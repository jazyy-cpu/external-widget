# 2026-11-19-01 - Personnel / cost page: Software Resource row (R&D only)

Requirement: WGT-07. Worklog: `2026-11-19-06`.

## What changed

| File | Change |
|---|---|
| `js/data/forms/personnel-cost.json` | row II "Software Resource required": was `hidden` / `pending`, now `source: service`, `display: software`, `profileField: SoftwareResource` |
| `js/services/ProjectContextService.js` | `toSoftware` (label = title, else number); `shape` carries `software` and `softwareError`; `sectionsFor` asks for `software` |
| `js/views/TaskDetailView.js` | `softwareBlock`: three columns Software Resource / Software evaluated / Remark (if any); `software` is a block; the failed-call fallback sets `softwareError` |
| `src/test/js/irstasks-detail.test.js` | the "row is parked" check replaced by row, shape, drawn columns, empty / error states, and per-profile checks (AR and no department: no row; R&D: right under the members) |

## Decisions (user, 2026-11-19)

- **R&D only.** R&D-PRJ-02 has the row; RDAREA-PRJ-01 page 4 has none (its only
  software mention is proposal section VII, free text). Page
  `IRSProjectFormProfiles`: `field.SoftwareResource.profiles = RND`.
- **Paper columns only**: no revision, version, evaluation date or expiry.

## Server side

JAR section `software` in `ProjectContextReader` (and its JPO twin
`IRSProjectContext`): one `getRelatedObjects` over `IRSProjectSoftware`, the
two values as relationship selects. Proven with
`exec program IRSProjectContext <project> software,department` on R&D-26005-HY.

**Order matters:** `parseInclude` rejects an unknown section, so an older JAR
answers this page's call with an error and every section shows "could not be
read". The new JAR must be deployed for the cost page to work again.

## Tests

`irstasks-*` (7) and `irsprojects-*` (3) pass. Served copies in
`target/classes` are SHA-256 equal. No CSS.

## Live check (open)

| # | Task | Expect |
|---|---|---|
| S1 | a cost task of R&D-26005-HY (Oil Spill) | row II under the members: CATIA / Not Applicable / Remarks |
| S2 | cost task T-0000113 (RDAR-26001-SR) | no Software Resource row |

## Update 2026-11-19 - column spacing

Live look (user screenshot): "Software evaluated" ran into "Remark (if any)".
The table is `table-layout: fixed` and the widget's rem is small, so the
`12rem` + `text-nowrap` column was narrower than its own header. Now `35% / 20% /
rest`, no nowrap. `irstasks-detail` passes; served copy SHA-256 equal.
