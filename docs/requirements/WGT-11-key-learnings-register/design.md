# WGT-11 - design

## 1. Data flow: three index searches, nothing per row

```
Show (From, To)                                     <- required, WP11 D8
  |
  | 1  learnings      flattenedtaxonomies:"types/IRSLearning"
  |                   AND originated>="<From 00:00 local, as UTC>"
  |                   AND originated<"<To+1 00:00 local, as UTC>"
  |                   paged 200 at a time, at most 2000          -> name, title, text,
  |                                                                 state, created,
  |                                                                 origin project
  |                                                                 name / no / id
  | 2  projects       mxid:("<id>" OR ...)   50 ids a query      -> manager (ds6w:responsible),
  |                                                                 members (ownership)
  | 3  persons        types/Person AND name:("<login>" OR ...)   -> full names
  v
flat rows -> Tabulator (local paging, search box, export, print)
```

For the VM's data (3 learnings, 2 projects, 9 member logins) that is **three**
HTTP calls. In general it is `ceil(L/200) + ceil(P/50) + ceil(M/50)`, where L,
P and M are the learnings, distinct projects and distinct members **in the
range** - never a call per row, and never more than 10 pages of learnings.

### Why the index and not our REST JAR

A REST reader was written first (worklog 2026-10-25-02, steps 2-6) and then
**reverted** on the user's direction: it read the database, and a wide range
would make the kernel walk every learning, project and member. The index is
built for filtered, paged lists, it already held everything needed, and the
widget then needs **no server code of ours** - no JAR, no JPO, no TomEE
restart. Proven field by field on the VM (api.md section 2).

### Why not the OOTB project service for members

`GET /modeler/projects/{id}?$include=members` returns person ids only, no
names, and accepts no `owner` field (WGT-01 api.md section 3) - so it would be
a call per project plus a person lookup anyway. The project's **index document**
already carries both: `ds6w:responsible` is the owner's full name, and
`ownership` holds one `<login>_PRJ | Multiple Ownership For Object` entry per
member, which matched the `Member` connections exactly on both test projects.

## 2. Modules (rule R4)

| File | Role |
|---|---|
| `IRSKeyLearnings.html` | UWA shell: metas, one hidden preference (`x3dPlatformId`), script tags, addEvents - no logic |
| `js/App.js` | start-up, top band, credential bar; one page, so no router |
| `js/config/LearningFields.js` | **the file to edit**: predicates, queries, the size guards, the range rule, UTC bounds, export list |
| `js/services/IndexSearch.js` | federated search through `JazzySole/Request`: one page, every page up to a ceiling, chunked lookups |
| `js/services/LearningService.js` | the three searches and the join into flat rows |
| `js/components/LearningToolbar.js` | From / To / Show, search box, Export CSV, Print |
| `js/views/LearningColumns.js` | the nine columns |
| `js/views/LearningListView.js` | the grid, preferences, export / print, the cap warning |
| `css/IRSKeyLearnings.css` | the only custom CSS, all under `.irs-learnings` |

## 3. Decisions

| # | Decision | Why |
|---|---|---|
| W1 | **A date range is required.** Show is disabled until both dates are set; the first open reads nothing | the user, 2026-10-25: "first user have to select from and to date" |
| W2 | **Every reload starts clean** - no range, no search text, no rows; nothing is kept in preferences. First built the other way (range and search restored, rule R6), changed the same day | user 2026-10-25: "each time we reload the widget, old search should not show" - overrides R6 for this widget |
| W3 | The user's **local** days become **UTC** bounds | the index stores `originated` in UTC; bare days would move a learning written before 05:30 IST to the previous day. Proven to the second on the index API |
| W4 | **At most 2000 learnings per view**, with a warning naming the total | a partial list must never look complete; a shorter range is the answer, not a bigger download |
| W5 | **Every state** is listed, with a State column | WP11 O1 - not decided by IRS |
| W6 | A learning whose project the user **cannot read** shows "no access to the project" | the index only returns what the caller may read; blanks would read as "no manager" |
| W7 | Rows are **flat** (members joined into one string) | Tabulator's search, sort and download read fields; an array would export as `[object Object]` |
| W8 | Export = **CSV only** (with BOM, for Excel), and Print. JSON and HTML were offered first and removed: not wanted (user, 2026-10-25) | WP11 D5 - Tabulator's own, no library. XLSX/PDF = WP11 L3 |
| W9 | Paging order is `ds6w:label` | the order the verified JBM payload uses; paging needs a stable order, the grid sorts for display (newest first) |

## 4. The CSS, and why it exists (rule R1)

`tabulator_simple` as in IRSProjects, plus three things neither library can do,
all copied from IRSProjects so the widgets look alike (user: "same look and
feel"):

- the visible top band (`.irs-toolbar`);
- the grid density and the ENOVIA-blue header (WGT-01 design.md section 6);
- `.irs-lines` - keeps a learning's line breaks and lets long text wrap,
  because Tabulator cells are `nowrap`.
