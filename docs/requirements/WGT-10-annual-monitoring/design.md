# WGT-10 - Design and code structure

| | |
|---|---|
| Status | **design only; nothing built** |
| Requirement | [README.md](README.md) |
| Design of record | [WP01 doc 10 §10](../../../../documents/work-packages/01-organization-master-data-skill-matrix/10-annual-monitoring.md) |

---

## 1. What is reused, and what is actually new

Almost nothing here is new UI. The point of this section is to make that
explicit, so the work is not over-estimated.

**Reused unchanged from `JazzySole/`:**

| Module | Job |
|---|---|
| `JazzySole/Request` | the one request wrapper (R3): 3DSpace root, tenant, SecurityContext, CSRF tracking and the single retry (R5) |
| `JazzySole/Router` | navigation that survives a refresh (R6) |
| `JazzySole/Ui/CredentialBar` | the credential picker, top right |
| `JazzySole/Ui/Format` | locale dates, Bootstrap badges as DOM nodes |
| `JazzySole/Notify` | messages |
| `JazzySole/TabulatorLoader` | loads the Tabulator UMD bundle past the AMD loader |
| `JazzySole/Tabulator` 6.5.3 + `tabulator_bootstrap5` | every grid |
| `JazzySole/bootstrap` 5.3.8 | layout, badges, forms |

**Patterns copied from existing packets:** `ListToolbar` (IRSProjects),
`ProjectHeader` → `ReportHeader`, `Tabs`, `FieldList`, and the form look that
WGT-07 built for the platform's Summary Report style - that is the closest
existing thing to a printed IRS form, and the person report should follow it
rather than invent a second house style.

**Genuinely new:** one thing only - the **editable rating grid with computed
columns and a live total** (§5). Everything else is a variation on a page that
already runs.

## 2. Routes

Through `JazzySole/Router`, state in a hidden preference (R6):

| Route | Page |
|---|---|
| `assessments` | rounds for the chosen department |
| `assessment/:id` | one round: its people, its training plans, its properties |
| `assessment/:id/report/:reportId` | one person's G15 report |
| `assessment/:id/matrix` | the G16 skill matrix for that round |

The department is **not** in the route. It is a user-level choice, like the
credential, so it lives in a preference beside `jzRoute`; a person who is HOD of
one department never sees the picker.

## 3. Modules

`WidgetPacket/IRSAnnualMonitoring/js/`, one AMD module per file (R4):

| Module | Job |
|---|---|
| `config/AssessmentFields` | states, `$fields` lists, grade badge colours, the 228-day ceiling, the Note block text - **the only file to edit when the data model changes** |
| `config/RatingColumns` | the rating grid's column definitions, including the computed ones |
| `services/ResponsibilityService` | which departments the signed-in person is HOD or In-Charge of |
| `services/AssessmentService` | list rounds, read one, create one, complete one |
| `services/ReportService` | one person's report: ratings, projects, trainings |
| `services/OfferingService` | `RELEASED` offerings for the recommendation picker |
| `components/DepartmentPicker` | shown only when the person has more than one |
| `components/ReportHeader` | person, department, round, state badge |
| `components/NoteBlock` | the points and grade rules, rendered under the ratings (A9) |
| `components/ExportBar` | Excel / PDF / print, per report |
| `views/AssessmentListView`, `AssessmentDetailView`, `PersonReportView`, `SkillMatrixView` | the four pages |
| `App.js` | UWA lifecycle, credential bar, department picker, page switching |
| `css/IRSAnnualMonitoring.css` | the only custom CSS, all under `.irs-annual` (R1) |

## 4. The four pages

### 4.1 `assessments` - rounds

Credential bar and department picker at the top, then a Tabulator grid: Title,
Year, Start, End, State, reports total / complete. (No Period column: H1 / H2
were removed on 2026-10-14 - they were in no customer document, and there is one
round per department per year.) Toolbar in the
IRSProjects shape - a switch for completed rounds, one search control, Clear,
Refresh - plus **New assessment**, rendered only when the person is HOD or
In-Charge of the selected department (A1).

In the **New assessment** panel the **year is the only real input**: the
April-March range and the suggested title are both derived from it through
`Fields.rangeForYear` and `Fields.suggestedTitle`, and both follow it as it is
typed (a title the HOD has typed is left alone). The date pickers remain, for
testing a shorter window; the agreed direction is to remove them and the year
box too, defaulting to the current financial year, at which point the panel
loses three fields and gains no logic. A server-side refusal of a range that
does not contain its own year was **considered and parked** on the user's
decision (2026-10-14): once nothing can be chosen, there is nothing to refuse.

### 4.2 `assessment/:id` - the round

`ReportHeader` over `Tabs`:

- **People** - one row per `IRSAnnualMonitoring`: person, designation, domains
  rated, state. Click through to the report.
- **Training plans** - the connected `EPMDepartmentTrainingPlan`s, with Add.
- **Properties** - `FieldList`: year, period, date range.

Action **Complete round**, disabled while any report is open (A14). The disable
is courtesy; the platform refuses it anyway (A15).

### 4.3 `assessment/:id/report/:reportId` - the person's G15 report

**This is the page that matters**, because it replaces paper. Sections in the
order of R&D-AM-HY, using WGT-07's form look:

1. **Header** - name, designation, department, round, state.
2. **Projects handled** - read-only grid: Project No, Name, Nature of Work,
   Start / Completion. Nature of Work has no source yet (doc 10 §10.5).
3. **Trainings undergone** - read-only list.
4. **Rating** - the editable grid, §5 below, with the **Note block underneath**.
5. **HOD judgement** - R&D only, from `IRSRnDMonitoring`: competence maintained,
   proposed action, area of improvement, TIRA entry. Rendered only when the
   object carries the interface.
6. **Training recommended** - picker over `RELEASED` offerings (A12).
7. **Export bar** - Excel, PDF, Print (A13).

### 4.4 `assessment/:id/matrix` - G16

Persons as rows, **all** department domains as columns, cell = grade badge, NA
where no rating exists. Rows and columns come from different sets on purpose -
see doc 10 §10.6.

## 5. The rating grid - the one new pattern

Plain Tabulator 6.5.3. Columns:

| Column | Behaviour |
|---|---|
| Domain | **frozen**, so it stays visible while the rest scrolls |
| Accumulated | read-only, from the stored value |
| **Man-days** | the **only input**; `editor: "number"` |
| Current Year | **computed, read-only**: `min(10, 0.044 × man-days)`, recalculated in the cell as the user types |
| Grade | **computed, read-only**, badge: `≥20 A`, `≥10 B`, `>0 C`, `0 Not Assessed` |
| Worked in last 5 yrs | R&D only, `Yes/No`; rendered only when the rating carries `IRSRnDRating` |

`columnCalcs: "bottom"` gives the **man-days total row** for free - which is how
the 228-day ceiling becomes visible while typing (A8). `selectableRange` and
`clipboard` let the HOD paste a column of man-days from a real spreadsheet.

Two rules worth stating because they are easy to get wrong:

- **The browser computation is for feedback only.** Points and grade are
  written by the server from the stored man-days; the cell formula exists so the
  HOD sees the effect immediately, not so the browser decides the number.
- **The ceiling is enforced server-side.** A browser total is a courtesy; the
  service re-checks the sum before saving (A8).

## 6. Data flow

```
UWA onLoad ─► App.start
                ├─ Credentials.init()                   (WGT-03)
                ├─ ResponsibilityService.departments()   → HOD / In-Charge list
                ├─ DepartmentPicker (only if > 1)
                └─ Router → one of the four views
```

A credential change re-renders the page, as in WGT-01: a different security
context can see a different set of objects.

## 7. Reads vs writes - what needs the JAR

| Operation | Route |
|---|---|
| Which departments am I HOD of | read - `IRSResponsibility` traversal. **O1**: can OOTB REST return this, or does it need the service? |
| List rounds, reports, ratings, projects, trainings | read - OOTB REST if it can return custom types; otherwise the service |
| **Create a round** (assessment + one report per member + one rating per domain, compute Accumulated, attach interfaces) | **the service.** Too many linked writes for a client to compose, and it must be one transaction |
| **Write a rating's man-days** (then compute points, grade, re-check the ceiling) | **the service** |
| **Connect a rating to its department+domain** | **the service only** - `IRSRatedDomain` is a REL2REL and OOTB REST cannot create one |
| Complete a round | **the service** - it must verify every report first |

Per the JPO-first practice (rule R8): each of these is written and debugged as a
plain `(Context, ...)` method exercised from a JPO self-test, then moved into the
service class. A JAR redeploy costs a ~216-second TomEE restart, so the logic
should be right before it goes in.

## 8. Build order

Deliberately front-loads the two unknowns, then follows WGT-01's read-only-first
shape.

| Step | What | Why here |
|---|---|---|
| 0 | **Spike: one POST** from the widget through the request wrapper to a throwaway endpoint on the existing JAR | B2. Nothing past step 3 is safe to plan until a write works |
| 0b | **E1**: does a Tabulator download work in the dashboard iframe | B3, user is testing. Decides whether export is client- or server-side |
| 1 | `ResponsibilityService` + department picker, read-only | smallest real slice; proves A1-A3 with real accounts |
| 2 | Rounds list, read-only | answers O1 - whether OOTB REST reads our types |
| 3 | Round detail, read-only | |
| 4 | Person report, read-only, including the Note block | the form look, without writes |
| 5 | **Creation service in the JAR** + New assessment | first real write; needs step 0 |
| 6 | Rating grid editable + points/grade + ceiling | the core of the feature |
| 7 | Projects and trainings feeds | |
| 8 | Export and print | needs 0b |
| 9 | Skill matrix | |
| 10 | Complete round | |

**Corrected 2026-10-10, after O1 was tested** ([api.md](api.md)): 3DSearch does
return our custom types - identity, Title, type, policy, **state**, dates, owner
and department - so a list grid is OOTB. But it returns **no custom attribute
values** and **no relationships**, and the rating's domain is a REL2REL that
OOTB REST cannot read at all.

So only the *shell* of steps 2-4 is free. The year, period and date range on a
round, and everything under it, need either an OOTB detail service that expands
custom attributes (**O7**, worth answering first - the Project Web Services do
this for EPM attributes) or the JAR. **The JAR is needed earlier than this
order implies.**

One prerequisite before step 2 either way: the three Annual Monitoring types
have **never been indexed**, so search will not find them even once objects
exist (**O8**).

## 9. Open items

Carried from [README.md](README.md) §7, plus:

| # | Item |
|---|---|
| D1 | Does the person report need its own print stylesheet, or does WGT-07's form look already print acceptably? |
| D2 | Whether the rating grid should offer all department domains greyed out, rather than hiding the ones the person lacks - the user said "not show **or** NA" and either is allowed |
| D3 | Where the department choice lives if a person is HOD of departments in **different** Business Units - the division interfaces differ, so a round is per department anyway, but the picker grouping matters |
