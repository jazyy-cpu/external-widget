# 2026-10-22-02 - Stage Validation: the "Checked by" row removed

**Requirement:** WGT-07 (task page), WGT-09 (approval panel)
**Status:** done - JSON edit, no JS change; rebuild of the widget pending
**Worklog:** [2026-10-22-16](../../../../worklog/entries/2026/2026-10-22-16_stage-validation-remove-checked-by.md)

## Why

The customer confirmed that the R&D-VAL form's **Checked by** signatory is
not required. The approval route now has one level, In-Charge / HOD (platform
side: page `IRSApprovalRouteConfig`, worklog above).

## What changed in the widget

- `stage-validation.json`: the hidden `Checked by` approval row is removed,
  not kept hidden; a new `_noCheckedBy` note says why. `_hidden`, `_layout`
  and the In-Charge / HOD note updated to match (6 rows, 2 hidden).
- `irstasks-detail.test.js` section 24: asserts one signatory row
  (In-Charge / HOD, hidden, `approval`), that `Checked by` is absent, and that
  the file records the reason.
- `requirements/WGT-07-task-page/README.md`: the signatory paragraph.

Nothing on screen changes from the form file itself: the row was hidden. What
the user sees change is the WGT-09 approval panel, which reads the **live
route** and so shows one approver on any route created from now on.

## Tests

The full `irstasks-detail.test.js` still stops at line 3148 (the REST JAR
source moved off the host, devlog 2026-10-19-01) before reaching section 24,
so the section's signatory assertions were run on their own with `node -e`
against the edited file: all pass.
