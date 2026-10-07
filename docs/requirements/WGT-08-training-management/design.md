# WGT-08 design - HOD training management

Status: **architecture decided 2026-10-04; implementation pending**. The
solution uses a custom Department Training Plan project, custom Training Tasks
and `DMPTrainingOffering` Documents. The standalone-task option and separate
Person × FY record are superseded. The old `IRSTraining` master was deleted
from the platform on 2026-10-05.

## 1. Current architecture

| Object | Cardinality | Widget use |
|---|---|---|
| `DMPTrainingOffering` Document | one dated course run | Published offering picker and source for course metadata/files. Link the exact revision. |
| Department Training Plan project, proposed `IRSDepartmentTrainingPlan` | one Department × April–March FY | HOD's annual container. The widget finds or creates it and lists its WBS assignments. |
| Training Task subtype | one Person × one offering | Assignment, one assignee, planned/actual dates, employee completion and HOD attendance decision. Created inside the plan WBS. |
| Annual Monitoring | one Person × assessment round | Reads confirmed tasks by report dates and freezes the included entries when signed. |

No `IRSAnnualTrainingRecord` object is planned. The Department Training Plan
is the physical year container. Person/FY totals are queries over Training
Tasks, including tasks in different department plans if the Person transferred.

## 2. HOD journey

1. Resolve the signed-in user's current HOD departments from IRS organization
   responsibility data. If several apply, let the user select one.
2. Select an April–March financial year. Find the one Department Training Plan
   for Department × FY. Create it through a server action when none exists.
3. Show a Tabulator person summary from the current department roster and the
   plan's Training Tasks: Person, Designation, Assigned, In Progress, Awaiting
   Confirmation, Confirmed/Undergone and Last Training. A person with no tasks
   still appears as a virtual zero row.
4. Choose **Assign training**. Select one published
   `DMPTrainingOffering` revision and one current department member. Show
   title, dates, FY, provider, target designation and files before saving.
5. In one server-controlled operation, create a Training Task inside the plan
   WBS, assign exactly one Person, link the exact offering revision, set the
   planned dates and record the assigning department. Reject duplicate active
   Person × Offering assignments.
6. The employee uses the normal task experience to complete the Task.
7. The HOD confirms, rejects or cancels attendance. Only `Confirmed` counts as
   training undergone.
8. Annual Monitoring queries confirmed tasks for the person's assessment
   period and freezes the selected task/offering details at sign-off.

The widget does not offer standalone Training Tasks. It creates them inside the
Department Training Plan from the start. Moving a standalone task into a plan
is outside the selected flow.

## 3. Data and counting rules

- One Offering Document is one dated delivery. A repeat delivery is a new
  Document, optionally sharing a Course Code.
- A task links to the exact Offering Document revision, never by title or the
  latest revision.
- `assigned_count` counts distinct Training Tasks for the selected person and
  period. Status breakdowns include pending, rejected and cancelled only under
  their named categories.
- `undergone_count` counts distinct tasks whose sole assignee is the Person and
  whose HOD attendance status is `Confirmed`.
- Task completion and an ended offering do not confirm attendance.
- The offering's start date determines its April–March FY unless the business
  later approves a different boundary rule.
- Store the assigning Department on the Task for history. Current Person
  membership cannot reconstruct a past transfer.
- Signed Annual Monitoring reports keep a snapshot so later task decisions or
  Document revisions do not rewrite approved output.

## 4. Access and transaction rules

The browser filter is for usability. Every write must re-read and enforce:

1. the signed-in user's HOD responsibility for the selected department;
2. the Person's current department membership at assignment time;
3. the plan's Department and FY;
4. the offering's publication, organization, designation eligibility and
   exact revision;
5. the one-assignee rule and duplicate Person × Offering rule.

Creating the plan, task, assignee link and offering link must appear as one
operation to the user. A partial failure must be rolled back or recorded for
repair. Project membership or a credential alone is not proof that the user is
the department HOD.

## 5. Widget implementation shape

Use a dedicated `IRSTrainingManagement` UWA widget alongside `IRSProjects`
and `IRSTasks`. Reuse `JazzySole/Credentials`, `Request`, `Router`,
`TabulatorLoader`, `Ui/Format`, `Ui/CredentialBar` and Bootstrap.

Keep small AMD modules:

- `TrainingOfferingService` for published `DMPTrainingOffering` Documents;
- `TrainingPlanService` for Department × FY project find/create;
- `TrainingAssignmentService` for WBS Task creation and attendance actions;
- `DepartmentService` for HOD scope and department roster;
- separate person-summary and assignment Tabulator views/column definitions.

Use the shared CSRF renewal/retry wrapper and navigation preference. Exact API
endpoints and payloads belong in `api.md` after the project and task subtypes
are created and verified.

## 6. Remaining verification gates

| Gate | Required result |
|---|---|
| A1 | HOD account can create/open the Department Training Plan subtype with acceptable access. |
| A2 | Only one plan can be created for a Department × FY, including concurrent requests. |
| A3 | Custom Training Task subtype can be created inside the WBS and assigned to exactly one Person. |
| A4 | Task retains the exact `DMPTrainingOffering` revision and the assignee can open its files. |
| A5 | Project scheduling and lifecycle do not corrupt fixed offering dates or attendance history. |
| A6 | Employee completion and HOD confirmation are separate, enforceable actions. |
| A7 | Person/FY totals work across department plans and Annual Monitoring date boundaries. |

## 7. Superseded alternatives

The 2026-10-03 comparison considered standalone Training Tasks and an optional
Department Training Plan. On 2026-10-04 the user selected the project-based
flow. The deleted `IRSTraining` master, the standalone-task option and the proposed
`IRSAnnualTrainingRecord` remain documented only as design history.