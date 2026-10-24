# 2026-10-24-01 - G9 Verification Report: the Division Head fills the form, then approves

User: "this time for apprval the division head will fill the form". Later the
same day: "rotue can be restarted , lets built the page , and then we try from
widget the use case".

## What the platform does (measured, worklog 2026-10-24-07)

- The task call the page already makes (`GET modeler/tasks/{id}`) returns all
  14 `EPM*` attributes and the caller's own `modifyAccess`.
- `PUT modeler/tasks/{taskId}` with `dataelements` writes them while the task is
  In Approval. A value outside the range comes back as 400 `Invalid attribute
  range specified.`
- Run as the Division Head (`IPLT_User4`):
  - if they are a task **assignee**: `modifyAccess` TRUE, PUT 200;
  - if they are **not**: `modifyAccess` FALSE, PUT 400 `No modify access on the
    specified object.`
  - Their inbox task is open to them either way.

## User decision

No new back end. When the Division Head is not an assignee, the widget says
so, Approve is withheld and Reject stays open. The Project Manager then adds
them as an assignee and sends the route again ("rotue can be restarted").

## What was built

| Piece | Change |
|---|---|
| `js/config/TaskFields.js` | `EPMPROJECT_VERIFICATION`: label VERIFICATION REPORT, badge `verification`, fields `verification-report`. It is now on the landing grid and in Approvals |
| `js/data/forms/verification-report.json` | new, read-only layout as R&D-VER-Rev.00: Project Name / No., then the 14 fields in the original PDF order. Every task field has an `input` block: 11 `choice` (`values` = the range minus the blank, NA only for invoices, all `required`), legal details `requiredWhen` legal = Yes, any other details and remarks optional |
| `js/services/ApproverFormService.js` | new, mostly pure: `inputsOf`, `isRequired`, `validate`, `classify` (platform wording -> `NOT_ASSIGNEE` / `BAD_VALUE`), `currentValues`, `canWrite`. `save` is the task PUT, rejecting with `err.code` |
| `js/views/ApproverFormFields.js` | new: radios with **nothing preselected**, text areas, Bootstrap `is-invalid` / `invalid-feedback`, a live `*` on required fields (legal details gets one when legal = Yes) |
| `js/views/TaskApprovalPanel.js` | `render(task, spec)`. A form with `input` fields changes the decision bar, see below |
| `js/views/TaskDetailView.js` | passes the spec to the panel |
| `IRSTasks.html` | two script tags |
| `css/IRSTasks.css` | one badge colour line, same pattern as the other types |

The decision bar on such a form:
- If the task's `modifyAccess` is FALSE, no inputs are drawn and Approve is
  disabled; Reject (comment required) stays open. The bar shows the
  `NOT_ASSIGNEE_TEXT` message.
- Otherwise the inputs hold the task's current answers, and there are three actions:
  - **Approve** validates first and does not arm while anything is missing.
    When confirmed, it **saves the task, then decides**. A failed save never
    sends the decision.
  - **Reject** saves nothing.
  - **Save draft** writes the answers without deciding.
- A save refused with `No modify access` (the assignment removed while the page
  was open) falls back to the not-assignee state.

Every other form has no `input` fields, so its bar is unchanged. Unit test 4f
checks this.

Round trips for the approver: the task GET is the one the page already makes,
plus **one** PUT on the task and the existing PUT on the inbox task. Save draft
is one PUT.

## Tests

New `src/test/js/irstasks-verification.test.js` uses a stub DOM to drive the
real decision bar. It checks:
- the spec: order, ranges, required flags;
- validation, including the conditional legal details and the range check;
- classification, including a message found only in the response body;
- not an assignee: no inputs, Approve disabled, Reject sends with no save;
- incomplete: Approve does not arm, 23 radios marked;
- complete: `save` then `decide`, the PUT goes to the task with 14 attributes,
  and the page copy is updated;
- save refused: no decision, bar falls back;
- Save draft;
- a form with no inputs is unchanged.

Updated: `irstasks-landing` and `irstasks-stm` (the allow-list now has 5
types), and `irstasks-detail` (the render call carries the spec). `-pes`,
`-publication` and `irsprojects-detail` pass. `irstasks-detail` still stops
at the old `rest-jar/` path (open since 2026-10-19).

## Live state

Copied to `target/classes`; the Spring app serves the new files (200). The
dashboard, however, still serves its **cached `IRSTasks.html`** without the two
new script tags. RequireJS then looks the modules up by name and fails
(`scripterror` for `IRSTasks/services/ApproverFormService`). This is the same
cause as 2026-10-21 (worklog 2026-10-21-12): the 3DDashboard external-widget
cache is on for this VM. The user clears it, then the live run follows.

Worklog `2026-10-24-07`. Requirement WGT-09.
