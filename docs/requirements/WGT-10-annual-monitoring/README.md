# WGT-10 - Annual Monitoring report (G15) and Skill Matrix (G16)

| | |
|---|---|
| Work package | [WP01](../../../../documents/work-packages/01-organization-master-data-skill-matrix/README.md) |
| Design of record | [WP01 doc 10](../../../../documents/work-packages/01-organization-master-data-skill-matrix/10-annual-monitoring.md) - **read §10 before this page** |
| Status | **working end to end (2026-10-14).** A round is created from the widget and verified in the database: the assessment, one report per member, one rating per domain held, the R&D interfaces and the REL2REL links. Listing, the HOD check and both refusals are live. One round per department per year (H1/H2 removed). **Resume at "Next" below** - [api.md](api.md) |
| Source | R&D requirement G15/G16; forms R&D-AM-HY/-ST/-RR/-LS Rev.04 and RDAREA-AM-FS/-SR; user instructions 2026-10-05 |
| Widget | `WidgetPacket/IRSAnnualMonitoring/` (new packet) |

> **Id note:** the user asked for "WGT-09", but that id is already the approval
> route, built 2026-10-08. This is **WGT-10**. WGT-05 was never used and is left
> free rather than back-filled, so the numbering stays chronological.

---

## 1. What was asked

The user's flow, 2026-10-05:

1. **On login, check whether the person is an HOD.** From the person, read the
   connected department and the role. **An annual monitoring object can be
   created by the HOD only** - later widened: **In-Charge as well**, because the
   forms sign off as "In-Charge/HOD".
2. **The HOD sees only their own department.**
3. The HOD **creates the master annual monitoring object**. A department can
   have **many** reports over time.
4. While creating it, **connect the training projects**, and later read from
   them what training each person did.
5. Once the master object exists, **the department's people appear under it
   automatically**, and **each person's report then runs its own lifecycle**.
6. **Projects are filled in from the financial year** - the master object
   carries a start and end date, defaulting to April-March, changeable so a
   department can assess a shorter window. A project counts if it falls in
   that range and the person is a member.
7. **Trainings undergone** come from the training tasks the person is assigned
   to in the connected training plans.
8. **Training recommendation** is picked from the released training offering
   documents - latest revision.
9. **Domain rating** uses the skills already captured at department level; only
   the **formula** had to be settled.
10. Reuse the **look and feel of the older widget**, and the **same Tabulator**.
11. Show the data **Excel-style in Tabulator** - plain Tabulator, **not
    Luckysheet**.
12. **Each person's report must print and export to Excel.**

## 2. What is already decided

All of it is in [WP01 doc 10 §10](../../../../documents/work-packages/01-organization-master-data-skill-matrix/10-annual-monitoring.md),
which is the design of record. The points that shape this UI:

| | Decision |
|---|---|
| Who may create | **HOD and In-Charge**, resolved through `IRSResponsibility` / `IRSResponsibilityRole`. A person can be HOD of **more than one** department, so the widget needs a **department picker** |
| Rating rows | the person's **own** domains, from their standing skill list - **not** every department domain. A domain they do not hold is hidden or shown **NA**. This deviates from the printed form on purpose |
| Points | **computed, never typed**: `min(10, 0.044 × man-days)` per domain per year. The HOD enters **man-days**; the system enters points |
| The Note block | the customer asked for the **rule text to be rendered on the form**, not just the result |
| Closing a round | the HOD closes it **manually**, once every person report is complete |
| Date range | April-March default, editable; selection is an **overlap test**, not "start or end inside the range" |
| Offerings | only **`RELEASED`** documents are selectable |
| Export | plain Tabulator; CSV free, XLSX and PDF add libraries - [WP03 02](../../../../documents/work-packages/03-project-widget/02-grid-export-and-print.md) |

## 3. What exists to build on

**On the platform (built and verified 2026-10-05):** `IRSSkillAssessment`,
`IRSAnnualMonitoring`, `IRSDomainRating`, the `IRSSkillAssessment` policy
(Draft → In Assessment → Completed), interfaces `IRSRnDRating` /
`IRSRnDMonitoring`, six relationships including the `IRSRatedDomain` REL2REL,
and `ASM-` / `AMR-` / `RAT-` generators. Both delete guards are live.

**Nothing behaves yet** - no creation logic, no points/grade computation, no
project or training feed.

**In the widget project:** `JazzySole` already provides the request wrapper,
router, credential bar, formatters, notifications, Tabulator and Bootstrap. Three
widget packets exist to copy from, `IRSProjects`, `IRSTasks` and the task page.

## 4. Blockers - none of this is cosmetic

| # | Blocker | Why it gates the work |
|---|---|---|
| **B1** | **The widget cannot call a JPO.** Creation and every write go in the **custom REST JAR** | `IRSRatedDomain` is a REL2REL, and a rel2rel can be created only through MQL or a web application - never through OOTB REST. So the rating cannot be written from the widget without the service. See [custom-rest-service.md](../../reference/custom-rest-service.md) |
| **B2** | **A write from the widget has never been proven.** Only authenticated GETs have been tested against a custom modeler path | Every page past read-only depends on a POST working through the request wrapper with tenant, SecurityContext and CSRF |
| **B3** | **E1 - does a Tabulator download work inside the 3DDashboard iframe?** | Blob + synthetic anchor click can be blocked by the iframe sandbox or CSP. The user will test this. If it fails, export moves server-side ([WP05](../../../../documents/work-packages/05-approval-output-pdf-and-jobs/README.md)) |
| **B4** | **Q13 - man-days has no source.** No project→domain link, no per-person effort | Decides whether the HOD types a judgement or the system measures. Does not block the UI, but it decides whether the man-days column is an input or a read-only roll-up |

B1 and B2 are sequencing, not design: the read-only pages can be built first.

## 5. Acceptance checks

Unticked until seen working in 3DDashboard, not in a unit test.

| # | Check |
|---|---|
| A1 | A person who is **neither HOD nor In-Charge** of any department sees no create action and no department list |
| A2 | A person who is HOD of **two** departments gets a picker and sees only those two |
| A3 | `admin_platform` (HOD of HY) and `PlmUser2` (In-Charge of HY) both reach the same department; `PlmUser1` (Division Head of the BU) is handled per §8 O4 |
| A4 | The rounds grid lists only the chosen department's assessments, newest first, with year, period, range and state |
| A5 | Creating a round writes the date range, year and period, connects the department, and creates **one report per Person member** |
| A6 | Each report lists **only that person's own domains** as rating rows |
| A7 | Entering man-days updates the points column **without a round trip**, and the grade follows the stored thresholds |
| A8 | The per-person **man-days total** is visible against the 228-day ceiling, and exceeding it is refused server-side, not only warned in the browser |
| A9 | The **Note block** (the points and grade rules) is rendered under the rating table |
| A10 | Projects listed for a person match the **overlap test**, including a project that starts before and ends after the range, and one with an empty finish date |
| A11 | Trainings listed are `Complete` `EPMTRAINING_TASK` objects under the **connected** plans only |
| A12 | The training recommendation picker offers **only `RELEASED`** offerings |
| A13 | A person's report **exports to Excel** and **prints** in a form that resembles R&D-AM-HY, not a raw grid |
| A14 | The round cannot be completed while any person report is open; completing it is a **deliberate HOD action** |
| A15 | A completed round is read-only everywhere in the UI, and the platform refuses a write even if the UI is bypassed |
| A16 | Navigation survives a browser refresh (rule R6) on every page |

## 6. Out of scope here

- The G16 Skill Matrix **export format** beyond a grid - agreed as a later step.
- Approval routing to the Division Head: doc 10 Q5 is unsettled, and the policy
  deliberately has no DH state.
- New-joiner resume attachment - approved in principle, not specified.

## 7. Open items

| # | Item |
|---|---|
| ~~O1~~ | ~~Which OOTB REST services can read our custom types~~ | **Answered 2026-10-10** — 3DSearch returns our custom types with id, Title, name, type, policy, **state**, dates, owner and department, but **not** custom attribute values and **not** relationships. See [api.md](api.md). Follow-on: **O7** |
| O2 | Whether the department picker should also offer departments where the user is **only** a member (read-only view) or strictly HOD/In-Charge |
| O3 | What a person with **no domains** should see - an empty report, or no report created at all |
| O4 | Whether a **Division Head** sees every department in the BU read-only |
| O5 | Whether the man-days column is editable at all once Q13 is answered |
| O6 | Where the Note block text lives - hardcoded, a JSON file like WGT-07's form descriptors, or read from the platform |
| **O7** | **Is there an OOTB detail/expand service that returns custom attributes and relationships for a plain business object?** The Project Web Services do it for EPM attributes; if an equivalent exists the REST JAR shrinks a lot. Answer this before writing service code |
| O8 | The three Annual Monitoring types have **never been indexed**, so federated search will not find them even once objects exist. `update searchindex type` for all three, after a `searchindexcustom` commit - prerequisite for step 2 |

## 8. Related

- [design.md](design.md) - pages, modules, data flow, the rating grid
- [WP01 doc 10](../../../../documents/work-packages/01-organization-master-data-skill-matrix/10-annual-monitoring.md) §10 - design of record
- [custom-rest-service.md](../../reference/custom-rest-service.md) - why writes need the JAR, and the JPO-first practice
- [WP03 02-grid-export-and-print.md](../../../../documents/work-packages/03-project-widget/02-grid-export-and-print.md) - export libraries and licensing
- [WGT-08](../WGT-08-training-management/README.md) - the training side this consumes

## Next — where to resume (2026-10-14, end of session)

**Two deploys are pending and neither is mine to run:**

1. ~~**Restart the Spring widget app.**~~ **Done 2026-10-14.** The warning toast
   was confirmed in 3DDashboard: *"Hydrodynamics and Multiphysics already has an
   assessment round for 2026: ASM-0000005. There is one round per department per
   year."* The refusal still appears **twice** — as the toast and as the red box
   inside the panel. Decide whether the inline box earns its place.

**Then, in order:**

2. ~~**Year / title / date mismatch.**~~ **Done 2026-10-14 (widget half).** The
   panel now derives the April–March range and the suggested title from the
   year, through `Fields.rangeForYear` / `Fields.suggestedTitle`, and follows it
   as it is typed; a title the HOD has typed is left alone. 29 unit checks pass.
   **Needs the Spring restart above to be seen.**

   The server-side half — refusing a range that does not contain its own year —
   is **parked by decision, not forgotten**: the direction is that the year and
   the dates stop being chosen at all (current financial year, fixed 1 Apr –
   31 Mar), and a refusal is only needed while something can be chosen. Close it
   when the pickers are removed. See
   [devlog 2026-10-14-04](../../devlog/2026/2026-10-14-04_year-drives-title-and-range.md).
3. **The rating grid** — division-aware columns (doc 10 §4): R&D gets an
   editable *Current Year* and *Worked in last 5 yrs*; AR gets *Mandays spent*
   with points read-only.
4. **Points and grade triggers**, division-aware, with the per-person ceiling
   (AR: man-days ≤ 228; R&D: Σ points ≤ 10, pending **Q14**).
5. **The create-check trigger** for one-round-per-year. The Java check is a
   courtesy — two heads pressing Create together both pass it.
6. **G16 skill matrix** as a live view over the open round (doc 10 §11).

**Smaller, carried:** dates render as `4/1/2026 12:00:00 AM` (format in the
reader); the `Reports` column is empty; round creation is **not atomic** and
should become resumable.

**Waiting on the customer:** Q1 (Grade C threshold), Q14 (R&D cap: shared per
person or per domain), Q15 (the man-days column on the R&D to-be form), Q16
(which round feeds the matrix), Q5 (HOD only or HOD→DH), Q13 (man-days source,
RDAREA only now).

**Not demonstrated:** two departments running the same year. The code is scoped
per department and the refusal names it, but only `0000000001` has an HOD or
In-Charge configured, so nobody can create a round elsewhere. One
`IRSResponsibility` connection would let this be proven.

**Live test data: none.** All three rounds and their twelve children were
deleted on 2026-10-14 (worklog
[2026-10-14-30](../../../../worklog/entries/2026/2026-10-14-30_annual-monitoring-test-data-cleared.md)),
two of them being mislabelled by the year/date defect since fixed. The next
round created will be `ASM-0000008`.

**Decide before step 3:** WP01 doc 10 §4 parked where `IRSMandaysSpent` lives —
a new `IRSARRating` interface, or left on the base type and unused by R&D —
noting it is free of migration only while no rating exists. That is true again
now, and stops being true with the first round created. Recommendation: **leave
it on the base type**; an `IRSARRating` interface buys symmetry and nothing
else, since the division branch in `computePoints` is needed either way.
