# 2026-10-10-01 - The PERSONNEL / COST form: printed tables, the baseline plan, and the Rev. No.

| | |
|---|---|
| Requirement | WGT-07 (the task page), with WGT-09 for the document the route generates |
| Status | **running on live data.** Read-only, as the rest of the form is |
| Worklog | [2026-10-09-02](../../../../worklog/entries/2026/2026-10-09-02_project-responsibility-attribute-and-members-api.md) (the members table and the attribute behind it), [2026-10-10-01](../../../../worklog/entries/2026/2026-10-10-01_baseline-monthly-plan.md) (the plan, the links, the Rev. No.) |

The second form after PROJECT PROPOSAL / PROFILE, and the first that needed
data the platform does not hand over in one call. This entry records what the
page draws, where each block comes from, and the four decisions that are worth
knowing before changing any of it.

## What the page draws

**12 visible rows of 17.** The spec is `js/data/forms/personnel-cost.json`;
nothing below is in code.

```
Header   Project Name · Project No. · Department · Rev. No.
         Project Members            table, one row per member
         Change of Scope
         Reason for revision        prose
         Start Date · Planned End Date
         Estimated Man days         table, IRS / Outside agency / Total
         Cost Estimation            table, three lines + total + rate footnote
         Project Planning           the monthly plan
```

Five rows stay `hidden`: two with no attribute anywhere (Software Resource
required, Reviewer Name) and the three approval signatures, which WGT-09's
panel draws under the form.

## Where each block comes from

| Block | Source | Call |
|---|---|---|
| Header, Change of Scope, Reason for revision | the TASK's own attributes | the task call the page already makes |
| Rev. No. | the task's **deliverable** | same call - see below |
| Project Members | our REST JAR, `$include=members` | the project context call |
| Man days, Cost Estimation | the PROJECT's attributes | the project call |
| Start / Planned End Date | the **Project Baseline** linked to the task | our JAR, `GET /tasks/{id}/baseline` |
| Project Planning | the baseline's task list | **OOTB**, `GET /resources/v1/modeler/projects/{baselineId}?$include=tasks` |

Four calls in all, and three of them are ones the page was already making.

## Decision 1 - the printed tables are data, not code

Cost Estimation and Estimated Man days replaced eleven rows that listed the
same numbers one under another. Both renderers know the **shape** of a printed
table and nothing about which attributes fill it: the lines live in `rows` and
`columns` in the JSON, so a fourth cost line or a fifth man-day column is a
JSON edit.

Nothing on this page adds up. Five of the eight figures are `ReadOnly` in DMC
and computed server-side; a second implementation of that arithmetic in the
client is how the screen and the database start disagreeing, and on a form a
customer signs that is the worst outcome available.

## Decision 2 - the plan comes from the OOTB resource, not from ours

We built the baseline's task list first, in the REST JAR, over
`ProjectBaseline.getSubtasks`. The user then pointed at the resource the
platform's own Gantt calls:

```
GET /resources/v1/modeler/projects/{baselineId}?$include=none,tasks
```

**A Project Baseline is a project to that service.** It answers every task with
`sequenceOrder` - the WBS order - plus `nlsType`, `isSummaryTask`,
`isTypeMilestone`, `sourceId` and ISO dates. Our own reader could not find an
order at all (`select rel attribute[Sequence Order]` reads 1 on every link),
so the rows had been sorted by date, which was our invention and not the
platform's order.

The JAR's task list was then **deleted**, along with the two compile
dependencies it alone needed. Our endpoint keeps the one job the platform does
not do: following `IRSTaskBaseline` from the task to its baseline.

Nine fields are requested, not the forty in the Gantt's own URL - those exist
for an editor (predecessors, assignees, float, constraints, access flags), and
each is work the server does per task for a grid that is only printed.

## Decision 3 - what the plan prints, and what it refuses to

- **The columns are the months the plan spans**, not the paper form's fixed
  twelve. Eleven empty columns read as missing data rather than as a short
  project.
- **A task the platform returned without dates keeps its row** and says so.
  Dropping it would quietly shorten an approved plan.
- **The row for this form's own task is marked**, matched on `Source ID`.
  Without it an approver reads several similar task numbers and has to work
  out which page they are signing.
- **The REV / S-VAL / VER / VAL / CIN markers of the paper grid are not
  drawn.** They need a mapping from those letters to task subtypes that nobody
  has defined, and a wrong letter on an approved plan is worse than none.

A long plan **scrolls**: the table keeps its natural width (Bootstrap's
`.table { width: 100% }` was shrinking every column instead), the task name
column is sticky, and a plan over six months offers a full-window view - our
own overlay, because this page loads Bootstrap's CSS and not its JavaScript.

## Decision 4 - the Rev. No. costs no call

The form's revision is the revision of the document the approval route
generates for the task. The route creates it on the first round and revises it
on each later one, connecting each revision to that round's own task - so a
task's document is its round's revision, and it cannot go stale.

The task carries `IRSTaskDocumentId` (interface `IRSTaskDocuments`) holding
that document's id, but **the OOTB task resource returns no interface
attributes** - asked for by name, as `customAttributes`, and as
`attribute[...]`, which Tomcat rejects for the brackets. It did not matter:
the same call already returns the deliverable, `TaskDetailService` already
shapes `documentRevision` from it, and it is the same object the attribute
points at (verified in MQL: stamped `39261...58394` = returned
`299036CE...035A` = PCE-0000009 rev 01).

The row is `source: "derived"` with `from: "task"` - a property the service
computed, not an attribute of any object. `derived` already existed for the
proposal form and read the project; it now takes its object from the spec.

**Caveat:** it is the FIRST deliverable, so a task carrying several documents
could show the wrong one. Ours carry exactly one, by the route's own rule.

## The link beside the plan

Three were tried, each opened in a browser on the VM:

| Link | Result |
|---|---|
| `/webapps/ENOProjectMgmtList/gantt-widget.html` | **blank** - and blank the same way through DS's own `emxProgramCentralWhatIfAnalysis.jsp` redirect and from the Gantt Chart tab inside the PMCSchedule portal. It wants the 3DDashboard app context ENOPRGA_AP gives it |
| `emxPortalDisplay.jsp?portal=PMCSchedule` | renders, but a bare frame with no header |
| `emxNavigator.jsp?appName=ENOPRPR_AP&targetLocation=content` | **the baseline inside ENOVIA Project Management** - this is the link |

The 3DDashboard Gantt, the one place the chart does work, is **not
constructible from a widget**: its URL carries the dashboard's id, the tab's
name and a `widgetId` generated per open, and a widget cannot read any of them
across origins.

## Tests

`src/test/js/irstasks-detail.test.js`, **18 suites**. The ones added here
cover the cost and man-day tables (including that the view never names an
attribute), the members table, the baseline endpoint, the plan in platform
order, the long-plan CSS read out of the stylesheet, the three link rules and
the Rev. No.

Three assertions had to learn to **read code rather than comments**: a comment
that names the attribute or the method it no longer uses is the most valuable
line in the file, and banning the word pushes the reasoning out of it.

## Files

```
js/data/forms/personnel-cost.json    the form: 17 fields, 12 visible
js/views/TaskDetailView.js           membersBlock, costsBlock, mandaysBlock,
                                     planTable + scheduleBlock + openPlan
js/services/BaselineService.js       our baseline endpoint + the OOTB plan
js/services/ProjectContextService.js members, sorted PM -> Dy PM -> Member
js/services/TaskDetailService.js     documentRevision (already there)
css/IRSTasks.css                     skills per line, month columns, the band,
                                     the sticky name column, the overlay
```

Server side: `rest-jar/irs-project-rest` (`TaskBaselineService`,
`ProjectContextReader`), with the JPO twin `IRSProjectContext` proving every
reader change before the JAR is rebuilt.
