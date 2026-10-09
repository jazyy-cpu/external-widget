# irs-project-rest - the IRCLASS project REST service

One GET that returns a project's **risks**, **opportunities** and **key
learnings** in one structured payload, for the project and task widgets.

| | |
|---|---|
| Status | **deployed to TomEE 2026-10-08** (byte-identical copy verified); awaiting the first live call after the restart |
| Built | 2026-10-07 |
| Artifact | `dist/irs-project-rest-0.1.0.jar` - 8,910 bytes, SHA-256 `D7722C5470E0F8F9F675EB514047E0C4A0EC9E0AEEFA82BF0BEDDB292B31826D`, Java 17 (class major 61) |
| Host master | this folder. The VM copy `C:\dev\jar-creation\irs-project-rest` is the **build** copy - keep them identical |
| Build guide | `documents/technical-notes/2026-09-22-r2024x-custom-rest-api-jar.md` - read it before changing anything here |
| Worklog | `worklog/entries/2026/2026-10-07-04_project-context-rest-service.md` |

## The endpoint

```http
GET /3dspace/resources/v1/irsproject/projects/{projectId}/context
Accept: application/json
```

`{projectId}` may be either id form. MQL resolves the REST physical id
(`299036CE0000CE606AC6711700000E70`) and the legacy id
(`39261.35329.61044.62131`) interchangeably, verified 2026-10-07 - so the
widget passes the id it already holds from the OOTB REST calls.

### The payload, as measured on TEST PROJECT

```json
{
  "project":  { "id", "physicalId", "name", "title", "projectNo", "type", "state" },
  "risks":         [ { "id", "physicalId", "no", "revision", "title", "state", "type" } ],
  "opportunities": [ { "id", "physicalId", "no", "revision", "title", "state", "type" } ],
  "learnings": {
    "createdInThisProject": [ { "id", "physicalId", "no", "title", "text", "state" } ],
    "fromOtherSources":     [ { "...", "originProject": { "physicalId", "name", "title", "projectNo" } } ],
    "error": ""
  },
  "counts":    { "risks", "opportunities", "learningsCreatedInThisProject", "learningsFromOtherSources" },
  "riskError": ""
}
```

Every value is a **string**, including the counts. That is deliberate: the
platform returns strings, and converting them here would mean deciding what an
unparseable value means in the wrong layer.

Risks and opportunities carry **limited information on purpose** (number, title,
state) - the user's scope. A row's scoring lives on the object and can be
fetched per row from the OOTB `GET /resources/v1/modeler/risks/{id}` where it is
actually wanted, which keeps this call one page-load rather than N.

### Errors

One shape for every failure, so the widget needs one branch:

```json
{ "error": { "status": 404, "code": "PROJECT_NOT_FOUND", "message": "..." } }
```

| Status | Code | When |
|---|---|---|
| 400 | `MISSING_PROJECT_ID` / `BAD_PROJECT_ID` | no id, or a blank one |
| 401 | `NOT_AUTHENTICATED` | no valid platform session |
| 404 | `PROJECT_NOT_FOUND` | the id is not an object |
| 500 | `READ_FAILED` | the read itself failed; the kernel's own wording is passed through, never a stack trace |

A **section** that fails does not fail the call: `riskError` and
`learnings.error` carry the reason while the rest of the payload is still
served. An empty list and a failed read are different facts, and a screen that
confuses them tells the user something false.

## Why this service exists at all

Checked against what DS ships first (CLAUDE.md rule), and the gap is real:

| | OOTB REST | Here |
|---|---|---|
| Risks | `GET /projects/{id}/risks` exists and answers 200 - but returned an **empty list** for TEST PROJECT while the `Risk` relationship holds four objects | reads the relationship directly: 2 risks, 2 opportunities |
| Opportunities | **no route at all** - an Opportunity id on `/risks/{id}` returns `data: []` | same call, split by `type.kindof[Opportunity]` |
| Key learnings | `IRSLearning` is ours, so nothing OOTB knows it | both relationships, with the origin project |

Evidence: worklog `2026-10-07-03` (the OOTB probe) and `2026-10-07-04` (this
build).

## Layout

```
src/main/java/com/irclass/platform/rest/project/
  IrsProjectModeler.java       @ApplicationPath("/resources/v1/irsproject")
  ProjectContextService.java   transport only - paths, status codes, headers
  ProjectContextReader.java    the business + data access. TWIN of the JPO
  JsonValues.java              Map/List/String -> JSON-P, one generic converter
MANIFEST.MF                    keep its trailing blank line
build.ps1                      runs INSIDE the VM only
```

`build/` and `dist/` are generated.

### The JPO twin

`mxupdate/custom/program/jpo/IRSProjectContext_mxJPO.java` holds the **same
reader body** plus a self-test:

```mql
exec prog MxUpdate --update --jpo IRSProjectContext --compile --path "C:\dev\mxupdate\custom";
exec program IRSProjectContext 299036CE0000CE606AC6711700000E70;
```

It prints the exact payload in seconds. A JAR redeploy costs a ~216-second
TomEE restart, so the logic is always proven there first. **If the reader
changes, change both** - a drifted twin proves nothing.

## Build

Inside the VM:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\dev\jar-creation\irs-project-rest\build.ps1
```

It validates the five compile references, stages BOM-free copies (the guarded VM
writer emits a BOM and javac rejects it), compiles with `--release 17 -Xlint:all`,
and refuses to finish if a required class is missing **or if a platform class got
bundled**. Current build: zero warnings.

`xerinfra.jar` is the one reference the hello JAR does not need - this service
calls `DomainObject`, `DomainConstants`, `MapList` and `PropertyUtil`.

## Deploy - not done yet

```powershell
# TomEE holds the old JAR open, so a clean stop / copy / start is required
C:\DassaultSystemes\TomEE\3DSpaceCas\apache-tomee-plus-9.1.2\webapps\3dspace\WEB-INF\lib\
```

Startup takes roughly **216 seconds**, and it interrupts every 3DSpace session -
so it is scheduled with the user, never done unannounced. A direct copy into
`WEB-INF\lib` **can be lost on a WAR rebuild** (open item J5 of the build
guide); the candidate persistent input is
`C:\DassaultSystemes\R2024x\3DSpace\STAGING\ematrix\WEB-INF\lib`.

## Open items

| # | Item |
|---|---|
| ~~P1~~ | ~~**Deploy and call it**~~ - **done 2026-10-09**. Deployed and called live on TEST PROJECT with `?$include=members`; the JAX-RS registration logged `invalids=0`, the authenticated context resolved, and `?$include=member` correctly returned `400 BAD_INCLUDE`. Worklog 2026-10-09-02 |
| P2 | `looksMissing` classifies a 404 by matching the kernel's message text. Brittle; the alternative is an extra existence round trip per call. Wrong guess = a 500 where a 404 was due, never wrong data |
| P3 | The four risks on TEST PROJECT are all `Complete`. Whether the panel should show closed ones, or filter by state, is a UI decision not yet taken - the service returns all and lets the page decide |
| P4 | `project.title` came back **empty** for both TEST PROJECT and Solize XYZ. `name` is populated. Confirm whether `Title` is simply unused on projects before a screen leans on it |
| P5 | No write endpoint. When one is added, `getAuthenticatedContext(request, false)` proves only a session - authorization must be decided explicitly (build guide J6) |
| P6 | Opportunity scoring has no OOTB by-id route either, so an opportunity's detail still has nowhere to come from except a second service here |
