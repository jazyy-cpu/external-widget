# 2026-10-22-01 - G12 technical publication approvals in the task widget

The user: the G12 route is created and DOC-0002 is under test; show its
approval in the task widget, "same like stm".

## What was in the way

- `InboxTaskService` drops an inbox task whose `contents[0].type` is not in
  the registry, so the Researcher / In-Charge / HOD / Division Head steps of
  `IRSPublicationApprovalRoute` never reached the list.
- `modeler/documents` returns none of a MxUpdate subtype's attributes (the STM
  finding, worklog `2026-10-19-14`), nor the project or our author link.

## What was built

| Piece | Change |
|---|---|
| `js/config/TaskFields.js` | `DOCUMENT_TYPES.IRSTechnicalPublication` (label `TECHNICAL PUBLICATION / PRESENTATION`, badge `pub`, `fields: technical-publication`, `kind: publication`) |
| `js/App.js`, `js/views/TaskListView.js` | new route `publication/:id` with `PublicationDocumentService` as loader |
| `js/services/PublicationDocumentService.js` | **new.** `GET resources/v1/irsproject/publications/{id}`, shaped as `{task, project, note}` exactly like `StmDocumentService`; the task keeps `kind: document` so the banner and panel need no change |
| `js/data/forms/technical-publication.json` | **new.** R&D-PRJ-03-Rev.01 rows in the paper's order; Date and the three signature rows hidden |
| `css/IRSTasks.css`, `IRSTasks.html` | badge `.irs-type-pub`; script tag |

`TaskDetailView` and `TaskDocumentsPanel` are unchanged.

## The server side

`irs-project-rest` gains `PublicationDocumentService` + `PublicationDocumentReader`
under a root of their own, `/publications` - `StmDocumentService` already owns
`/documents`, and two resource classes on one root leave the choice to the
container. Proven first in the JPO twin `IRSPublicationDocumentContext` on
DOC-0002. 2 round trips whatever the Document holds. Worklog `2026-10-22-12`.

## Tests

New `src/test/js/irstasks-publication.test.js`, built from the JPO's real
output: registry, inbox row, shaping (no file / one file / zip, journal type,
no project), every visible form row resolving in the paper's order, the
attributes present on the type CI, wiring, and the call and error.
`irstasks-stm`, `irstasks-pes`, `irstasks-landing` still pass.

## Open

- JAR deploy (TomEE restart), then the live check on DOC-0002 (R-0000128).
- DOC-0002 has no file checked in, so its documents-panel row offers no download.
