# 2026-10-28-01 - G7 Project Review: the reviewer fills it; RDAREA rows by profile

Requirements: WGT-09 (decision bar), WGT-07 (form page). Worklog `2026-10-28-01`.
Analysis: WP02 doc 17.

## What changed

| File | Change |
|---|---|
| `js/services/ApproverFormService.js` | `inputsOf` reads `input` on box `rows` and numbers them; new `inputsFor(spec, step)` that honours `inputAtStep`; choice values may be `{value, label}` |
| `js/views/ApproverFormFields.js` | labelled radios; new `lineRow` for `text` and `date` (`toDay` / `fromDay`, local noon ISO) |
| `js/views/TaskApprovalPanel.js` | the bar asks `inputsFor(spec, step)` instead of `inputsOf(spec)` |
| `js/views/TaskDetailView.js` | `forProfile` filters a box's items by `profileField` |
| `js/services/ProjectContextService.js` | `sectionsFor` asks for `department` when a box item is gated |
| `js/data/forms/project-review.json` | `inputAtStep: 2`; `formByProfile {AR: RDAREA-REV-Rev.00}`; inputs on all seven attributes (Next Review Date optional); `profileField` Validation / DataDrive |
| `src/test/js/irstasks-verification.test.js` | section 5: G7 inputs, numbering, AR filter, level gating, save-before-decide, stored values, date |
| `src/test/js/irstasks-detail.test.js` | project-review sections now `['department','reviewers']` (same JAR call); G7 `forProfile` AR / R&D checks |

## Notes

- Level gating uses `step.order`, which is the route's `taskOrder` (RouteService).
- Bootstrap only: `form-control`, `w-auto` on the date input; no new CSS.
- **Not proven live yet:** the write formats for a boolean (`TRUE` / `FALSE`)
  and a timestamp (ISO) on `PUT modeler/tasks`. G9 only wrote ranges and
  text. The first reviewer save answers this. A refusal shows as the
  "not allowed for its field" message, and the decision is not sent.

## Tests

`irstasks-*` (7 suites) and `irsprojects-*` (3) all pass.

## Update 2026-10-28 - Verification Report: RDAREA form code

`verification-report.json` has `formByProfile {AR: RDAREA-VER-Rev.00}` (AR
gateway G8). The papers are otherwise identical, so no field is gated. A test
was added in `irstasks-detail.test.js`, and all suites pass. Worklog
`2026-10-28-02`.
