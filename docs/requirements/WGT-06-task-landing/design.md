# WGT-06 design - the task landing page

## 1. Why a second widget rather than a page in IRSProjects

The project widget answers "what projects are there and what is in one". This
one answers "what must I approve". They are different audiences - a Division
Head opens the second and may never open the first - and a UWA widget is placed
on a dashboard per task, so two widgets is the platform's own unit of
separation. They share every library; what they do not share is a frame.

The cost is that two things must stay in step: the shared libraries (solved -
they are one copy in `JazzySole`) and the styling (not solved - see §4).

## 2. Module layout

```
App.js                 start sequence, the shared top row, the routes
config/TaskFields.js   the subtype registry, states, labels, badges, $fields
data/departments.json  department id -> name, and which fields it hides
services/ConfigService.js   loads data/*.json once each, cached
services/TaskService.js     the list call (a stub) and the row shape
components/TaskToolbar.js   the completed switch, search, Clear, Refresh
views/TaskColumns.js        Tabulator column definitions
views/TaskListView.js       toolbar + grid: load, filter, paginate, redraw
```

Same split as the project widget (rule R4), and the same reason: the file a
change lands in should be obvious from what changed. A new subtype touches
`TaskFields` only. A changed column touches `TaskColumns` only.

### `TaskFields` is the keystone - WP06 F1 and F2

`TASK_TYPES` holds one descriptor per subtype:

```
label    what the Type column prints
badge    the CSS class suffix, irs-type-<badge>
form     the AMD module id of its form (null = generic read-only view)
fields   the field-set id its form and its PDF read
```

`form` and `fields` are declared now and unused until the forms exist. That is
deliberate: they are what keeps the renderer generic when the fifth subtype
arrives. The POC spread `XITProject_Personal` over an if-chain, three filter
maps and a route config, and two of its five declared subtypes ended up with no
form at all, falling through to the generic view in silence. One registry is the
whole fix.

**`TASK_TYPES` is empty, and `isListed()` therefore lets everything through.**
An empty allow-list that filtered every row out would make a working widget look
broken for as long as the subtypes take to arrive. Once they are deployed the
list is filled and the filter becomes real - and the unit test asserts this
behaviour both ways round, so the day the registry is filled, the test says what
changed.

## 3. The empty grid

`TaskService.list()` returns `{rows: [], note: '...'}` without calling anything.
Three reasons:

1. there is nothing to query - the subtypes do not exist;
2. the page cannot then fail for a reason that has nothing to do with the layout,
   which is what is being judged first;
3. the note is rendered as an info strip, so the page **says why it is empty**
   instead of looking broken.

What the real call will be is written into the file rather than left to be
rediscovered: the POC's `projects/{id}/tasks`, plus `tasks/{id}/deliverables`
and `dsrt/routes/{id}/tasks` for the route side, with the two open questions
(O-T3, O-T4) stated beside them.

The row shape already carries `route`, `routeTask`, `actionRequired` and
`department`, all empty. Wiring the extra calls later changes `toRow` and
nothing in the view - and the unit test enforces the other direction too: every
column's `field` must exist in the row shape, so a column can never silently
read a key nobody fills.

## 4. Styling, and the duplication that is being accepted for now

Base theme `tabulator_simple`, one stylesheet, everything under `.irs-tasks`
(rule R1, UWA rule C3).

Why any custom CSS at all is unchanged from the project widget: Tabulator's
themes are built for a full page. The bootstrap5 theme renders at 16px and the
simple theme at 14px with heavy `#999` borders, giving rows about twice the
height of the OOTB grids the widget sits beside. Row density is font size, line
height and border colour - Tabulator exposes none of them as options and
Bootstrap cannot reach inside the Tabulator DOM.

The density, toolbar-band and maturity rules are **copied verbatim** from
`IRSProjects.css`, because the user asked for the same look and feel and the
cheapest way to guarantee it is the same declarations.

**This is duplication, and it is recorded as open item O-T1 rather than
pretended away.** The right answer is a shared `JazzySole` stylesheet with the
widget's root class applied by the widget. It was not done in this change
because it means restyling a live, user-approved widget in the same commit that
introduces a new one - two risks in one change, and the second one hard to see.
When it is done, the test is that both widgets still look identical.

Two additions the project grid has no equivalent of:

- **the task-type palette**, muted on purpose. The status column is the one that
  should carry colour in a grid; two loud columns compete and neither reads.
- **`irs-action`**, amber with dark text, for what the route task wants from the
  current user - the one cell in the row meaning "you have something to do".
  Dark text because white on amber fails contrast.

## 5. Per-department field rules - the JSON mechanism

Point 3 asked for a JSON file mapping department id to name, and expects more
such files. `ConfigService` is that mechanism: `get('departments')` fetches
`js/data/departments.json` once, caches it (including the in-flight promise, so
ten callers cause one request) and does **not** cache a failure, so a file
edited during development is picked up without a dashboard reload.

Rules for these files, written into the loader's header:

- static configuration only, never platform data;
- nothing secret - the browser downloads them and any widget user can read them;
- one loader, so no caller writes its own fetch.

`departments.json` is empty, carrying only `_about`, `_shape` and `_status`
keys that document the intended structure. The shape puts `hideFields` on the
department, which is WP06 F2 applied: hiding an attribute for a department is a
flag resolved against the field declaration, not a separate hand-written form.

The open risk is O-T2, the relative URL under the dashboard's proxy.

## 6. Routing

`JazzySole/Router` with `prefName: 'jzTaskRoute'` and its own
`xPrefTasksShowClosed`. Separate keys from the project widget's on purpose: both
widgets can sit on one dashboard, and neither should move the other's page or
toggle the other's switch.

`task/:id` is registered now as a placeholder that names the id and offers a way
back. A disabled link would have left the navigation, the back path and the
remembered-page behaviour untested until the form existed; this way they are
exercised from the first day and the form only replaces what is rendered.

## 7. What is deliberately not here

- **No write of any kind.** Approval is a write, and the project widget's write
  path (WGT-04 B3) has never run once. The first write in this codebase should
  be a small, deliberate change, not a side effect of a landing page.
- **No signature panel.** It belongs with the approver view (WGT-07).
- **No trigger** (point 5). Triggers are platform work; they are recorded in
  WP05 and need a `worklog/` entry, not a devlog one.
