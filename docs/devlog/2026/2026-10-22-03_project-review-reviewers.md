# 2026-10-22-03 - Project Review: Reviewer(s) shows the project's reviewers

**Requirement:** WGT-07 (task page)
**Status:** built and unit-tested; JAR built, **not deployed** (TomEE stop by the user); widget rebuild pending
**Worklog:** [2026-10-22-17](../../../../worklog/entries/2026/2026-10-22-17_project-review-reviewers-and-adhesion.md)

## Why

User, 2026-10-22: the G7 form showed the task's assignees as Reviewer(s);
show the project's internal and external reviewers instead (the REVIEWERS
section of the project form, worklog 2026-10-16-01). The route's level 2 now
follows the project type, so the assignees are no longer the reviewer pool.

## What changed

| File | Change |
|---|---|
| `js/data/forms/project-review.json` | Reviewer(s): `source: service`, `display: reviewers`, `pairLabels` {internal, external} - one row, two pairs on screen |
| `js/services/ProjectContextService.js` | `toReviewers` (names; external text as typed), `reviewers` in `shape`, `sectionsFor` asks for `reviewers`; `_toReviewers` test seam |
| `js/views/TaskDetailView.js` | `reviewerPairs` - internal names joined by ", ", external text in `irs-lines` so its line breaks show; `pairLabels` carried through `resolve`; the context-failure fallback carries a `reviewers` error |
| `src/test/js/irstasks-detail.test.js` | the Reviewer(s) block rewritten; the "no service section" assertion is now `['reviewers']` |
| JAR `ProjectContextReader` (VM `C:\dev\jar-creation`) | new `$include` section `reviewers`: `internal` = one getRelatedObjects on IRSProjectReviewer; `external` = rides on the header getInfo, so no extra round trip |

No CSS added: `irs-lines` already exists for the member skills.

## Round trips

The form page: one JAR call (it had none for G7 before). Server side: the
header getInfo (always made) plus one getRelatedObjects.

## Tests

All widget test files pass. `irstasks-detail.test.js` still reads the moved
REST JAR source at line 3148 (devlog 2026-10-19-01), so it was run from a
scratch copy pointing that one read at the edited reader; every section passed.
