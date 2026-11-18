# 2026-11-03-01 - Project Completion approvals in the task widget

| | |
|---|---|
| Date | 2026-11-03 |
| Requirement | [WGT-09](../../requirements/WGT-09-approval-route/README.md) |
| Status | built and unit-tested; needs the JAR deployed |
| Done by | Claude Code |

## Goal

The user: add the Project Completion data to the task widget. Its route (Project Manager, In-Charge / HOD, Division Head; worklog `2026-11-03-04`) approves an `IRSProjectCompletion` Document. Same pattern as the G12 publication (devlog `2026-10-22-01`).

## What was done

| Piece | Change |
|---|---|
| `js/config/TaskFields.js` | `DOCUMENT_TYPES.IRSProjectCompletion` (label `PROJECT COMPLETION`, badge `com`, `fields: project-completion`, `kind: completion`) |
| `js/App.js`, `js/views/TaskListView.js` | new route `completion/:id` with `CompletionDocumentService` as loader |
| `js/services/CompletionDocumentService.js` | **new.** `GET resources/v1/irsproject/completions/{id}`, shaped as `{task, project, note}` like `PublicationDocumentService`. Adds the project's category (type -> Research / Analysis), Project Manager, customer and three dates; the invoice as one "No. / date" value, as the paper and the PDF |
| `js/data/forms/project-completion.json` | **new.** R&D-COM-Rev.00 rows in the paper's order; `formByProfile` AR -> `RDAREA-COM-Rev.00`; Date and the three signature rows hidden |
| `css/IRSTasks.css`, `IRSTasks.html` | badge `.irs-type-com`; script tag |

`TaskDetailView`, `TaskDocumentsPanel` and `ProjectContextService` are unchanged.

## Decisions and findings

- **Key learning features need no new code.** `learningsBlock` already has a `created` scope, whose comment names "the completion form"; `ProjectContextService` reads `learnings.created` from the project id the loader returns. The widget shows every state with a State column; the PDF leaves out Obsolete ones.
- **The four paper counts are four rows** (`No. of papers - Journal, National` and so on). The paper draws them as a small table; no table display exists for document fields, and the counts read correctly as pairs.
- **Project Manager** comes from a second round trip on the JAR (Member, Project Owner), not a filtered nested select: that select returned nothing through the PDF renderer's read on 2026-11-03.
- Own CSS: one badge colour line, the same as every other type badge (rule R1).

## The server side

`irs-project-rest` gains `CompletionDocumentService` + `CompletionDocumentReader` under a root of their own, `/completions`, registered in `IrsProjectModeler`. Proven first in the JPO twin `IRSCompletionDocumentContext` on `COM-0000002`. 2 round trips whatever the Document holds. Worklog `2026-11-03-08`.

## Verification

- New `src/test/js/irstasks-completion.test.js`, built from the JPO's real output: registry, inbox row, shaping (category, two owners, no invoice date, no project), every visible form row resolving in the paper's order with its formatted value, the learnings sections asked for, the attributes present on the type CI, wiring, the call and its error.
- `irstasks-publication`, `irstasks-stm`, `irstasks-pes`, `irstasks-landing`, `irstasks-detail` still pass.
- Served copies placed in `target/classes`, identical by SHA-256.
- Not checked: the live page. The JAR is built, not deployed.

## Next

- Deploy the JAR (TomEE stop by the user), then open a completion step from the Approvals list as each approver.
