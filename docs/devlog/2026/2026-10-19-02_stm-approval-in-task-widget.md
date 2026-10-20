# 2026-10-19-02 - STM Document approvals in the task widget

The user: the G11 route on an `IRSServiceToolMethod` Document gives the
approvers inbox tasks; *"we need to show the data to approver in same way we
are showing for different task already"*. Decisions on the plan: no Category,
no Date, **Approvals list only**, read access assumed for now.

## What was in the way

- `InboxTaskService` kept an inbox task only when `contents[0].type` was one of
  the four task subtypes, so all three STM steps were counted "connected to
  another type" and dropped. The resource itself returns them (measured: 3 of
  5 inbox tasks, route R-0000105).
- The task page reads `modeler/tasks/{id}`, which cannot read a Document. The
  OOTB `modeler/documents/{id}` answers basics and files only, even with
  `$fields=all` (`extensions: []`): none of the IRSSTM attributes, no project,
  no researchers, no route.

## What was built

| Piece | Change |
|---|---|
| `js/config/TaskFields.js` | `DOCUMENT_TYPES.IRSServiceToolMethod` (label, badge `stm`, `fields: stm-archive`, `kind: document`); `isApprovable()`, `kindOf()`; `descriptor/typeLabel/typeBadge/fieldSet` read both registries. `isListed()` unchanged, so the task grid is unaffected |
| `js/services/InboxTaskService.js` | filters on `isApprovable()`; row carries `kind` / `connectedKind`; a `typeNLS` equal to the raw type name is ignored (the platform sends `IRSServiceToolMethod`) |
| `js/views/TaskListView.js`, `js/App.js` | an STM row opens new route `document/:id` - its own path so a refresh reopens the right loader (R6) |
| `js/services/StmDocumentService.js` | **new.** `GET resources/v1/irsproject/documents/{id}/stm`, shaped exactly like `TaskDetailService`'s `{task, project, note}`: form values in `task.attributes`, researchers as a `derived` list, the route by physical id, and the Document itself as the one documents-panel row (several files download as the server's zip) |
| `js/views/TaskDetailView.js` | `options.loader` (default `TaskDetailService`); banner says "This document is ..." |
| `js/data/forms/stm-archive.json` | **new.** The labels are the R&D-STM Rev.00 form's own wording; the values come from the same selects as the signed PDF. Date and the three signatory lines are `hidden`; Category is absent |
| `css/IRSTasks.css` | one badge rule, `.irs-type-stm`, alongside the four existing ones |
| `IRSTasks.html` | script tag for the new service |

The form, documents panel, approval chain with signatures, and Approve / Reject
needed **no change**: the decision acts on the inbox task id, and `RouteService`
read the STM route unchanged (measured).

## The server side

New endpoint in `irs-project-rest` (`StmDocumentService` + `StmDocumentReader`),
proven first in the JPO twin `IRSStmDocumentContext`. Two round trips whatever
the Document holds: one batched `getInfo` (attributes, nested
`to[Reference Document].from.*` project, `from[Object Route].to.*` routes, file
names) and one `getRelatedObjects` for the researchers. Details and
verification in worklog `2026-10-19-14`.

## Tests

New `src/test/js/irstasks-stm.test.js`: the registry (approvable, never
listed), the inbox row and its label, the payload shaping (taken from the JPO
twin's real output on `2026-002`), every visible form row resolving to its
value, and the call path and error message. `irstasks-landing` passes; the detail suite passes in full when line 3148's moved path is
redirected (that pre-existing breakage is unchanged, see 2026-10-19-01).

## Open

- Live check after the JAR deploy: an STM Document Frozen with its G11 route
  started, opened from the Approvals list by each of the three approvers.
- HOD / Division Head read access to the Document and project - assumed.
- The documents panel shows the Document as one row; per-file download would
  need the OOTB per-file ticket and file ids - not asked for.
