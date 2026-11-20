# 2026-11-20-01 - Task widget: IRS Tasks view switched off, Approvals only

Requirement: - (widget landing). No VM, database or JAR change, so no worklog entry.

## What changed

| File | Change |
|---|---|
| `WidgetPacket/IRSTasks/js/views/TaskListView.js` | `TaskService` and `TaskColumns` commented out of the `define` list; `VIEWS.tasks` commented out; `readMode` falls back to `approvals` |
| `WidgetPacket/IRSTasks/js/components/TaskToolbar.js` | default mode `approvals`; the `IRS Tasks` button and its paint lines commented out, so Approvals is the first and only button |

## Decision (user, 2026-11-20)

The IRS Tasks list played no part in the work: everything reaches the user as
an approval. The view is commented out rather than deleted, so it can come back.

Since `TaskService` is no longer required, the task list REST call is never
made. `IRSTasks.html` still loads `TaskService.js` with a script tag, which only
registers the module. A saved `xPrefTasksMode = tasks` from an older build no
longer matches a view, so `readMode` drops it and opens Approvals.

## Verification

`node --check` on both files; all seven `src/test/js/irstasks-*.test.js` suites
pass. Live check in the widget pending.
