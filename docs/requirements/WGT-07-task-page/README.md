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
| O-P1 | **The other three forms have no JSON yet.** `personnel-cost`, `stage-validation` and `project-review` are declared in `TaskFields` and their files do not exist - the page says so plainly instead of failing. Those three DO have task attributes, so they will use `source: "task"` |
| O-P2 | **Nothing is editable.** The next slice is the edit control for an In Work task, and it writes through the **REST JAR**, not a JPO (worklog 2026-10-06-01) |
| O-P3 | **The approval levels are not shown.** Who must approve, in what order, what each has done. `GET .../dsrt/routes/{routeId}?$include=tasks`, one call for one task - and the capture shows the Inbox Task fields that carry it (`routeTaskAction`, `routeTaskApprovalAction`, `routeTaskApprovalComments`, `routeTaskInstructions`) |
| O-P4 | **The generated form document is named but not opened.** The sidebar shows `PPF-0000004 rev 01`; it could link to the document or offer its file |
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
