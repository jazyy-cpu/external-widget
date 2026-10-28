# 2026-10-28-02 - STM archive page by department profile: RDAREA code, title and labels

Requirement: WGT-07 (form page). Worklog `2026-10-28-07`. Analysis: WP02 doc 19.

## What changed

| File | Change |
|---|---|
| `js/data/forms/stm-archive.json` | `formByProfile {AR: RDAREA-STM Rev.00}`, `titleByProfile`, `labelByProfile` on STM Number -> Tool Number, Service / Tool / Method Name -> Tool Name, Purpose ... -> Purpose and Application of Tool; level-2 note (In-Charge and HOD one level) |
| `js/views/TaskDetailView.js` | `forProfile` relabels a row from `labelByProfile` (copy, the spec is not mutated) |
| `js/services/ProjectContextService.js` | `sectionsFor` asks for `department` when a row has `labelByProfile` |
| `src/test/js/irstasks-detail.test.js` | STM AR / R&D labels, code, title, no mutation, section |

## Notes

- The Document page already loads the project context by `task.projectId`, so
  the department comes with the same JAR call; no service change.
- No CSS.

## Tests

`irstasks-*` (6) and `irsprojects-*` (3) all pass. The served copies in
`target/classes` are SHA-256 equal.

## Update 2026-10-28 - Technical Publication: RDAREA form code

`technical-publication.json` now has `formByProfile {AR: RDAREA-PRJ-02-Rev.00}`.
The rows are the same as R&D's; the level-2 note records the paper's
"In-Charge/HOD". A test was added in `irstasks-detail.test.js`, and all suites
pass. Worklog `2026-10-28-08`.
