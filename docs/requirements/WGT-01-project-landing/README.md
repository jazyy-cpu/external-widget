# WGT-01 - Project landing page

| | |
|---|---|
| Status | **agreed, ready to design the build** (user review 2026-09-23) |
| Work package | [WP03](../../../../documents/work-packages/03-project-widget/README.md) |
| Data model | WP02 doc 05: `EPMRandD` -> `EPMAnalysisProject`, `EPMResearchProject` |
| API | [api.md](api.md) - tested 2026-09-23 |

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
│ IRS Projects                                         [⟳ Refresh]   │
│ [○ Show completed / archived]              [🔍 Search project…   ] │
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
