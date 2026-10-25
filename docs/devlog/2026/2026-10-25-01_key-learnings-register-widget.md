# 2026-10-25-01 - Key Learnings register widget (G14), read from the search index

| | |
|---|---|
| Date | 2026-10-25 |
| Requirement | [WGT-11](../../requirements/WGT-11-key-learnings-register/README.md) |
| Status | done (built, unit-tested); live checks open |
| Done by | agent (Claude) |

## Goal

User: one widget for G14 showing learning name, learning, key learning feature,
origin project name and no, project manager (project owner), project members,
with a date filter on the learning's date originated; same look and feel,
Tabulator, Tabulator's default export options. Then: read from the index server
and the project data, ask for the From / To date first, because the database
approach could hang the server with a lot of data; revert the JAR change.

## What was done

1. A REST reader + JPO twin (database read, two round trips) was built, proven
   on the VM, then **reverted** on the user's direction - see worklog
   `2026-10-25-02`.
2. The index was read field by field on the VM (api.md section 2): the learning
   document carries the learning and its origin project; the project document
   carries the manager (`ds6w:responsible`) and the members (`ownership`,
   `_PRJ` entries, identical to the `Member` connections); persons carry
   `ds6wg:fullname`. The date range works on the native `originated` to the
   second; `ds6w:created` does not.
3. New packet `IRSKeyLearnings`: 7 AMD modules, shell, one scoped CSS file,
   README. Three federated searches per Show, paged and capped.
4. `src/test/js/irskeylearnings.test.js`: 29 checks on the VM's real values.

## Decisions and findings

- **Range required** before any read; a saved range is read again on start
  (R6).
- Local days -> **UTC** bounds: the index stores `originated` in UTC.
- **At most 2000** learnings per view, with a warning; a shorter range is the
  answer.
- "no access to the project" when the user can read a learning but not its
  project - the API Labs account is such a user (`#DENIED!`).
- OOTB `$include=members` gives ids only and no owner (WGT-01 api.md), so it was
  not used; the project's index document has both.
- No new CSS idea: the density rules are IRSProjects', plus `.irs-lines`.

## Verification

- `irskeylearnings.test.js`: **29/29 pass**. Other suites pass except the known
  `irstasks-detail` stale `rest-jar/` path (open since 2026-10-19).
- The 9 packet files served by `https://localhost/WidgetPacket/IRSKeyLearnings/`
  are byte-identical to the source.

## Next

- Register as an Additional App; open as IPLT_USER65; checks K1-K10.
- The first `/federated/search` response answers api.md A1-A4 (predicate names,
  `ownership` / `mxid` returned, native date comparison accepted).

## Update 2026-10-25 - first dashboard run: Date Originated and State blank

The user opened the widget: rows, members and the grid were right, but
**Date Originated and State were empty**. Members filling proved the three
searches and the native `ownership` field work; the gap was the names of the
6W when/what fields. Federated search reports them **by path**
(`ds6w:when/ds6w:created`, `ds6w:what/ds6w:status`, `ds6w:who/ds6w:responsible`)
- IRSAnnualMonitoring's AssessmentService reads exactly these on live data -
while the index API showed the short names.

Fix:
- `LearningFields`: the path names are requested, beside the short ones and the
  native `originated` / `current`;
- `IndexSearch.flatten`: a path-named field is also filed under its short name,
  so readers ask for one name;
- `LearningService`: the date falls back to the native `originated` (UTC), the
  state to `current`; the manager's login is always looked up, so the manager's full name
  arrives even if the 6W responsible does not.

Three new checks (path names; native-only; path-named manager): **32/32 pass**.
The served files are identical to the source. Answers api.md A1 in part: the
custom `ds6wg:IRS_LEARNING_*` and native fields DO come back by the names asked.
## Update 2026-10-25 - export narrowed to CSV

User: "remove json and html from widget export, it is not required, just don't show these options". `LearningFields.EXPORTS` now holds CSV only; the toolbar draws its buttons from that list, so Export shows CSV and Print. `LearningListView.exportAs` lost its JSON / HTML branches. Test updated; **32/32 pass**. WGT-11 README K7 / design W8 and WP11 D5 follow.

## Update 2026-10-25 - reload starts clean; rate-limit question

User: "each time we reload the widget, old search should not show". The From / To range and the search text were kept in three hidden preferences and restored on reload. Removed: no `xPrefLearning*` preference in the shell, `LearningFields.PREFS` gone, `LearningListView` starts with an empty range and search every time. A new check guards it; **32/32 pass**. Values already stored in an existing dashboard instance are simply no longer read. WGT-11 K9 / W2, WP11 D9 and the packet README follow.

User also asked whether one extra project call per learning could hit a rate limit. There is no call per learning: projects are looked up 50 distinct ids per query and persons 50 logins per query, one query at a time. Neither the DS API guidance (API Labs knowledge search) nor the white-paper library documents a rate limit for on-premise federated search; the constraint is search-server load, which the range requirement, the 2000-row ceiling and the sequential calls bound.
