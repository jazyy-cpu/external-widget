# Custom REST service in 3DSpace - how the widget performs operations

**The rule, stated by the user 2026-10-05:**

> "JPO will not help. In the widget we have to create the jar and with the API
> we have to do the operation from the widget."

**This is not new ground.** A working custom REST JAR was built, deployed and
verified on this VM on **2026-09-22**, and extended on 2026-10-03. The
authoritative build guide is
[`documents/technical-notes/2026-09-22-r2024x-custom-rest-api-jar.md`](../../../documents/technical-notes/2026-09-22-r2024x-custom-rest-api-jar.md);
this note is the widget-side view and does not repeat it.

---

## 1. Why a JPO is not reachable from the widget

A JPO is kernel-side Java invoked by something *inside* 3DSpace - an AEF
command, a table or form program, a trigger, or `exec program` from MQL. It has
no HTTP entry point.

The widget is a UWA widget served as static content by the Spring app
(`external-widget/`), registered in 3DDashboard as an Additional App on a
trusted domain. It runs in the browser and reaches 3DSpace only over **REST**,
with `tenant`, `SecurityContext=ctx::<credential>` and a CSRF token (rule R5).

The division is **who invokes it**:

| Invoked by | Mechanism | Examples here |
|---|---|---|
| The kernel (triggers) | **JPO** - correct, unaffected | Guard A `checkNoPersonOnDepartmentDomain`, Guard B `checkNoRatingOnPersonSkill` |
| The native AEF UI (commands, tables, forms) | **JPO** - correct, unaffected | `IRSDomainUI`, `IRSProjectUI`, `IRSApprovalRoute` |
| **The widget** | **custom REST service in a deployed JAR** | everything Annual Monitoring needs from the widget |

Nothing built so far has to be redone - both delete guards are kernel triggers,
so a JPO is exactly right for them.

## 2. What already exists on the VM

| Asset | Path | Note |
|---|---|---|
| Working project | `C:\dev\jar-creation\irs-hello-rest` | `src`, `build.ps1`, `MANIFEST.MF`, `dist` |
| Deployed JAR | `...\apache-tomee-plus-9.1.2\webapps\3dspace\WEB-INF\lib\irs-hello-rest-0.1.0.jar` | live, verified |
| Verified endpoints | `GET /3dspace/resources/v1/irs/hello`, `GET /3dspace/resources/v1/irs/signatures/{loginId}` | hello returns the authenticated user |
| **Decompiled platform JARs** | `C:\dev\jar-analysis\decompiled` | **1,437 folders** - includes `RestServicesInfra` and the shipped `ENOHistoryService`, the reference for how DS writes its own services |
| Compile-only references | `RestServicesInfra.jar`, `eMatrixServletRMI.jar`, `jakartaee-api-9.1.1-tomcat.jar`, `servlet-api.jar` | listed with SHA-256 in the technical note |

**Adding an Annual Monitoring service is a third class plus one line** in
`getServices()` - the modeler, the build script and the deployment path all
exist already.

## 3. The actual R2024x pattern - jakarta, not javax

This is the correction that matters most. The R2022x white paper shows
`javax.ws.rs`; on R2024x `ModelerBase extends jakarta.ws.rs.core.Application`
and **R2022x samples are not binary-compatible**. `RestService.authenticate` is
**deprecated** - use `getAuthenticatedContext`.

The live modeler on this VM:

```java
import com.dassault_systemes.platform.restServices.ModelerBase;
import jakarta.ws.rs.ApplicationPath;

@ApplicationPath("/resources/v1/irs")
public final class IrsHelloModeler extends ModelerBase {
    @Override
    public Class<?>[] getServices() {
        return new Class<?>[] { IrsHelloService.class, IrsSignatureService.class };
    }
}
```

The live service:

```java
import com.dassault_systemes.platform.restServices.RestService;
import jakarta.ws.rs.*;            // GET, Path, Produces
import jakarta.ws.rs.core.Context; // and Response, MediaType

@Path("/hello")
public final class IrsHelloService extends RestService {
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response hello(@Context HttpServletRequest request) {
        matrix.db.Context matrixContext = getAuthenticatedContext(request, false);
        ...
    }
}
```

Two things to carry into any new service:

- **`getAuthenticatedContext(request, false)` returns a `matrix.db.Context`** -
  the same type a JPO receives. So every framework call already proven in this
  project (`DomainObject`, `DomainRelationship`, `MqlUtil`, the REL2REL `torel`
  selects) works unchanged. Only the entry point and packaging differ.
  The `false` still requires a valid platform session but does not demand an
  explicit SecurityContext header; a production write endpoint must decide its
  own authorization deliberately.
- **The resource is a singleton.** One instance serves every call, so request
  and user data must stay in local variables - never in fields.

Java 17, `--release 17`, class major version 61.

## 3b. The working practice: prove it in a JPO, then move it into the JAR

**The user's method, stated 2026-10-05 - follow it.**

> "Generally how I do it: I test the code in a JPO and then put the code in the
> JAR. This saves our time."

The reason it works is the cost asymmetry, and it is large:

| Iteration | Cost |
|---|---|
| JPO | `exec prog MxUpdate --update --jpo <name> --compile` - **seconds**, no restart, and `exec program <name> <args>` runs it immediately with `System.out.println` coming back to the terminal |
| JAR | build, clean TomEE **stop**, guarded copy, start - **about 216 seconds**, because TomEE holds the old JAR open |

So a JAR redeploy is roughly two orders of magnitude more expensive than a JPO
compile. Debugging business logic through redeploys burns the day.

### Why the code moves across unchanged

Because both receive the **same object**. A JPO method is handed a
`matrix.db.Context`; `getAuthenticatedContext(request, false)` returns a
`matrix.db.Context`. Everything between those two lines - `DomainObject`,
`DomainRelationship`, `MqlUtil`, selects, REL2REL `torel` traversals - is
identical in either host. Only the entry point differs.

### How to apply it

1. **Write the logic as a plain method** taking `(Context context, ...)` and
   returning data, not `Response`. Keep it free of anything HTTP.
2. **Exercise it from a JPO** - the self-test entry point in
   `IRSDomainUI_mxJPO.mxMain` is the pattern already in use here: it takes
   arguments, calls the real method and prints the result, and it is how both
   delete guards were debugged (worklog `2026-10-05-09`, `2026-10-05-11`).
3. **Move the proven method into the service class**, and let the REST layer do
   only transport: read parameters, call the method, serialise JSON, map errors
   to status codes.
4. **Redeploy the JAR once**, when the logic is already known to be right.

### What this does NOT remove

The JAR still has to be deployed and tested at least once per endpoint, because
these are only exercised there:

- the JAX-RS plumbing - path mapping, parameter binding, JSON serialisation;
- authentication through `getAuthenticatedContext`, and the security context the
  widget sends;
- CSRF on writes, and the widget's request wrapper against a custom modeler path;
- **singleton behaviour** - a field that works in a single-threaded JPO test is
  a concurrency bug in an instance-mode REST resource.

That last one is worth repeating: the JPO test will not catch per-request state
stored in a field. Keep request and user data in local variables from the start.

## 4. Why this is a prerequisite, not a preference

`IRSRatedDomain` is a **REL2REL** (decision 2026-10-05). A rel2rel connection
can be created only through MQL or a web application - the generic OOTB REST
services model business objects, not connections-to-connections. So the
rating-to-domain link **cannot be created from the widget at all** without a
custom service. The same applies to `IRSPersonDepartmentDomain`, which the IRS
Skill page creates through `MqlUtil.mqlCommand` inside a JPO: fine for the AEF
page, unreachable from the widget.

## 5. What moves, and what stays

| Was planned as | Becomes |
|---|---|
| "creation JPO": assessment -> one report per member -> one rating per domain, compute Accumulated, attach division interfaces | a **POST on the custom REST service**, same Java inside |
| `computePoints` / `computeGrade` driven by attribute triggers | **unchanged** - kernel-side |
| Guards A and B | **unchanged** - kernel triggers |
| HOD / In-Charge check | read over REST for the UI, and enforced **again** inside the service, because a browser check is not a control |

## 6. Open questions

J1-J3 were answered by the September build; what is left is narrower.

| # | Question | Status |
|---|---|---|
| ~~J1~~ | Where does the JAR deploy, and what does a redeploy cost? | **Answered**: `webapps\3dspace\WEB-INF\lib`, and it needs a **TomEE restart of roughly 216 seconds**, with TomEE holding the old JAR open so a clean stop / copy / start is required. Budget for that per iteration |
| ~~J2~~ | Do the R2022x signatures hold on R2024x? | **No** - `jakarta`, not `javax`; `authenticate` deprecated. See section 3 |
| ~~J3~~ | Does authentication work? | **Partly**: an authenticated browser GET works, anonymous returns 302 to 3DPassport. **Still to prove: a write (POST) from the widget through the existing request wrapper**, with tenant, SecurityContext and CSRF, against a custom modeler path |
| J4 | How much can the OOTB REST services already do for plain objects and links, so the custom service stays small? | **open** |
| J5 | A direct copy into `WEB-INF\lib` **can be lost on a WAR rebuild**. The candidate persistent input is `C:\DassaultSystemes\R2024x\3DSpace\STAGING\ematrix\WEB-INF\lib` - confirm the packaging process before relying on the deployment | **open** |
| J6 | Authorization model for write endpoints: `getAuthenticatedContext(request, false)` only proves a session. The HOD / In-Charge check must be re-enforced server-side | **open** |

## 7. Sources

- **`documents/technical-notes/2026-09-22-r2024x-custom-rest-api-jar.md`** - the
  build guide: references with SHA-256, `build.ps1`, BOM-free staging, verify
  and deploy steps, troubleshooting. Read this before writing a service.
- Worklog `2026-09-22-04` (prototype), `2026-10-03-03` (signature service),
  `2026-10-06-01` (this correction).
- `AGENTS/3dexperience_windows_vm/config/VM-KNOWLEDGE.md`, 2026-09-22 entry -
  the jakarta/javax incompatibility and the Java 17 baseline.
- Live source on the VM: `C:\dev\jar-creation\irs-hello-rest\src`.
- *3DEXPERIENCE Widget Development Fundamentals R2022x v1.8*, pp. 243-247 -
  the concepts only; **its code does not compile against R2024x**.

---

## 8. The second JAR: `irs-project-rest` (2026-10-07)

The first custom service carrying real business logic, built on the user's
instruction *"lets create one new jar, and this jar return risk opportunity and
key learning in structured manner"*.

```http
GET /3dspace/resources/v1/irsproject/projects/{projectId}/context
```

returns, in one payload: the project header, its **risks**, its
**opportunities** (number, title, state - limited on purpose), and its **key
learnings** split into *created in this project* and *from other sources*, the
latter carrying the origin project's name and `EPMProjectNo`.

| | |
|---|---|
| Host master | `external-widget/rest-jar/irs-project-rest/` - its README has the payload, the error shapes and the open items |
| VM build copy | `C:\dev\jar-creation\irs-project-rest` |
| Status | **built, zero warnings, verified through its JPO twin. NOT deployed** - that needs the ~216s TomEE restart |
| Worklog | `worklog/entries/2026/2026-10-07-04_project-context-rest-service.md` |

Three things from this build are worth carrying into the next service.

**A separate application path, not a class added to the hello JAR.**
`irs-hello-rest` owns `/resources/v1/irs`; nesting a second JAX-RS application
beneath another's path makes which one serves a URL container-dependent. A
sibling path keeps the two JARs independent, so redeploying one cannot break the
smoke-test endpoint that proves the mechanism still works at all.

**Section 3b's practice, applied in full, and it paid.** The reader was written
as a JPO (`IRSProjectContext`), run against the live system, and only then moved
into the JAR. The whole payload was agreed before a single TomEE restart - and a
`StringList` deprecation and the entire four-round-trip read shape were settled
at JPO cost. The two copies are **twins**: if the reader changes, both change,
or the self-test proves nothing.

**The widget's id works.** MQL resolves the 3DSpace physical id
(`299036CE...`) that the widget already holds, as well as the legacy
`39261.35329...` form, and `physicalid` is a select - so every row returns both
and the widget can link back to what it read over REST. No id translation layer
is needed anywhere.

### It also answered an OOTB question

`GET /resources/v1/modeler/projects/{id}/risks` returned an empty list for TEST
PROJECT. The objects **are** connected by the OOTB `Risk` relationship, proven in
MQL - so the OOTB service is filtering (all four are `Complete`), not missing the
link. Reading the relationship directly is therefore a sound basis for the
widget, and **J4 gets a concrete data point**: for risks the OOTB service exists
but does not serve this case, and for opportunities there is no route at all.
