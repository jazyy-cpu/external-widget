# WGT-10 - API

Tested 2026-10-10 against the dev VM through the ENOVIA API Labs MCP server
(profile `enovia-on-premise`, read-only). This page answers **O1**: how much of
the widget can be built on OOTB REST, and where the custom REST JAR becomes
unavoidable.

---

## 1. The answer in one line

**3DSearch returns our custom types, but not their custom attributes and not
their relationships.** So list pages are OOTB; everything that needs an
attribute value or a link needs more.

## 2. Federated search DOES return custom types - verified

```
flattenedtaxonomies:"types/IRSDomain"      -> 35 hits
flattenedtaxonomies:"types/DMPTrainingOffering" + name:"TOF-0000010" -> 1 hit
```

No special configuration, no custom service. What comes back per hit:

| Field | Example | Use in WGT-10 |
|---|---|---|
| `physicalId` / `physicalid` | `299036CE000036706AB15A8D00000004` | the id for any follow-up call |
| `ds6w:label` | `Computational Fluid Dynamics` | the Title - the display name |
| `name` | `DOM-0000001` | the generated code |
| `ds6w:what/ds6w:type` | `IRSDomain` | our subtype, returned as-is |
| `ds6w:what/ds6w:policy` | `IRSDomain` | |
| **`ds6w:what/ds6w:status`** | **`IRSDomain.Active`** | **policy.state together** - this is the state badge |
| `ds6w:when/ds6w:created`, `...modified` | `2026/09/21` | |
| `ds6w:who/ds6w:responsible`, `...lastModifiedBy` | `Sharad S Dhavalikar` | |
| `ds6w:where/ds6w:context/ds6w:project` | `Hydrodynamics and Multiphysics` | the collaborative space |
| `ds6w:who/ds6w:responsible/ds6w:organizationResponsible` | `0000000001` | **the department id** |

That is enough for a landing grid: id, title, code, type, state, dates, owner,
and the owning organization. **Steps 2-4 of the build order need no JAR work.**

## 3. What search does NOT return

### 3.1 Custom attribute values

`TOF-0000010` has six DMC attributes (`DMPTrainingStartDate`,
`DMPTrainingCategory`, `DMPTrainingMode`, ...). **None of them appear** in the
hit. Only the `ds6w:*` standard set comes back.

This matters directly: `IRSAssessmentYear`, `IRSAssessmentPeriod`, the date
range, and every rating value (`IRSMandaysSpent`, `IRSCurrentYearPoints`,
`IRSAccumulatedPoints`, `IRSGrade`) are custom attributes. **A rounds grid
showing year and period cannot be fed by search alone.**

Two ways out, in order of preference:

1. a **detail call** that does return custom attributes - the Project Web
   Services do exactly this for `EPMProjectNo` and the other EPM attributes
   ([WGT-01 api.md](../WGT-01-project-landing/api.md) §2), so an equivalent for
   plain business objects is worth finding before writing service code;
2. our **custom REST service**, which can select anything.

### 3.2 Relationships, and REL2REL at all

Search indexes **objects**, not links. So none of these are answerable here:

- which departments a person is HOD of - `IRSResponsibility` traversal (**step 1
  of the build order**);
- the reports under a round, the ratings under a report;
- the rating's domain, which is a **REL2REL** (`IRSRatedDomain`) and cannot be
  read or written through OOTB REST at all.

### 3.3 A prerequisite nobody has met yet

`IRSDomain` and `DMPTrainingOffering` are searchable because they were
**indexed** - the `searchindexcustom` work of 2026-10-04/05. The three Annual
Monitoring types are **brand new and have never been indexed**, so
`flattenedtaxonomies:"types/IRSSkillAssessment"` will return nothing even once
objects exist.

Before step 2, they need the same treatment:

```mql
set system searchindexcustom file "...\custo-<date>.xml" force;
update searchindex type IRSSkillAssessment;
update searchindex type IRSAnnualMonitoring;
update searchindex type IRSDomainRating;
```

The recipe, and the trap that `update searchindex type` alone is a no-op while
the CloudView config is stale, are in VM-KNOWLEDGE (2026-10-04).

## 4. Incidental finding: the offerings are RELEASED now

`TOF-0000010` came back as **`Document Release.RELEASED`**, modified
2026-10-08. When doc 09 was written every offering sat in `IN_WORK`, which was
recorded as the thing blocking the training feed. The user has released them
since, so the "only `RELEASED` offerings are selectable" rule (A12) now has real
data behind it.

Also note `ds6w:who/ds6w:responsible/ds6w:organizationResponsible` = `0000000001`
on that document - the department id travels with the object, which may save a
traversal when filtering offerings per department.

## 5. Consequences for the build order

| Step | Needs |
|---|---|
| 1 - who am I HOD of | **not search.** A relationship traversal - find an OOTB route, else the service |
| 2 - rounds list | search for identity and state; **plus** a detail call for year / period / range |
| 3 - round detail | the reports under a round are a relationship - see step 1 |
| 4 - person report | ratings, projects, trainings are all relationships |
| 5+ - every write | the service (B1) |

So the honest position: **search gets the widget onto the screen, and almost
nothing past that.** The JAR is needed earlier than the build order implied.
Before writing it, answer §3.1 option 1 - whether an OOTB detail service returns
custom attributes and expands relationships for a plain business object - since
that decides how much the service has to do.

## 6. Not yet tested

- An OOTB detail/expand service for a non-project custom type.
- Whether the request wrapper's `tenant` / `SecurityContext` / CSRF work against
  a custom modeler path (**B2**), and a POST at all.
- Paging and sorting on federated search for a grid of any size.
