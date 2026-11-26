# 2026-11-26-01 - Approval bar: comment mandatory for Approve and Reject, red placeholder

Requirement: WGT-09. Worklog `2026-11-26-01`.

## Why

Approve with an empty comment ended in "The platform would not accept this
decision (400)". The cause is the platform, not the widget call:
`emxInboxTaskBase` promote check (OOTB JPO, line 847) refuses an empty comment
on Approve / Abstain / Reject while `emxComponents.Routes.EnforceAssigneeApprovalComments=true`
and `emxComponents.Routes.ShowCommentsForTaskApproval=true` - the values DS ships.
The widget's "required to reject, optional to approve" rule could never succeed
on an approval. The user chose to follow the platform rather than change the
property.

## What changed

| File | Change |
|---|---|
| `src/main/resources/static/WidgetPacket/IRSTasks/js/views/TaskApprovalPanel.js` | placeholder `Comment (mandatory)`, class `irs-required`, `required`; Approve disabled (tooltip "A comment is mandatory") until text is typed, like Reject; the comment input re-syncs both buttons; `handle` refuses either decision with no comment; doc comment states the platform rule |
| `src/main/resources/static/WidgetPacket/IRSTasks/css/IRSTasks.css` | `.irs-tasks .irs-decide .irs-required::placeholder` in `var(--bs-danger)` |
| `src/test/js/irstasks-detail.test.js` | the comment-rule assertions now check the new placeholder, Approve waiting for a comment, and the red class |

## Own CSS - why

Bootstrap has no placeholder-colour utility, and `text-danger` on the textarea
would turn the typed comment red too. One rule under the widget root, using
Bootstrap's own `--bs-danger`.

## Result

`node src/test/js/irstasks-detail.test.js` - all suites pass. Live check in the
widget pending (the user's).
