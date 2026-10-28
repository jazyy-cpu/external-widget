# 2026-10-28-03 - Periodic evaluation page by department profile: RDAREA-PES

Requirement: WGT-07 (form page). Worklog `2026-10-28-09`. Analysis: WP02 doc 21.

## What changed

| File | Change |
|---|---|
| `js/data/forms/pes-evaluation.json` | `formByProfile {AR: RDAREA-PES-Rev.00}`, `titleByProfile`; benchmark row `profileField: BenchmarkChanged`; "Any other" row `labelByProfile {AR: Please specify}` |
| `js/services/EvaluationService.js` | `shape` returns `context: {department}` from the JAR's new `department` section (null when an older JAR sends none); depends on ProjectContextService |
| `js/services/ProjectContextService.js` | `toDepartment` exported, so both loaders shape the department the same way |
| `js/views/TaskDetailView.js` | `loadContext`: with no project, the loader's own `result.context` |
| `src/test/js/irstasks-pes.test.js` | AR / R&D / no department, no mutation, section wiring |

## Notes

- An evaluation has no project; its ownership organization is its Department.
  The JAR's `EvaluationReader` (and JPO twin `IRSPeriodicEvaluationContext`)
  now send `department {linked, name, profiles, profileFields, profileError}`,
  one more round trip (the profile page).
- Page `IRSProjectFormProfiles` gains `field.BenchmarkChanged.profiles = RND`.
- **Until the new JAR is deployed** the call has no `department`, so the page
  shows the R&D form for every evaluation, as before.
- No CSS.

## Tests

`irstasks-*` (6) and `irsprojects-*` (3) all pass. The served copies in
`target/classes` are SHA-256 equal.
