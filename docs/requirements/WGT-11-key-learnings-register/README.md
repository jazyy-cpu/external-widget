# WGT-11 - Key Learnings register (G14)

| | |
|---|---|
| Status | **built and unit-tested 2026-10-25** (29 checks pass). Never opened in 3DDashboard - checks K1-K10 below are open |
| Widget | `src/main/resources/static/WidgetPacket/IRSKeyLearnings/` |
| Work package | [WP11](../../../../documents/work-packages/11-key-learnings-register/README.md) |
| Source | R&D RSD V2.0 **G14** (pp. 35-36, Figures 35-36) = AR RSD V3.0 **G10** (p. 31); TO-BE R16 |
| Data model | WP02 [doc 08](../../../../documents/work-packages/02-project-task-route-ootb/08-learning-object.md) - `IRSLearning`, origin `IRSProjectLearning` |
| Devlog | [2026-10-25-01](../../devlog/2026/2026-10-25-01_key-learnings-register-widget.md) |
| Worklog | `worklog/entries/2026/2026-10-25-02_key-learnings-register-widget.md` |

## What is asked

> "This key learning dashboard will show all the project key learning with
> Project No., Project Name, Key Learnings, Project member etc. ... Date based
> filter with range selection." - G14

The user's columns (2026-10-25): learning name, learning, key learning feature,
origin project name, origin project no, project manager (the project's owner),
project members, and a date filter on the learning's **date originated**.
Tabulator look and feel, Tabulator's own export options.

The user's direction (2026-10-25, second message): read from the **search
index**, not the database, and **ask for the date range first** - so a wide
register can never hang the server.

## Acceptance

| # | Check | State |
|---|---|---|
| K1 | Opens in 3DDashboard as an Additional App; credential bar and top band look like IRSProjects | open |
| K2 | **First open shows no data** - only the prompt to choose From and To; Show is disabled until both are set | unit-tested (toolbar logic); live open |
| K3 | 18 Oct - 24 Oct lists LRN-0000001, -0000002, -0000003, newest first | **unit-tested on the VM's real index values**; live open |
| K4 | 19 Oct - 24 Oct lists LRN-0000003 only | the same query proven on the index API; live open |
| K5 | LRN-0000003 shows Project Manager *Sharad S Dhavalikar* and 5 members by full name | unit-tested; live open |
| K6 | The search box narrows the rows; the range is untouched | unit-tested (matcher); live open |
| K7 | CSV downloads the rows shown and opens in Excel with the names intact (the only export - JSON / HTML removed, user 2026-10-25) | open - also answers WP03 doc 02 **E1** (download inside the dashboard iframe) |
| K8 | Print shows the register with its title and range | open - WP03 doc 02 **E2** |
| K9 | **A reload starts clean**: empty From / To, empty search, no rows - the old search is not shown (user, 2026-10-25; replaces "a refresh returns to the same range") | unit-tested; live open |
| K10 | As a user who cannot read a project, its learnings say "no access to the project" in Manager / Members | unit-tested; live open - the API Labs account is exactly such a user (`#DENIED!`, 2026-10-25) |

## Not in this requirement

Parked in WP11: the access request to HOD / In-Charge (L1), keyword search
exact / close (L2), XLSX and PDF (L3), filter by author (L4), reused-by (L5).

## Files

| File | Content |
|---|---|
| [design.md](design.md) | data flow, modules, decisions, the CSS and why |
| [api.md](api.md) | the three index searches, what was proven on the VM, the limits |
| [test.md](test.md) | the unit suite and the live checks |
