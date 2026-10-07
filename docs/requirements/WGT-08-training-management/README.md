# WGT-08 - HOD training management widget

| | |
|---|---|
| Work package | [WP01 doc 09 - Training Management](../../../../documents/work-packages/01-organization-master-data-skill-matrix/09-training-management.md) |
| Status | **Platform model built and verified 2026-10-05**; all three subtypes deployed with sample data, lifecycle decided. Widget implementation pending. See WP01 doc 09 for the current model. |
| Source | User decision 2026-10-04: manage training through a custom Project, Task and Document; deprecate the old Training Master |

## Purpose

Let an HOD manage one Department Training Plan per financial year, assign a
published Training Offering Document to a department member through a Training
Task in the project's WBS, follow progress, confirm attendance and supply
verified training history to Annual Monitoring.

The Training Master list is the filtered list of published
`DMPTrainingOffering` Documents. The old `IRSTraining` page and objects were
deleted from the platform on 2026-10-05 and no longer exist.

## Acceptance to prove

| # | Check |
|---|---|
| A1 | The signed-in HOD sees only departments for which they hold current HOD responsibility; server writes reject other departments. |
| A2 | The widget finds or creates exactly one Department Training Plan for Department × April–March FY. |
| A3 | Selecting a published Offering Document revision and one current department member creates exactly one Training Task inside that plan's WBS. |
| A4 | The Task has exactly one assignee and retains the exact Offering Document revision and assigning Department. |
| A5 | Task state `Review` (employee claims completion) is separate from `Complete` (HOD approved through the route); only `Complete` counts as undergone. |
| A6 | Current-FY person rows include department members with zero assignments without creating empty annual-record objects. |
| A7 | A repeat offering is a **new revision** of the same Document; earlier tasks retain the original offering revision and files. |
| A8 | Annual Monitoring selects confirmed tasks by its assessment date range, including ranges that cross the April FY boundary. |
| A9 | ~~No widget query uses deprecated `IRSTraining` objects.~~ **Closed 2026-10-05** — the type, policy, attributes, UI and data were deleted, so there is nothing left to reference. |

## Current platform result

- All three subtypes are deployed: `DMPTrainingOffering` (prefix `TOF-`),
  `EPMDepartmentTrainingPlan` and `EPMTRAINING_TASK`.
- The Offering carries six DMC attributes, all indexed and facet-verified.
- Live sample data: project `TRAINING` with its department connected, task
  `T-0000102` linked to `TOF-0000003`, and eleven Offerings.
- Open before the widget: `EPMTRAINING_TASK` is not yet in
  `IRSApprovalRouteConfig` `taskTypes`, so the approval command does not appear
  on a training task.

## Links

- [Detailed design and widget flow](design.md)
- [WP01 doc 09 - Training Management: the single current training document](../../../../documents/work-packages/01-organization-master-data-skill-matrix/09-training-management.md)
- [Existing task widget](../WGT-06-task-landing/README.md) — reusable Tabulator and shared libraries; WGT-07 remains reserved for its approval view.