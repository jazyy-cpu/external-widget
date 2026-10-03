# WGT-06 - Task widget landing page

| | |
|---|---|
| Work package | [WP06](../../../../documents/work-packages/06-task-approval-widget/README.md) |
| Status | **built 2026-10-03, empty by design.** Not yet opened in 3DDashboard |
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
| A7 | The subtype registry, the search control, the column set and the row shape are unit-tested | **passed 2026-10-03** (`node src/test/js/irstasks-landing.test.js`) |

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
| O-T2 | **`ConfigService` fetches a relative URL** (`js/data/*.json`). The dashboard proxies an Additional App, so a relative URL resolves against the proxied document. The module `<script>` tags already load this way, which is good evidence - but XHR has not been observed yet. If it fails, build the URL from `widget.getSettings().baseUrl` |
| O-T3 | **Which tasks does the landing page list?** Every custom task the user may see across projects, or the tasks of one project picked first? The POC did the second. The first needs a search - there is no "all tasks for me" project resource |
| O-T4 | **The route task is a second object.** Showing it beside the task may be one extra call per row. Settle whether it arrives with the task before the grid is wired to live data |
| O-T5 | **The task policy's real states are unverified.** `TaskFields` currently maps both the POC's spellings and the project policy's. Confirm with `print policy "Project Task" select state.name dump \|;` and cut the list down |
| O-T6 | The `$fields` list in `TaskFields.LIST_FIELDS` is **untested** against the service. An untested name is how a whole call starts returning 400 - verify each before the first live call |

## Files

See the widget's own [README](../../../src/main/resources/static/WidgetPacket/IRSTasks/README.md)
for the file tree, and [design.md](design.md) for why it is shaped that way.
