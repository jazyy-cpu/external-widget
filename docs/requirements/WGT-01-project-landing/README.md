# WGT-01 - Project landing page

| | |
|---|---|
| Status | **running in 3DDashboard** since 2026-09-24; density and search reworked after the first live look. Remaining checks in [test.md](test.md) §3 |
| Work package | [WP03](../../../../documents/work-packages/03-project-widget/README.md) |
| Data model | WP02 doc 05: `EPMRandD` -> `EPMAnalysisProject`, `EPMResearchProject` |
| API | [api.md](api.md) - tested 2026-09-23 |
| Design and code | [design.md](design.md) - modules, data flow, the Tabulator / AMD obstacle |
| Tests | [test.md](test.md) - automated tests pass; the dashboard checklist is the next task |

## What is asked

The first page of the widget lists the projects. Minimal custom CSS
(docs README rule R1). Projects are **created with the OOTB project
widget**, not here - this page has no create button.

## 1. Which projects are shown

Lifecycle (MQL): policy `Project Space` = Create, Assign, Active, Review,
Complete, Archive; policy `Project Space Hold Cancel` = Hold, Cancel.

| View | States | |
|---|---|---|
| **Default** | everything **except Complete and Archive**: Create, Assign, Active, Review, Hold, Cancel | user decision 2026-09-23 |
| Closed (switch on) | Complete, Archive added | Bootstrap `form-switch` "Show completed / archived" |

The state is still visible per row as a badge, so the user can tell Hold
and Cancel apart from running projects. Quick filtering by state is done
with the Status column's header filter.

## 2. Columns - minimum to identify a project

User 2026-09-23: **no task data on the landing page**, only the minimum
needed to recognise a project; everything else is on the project detail
page (click on the row).

| # | Column | Source (REST field) | Note |
|---|---|---|---|
| 1 | Project No. | `EPMProjectNo` | frozen left; empty until numbering (R20) |
| 2 | Title | `title` | frozen left; click opens `project/<id>` |
| 3 | Category | `type` -> "Analysis" / "Research" | Bootstrap badge |
| 4 | Department | `IRSDepartmentProject` | shown empty until the relationship exists |
| 5 | Customer | `IRSProjectCustomer` | shown empty until the relationship exists |
| 6 | Status | `state` | Bootstrap badge |
| 7 | Start | `estimatedStartDate` | |
| 8 | Planned end | `estimatedFinishDate` | |

Moved to the detail page: progress (`percentComplete`, a roll-up of the
tasks), project manager and members (open item A1), actual dates,
description, the EPM form fields. So the list call stays
`$include=none` with a short `$fields` list.

**Later** (user): CAT and Screening approval columns.

## 3. Layout

Bootstrap + Tabulator (`tabulator_bootstrap5` theme) only.

```
┌────────────────────────────────────────────────────────────────────┐
│ [○ Show completed / archived]  [All fields ▾][    ][🔍][Clear][⟳]  │
├────────────────────────────────────────────────────────────────────┤
│ Project No │ Title ║ Category │ Dept │ Customer │ Status │ Start │ Planned end │  ◄═══►
├────────────────────────────────────────────────────────────────────┤
│ Showing 1-20 of 23                            « 1 2 »  [20 ▾]      │
└────────────────────────────────────────────────────────────────────┘
```

- **Tabulator pagination** (local, page size 20 with a size selector).
- Header filters on Title, Category, Status; global search box.
- Default sort: planned end ascending.
- **Horizontal scroll bar** (user): Tabulator `layout: "fitDataFill"` with minimum column widths, so a narrow widget scrolls sideways instead of squeezing or hiding columns. Project No. and Title are **frozen** so they stay visible while scrolling. No `responsiveLayout` collapse. `onResize` -> `table.redraw()`.
- Empty / error: Bootstrap `alert`.
- **The pager sits at the bottom of the widget**, not under the last row (user, 2026-09-24): the grid is given a measured pixel height that fills the frame.
- **One search control, no per-column filter boxes** (user, 2026-09-24): field picker (All fields / Project No. / Title) + input + magnifier + Clear, with Refresh next to Clear. Only **Project No. and Title** are searchable.
- **No "IRS Projects" heading and no row count in the toolbar** (user, 2026-09-24): the widget's own title bar names it and Tabulator's footer already counts the rows.
- **Compact rows, close to the OOTB grids** (user, 2026-09-24): `tabulator_simple` theme at 13px with one small scoped CSS file - the only custom CSS in the widget.

## 4. Decisions log

| Date | Decision |
|---|---|
| 2026-09-23 | Default = all states except Complete and Archive; switch to include them |
| 2026-09-23 | Tabulator pagination |
| 2026-09-23 | No create button - projects are created in the OOTB widget |
| 2026-09-23 | Department and Customer columns shown empty for now |
| 2026-09-23 | CAT and Screening approval: decide later |
| 2026-09-23 | Navigation must survive a refresh -> [WGT-02](../WGT-02-navigation-state/README.md) |
| 2026-09-23 | No task data on the landing page; minimum columns only; detail on click |
| 2026-09-23 | Horizontal scroll bar on the grid, first two columns frozen |
| 2026-09-24 | The pager is pinned to the bottom of the widget even with one row |
| 2026-09-24 | One search control over Project No. and Title; no header filter on any column |
| 2026-09-24 | Toolbar is one row: heading and row count dropped as duplicates, Refresh moved beside Clear |
| 2026-09-24 | Compact rows: `tabulator_simple` theme plus one scoped CSS file, as close to the OOTB grids as reasonable |
| 2026-09-24 | `state` **is** accepted by the service (A2 answered); the local filter stays as a safety net |
| 2026-09-24 | Plain `Project Space` projects are listed too - whether to show only our EPM subtypes is open item **A4** |

## 5. What is built (2026-09-24)

Everything in sections 1-3 is implemented and the temporary `HelloView` is
deleted. Details in [design.md](design.md); the short version:

- eight modules, one per file (rule R4), listed in design.md section 1;
- all REST goes through the new shared `JazzySole/Request` (rules R3 and R5);
- Tabulator is loaded by the new shared `JazzySole/TabulatorLoader`, because its
  UMD bundle would otherwise raise `Mismatched anonymous define()` - design.md
  section 3 is the one part of this requirement worth reading before touching it;
- **one small scoped CSS file** for row density, the only custom CSS in the
  widget, with the reason recorded as rule R1 requires (design.md section 6);
- `xPrefShowClosed` keeps the closed switch across a refresh (rule R6);
- the state filter is applied locally as well as sent, so the view is right
  whatever the server does with the parameter (open item A2).

Not built here, on purpose: the project detail page (needs WGT-02's router and
its own requirement), Department and Customer values (relationships do not
exist), CAT and Screening approval columns (decided later), project numbering.

## 6. Next

1. Look at the reworked grid in the dashboard and finish the remaining checks in
   [test.md](test.md) section 3 (G4-G12, G14, G15).
2. **A4:** decide whether the list shows only `EPMAnalysisProject` /
   `EPMResearchProject` or every project the user can see (today: everything).
3. **A3:** more than 20 projects, so the pager can actually be judged.
4. Then the project detail page: wire `JazzySole/Router` into `App.js` (WGT-02
   checks N1-N3) and replace the placeholder alert in `App.js` with navigation
   to `project/<id>`.
