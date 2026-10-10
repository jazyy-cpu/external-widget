# WGT-07 - The task page: context sidebar, and the form driven by a JSON file

| | |
|---|---|
| Work package | [WP06](../../../../documents/work-packages/06-task-approval-widget/README.md) |
| Status | **PROJECT PROPOSAL / PROFILE built 2026-10-07, read-only.** Not yet opened in 3DDashboard |
| Source | user instructions 2026-10-07 |
| Widget | `WidgetPacket/IRSTasks/` - `views/TaskDetailView.js`, `services/TaskDetailService.js`, `data/forms/*.json` |

## What was asked

> "when we click on task we want to show some data, based on the form - for each
> form we should have some json file, so that we change the json file that what
> data we want to show ... based on the task state we can give edit option for
> some task not all task if task in inwork ... first we will work on the PROJECT
> PROPOSAL / PROFILE task ... we need to make the api call to the project and get
> the attributes in the project and first show this data ... when we open the
> task we will have one side bar where we will show some data and on the main
> page we show the content of the task."

Five requirements, taken one at a time:

| # | Requirement | State |
|---|---|---|
| 1 | Clicking a task opens a page showing its data | **built** |
| 2 | **One JSON file per form** decides what is shown | **built** - `js/data/forms/<id>.json` |
| 3 | Sidebar with context, main area with the form's content | **built** |
| 4 | PROJECT PROPOSAL / PROFILE first, its data read **from the project** | **built** |
| 5 | Edit only when the task is In Work | **rule built, control not.** The page states which it is |

## Why the proposal form reads the project

Measured on the live capture (`As-Is  Understanding/manual logs/ABCLogs`, 65
tasks, 2026-10-07): **`$fields=basics` already returns a task's own custom
attributes**, and what each subtype carries is

| Task subtype | Its own attributes in the response |
|---|---|
| `EPMPROJECT_PROPOSAL` | **none** |
| `EPMPROJECT_PERSONNEL_COST` | `EPMChangeOfScope` |
| `EPMPROJECT_STAGE_VALIDATION` | `EPMValidationDetails`, `EPMValidationRemarks` |
| `EPMPROJECT_REVIEW` | all seven G7 attributes |

So the user's instruction is also what the data says: the PROJECT PROPOSAL /
PROFILE form has **no content of its own** - it is a view of the project. The
page therefore makes two calls, in parallel:

    GET resources/v1/modeler/tasks/{id}?$include=assignees,deliverables&$fields=basics
    GET resources/v1/modeler/projects/{projectId}?$include=none

and the form definition says, per field, which of the two it reads.

The page **refetches rather than reusing the list's row**, because the router
remembers `task/:id` in a preference: a refresh must open this page with
nothing behind it (rule R6).

## The form definition contract

`js/data/forms/<id>.json`, where `<id>` is the `fields` key of the subtype's
entry in `js/config/TaskFields.js`. For the proposal that is
`forms/project-proposal.json`.

```json
{
  "form": "R&D-PRJ-01-Rev.06",
  "title": "PROJECT PROPOSAL / PROFILE",
  "taskType": "EPMPROJECT_PROPOSAL",
  "fields": [
    { "ref": "III", "label": "Need of the Project",
      "source": "project", "field": "EPMNeedOfTheProject", "display": "longtext" }
  ]
}
```

| Key | Meaning |
|---|---|
| `ref` | the numeral on the printed form, shown as a small badge so a reader can match page and screen |
| `label` | what the **form** calls it, not what the attribute is called |
| `source` | `project` \| `task` \| `none` - which object's `dataelements` to read |
| `field` | the attribute name. Required unless `source` is `none` |
| `display` | `text` \| `longtext` \| `pending` \| `elsewhere` \| `approval` \| `type` |
| `note` | muted help text. **Required** when `source` is `none`, so a blank is never unexplained |

`TaskDetailView` knows about `source` and `display` and **about no attribute
name at all**. Changing what a form shows is editing the JSON.

### Four states a field can be in, and why they are not three

| State | What the page shows |
|---|---|
| has a value | the value (dates formatted, prose keeping its line breaks) |
| **empty** - the attribute exists, nobody filled it in | an em dash |
| **missing** - the attribute is not in the payload at all | a red line naming the field, and a count in the banner |
| `source: none` | the note: it lives on a relationship, in its own objects, in the WBS, or in the route |

Keeping *empty* and *missing* apart is the point. An empty box reads as "nobody
entered anything"; when the truth is "the spec names an attribute that does not
exist", that has to be visible or it is a silent bug. `display: pending` is the
third case - the attribute is **agreed but not created on the platform yet**
(two of the 23 fields), so its absence is expected and the note says so instead.

### The file was generated, not typed

`forms/project-proposal.json` was generated from
`IRSProjects/js/config/ProjectForm.js`, whose source of truth is **WP02 doc 05
section 12** - all 23 fields verified in MQL on 2026-09-23. Hand edits are
expected from here; if doc 05 changes, both files need checking. The two exist
because they serve different pages: the project detail page (WGT-04) and this
one.

## The type name comes from the platform where it can

The live capture shows the platform's own display names on related objects as
`typeNLS` - `PROJECT PROPOSAL / PROFILE`, `PROJECT PERSONNEL / COST ESTIMATION`,
`STAGE-VALIDATION REPORT`, `PROJECT REVIEW`, `Analysis Project` - and states as
`stateNLS` (`Completed`, `In Work`, `Archived`).

The page uses `typeNLS` and `stateNLS` **when they arrive** and falls back to
`TaskFields`' own labels when they do not. That is the better default: the name
then comes from DMC, so renaming a type there changes the widget with no code
change.

**In the capture, `typeNLS` is present on related objects but not on the task
itself**, so the fallback is what will show until the single-task call is seen
live. `typeFromPlatform` on the shaped task records which one was used, so the
first live run answers it rather than leaving it to belief.

## Edit: the rule exists, the control does not

`TaskFields.EDITABLE_STATES = ['Active']` - `Active` is the state the platform
labels **In Work**, verified. The page prints which case it is in, so the rule
is visible before anything can act on it:

- In Work: *"This task is In Work. Editing is not built yet, so the form is
  shown read-only."*
- anything else: *"This task is Completed, so the form is read-only."*

**This governs what the widget offers, not what the platform permits.** The
policy's access decides whether a save succeeds; a widget can only avoid
offering what it knows will fail.

## Acceptance

| # | Check | State |
|---|---|---|
| B1 | A proposal task opens: sidebar left, form right, at phone width stacked | not run |
| B2 | The header fields fill - Project Name and Project No. from the project | not run |
| B3 | A field nobody filled in shows an em dash; one the platform did not return is flagged red and counted in the banner | not run |
| B4 | The three signature rows and the four relationship/object rows show their note, not a blank | not run |
| B5 | A browser refresh on the task page reopens the same task, with no list behind it | not run |
| B6 | **Does the single-task call return `typeNLS`?** If yes the heading reads `PROJECT PROPOSAL / PROFILE`; if no, `Project Proposal` | not run |
| B7 | A task whose project cannot be read still opens, with the warning and an empty form | not run |
| B8 | Unit tests over the form definition, the resolver's four states, and the two calls | **passed 2026-10-07** (`node src/test/js/irstasks-detail.test.js`) |

## Open items

| # | Item |
|---|---|
| ~~O-P1~~ | ~~The other three forms have no JSON yet~~ - **`personnel-cost` built 2026-10-09/10** and **`stage-validation` built 2026-10-10** (both below). **`project-review` built 2026-10-10** (below). **All four are now there**, so no subtype resolves to a missing file any more - the banner that said so has nothing left to report |
| O-P2 | **Nothing is editable.** The next slice is the edit control for an In Work task, and it writes through the **REST JAR**, not a JPO (worklog 2026-10-06-01) |
| O-P3 | **The approval levels are not shown.** Who must approve, in what order, what each has done. `GET .../dsrt/routes/{routeId}?$include=tasks`, one call for one task - and the capture shows the Inbox Task fields that carry it (`routeTaskAction`, `routeTaskApprovalAction`, `routeTaskApprovalComments`, `routeTaskInstructions`) |
| O-P4 | **The generated form document is named but not opened.** The sidebar shows `PPF-0000004 rev 01`; it could link to the document or offer its file. Its REVISION is now printed on the personnel/cost form as the Rev. No. |
| O-P5 | Department is still absent everywhere (grid O-T7): not in either payload, it comes from the project's `IRSDepartmentProject` link |
| O-P6 | `onlyForDesignAndDevelopment` is carried through from the catalogue on four fields and **nothing acts on it**. The printed form marks them as applicable only to design and development of a new product or service |
| O-P7 | **`project.title` is empty on every project measured** (TEST PROJECT, Solize XYZ) while `name` is filled. The Project Name row falls back to `name`; confirm whether `Title` is simply unused on projects before any other screen leans on it |
| O-P8 | The risk, opportunity and learning rows carry their physical ids but **nothing links out to them** yet. A row could open the object's own page |
| O-P9 | All four risks and opportunities measured are `Complete`. Whether the section shows closed ones or filters by state is undecided - the service returns all and lets the page choose |

## Files

```
js/services/TaskDetailService.js     the two calls, the shaping, the one retry
js/services/ProjectContextService.js our REST JAR - sections XII and XIII
js/views/TaskDetailView.js           the form, the resolver, the two tables
js/data/forms/project-proposal.json  the form definition (23 fields)
js/App.js                            the task/:id route now renders the page
IRSTasks.html                        three more module script tags
src/test/js/irstasks-detail.test.js
```


## The second form: PROJECT PERSONNEL / COST ESTIMATION (2026-10-09/10)

Running on live data, read-only. **12 visible rows of 17** in
`js/data/forms/personnel-cost.json`. It is the first form that needed data the
platform does not hand over in one call, and the first with tables that have
to look like the paper they replace.

| Block | Source |
|---|---|
| Header, Change of Scope, Reason for revision | the TASK's own attributes |
| Rev. No. | the task's deliverable - the document the route generates |
| Project Members | our REST JAR, `$include=members` |
| Estimated Man days, Cost Estimation | the PROJECT's attributes |
| Start / Planned End Date | the Project Baseline linked to the task, our JAR |
| Project Planning (page 2) | the baseline's tasks, **OOTB project resource** |

Four decisions worth knowing before changing any of it:

1. **The printed tables are data.** The cost lines and man-day columns live in
   the JSON; the renderers know the shape and name no attribute. Nothing adds
   up - five of the eight figures are `ReadOnly` in DMC and computed
   server-side.
2. **The monthly plan comes from the OOTB resource**, not ours. We built it in
   the JAR first; the user pointed at
   `GET /resources/v1/modeler/projects/{baselineId}?$include=tasks`, which
   answers a baseline (a baseline IS a project to that service) **with
   `sequenceOrder`** - the WBS order our own reader could not find. The JAR's
   task list was deleted; the JAR keeps the one job the platform does not do,
   following `IRSTaskBaseline` from task to baseline.
3. **The plan refuses to invent.** Columns are the months the plan actually
   spans; an undated task keeps its row and says so; the REV / S-VAL / VER /
   VAL / CIN markers of the paper grid are NOT drawn, because the mapping from
   those letters to task subtypes does not exist yet.
4. **The Rev. No. costs no call.** `IRSTaskDocumentId` holds the document's id
   but is an interface attribute, which the OOTB task resource will not
   return; the same call already carries the deliverable, and it is the same
   object.

Two rows stay `hidden` for want of an attribute - Software Resource required
and Reviewer Name. **Reason for revision was a third until 2026-10-10**, when
`EPMReasonForRevision` was created: the row was already written, so bringing
it in cost one JSON entry. That is what the recorded gaps are for.

Full detail, including the three links tried beside the plan and why two were
rejected: devlog
[2026-10-10-01](../../devlog/2026/2026-10-10-01_personnel-cost-form-and-baseline-plan.md).

### Open items this form adds

| # | Item |
|---|---|
| O-P10 | **A nested work breakdown is untested.** The plan asks the OOTB resource without `level`; no project here has a nested WBS, so whether children come back whole is unknown |
| ~~O-P11~~ | ~~The Rev. No. reads the FIRST deliverable~~ - **fixed 2026-10-10** while building the review form, and with no JAR endpoint and no restart: the row names the document's TYPE (`DMPPERSONNEL_COST`), which is already in the response, so an upload on the same relationship cannot answer. `IRSTaskDocumentId` turned out to be unusable anyway - interface attributes do not arrive in the OOTB response, and the stored value is an MQL id where REST answers physical ids |
| O-P12 | The five page-2 markers (REV / S-VAL / VER / VAL / CIN) need a mapping to task subtypes before they can be drawn |
| O-P13 | The deployed JAR still returns a `tasks` field nothing reads - it goes at the next rebuild |


## The third form: STAGE-VALIDATION REPORT (2026-10-10)

Running on live data, read-only. **4 visible rows of 7** in
`js/data/forms/stage-validation.json`, from `R&D-VAL-Rev.00`.

The smallest of the four forms, and **the only one that cost nothing**: no new
DMC attribute, no new call, no view change, no CSS, no server-side change. One
JSON file.

| Row | Source |
|---|---|
| Project Name, Project No. | the PROJECT - the project call the page already makes |
| Validation Details, Remarks | the TASK's `EPMValidationDetails` / `EPMValidationRemarks` - the task call it already makes |

Project Name is **not on the paper**; added at the user's request beside the
Project No. the form does ask for.

### Why it was free, and what that says

`print type EPMPROJECT_STAGE_VALIDATION select attribute` returns those two
custom attributes and no others, and both are TYPE attributes, so both arrive
in `dataelements` - verified against the live response. The page's two extra
calls are gated on the spec having a `service` row (`ProjectContextService`) or
a visible `baseline` row (`BaselineService`); this spec has neither, so neither
fires.

**The reason is the paper form, not the code.** Personnel/cost needed four
calls because it asks for members, a baseline's dates and a baseline's whole
task list. This one asks for two paragraphs the task already holds.

### What it deliberately does not show

Three rows are `hidden`, and each inherits an earlier decision rather than
re-opening it:

1. **Date - parked**, user 2026-10-10: *"date we will see later"*. The paper
   asks for a Date and no attribute exists for it; the open question is which
   date it means. The row stays in the file with its **four candidate sources
   named** (`actualFinishDate`, `dueDate`, `originated`, the approval date),
   all already in the task response. Bringing it back is deleting one line.
2. **No stage row** - the stage is the task's position in the WBS (user,
   2026-10-06), carried by the task name into the document title, the route
   name and the page header.
3. **No Rev. No.** - this form's document is never revised, because each record
   validates a different stage. The other two forms revise and do print one.

The two signatory lines (**Checked by**, **In-Charge / HOD** - two blocks, not
one caption) are approvals, drawn by the WGT-09 panel.

### One form, two areas

`R&D-VAL-Rev.00` and `RDAREA-VAL-Rev.00` are identical apart from the form
code, so one subtype and one file serve R&D and AR both. The to-be document's
R06 note that the two areas' forms differ is true for **Project Review**, not
for this one - recorded in the spec, because the next form built is where it
matters.

Full detail: devlog
[2026-10-10-02](../../devlog/2026/2026-10-10-02_stage-validation-form.md).

### Open items this form adds

| # | Item |
|---|---|
| O-P14 | **The printed form's Date has no source chosen.** Four candidates, all free; parked by the user 2026-10-10 |
| O-P15 | **The report number `SVR-nnnnnnn` is not shown.** This form has no Rev. No., so the document name is what identifies the record. Reading it no longer means the first deliverable: since 2026-10-10 a row can name the document's TYPE (`DMPSTAGE_VALIDATION`), which separates our generated document from the signed upload on the same `Task Deliverable` relationship without the `IRSGeneratedDocument` interface, which does not reach the client. What is still open is whether to show the number at all - decide it with the review form's report number |


## The fourth form: PROJECT REVIEW (2026-10-10)

Running on live data, read-only. **8 visible rows of 12** in
`js/data/forms/project-review.json`, from `R&D-REV-Rev.02` - one of the eight
is the *Review Observations* box, which carries four more. **All seven of the
subtype's attributes are on screen.**

**All four forms now have a file.** Every subtype `TaskFields` declares resolves
to a spec, so O-P1 is closed.

| Row | Source |
|---|---|
| Project Name, Project No. | the PROJECT - the project call the page already makes |
| Review No. | the task's own review DOCUMENT, picked by type - its revision |
| Reviewer(s) | the task's `assignees` - free in the task call |
| **Review Observations** - items 1) to 4) in one box, as the paper draws them | four of the TASK's attributes, each with its own format |
| Follow-up Action Recommended, Data copied to common drive | the TASK's other two |

Seven attributes read from one task, and **still no extra call**: the spec has no
`service` row and no visible `baseline` row, so neither `ProjectContextService`
nor `BaselineService` fires. Both gates are asserted in the test with the cost
form as the contrast.

### The Review No., and a correction to the cost form

The Review No. is the review document's revision (user, 2026-10-07: the revision
chain IS the review sequence). The question is **which document** - a review task
also carries the signed form and the reviewed reports, and an attachment uses the
**same `Task Deliverable` relationship** as our generated document.

The row names the document's TYPE (`DMPPROJECT_REVIEW`; an upload is a plain
`Document`), which is already in the response. The id the platform stores for
exactly this purpose - `IRSProjectReviewDocumentId`, interface
`IRSProjectDocuments` - cannot be used, measured twice on 2026-10-10: the project
response carries TYPE attributes only, so the interface attribute never arrives;
and the stored value is an MQL object id where REST answers physical ids.

**The cost form's `Rev. No.` was corrected the same way** - it had been reading
the task's first deliverable. That closes **O-P11**, and the test pins the
failing case: an upload connected first must not answer.

### The two areas differ here, and R06 is about this form

`R&D-REV-Rev.02` carries two items `RDAREA-REV-Rev.00` does not - *Validation*
(`EPMValidation`) and *Data copied to the project common drive* (`EPMDataDrive`).
They are additive, so AR is an older revision of the same form and one subtype
carries both attributes.

The user chose 2026-10-10 to **draw both rows on both areas, labelled
*(R&D form only)***, rather than hide them on an Analysis project - the project
subtype would have answered the area for free. A visible labelled row says what
the difference is; a hidden one says nothing. The label carries the note because
short rows have nowhere else to put one.

Printed section numbers stay off the screen for a new reason as well as the
old one: the same item is numbered 4 on the R&D form and 3 on the AR one.

**One exception, added 2026-10-10 at the user's request:** the four items
inside the *Review Observations* box ARE numbered, because there the number is
the content - a reviewer reads item 3 off the paper and looks for item 3 on
screen. An AR reader sees four where their paper has three, and the third
carries *(R&D form only)*, which is what tells them why.

### What it deliberately does not show

1. **The top *Review Date* - parked.** The platform has no attribute for it at
   all, the same gap as on stage validation, so the row names its four
   candidate sources and waits. The reviewer's approval date is the strongest
   of them here, because the printed page says *"(To be filled by Reviewer
   only)"*. *Next Review Date* is a different question and **is drawn** - it
   has `EPMNextReviewDate` and live data in it (user, 2026-10-10).
2. **The report number** `PRV-nnnnnnn` - the document's name, as against its
   revision. Decided together with O-P15, below.
3. **Grade A / the skill-based reviewer** - not implemented by decision of
   2026-10-07; the reviewer is the task's assignee, which Reviewer(s) prints.

Full detail: devlog
[2026-10-10-05](../../devlog/2026/2026-10-10-05_project-review-form.md).

### Open items this form adds

| # | Item |
|---|---|
| O-P16 | **The Review No. is off by one on legacy document families.** New families start at revision `01`, so `01` is Review No. 1; families created before 2026-10-07 start at `0` and read one low. The page prints the revision as it is rather than adding one, which would be wrong for everything new |
| ~~O-P17~~ | ~~The parked `Next Review Date` is ready to draw~~ - **drawn 2026-10-10**, the same day, at the user's word. One line deleted: parking a row wired rather than empty is what made it that cheap |

## Layout: Bootstrap only (decided 2026-10-08)

The user's decision, after an analysis that recommended a Bootstrap form with
Tabulator confined to the four row blocks:

> *"i think lets use only bootstrap then, because bootstrap also have table
> elements, and this will keep uniformity across the form"*

So **no grid library on this page at all**. The two object sections are plain
`table table-sm table-bordered`. Beyond uniformity it is the better fit: sixteen
sections are paragraphs of prose rather than cells, doc 02's open item **E2**
already found that a per-person form must print through `printAsHtml` or jsPDF
*"not the raw grid"*, and an Excel-like grid signals "editable spreadsheet" on a
controlled approval record.

## Where the 23 rows get their data

Four sources. Fourteen are project attributes, one is derived from the project's
subtype, **two come from our REST JAR**, and six are not available yet -
Department, Customer, Project Planning, the screening-approval attribute and the
three signatures. **17 of 23 render today.**

Sections **XII** (Lessons learnt) and **XIII** (Risks and opportunities) are the
two the JAR unlocked on 2026-10-08. XII had been marked `pending` against
`EPMLessonsLearnt`, an attribute that was **cancelled** when the `IRSLearning`
object replaced it (WP02 doc 08) - the row had been waiting for something that
was never going to exist.

Full row-by-row map: devlog [2026-10-08-01](../../devlog/2026/2026-10-08-01_proposal-form-sections-and-bootstrap-only.md).

Detail: devlog [2026-10-07-02](../../devlog/2026/2026-10-07-02_task-page-proposal-form.md).
