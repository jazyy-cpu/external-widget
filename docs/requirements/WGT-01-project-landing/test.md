# WGT-01 - Tests

| | |
|---|---|
| Automated | **pass** 2026-09-24 - five suites |
| In the dashboard | **G1, G2, G3 pass** 2026-09-24 (first live run). The rest still to do, on the reworked grid |

## 1. Automated (Node, no browser)

From `external-widget/`:

```powershell
node src/test/js/jazzysole-credentials.test.js      # ALL CREDENTIALS TESTS PASSED
node src/test/js/jazzysole-router.test.js           # ALL ROUTER TESTS PASSED
node src/test/js/jazzysole-request.test.js          # ALL REQUEST TESTS PASSED
node src/test/js/irsprojects-projectservice.test.js # ALL PROJECT SERVICE TESTS PASSED
node src/test/js/irsprojects-search.test.js         # ALL SEARCH TESTS PASSED
```

Each test loads the real widget file the way a browser does - `new Function('define', source)`
with fakes for `widget`, `DS/WAFData/WAFData` and the platform services - so it
tests the file that is actually served, not a copy.

### `jazzysole-request.test.js` (13 assertions groups)

| # | Covers |
|---|---|
| 1, 1b | relative path resolved against the 3DSpace root; `tenant`; `SecurityContext`; `Accept-Language`; empty params dropped but `0` kept; a GET sends no token |
| 2 | an absolute URL passes through; `noContext` omits `SecurityContext` |
| 3, 3b | the token is captured from a response body carrying `csrf` **and** from the `X-DS-CSRFTOKEN` header; a write then sends it with no extra call |
| 4 | with no token held, a write fetches one from `resources/v1/application/CSRF` first |
| 5, 5b, 5c | **rule R5:** a 403 write refetches and retries **once**; a second failure propagates; a 404 is not retried at all |
| 6 | HTTP 200 carrying `success: false` is rejected, not returned as data |
| 7 | a timeout names the call |
| 8 | the token value is not reachable through the public API, and the module contains no `console.*` that could print it |

### `irsprojects-projectservice.test.js`

| # | Covers |
|---|---|
| 1 | `$include=none`, the exact tested `$fields` list, the six open states, and **no task fields** |
| 2, 2b-2e | the row mapping (`dataelements` flattened, subtype to label); ISO strings sort chronologically; unknown subtype shows its own name; missing fields become `''` not `undefined`; a body with no `data` is an empty list |
| 3 | the switch asks for all eight states and keeps closed projects |
| 4 | a closed project is filtered out even if the server returned it anyway |
| 5, 5b | **A2 fallback:** `state` refused -> one retry without it, local filtering, `serverFiltered: false` and a message; if the retry also fails the error reaches the caller |
| 6 | `ProjectFields`: both policies' states; `Cancel` is **not** closed; unknown state still renders |

### `irsprojects-search.test.js`

The one search control, after the per-column header filters were removed.

| # | Covers |
|---|---|
| 1 | an empty, blank or missing term returns `null` - the view clears the filter instead of installing a match-everything one |
| 2 | "All fields" searches **Project No. and Title only**: department, customer, status and category values do **not** match |
| 3 | case-insensitive, partial, and the term is trimmed |
| 4 | a single chosen field is searched alone |
| 5 | a row with an empty Project No. is simply not a match, and does not throw; no match is an empty list |
| 6 | the toolbar's field picker offers exactly the fields the matcher supports |

## 2. Served over HTTPS (2026-09-24)

`https://localhost/...` with full certificate validation
(`curl --cacert ~\.irs-certs\external-widget.crt`, never `-k`):

| Path | |
|---|---|
| `/WidgetPacket/IRSProjects/IRSProjects.html` | 200 |
| `js/App.js`, `js/config/ProjectFields.js`, `js/utils/Format.js`, `js/services/ProjectService.js`, `js/components/ListToolbar.js`, `js/views/ProjectColumns.js`, `js/views/ProjectListView.js` | 200 |
| `JazzySole/PlatformService/Request.js`, `JazzySole/Tabulator/TabulatorLoader.js` | 200 |
| `JazzySole/Tabulator/js/tabulator.min.js` | 200 |
| `IRSProjects/css/IRSProjects.css`, `JazzySole/Tabulator/css/tabulator_simple.min.css` | 200 (the theme in use since the density rework) |
| `js/views/HelloView.js` | 404 - deleted, as intended |

`IRSProjects.html` re-checked as well-formed XML (UWA rule A1).

> `external.solize.com` does **not** resolve on the host: the elevated
> `scripts/setup-https-host.ps1` has never been run there. The VM has the hosts
> entry, which is what the dashboard needs, so use `https://localhost/...` for
> host-side checks.

## 3. In 3DDashboard - the checklist

Open the dashboard tab that carries the `IRSProjects` widget with DevTools open
and **"Disable cache" ticked** (the proxy cache-busts with the *platform's*
resource version, so the browser will otherwise serve yesterday's JS).

| # | Check | Expect | Result |
|---|---|---|---|
| G1 | The grid appears at all | toolbar, columns, the test projects | **pass** 2026-09-24 - three projects listed |
| G2 | The console | **no** `Mismatched anonymous define()` - so `TabulatorLoader` did its job. `DS/3DXContentChecker/3DXContentChecker_v2.1` still fails; that one is the dashboard's own and affects every external widget (devlog 2026-09-24-05) | **pass** - the grid rendered, which it could not have done had the bundle failed |
| G3 | **A2:** a warning strip "The server refused the state filter…"? | no strip = `state` works | **pass**, no strip -> `state` is accepted. Recorded in [api.md](api.md) section 4 |
| G4 | Toggle "Show completed / archived" | Complete / Archive rows appear and disappear | |
| G5 | Refresh the browser with the switch **on** | the switch is still on (rule R6, `xPrefShowClosed`) | |
| G6 | Narrow the widget column on the dashboard | a **horizontal scroll bar**; Project No. and Title stay frozen and visible | |
| G7 | Resize the widget | `onResize` -> `setHeight` + `redraw(true)`: columns not clipped, **and the pager follows the new bottom edge** | |
| G8 | The search control: pick a field, type, press the magnifier or Enter; then Clear | only Project No. and Title match; Clear restores every row and resets the picker to All fields | |
| G18 | **Hold and Cancel**: open a project in either state and read what the platform calls it - the two display names that could not be confirmed | correct the table in README section 1 | new 2026-09-25 |
| G17 | Beside an OOTB grid on the same tab: the Type column plain, the Maturity State badge purple for Create and teal for Active, the headings and the toolbar band comparable | not a different application | new 2026-09-25 |
| G16 | The toolbar is one row - switch, field picker, input, magnifier, Clear, Refresh - with no heading and no row count | the row count appears only in Tabulator's footer | new 2026-09-24 |
| G9 | Click a project title | the information alert "the detail page is not built yet" | |
| G10 | Change the credential in the top bar | the grid reloads for the new security context | |
| G11 | Widget menu -> Refresh | one reload, not two (the start guard) | |
| G12 | Dates | locale dates, and sorting Start / Planned end orders them chronologically | |
| G13 | **A3:** paging | needs more than 20 projects; with three the pager cannot be judged | blocked on test data |
| G14 | **The pager sits at the bottom of the widget**, with one row and with twenty | the grid fills the frame; the footer is on the bottom edge, not half way up | new 2026-09-24 |
| G15 | Row height next to an OOTB widget on the same tab | comparable, not roughly double | new 2026-09-24 |

Nothing here needs a code change to run; it is all observation.
