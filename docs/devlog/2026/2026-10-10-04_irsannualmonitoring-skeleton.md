# 2026-10-10-04 - IRSAnnualMonitoring: the widget skeleton

| | |
|---|---|
| Date | 2026-10-10 |
| Requirement | [WGT-10](../../requirements/WGT-10-annual-monitoring/README.md) |
| Status | done - skeleton builds and its tests pass; never opened in 3DDashboard |
| Done by | Claude |

## Goal

The user: *"let's build the skeleton of the widget ... our first thing is have a
skeleton where we can create an annual monitoring report and at least we have
widget."*

## What was built

A third widget packet, `WidgetPacket/IRSAnnualMonitoring/` - 11 files, following
IRSTasks exactly so all three widgets start, fail and refresh alike.

| Piece | State |
|---|---|
| Shell, credential bar, shared top band, spinner, error boxes | built |
| Department picker - plain text for one, `<select>` for several, kept in a preference | built |
| Router with four routes | `assessments` built; the other three show an honest placeholder with a Back button |
| Rounds grid - Tabulator, final column shape, state badges | built |
| Create form - Title, Year, Period, April-March range, date validation | built |

## Decisions and findings

### Two things copied rather than invented

`tabulator_simple`, **not** `tabulator_bootstrap5` - the bootstrap5 theme
renders at 16px, roughly twice the row height of the OOTB grids beside us.
IRSTasks had already found this; my WGT-10 design said bootstrap5 and was
wrong. And **own preference keys** (`jzAnnualRoute`, `xPrefAnnualDepartment`):
three widgets may sit on one dashboard and none should move another's page.

### The create form is a card, not a modal

Bootstrap's JavaScript is not loaded in a UWA widget (rule C3), so
`new bootstrap.Modal(...)` would never run. An inline card with native inputs
and Bootstrap classes.

It deliberately does **not** check "one round per department per year and
period". That is a platform rule needing a create-check trigger; a browser check
would be a courtesy and might be mistaken for the control.

### Failure is reported, not hidden

Two places where the easy thing would have been to show nothing:

- **listing** returns `indexed: false` with a reason, and the view says the REST
  service is not built. An empty grid otherwise reads as "this department has no
  rounds" - a different and much more reassuring statement than the truth;
- **the HOD check** is not applied, because it is a relationship traversal that
  OOTB REST cannot do. `DepartmentService.mine()` falls back to a seeded
  `departments.json`, reports `degraded: true`, and the App shows a visible
  banner. The widget never implies the check passed.

The seeded JSON follows the precedent already in IRSTasks
(`js/data/departments.json`) and holds the eight real departments captured from
the VM. `fromService()` is written beside it so switching over is one function.

### Pressing Create is the B2 test

Create posts to `resources/v1/irs/annualmonitoring/assessments` on our own REST
JAR. That endpoint does not exist, so it fails - with the underlying error shown.
That failure is useful: it is the first real exercise of a **POST from this
widget through the request wrapper to a custom modeler path**, which is WGT-10
blocker B2 and has never been proven.

## Verification

`node src/test/js/irsannual-skeleton.test.js` - **20 checks, all pass.** The
suite covers the two rules most likely to be got wrong rather than the UI:

- the formula, including that `0.044 x 228 = 10.032` so a full year must be
  **capped** at 10 - the `min()` is not cosmetic;
- the grade thresholds and their form meanings;
- the April-March year, including that January belongs to the year before;
- the **overlap test**, with a case named
  `AN ITEM SPANNING THE WHOLE RANGE COUNTS` - the regression it exists for;
- the search row mapping, including splitting `IRSSkillAssessment.In Assessment`
  down to the state, and that custom attributes come back blank;
- that `list()` reports failure rather than an empty list.

`node --check` passes on all 8 modules and the JSON parses. **Never opened in
3DDashboard** - every acceptance check A1-A16 is still open.

## Next

1. Open it in the dashboard - the first click answers more than any test.
2. **B2**: press Create and read the error. Whether it is a 404 from the modeler
   or a CSRF/auth failure tells us two different things.
3. **O8**: index the three types, or listing can never work.
4. Then the creation service in the JAR, written JPO-first (rule R8).

Workspace worklog: `2026-10-10-07_irsannualmonitoring-widget-skeleton.md`.

## Update 2026-10-10 - first run in 3DDashboard: HTTP 404 on departments.json

Opened in the dashboard for the first time. The widget rendered its shell and
then stopped with:

    The widget could not start: departments.json returned HTTP 404

**Cause: a relative XHR path.** `DepartmentService.seeded()` asked for
`js/data/departments.json`. UWA rewrites the markup's `src` and `href` to
absolute URLs on the widget's host - which is why every script tag loaded -
but it cannot rewrite a URL built inside JavaScript. The relative path resolved
against the *proxied* document, so the request went to the dashboard
(`/3ddashboard/api/widget/js/data/departments.json`) for a file only our host
has.

**This was a known trap, and the skeleton reintroduced it.** IRSTasks hit the
identical failure on 2026-10-08 and its `ConfigService` carries the full note
(O-T2). Copying the packet's *shape* from IRSTasks did not carry across a fix
that lived inside one module.

**Fix:** the same three-step base resolution, now in `DepartmentService`:
`widget.getSettings().baseUrl` first, then the `src` of a script that
demonstrably loaded (already an absolute URL), then the relative path as a
degraded last resort. Every error message now carries the URL it tried, because
the status alone did not show which document the path had resolved against.

Two regression checks added - the suite is now **22, all passing**: the URL is
derived from a loaded script, and an unidentifiable script degrades to relative
rather than throwing.

Open: whether the third widget should share one copy of this resolver rather
than a third hand-copied one. Not done now - the duplication is 30 lines and
the shared-module question belongs with the JazzySole layer.
