# 2026-09-24-06 - WGT-01: the project list, the request wrapper and the Tabulator loader

| | |
|---|---|
| Date | 2026-09-24 |
| Requirement | [WGT-01](../../requirements/WGT-01-project-landing/README.md) |
| Status | built and unit-tested; **dashboard checks G1-G13 pending** |
| Done by | agent (Claude Opus 5) |
| Follows | [2026-09-24-05](2026-09-24-05_3dxcontentchecker-control-widget.md) |

## Goal

Show the projects in the widget, replacing the temporary `HelloView`, following
the design already agreed with the user on 2026-09-23 (minimum columns, no task
data, Complete and Archive behind a switch, Tabulator pagination, horizontal
scroll bar, no create button, details on click). Enhancements come later.

## What was done

Eight modules, one per file (rule R4). Two of them are **shared** and will serve
every future IRS widget:

| New file | Module | Job |
|---|---|---|
| `JazzySole/PlatformService/Request.js` | `JazzySole/Request` 1.0.0 | the one request wrapper: 3DSpace root, `tenant`, `SecurityContext`, `Accept-Language`, CSRF tracked and retried once (rules R3, R5) |
| `JazzySole/Tabulator/TabulatorLoader.js` | `JazzySole/TabulatorLoader` 1.0.0 | loads the Tabulator UMD bundle without tripping the AMD loader |
| `IRSProjects/js/config/ProjectFields.js` | config | states, `$fields`, subtype labels, badge colours |
| `IRSProjects/js/utils/Format.js` | utils | locale date, badge as a DOM node |
| `IRSProjects/js/services/ProjectService.js` | service | the list call and the row mapping |
| `IRSProjects/js/components/ListToolbar.js` | component | title, count, Refresh, closed switch, search |
| `IRSProjects/js/views/ProjectColumns.js` | view | Tabulator column definitions |
| `IRSProjects/js/views/ProjectListView.js` | view | toolbar + grid, load, filter, redraw |

Changed: `App.js` (renders the list, `onResize` now really calls
`table.redraw(true)`, closes the old view before rendering a new one),
`IRSProjects.html` (Tabulator bootstrap5 theme `<link>`, the new script tags,
the new hidden preference `xPrefShowClosed`, version 0.2.0).
Deleted: `js/views/HelloView.js` - it existed only to prove the credential path,
which the dashboard now proves.

New tests: `src/test/js/jazzysole-request.test.js` and
`src/test/js/irsprojects-projectservice.test.js`.

## Decisions and findings

**1. The Tabulator UMD bundle really does clash with the AMD loader.** Read from
the shipped file rather than assumed:

```js
typeof define === 'function' && define.amd ? define(factory) : global.Tabulator = factory()
```

An anonymous `define()` from a script the loader did not request raises
`Mismatched anonymous define() module`. `TabulatorLoader` hides `define.amd`
around the injected script tag and restores it in both `onload` and `onerror`;
the bundle then publishes `window.Tabulator`. Its own URL comes from
`document.currentScript.src` read **at file scope**, because `currentScript` is
already `null` when the AMD factory runs. Accepted limitation, written down in
[design.md §3](../../requirements/WGT-01-project-landing/design.md): `define.amd`
is global, so only one UMD library may be loaded at a time.

**2. The service does not trust the `state` parameter.** It is documented in the
DS guide but missing from the OpenAPI spec, so it was never verified (open item
A2). `ProjectService` sends it, retries once without it if the call fails, and
filters the rows locally in every case - and reports `serverFiltered`, which the
view turns into a warning strip. **A2 is now answered by opening the widget**: a
strip means the parameter is refused. That seemed better than either guessing or
leaving a question open for another session.

**3. `$fields` was left exactly as tested.** `id` and `type` arrive as siblings
of `dataelements` regardless, so they are deliberately not listed - adding
untested names to `$fields` is how a whole call starts returning 400.

**4. CSRF was implemented now, although the landing page only reads.** Rule R5 is
the wrapper's contract; it is covered by six test groups today rather than
written under pressure at the first write operation. The token value is never
logged, never stored in a preference, and is not reachable through the public API
- a test asserts both of those.

**5. No custom CSS was needed** (rule R1). Bootstrap utilities plus Tabulator's
`tabulator_bootstrap5` theme covered the whole layout, including the switch, the
badges and the empty/error states.

**6. Formatters return DOM nodes, not HTML strings**, so a project title can
never inject markup.

## Verification

```
node src/test/js/jazzysole-credentials.test.js      ALL CREDENTIALS TESTS PASSED
node src/test/js/jazzysole-router.test.js           ALL ROUTER TESTS PASSED
node src/test/js/jazzysole-request.test.js          ALL REQUEST TESTS PASSED
node src/test/js/irsprojects-projectservice.test.js ALL PROJECT SERVICE TESTS PASSED
```

`node --check` clean on all nine files; `IRSProjects.html` re-checked as
well-formed XML (UWA rule A1). Application restarted
(`Started ExternalWidgetApplication in 1.925 seconds`) and every new file
verified served with full TLS validation - see
[test.md §2](../../requirements/WGT-01-project-landing/test.md). `HelloView.js`
correctly returns 404.

Noted while verifying: **`external.solize.com` does not resolve on the host** -
the elevated `setup-https-host.ps1` was never run there. The VM has the hosts
entry, which is what the dashboard needs, so host-side checks use
`https://localhost/...`. The README's verify commands were corrected.

**Not verified: anything that needs a browser.** The widget has not been opened
in 3DDashboard since these changes. In particular the Tabulator loader, the grid
layout, the horizontal scroll bar, `onResize` and the A2 question are all
untested in reality.

## Next

1. Open the widget in 3DDashboard with DevTools "Disable cache" ticked and run
   the checklist in
   [test.md §3](../../requirements/WGT-01-project-landing/test.md) (G1-G13).
   G2 and G3 are the two that could send the design back to the drawing board.
2. Record the A2 answer in `api.md` §4.
3. A3: create a few projects in the OOTB project widget - with one project the
   pager, the sort and the search cannot be judged.
4. Then the detail page: wire `JazzySole/Router` into `App.js` (WGT-02 N1-N3) and
   replace the placeholder alert with navigation to `project/<id>`.

A standing summary of where the work is and what will bite next is kept in
[docs/HANDOFF.md](../../HANDOFF.md), written for whoever picks this up.
