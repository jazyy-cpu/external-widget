# WGT-06 - Task widget landing page

| | |
|---|---|
| Work package | [WP06](../../../../documents/work-packages/06-task-approval-widget/README.md) |
| Status | **reading live data 2026-10-07.** Still not opened in 3DDashboard |
| Source | user instructions 2026-10-03 (five points, below) |
| Widget | `WidgetPacket/IRSTasks/` |

## What was asked

The user's five points, verbatim in substance:

1. Create the widget **taking the look and feel of the old widget, IRS
   Projects**, and use the **same Tabulator table**.
2. The widget will handle **a lot of forms**, and for a single form some
   attributes may have to be hidden **depending on department or division**.
3. So the widget must know **which department a project belongs to**; the
   department id -> name mapping goes in a **JSON file**, and more JSON files
   are expected as requirements arrive.
4. Show the **project task (custom subtask)** and the **route task connected to
   it** in this widget.
5. **Put triggers on the system for automation** where applicable.

And for this first step: *"lets create the first landing page ... what to show
in column that we can take the help of poc project, and later we will add and
remove as of now just create empty table."*

Also confirmed: **attributes can be created on the task** as well, so a field's
home is a real choice (WP06 F3).

## The user's instructions of 2026-10-07, and what they settled

> "first lets get all the task, and when we click on task we want to show some
> data based on the form - for each form we should have some json file, so that
> we change the json file that what data we want to show ... based on the task
> state we can give edit option for some task not all task if task in inwork.
> note this point in requirement document. Lets first show the task, and with
> task we will show the project also, and we will show only our custom task that
> we have created."

Four things, two of them built now and two recorded for the task view:

| # | Instruction | State |
|---|---|---|
| 1 | **All tasks**, with the **project** on each row | **built** - one call returns both |
| 2 | **Only our own custom tasks** | **built** - a real allow-list of the four gateway subtypes |
| 3 | **One JSON file per form** saying which data the task view shows | **the mechanism is declared, the view is not built**. Each descriptor in `TaskFields.TASK_TYPES` carries a `fields` id, which names `js/data/forms/<id>.json`. Changing what a form shows is then changing a JSON file, which is the whole point |
| 4 | **Edit only when the task is In Work** | **recorded and half-built**: `TaskFields.EDITABLE_STATES = ['Active']`, `isEditable(state)`, and every row carries `editable`. `Active` is the state the platform labels *In Work* - verified, not assumed. No edit control exists yet because no form does |

On (4), one thing is worth stating plainly in this document: **this governs what
the widget offers, not what the platform permits.** The policy's own access
decides whether a save succeeds, and a widget can never be the thing that
enforces a rule - it can only avoid offering what it knows will fail.

On (3), the per-form JSON is the same mechanism as `departments.json` and the
reason point 2 of the 2026-10-03 list (a field hidden by department or division)
does not need a form per department: the field list and its per-department rules
are data in one file, read by one renderer.

## Scope of this requirement

The landing page only: the shell, the shared top row, the toolbar, the grid, the
column set, the states and the subtype registry. **No data call** - the custom
task subtypes do not exist yet, so `TaskService` returns an empty list and the
page says why.

Out of scope here: the approval form (planned WGT-07), the route task call, the
per-department field rules beyond the empty config file, and point 5 (triggers),
which is platform work recorded in [WP05](../../../../documents/work-packages/05-approval-output-pdf-and-jobs/README.md).

## Acceptance

| # | Check | State |
|---|---|---|
| A1 | The widget loads in 3DDashboard and shows the toolbar, the grid headings and an empty-state message | not run |
| A2 | It looks like the IRS Projects widget beside it - same row density, same toolbar band, same header blue | not run |
| A3 | The credential picker sits at the far right of the shared row and changing it reopens the page | not run |
| A4 | A refresh returns to the page that was open (`jzTaskRoute`), and does not disturb the project widget's `jzRoute` | not run |
| A5 | The pager sits at the bottom edge of the widget frame, not under the last row | not run |
| A6 | A narrow frame gets a horizontal scroll bar, not squeezed columns | not run |
| A7 | The subtype registry, the search control, the column set and the row shape are unit-tested | **passed**, extended 2026-10-07 with the live call's parameters and both filters (`node src/test/js/irstasks-landing.test.js`) |
| A8 | **What does `currentTaskFilter=all` return** - every task the user can read, or every flavour of their own? A PM must see tasks assigned to others | **not run - the one check that could change the call.** Fallback if it is the latter: fan out over `/projects` then `/projects/{id}/tasks` |
| A9 | A project that has baselines shows each of its tasks **once**, and the note above the grid names what was filtered out | not run |

## The columns

Taken from the POC's task grid, then adjusted:

| Column | From | Note |
|---|---|---|
| `#` | POC | row number, frozen with the title |
| Title | POC | frozen, the one clickable cell - opens the form |
| Task Type | POC | badge; label and colour come from the subtype registry |
| Status | POC (`State`) | badge in the platform's maturity palette |
| Assigned To | POC | |
| Project | POC | |
| Department | **new** | point 3: a form may hide fields by department, so the grid should say which |
| Route | POC | |
| Route Task | **new** | point 4: the route task connected to the custom subtask |
| Action Required | POC | amber badge - the one cell meaning "you have something to do" |
| Est. Finish | **new** | so a list of approvals can be sorted by when it is due |
| ~~Needs Review~~ | POC | **dropped** - it was an attribute of the POC's own document type; whether a task needs review is what its state says |
| ~~Actions~~ | POC | **dropped** - the title is the link, as in the project widget; one target per row, not two |

Provisional on purpose: the user will add and remove once the subtypes exist.
Changing `js/views/TaskColumns.js` is the only change needed.

## Open items

| # | Item |
|---|---|
| O-T1 | **The CSS is duplicated.** Density, toolbar band and maturity palette now exist in both widgets' stylesheets. They belong in a shared JazzySole sheet; doing it now would mean restyling a live widget inside the same change that builds a new one. See design.md §4 |
| ~~O-T2~~ | ~~**`ConfigService` fetches a relative URL**~~ - **HAPPENED, and fixed 2026-10-08.** The widget asked the dashboard for its own file: `GET /3ddashboard/api/widget/js/data/forms/project-proposal.json` -> **404**. UWA rewrites markup `src`/`href` to the widget's real host, which is why every `<script>` loads, but it cannot rewrite a URL built in JavaScript. The base is now resolved absolutely: `widget.getSettings().baseUrl` first (as this item predicted), then the `src` of a script that demonstrably loaded, then the relative path. The failure message now carries the URL - the status alone hid the cause |
| ~~O-T3~~ | **Closed 2026-10-07.** Every custom task, from `GET resources/v1/modeler/tasks` with `showProjectTasks=true` - there IS an all-tasks resource, so no search is needed. What `currentTaskFilter=all` scopes it to is check A8 |
| ~~O-T4~~ | **Closed 2026-10-07.** The route's name and id arrive with the task in `relateddata.route`, as do the project and the assignees - so the grid is one call. The route's individual approval **levels** still need `GET .../dsrt/routes/{id}?$include=tasks`, which belongs to the task view, where it is one call for one task |
| ~~O-T5~~ | **Closed 2026-10-07.** `Project Task` has `Create`, `Assign`, `Active`, `Review`, `Complete`, and every live custom task carries that policy, not the `Software Task` one its type also names. The POC's spellings are out of the state lists and kept only in the badge map |
| ~~O-T6~~ | **Closed 2026-10-07 by not doing it.** The list call sends `$fields=basics`, the spelling the POC proved on this platform; an untested name in an explicit list returns 400 for the whole call. The hand-made list survives as `DETAIL_FIELDS` for a single-task call, renamed so nothing implies the list uses it |
| O-T7 | **Department is empty.** It is not in the task payload - it comes from the project's `IRSDepartmentProject` link, so it needs either a per-project lookup or the id -> name map in `departments.json` once we know which id arrives |
| O-T8 | **Tasks inside baselines and snapshots are excluded by a deny list.** If DS adds a fourth copy container, it needs a line in `COPY_PROJECT_TYPES`. The same trap waits for anything that COUNTS tasks (R24's quarterly figures) |

## Files

See the widget's own [README](../../../src/main/resources/static/WidgetPacket/IRSTasks/README.md)
for the file tree, and [design.md](design.md) for why it is shaped that way.
