# 2026-10-27-02 - Personnel / cost page by department profile; Reviewer Name shown

Requirement: WGT-07. Worklog: `2026-10-27-06`. Analysis: WP02 doc 15.

## What changed

`personnel-cost.json`:

- `formByProfile` / `titleByProfile`: an AR project prints
  `RDAREA-PRJ-01-Rev.01`, PROJECT PERSONNEL / COST ESTIMATION.
- **Members row**:
  - `columnProfileFields { driveAccess: DriveAccess }`, so the Drive access
    column is R&D only;
  - `columnLabelsByProfile { AR: { skills: "Competence / skill" } }`.
- **R&D only:** Change of Scope (`ChangeOfScope`) and Reason for revision
  (`ReasonForRevision`).
- **Reviewer Name:** no longer hidden. It is `display: reviewers`, the
  internal + external pair the Project Review page uses (JAR section
  `reviewers`, deployed 2026-10-22).
- **New Remarks row** (`EPMRemark`, `profileField: Remark`, AR) under the
  cost table.

Code:

- **`TaskDetailView.forProfile`** now also takes `titleByProfile`, and for a
  row with column gates it returns a copy carrying `hiddenColumns` and
  `columnLabels`. The original spec is not mutated.
- **`membersBlock(context, row)`** drops and relabels columns from those
  values.
- **`ProjectContextService.sectionsFor`** asks for `department` for column
  gates too.

## Tests

- **New:** G4 per-profile assertions (AR, R&D, no department), and a
  members-header render check (5 columns for R&D, 4 for AR).
- **Project Review section repaired.** It had failed since devlog
  `2026-10-25-02` renamed three labels, and its synchronous failure stopped
  the file before the async checks ran.
- **Result:** `irstasks-detail.test.js` passes end to end; all six
  `irstasks-*` suites pass.

## Live check (open)

| # | Task | Expect |
|---|---|---|
| C1 | cost task T-0000113 (RDAR-26001-SR) | RDAREA code and title; members without Drive access, skill headed Competence / skill; Reviewer Name Niveditha Rajan / MR XYZ; no Change of Scope or Reason; Remarks under the cost table |
| C2 | a cost task of R&D-26002-HY | as before, plus Reviewer Name; no Remarks |
