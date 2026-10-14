# IRSAnnualMonitoring widget packet

The Annual Monitoring report (G15) and Skill Matrix (G16) widget.
Requirement: [WGT-10](../../../../../../docs/requirements/WGT-10-annual-monitoring/README.md).

**Skeleton, built 2026-10-10.** The shell, the department picker, the rounds
grid and the create form exist. Nothing can be created yet, by design - see
"What does not work" below.

## Run it

The widget is static content served by the Spring app, like the other packets:

```
scripts/start-widget.ps1
```

then add `.../WidgetPacket/IRSAnnualMonitoring/IRSAnnualMonitoring.html` as an
Additional App in 3DDashboard. Nothing is registered server-side; there is no
Java for this widget.

Unit tests (pure logic, no DOM, no platform):

```
node src/test/js/irsannual-skeleton.test.js
```

## What works

| | |
|---|---|
| Shell | spinner, credential bar, shared top band, error boxes - the same shape as IRSProjects and IRSTasks |
| Department picker | plain text when there is one department, a `<select>` when there are several; the choice is a preference, so it survives a refresh |
| Routing | four routes registered; `assessments` is built, the other three show an honest placeholder with a Back button rather than a blank page |
| Rounds grid | Tabulator, final column shape, state badges |
| Create form | collects Title, Year and the April-March range, validates the dates, and posts. There is no Period field: one round per department per year (doc 10 §2.5) |

## What does not work, and why

Both are blockers recorded in WGT-10, not oversights.

**The Head of Department check now works** (2026-10-14). The rule - the person
holds `role_IRSHeadOfDepartment` or `role_IRSInCharge` on the Department through
`IRSResponsibility` - is a relationship traversal that OOTB REST cannot answer,
so it needed our own service: `GET resources/v1/irsmonitoring/departments/mine`
in `irs-monitoring-rest`, and the platform enforces it again on every read.

The seeded `js/data/departments.json` is still there, but it is now the
**failure** path, not the normal one: if the service cannot be reached the
widget lists every department, reports `degraded: true` with the error attached,
and the App shows a visible banner. It never silently implies the check passed.

**Nothing can be listed or created.** Both go to
`resources/v1/irs/annualmonitoring/...` on our own REST JAR, which is not built.
Listing shows a warning that says so - deliberately, because an empty grid
otherwise reads as "this department has no rounds", which is a different and
much more reassuring statement than the truth. Creating fails with the
underlying error attached.

That failure is useful: pressing **Create** is the first real test of whether a
POST from this widget reaches a custom modeler path at all (WGT-10 blocker B2).

## Layout

```
IRSAnnualMonitoring.html          the shell: preferences, script tags, UWA events
css/IRSAnnualMonitoring.css       the only custom CSS, all under .irs-annual
js/App.js                         start-up, the top band, routing
js/config/AssessmentFields.js     THE file to edit when the model changes
js/data/departments.json          seeded department list (placeholder)
js/services/DepartmentService.js  which departments this person may act for
js/services/AssessmentService.js  list and create rounds
js/components/DepartmentPicker.js
js/components/NewAssessmentPanel.js
js/views/AssessmentColumns.js
js/views/AssessmentListView.js
```

## Things worth knowing before editing

- **`AssessmentFields.js` holds the rules, not preferences.** The point formula,
  the grade thresholds, the 228-day ceiling and the Note text all come from the
  customer's forms. Change them there and nowhere else.
- **The browser's points calculation is feedback only.** The server computes and
  stores the value; the browser recomputes it so the HOD sees the effect while
  typing. If they ever disagree, the server is right.
- **No Bootstrap JavaScript.** It is not loaded in a UWA widget, so the create
  form is an inline card and not a modal, and every control is a native element
  with Bootstrap classes.
- **`tabulator_simple`, not `tabulator_bootstrap5`** - the bootstrap5 theme
  renders at 16px, about twice the row height of the OOTB grids beside us.
- **Own preference keys** (`jzAnnualRoute`, `xPrefAnnualDepartment`): three
  widgets may sit on one dashboard and none should move another's page.
- **Never fetch a file with a relative URL.** Inside a dashboard it resolves
  against the proxied document and returns 404. `DepartmentService` resolves an
  absolute base from `widget.getSettings().baseUrl` or a loaded script's `src`;
  anything new that reads a file must do the same.
- The overlap rule in `AssessmentFields.overlaps` is **not** "start or end in
  the range". That wording drops an item spanning the whole range. The test
  suite has a case named for it.
