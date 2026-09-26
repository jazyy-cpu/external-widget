# WGT-01 - Design and code structure

| | |
|---|---|
| Built | 2026-09-24 |
| Status | built; **running in 3DDashboard** since 2026-09-24. Density and search reworked after the first live look - §4a |
| Requirement | [README.md](README.md) |
| API | [api.md](api.md) |

Replaces the temporary `HelloView`, which was deleted.

## 1. Modules (rule R4: one AMD module per file)

Shared, reusable by any widget - `static/WidgetPacket/JazzySole/`:

| Module id | File | Job |
|---|---|---|
| `JazzySole/Request` | `PlatformService/Request.js` | **the one request wrapper** (rule R3): 3DSpace root, `tenant`, `SecurityContext`, `Accept-Language`, CSRF tracking and the single retry (rule R5) |
| `JazzySole/TabulatorLoader` | `Tabulator/TabulatorLoader.js` | loads the Tabulator UMD bundle without tripping the AMD loader (§3) |

Widget-specific - `static/WidgetPacket/IRSProjects/js/`:

| Module id | File | Job |
|---|---|---|
| `IRSProjects/config/ProjectFields` | `config/ProjectFields.js` | lifecycle states, the `$fields` list, subtype labels, state badge colours - the only file to edit when the data model changes |
| `IRSProjects/utils/Format` | `utils/Format.js` | locale date, Bootstrap badge as a DOM node |
| `IRSProjects/services/ProjectService` | `services/ProjectService.js` | the project list call and the row mapping |
| `IRSProjects/components/ListToolbar` | `components/ListToolbar.js` | one row: the closed switch, the search control, Clear and Refresh |
| `IRSProjects/views/ProjectColumns` | `views/ProjectColumns.js` | Tabulator column definitions |
| `IRSProjects/views/ProjectListView` | `views/ProjectListView.js` | puts toolbar + grid together, loads, filters, redraws |
| `IRSProjects/App` | `App.js` | UWA lifecycle, credential bar, page switching |
| - | `css/IRSProjects.css` | the widget's only custom CSS, all under `.irs-projects` (§6) |

Nothing imports `DS/WAFData` except `JazzySole/Request`; nothing touches
`window.Tabulator` except `JazzySole/TabulatorLoader`.

## 2. Data flow

```
UWA onLoad ─► App.start
                ├─ spinner into widget.body
                ├─ Credentials.init()            (WGT-03 - preference, active credential)
                ├─ CredentialBar.render          (change credential ─► re-render the page)
                └─ ProjectListView.render
                     ├─ ListToolbar.render       (switch state read from xPrefShowClosed)
                     ├─ ProjectService.list({includeClosed})
                     │     └─ Request.get('resources/v1/modeler/projects', …)
                     │           └─ DS/WAFData/WAFData.authenticatedRequest
                     └─ TabulatorLoader.load() ─► new Tabulator(host, {columns, data, …})

UWA onResize ─► App.onResize ─► view.redraw()   (table.redraw(true))
```

A credential change re-renders the page rather than only re-fetching: a
different security context can see a different set of projects, and the grid's
filters and page number belong to the credential that produced them.

## 3. Tabulator and the AMD loader - the one real obstacle

`tabulator.min.js` is a UMD bundle:

```js
typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory()
  : typeof define === 'function' && define.amd ? define(factory)
  : global.Tabulator = factory();
```

A 3DDashboard widget always runs with an AMD loader present, so branch 2 is
taken and the **anonymous** `define(factory)` raises
`Mismatched anonymous define() module` - the bundle was not requested through
the loader, so the loader cannot tell which module id it belongs to. This is why
Bootstrap's JavaScript was avoided altogether (UWA rule C3) and why every
control in this widget is a plain Bootstrap class or a native form element.

Tabulator cannot be avoided, so `JazzySole/TabulatorLoader`:

1. hides `define.amd` (`delete`, or `undefined` if it is not configurable);
2. injects `<script src=".../Tabulator/js/tabulator.min.js">`;
3. restores `define.amd` in **both** `onload` and `onerror`;
4. resolves with `window.Tabulator`, which branch 3 has now published.

The bundle's own path is derived from `document.currentScript.src` **at file
scope** - `currentScript` is already `null` by the time the AMD factory runs -
so the loader works wherever the package is mounted, including under the
dashboard proxy path.

**Known limitation, accepted:** `define.amd` is global, so for the length of
that one script load no other AMD module may be loaded. The widget calls
`load()` once, from `ProjectListView`, while nothing else is loading. If a
future widget needs a second UMD library, load them one after another, never in
parallel.

Alternatives considered and rejected: fetch the source and `eval` it with
`define` shadowed (a CSP on the dashboard origin could block it); rebuild
Tabulator as a named AMD module (a build step this project does not have);
Tabulator's ESM build (`<script type="module">` is not part of the UWA contract).

## 4. The grid

| Setting | Value | Why |
|---|---|---|
| `layout` | `fitDataFill` | with a `minWidth` on every column, a narrow widget gets a **horizontal scroll bar** instead of squeezed columns (user, 2026-09-23) |
| `responsiveLayout` | `false` | no column may be collapsed away |
| `frozen` | Project No., Title | stay readable while scrolling sideways |
| `pagination` | local, 20, selector 10/20/50/100, `paginationCounter: 'rows'` | user decision 2026-09-23 |
| `initialSort` | `finish` ascending | planned end first |
| `headerFilter` | **none** | one search control in the toolbar instead (user, 2026-09-24) |
| rows | only `ProjectFields.LIST_TYPES` | Analysis and Research only (user, 2026-09-24). The service has no type parameter, so it is filtered here |
| `index` | `id` | so `replaceData` can keep row identity |
| `placeholder` | "No project in this view." | empty state without an extra branch |
| `height` | measured in pixels, recomputed on resize | pins the pager to the **bottom of the widget** - §4a |

The toolbar is a single row - no heading, no row count. Both were dropped on
2026-09-24 as duplicates: the widget's own title bar names it, and Tabulator's
footer already says "Showing 1-3 of 3 rows". In a frame this short, a second
label costs a row of grid. Refresh sits at the end of the search group, beside
Clear.

Search is one control, not a box per column: a field picker
(All fields / Project No. / Title), an input, a magnifier button and Clear. It
searches **Project No. and Title only** (user, 2026-09-24) through
`table.setFilter(matcher)`; an empty term calls `clearFilter` rather than
installing a match-everything filter. The magnifier is an inline SVG - no icon
font is bundled, and one shape is cheaper than adding Bootstrap Icons.

## 4a. What the first live run changed (2026-09-24)

The grid worked on the first try; three things looked wrong next to the OOTB
widgets on the same dashboard, and the user asked for all three:

| Seen | Cause | Fix |
|---|---|---|
| The pager sat directly under the single row, half way up an empty widget | Tabulator only pins its footer when it knows its own height, and it had none | `height` is measured: `clientHeight - host.getBoundingClientRect().top - 8`, floor 180px, set at build time, after every load (a warning strip moves the grid down) and on every `onResize` via `table.setHeight()` |
| Rows about twice the height of the OOTB grids | the `tabulator_bootstrap5` theme renders at **16px**, and our `rounded-pill` badges were the tallest thing in each row | theme switched to `tabulator_simple` (14px), one small scoped CSS file for the rest (§6), badges square and 11px |
| A filter box under every column heading | `headerFilter` on four columns, costing a whole row of height and duplicating the search box | all `headerFilter` removed |

`height: '100%'` was tried on paper and rejected: it needs every ancestor to have
a definite height, which a UWA `widget.body` does not have.

**Do not** make the measured height larger than the viewport. It is deliberately
`viewport - top`, so the content ends exactly at the frame's bottom edge; a value
that overflows would make a self-sizing frame grow on every resize.

Formatters return **DOM nodes**, not HTML strings, so a project title can never
inject markup. The Project No. column shows an em dash until the numbering rule
(R20) exists.

## 5. The state filter, and why the service does not trust it

`state` is documented in the DS guide but absent from the OpenAPI spec, so the
API Labs validator refused it and it is still unverified (api.md §4, open item
**A2**). `ProjectService.list()` therefore:

1. sends `state=<the six open states>`, or all eight when the switch is on;
2. if that call fails, retries **once** without `state`;
3. filters the rows itself either way, so the view is correct even if the server
   ignored the parameter;
4. returns `serverFiltered: true|false`, and the view shows a Bootstrap warning
   with the server's own message when it is `false`.

So A2 is answered by simply opening the widget: a warning strip means the
parameter is not accepted, no strip means it is.

## 6. CSS (rule R1)

Bootstrap utilities and components cover the whole layout (`container-fluid`,
`d-flex`, `gap-*`, `form-check form-switch`, `input-group`, `form-select`,
`form-control`, `btn`, `alert`, `badge text-bg-*`, `spinner-border`). The grid
uses Tabulator's `tabulator_simple` theme, a plain `<link>` in the shell.

One custom file exists: **`IRSProjects/css/IRSProjects.css`**, about 60 lines,
every rule under the single root class `.irs-projects` so it can never restyle
the dashboard (UWA rule C3). Rule R1 requires the reason to be written here:

> Row density is font size, line height, cell padding and border colour. None of
> those is a Tabulator option, and none is reachable with a Bootstrap class,
> because the cells are Tabulator's own DOM. The shipped themes are built for a
> full page - 16px (bootstrap5) or 14px with heavy `#999` borders (simple) - and
> next to the OOTB ENOVIA grids on the same dashboard the rows were roughly twice
> as tall (user, 2026-09-24: "each row looks too big… go as close as possible").
> Changing the theme alone was not enough.

What the file does, and nothing else: font size 13px, header `#f5f5f5`, lighter
borders, cell padding 4-6px, 28px minimum row height, alternating row shading and
a hover colour (both of which the OOTB grids have and `tabulator_simple` does
not), compact 11px badges, and a pointer cursor on the clickable title cell.

## 6a. Matching the OOTB grids (2026-09-25)

The user asked for the landing page to look professional beside the OOTB
widgets, "specially status and project type". Read from the OOTB Project Gantt
and Change Governance grids in the shared screenshots:

| Seen in OOTB | What we did |
|---|---|
| The **Type** column is plain text - "Analysis Project", "Project Space" - with no badge | Category renamed **Type**, badge dropped, and `TYPE_LABELS` now carries the platform's own labels ("Analysis Project", not "Analysis") |
| The **Maturity State** column is a solid rectangular badge in the platform's palette: purple for Draft, teal for In Work | Status renamed **Maturity State**; a state now maps to a CSS class of ours (`irs-state-<key>`), and the eight colours follow that palette - purple Create/Assign, teal Active, amber Review/Hold, green Complete, grey Archive/Cancel |
| Date headings read "Estimated Finish Date" | Start / Planned end became **Estimated Start** / **Estimated Finish** |
| Column headings sit on a light band in solid dark text with a definite rule under them | header background `#eef0f2`, a 2px `#c8ccd0` rule, `font-weight: 600` |
| The controls live in a distinct strip, not floating above the grid | the shared top row is now a toolbar band (`.irs-toolbar`): `#f5f5f5`, a 1px border, 3px radius |

**The trade-off, stated:** "Type" and "Maturity State" are the *platform's*
vocabulary, while the R&D-PRJ-01 form says "Project Category" and the earlier
grid said "Status". Matching the OOTB screen was the explicit instruction, and a
user moving between the two widgets sees one vocabulary. If IRS prefers the
form's words on this page, both headings are one line each in
`views/ProjectColumns.js` - the field names and the data do not change.

**Where the colours live.** The mapping state to class is in
`config/ProjectFields.js` (`STATE_CLASS`); the colours are in
`css/IRSProjects.css`. They can drift, so a test walks every state of both
policies, asks for its class, and fails if the CSS defines no rule for it - and
also fails if any state falls through to `irs-state-unknown`.

### The state names (2026-09-25)

The REST service returns the **MQL** name (`Create`); the platform's screens show
a **display** name (`Draft`). The grid now shows the display name, from
`ProjectFields.STATE_LABELS` - see the table in the requirement's README for the
mapping and which entries are confirmed rather than inferred.

This is presentation only, and the separation is load-bearing:

| Carries the MQL name | Carries the display name |
|---|---|
| the `state` query parameter, the row data, `isClosed`, the Tabulator cell value (so sorting is unaffected) | the badge text, and nothing else |

A test asserts that no display name can reach the query - a `state=Draft` would
simply return nothing, silently.

**The widget does not change state.** It shows maturity; the platform drives it.
Nothing here writes, and the maturity graph is the platform's own screen.

### Colours and legibility

The palette is read off the platform's Maturity graph: purple Draft, crimson
To Do, teal In Work, light green In Approval, grey Completed and Archived.

The three light backgrounds take **dark text** rather than the platform's white:
white on `#8cc98c` or `#b4b4b4` is about 1.9:1, which cannot be read. The
background is the platform's; only the text colour differs, and it is the
smallest deviation that keeps the badge legible.

### Badge alignment

The OOTB badges carry their text dead centre; ours sat high, because a Bootstrap
badge is an inline-block taking its height from the inherited line-height. The
badge is now `inline-flex` with `min-height: 20px` and `line-height: 1`, which
centres the text in both directions and makes every badge in a column the same
size whatever the word.

This is the third and last block of custom CSS in the widget, and it is here for
the same reason as the first: Bootstrap has no contextual colour anywhere near
the platform's Draft purple or In Work teal, and `navbar` is not a toolbar.

### Tabulator builds itself asynchronously (2026-09-26)

Tabulator's constructor does not build the table. It ends with

```js
//delay table creation to allow event bindings immediately after the constructor
setTimeout(() => { this._create(); });
```

so in the window between `new Tabulator(host, ...)` returning and that timeout
firing, `columnManager.element` is still null. A promise `.then` is a microtask
and therefore always runs **inside** that window.

`setHeight()` is one of the few public methods with **no `initGuard()`**, so it
walks straight into `rowManager.adjustTableSize()`, which reads
`columnManager.getElement().getBoundingClientRect()` - and throws. It has already
set `options.height` and the element's style by then, so the table that builds a
tick later usually looks right, which is why this went unnoticed: the symptom was
a console error, until the day the half-initialised renderer rendered no rows.

The view therefore keeps a `built` promise resolved from the `tableBuilt` event,
and a `ready()` test (`table.initialized === true`, Tabulator's own flag). Nothing
touches the table before both: not `setHeight`, not `setFilter`, and not a
`replaceData` from a reload that overtakes the first build.

While there: the load chain's error handler was `.then(ok, err)`, so a throw
inside `ok` - exactly this crash - became an unhandled rejection and the spinner
kept turning with no message. It is now a `.catch` after the `.then`.

## 7. Preferences used

| Name | Type | Set by | Purpose |
|---|---|---|---|
| `x3dPlatformId` | hidden | dashboard | tenant for every call |
| `xPref_CREDENTIAL` | list | `JazzySole/Credentials` | active credential (WGT-03) |
| `xPrefShowClosed` | hidden | this view | the closed switch survives a refresh (rule R6) |

No data, ids, tokens or anything sensitive is stored in a preference.

## 8. Decisions taken while building (2026-09-24)

| # | Decision | Why |
|---|---|---|
| 1 | The request wrapper is a **shared** `JazzySole` module, not a widget module | every future IRS widget needs the same tenant / SecurityContext / CSRF behaviour |
| 2 | CSRF logic implemented now although the landing page only reads | rule R5 is the wrapper's contract; writing it later means writing it under pressure, and it is covered by tests today |
| 3 | `ProjectService` always applies the state filter locally as well | correctness must not depend on an unverified query parameter |
| 4 | `HelloView` deleted rather than kept behind a flag | it only ever existed to prove the credential path, which WGT-03 now proves in the dashboard |
| 5 | The title click shows an information alert | the detail page needs the router (WGT-02) and its own requirement; a dead click would look like a bug |
| 6 | Dates kept as the service's ISO-like strings, formatted in the column | correct text sort with no date library and no extra sorter |
| 7 | The grid height is measured in JavaScript rather than set in CSS | only an explicit height pins Tabulator's footer, and a UWA body has no height to inherit from |
| 8 | One search control instead of per-column header filters, over Project No. and Title only | user, 2026-09-24. The other columns are badges with a handful of values, or not filled yet |
| 9 | A custom CSS file was accepted, scoped to `.irs-projects` | the alternative was rows twice the height of every neighbouring widget; reason recorded above as rule R1 requires |
| 10 | Plain `Project Space` objects are still listed | the service returns them and the Category column names the type; hiding data silently is worse. Open item **A4** |
| 11 | The toolbar shows neither a heading nor a row count | user, 2026-09-24. Both were said twice on screen, and vertical space is the scarcest thing in a widget |
