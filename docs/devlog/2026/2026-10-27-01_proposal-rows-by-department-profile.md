# 2026-10-27-01 - Proposal: RDAREA rows, Screening Committee, rows by department profile

Requirement: WGT-07 (task page). Worklog: `2026-10-27-03` (JPO twin, JAR, page).
Platform side of the same rule: worklog `2026-10-27-02` (AEF project form).

## What changed

`project-proposal.json`:

- **Two new rows** after VI Input: `EPMResources` (Resources (hardware,
  software, any other technology)) and `EPMRequiredCompetenceSkill` (Required
  competence / skill). These are RDAREA-PRJ-01-Rev.01 sections VII and VIII, and
  sit where that paper puts them, before Methodology.
- **Screening Committee row back**, as `display: choice`. The attribute was
  created in DMC on 2026-10-27.
- **Eight rows carry `profileField`**: the two above (`AR`), and VIII to XIII
  (`RND`). XII (lessons) and XIII (risks) are included here, although on the
  AEF form they are tabs rather than fields.
- **`formByProfile`** `{ "AR": "RDAREA-PRJ-01-Rev.01" }` sets the form code
  printed in the header.

Code:

- **`ProjectContextService.toDepartment`** keeps `profiles`, `profileFields`
  and `profileError`. `profileFields` is `null` when the service sends none,
  which is the JAR before this change.
- **`sectionsFor`** asks for `department` whenever a row has a `profileField`.
- **`TaskDetailView.forProfile`** drops rows the department's profile does not
  see and sets the form code. It runs after the context is loaded. The rule is
  the one `IRSProjectUI:showForProfile` applies:
  - no key, or a key the page does not list: the row is shown;
  - no department, a failed read, or an unreadable page: hidden;
  - otherwise: shown when the department is in one of the key's profiles;
  - one addition: with no map at all (old JAR), every row is shown, as before.
- **`choice`** also turns `_` into a space, so `Not_Applicable` prints as
  `Not Applicable`.

## Where the profiles come from

Page `IRSProjectFormProfiles` is the single source (user, 2026-10-27). The
REST department section reads it in one extra round trip
(`ProjectContextReader.addProfiles`, proven first in the JPO twin
`IRSProjectContext`). The widget holds no copy of it. `departments.json`
stays unused.

## Tests

`irstasks-detail.test.js`:

- **New section 10b**, about 30 assertions:
  - AR, R&D, no department, Rule Development, a failed read, the old JAR and
    an unreadable page;
  - paper order;
  - the form code;
  - every key exists on the page;
  - Screening, and `Not_Applicable`.
- **Counts updated**: 25 rows, 16 project rows, 4 hidden; `choice` added to
  the displays.
- **Stale path repointed** to `PLM_PRD_CUSTOMIZATION/jar-development`. The
  JAR source moved there on 2026-10-19.

Result: passes up to the Project Review section at line 3768. That section
fails on labels that `project-review.json` changed in devlog `2026-10-25-02`
(for example `Validation (R&D form only)` is now `Validation`). The failure is
older than this change and not fixed here. The other five IRSTasks suites pass.

## Live check (open)

It needs the rebuilt JAR deployed (TomEE restart) and the widget redeployed.
Until the JAR is deployed, the widget shows every row, as before.

| # | Task | Expect |
|---|---|---|
| L1 | proposal of P-0000104 (RDAR-26001-SR) | Resources and Competence after Input; no VIII-XIII; header `RDAREA-PRJ-01-Rev.01`; Screening at the foot |
| L2 | proposal of R&D-26002-HY | VIII-XIII as before, no Resources / Competence; `R&D-PRJ-01-Rev.06` |
| L3 | a project with no department | none of the eight |
