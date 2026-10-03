# 2026-10-03-01 - IRSTasks widget: landing page skeleton with an empty grid

| | |
|---|---|
| Date | 2026-10-03 |
| Requirement | [WGT-06](../../requirements/WGT-06-task-landing/README.md) |
| Status | built; not yet opened in 3DDashboard |
| Done by | agent (Claude), on the user's instructions |

## Goal

Create the first page of the task widget, reusing the IRS Projects widget's look
and feel and the same Tabulator table, with the column set taken from the POC's
task grid - **an empty table for now** (user: "later i will add and remove as of
now just create empty table").

## What was done

A new sibling widget `WidgetPacket/IRSTasks/`, nine files, built to the project
widget's structure: UWA shell with no logic, `App.js` running the same
spinner -> `Credentials.init()` -> shared top row -> router sequence, a toolbar
with the identical control set, and a Tabulator grid with the same density
rules, pager-at-the-bottom height measurement and `fitDataFill` + minWidth
behaviour.

Two shared modules were **promoted into `JazzySole/Ui/`** rather than copied:

- `Format.js` -> `JazzySole/Format` (locale date, badge as a DOM node, plus an
  `empty()` em dash so "no value" looks the same in every widget);
- `CredentialBar.js` -> `JazzySole/CredentialBar`.

`IRSProjects` still carries its own copies. It is live and has tests against it,
so switching it over is a separate change - noted in both new files' headers.

The column set follows the POC grid, minus `Needs Review` (an attribute of the
POC's own document type; whether a task needs review is what its state says) and
minus the `Actions` button column (the title is the link, as in the project
widget - one target per row, not two), plus `Department`, `Route Task` and
`Est. Finish` for the user's points 3 and 4.

`js/data/departments.json` and `services/ConfigService.js` set up the JSON
configuration mechanism the user asked for in point 3. The file is empty,
carrying only `_about` / `_shape` / `_status` keys; the loader caches each file
once, does not cache failures, and documents that these files are public and
must hold nothing secret.

## Decisions and findings

- **`TaskFields.TASK_TYPES` is empty, and `isListed()` therefore lets every type
  through.** An empty allow-list would filter every row out and make a working
  widget look broken until the subtypes are deployed. The unit test asserts this
  behaviour, so the day the registry is filled the test states what changed.
- **`TaskService` makes no call at all.** The page then cannot fail for a reason
  unrelated to the layout, which is what is being judged first. Its note is
  rendered as an info strip, so the empty grid says why it is empty. What the
  real calls will be is written into the file, with the two open questions
  (which tasks to list; whether the route task costs a call per row) beside
  them.
- **The row shape already carries `route`, `routeTask`, `actionRequired` and
  `department`**, all empty. Wiring the extra calls later changes `toRow` and
  nothing in the view, and the test enforces that every column's `field` exists
  in the row shape - so no column can silently read a key nobody fills.
- **The CSS is duplicated and that is recorded, not hidden** (O-T1). The right
  answer is a shared JazzySole stylesheet; doing it now would mean restyling a
  live, user-approved widget in the same change that introduces a new one.
- **Separate preference keys** (`jzTaskRoute`, `xPrefTasksShowClosed`): both
  widgets can sit on one dashboard and neither should move the other's page.
- **`task/:id` is a real route with a placeholder page**, so navigation, the back
  path and the remembered page are exercised from day one; the form replaces
  only what it renders.
- **The task policy's real state names are still unverified.** `TaskFields` maps
  both the POC's spellings (`Not Started`, `In Work`) and the project policy's
  (`Create`, `Assign`, ...). An unmapped state keeps its own name and draws the
  `unknown` badge, so a wrong guess is visible rather than silent. O-T5 is the
  MQL check that settles it.

## Verification

- `node --check` on all nine new JS files - pass. `departments.json` parses.
- New unit test `src/test/js/irstasks-landing.test.js` - **all assertions
  passed**. It covers the subtype registry both ways round, the state maps
  including unmapped states, the search control (including that the toolbar's
  picker and the view's field list cannot drift apart), the column set against
  the row shape, that no column carries a header filter or lacks a minWidth,
  that exactly one column is clickable, and that the stub returns no rows with a
  reason.
- The whole JS suite re-run: **8 of 8 test files pass**, so nothing in the
  project widget was disturbed by the two promoted modules.
- **Not verified:** anything in a browser. The widget has not been added to
  3DDashboard, so acceptance checks A1-A6 are open.

## Next

1. Add `IRSTasks.html` to the dashboard as an Additional App and run A1-A6.
2. O-T5: confirm the task policy's states by MQL and cut `TaskFields` down.
3. The subtypes, then fill `TASK_TYPES` - at which point the grid filter becomes
   real and the list call can be wired (O-T3, O-T4, O-T6).
