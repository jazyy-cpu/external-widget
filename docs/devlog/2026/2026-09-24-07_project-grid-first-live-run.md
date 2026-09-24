# 2026-09-24-07 - The grid's first live run: A2 answered, then density, search and the pager

| | |
|---|---|
| Date | 2026-09-24 |
| Requirement | [WGT-01](../../requirements/WGT-01-project-landing/README.md) |
| Status | done (plus the toolbar trim in the update below); G4-G12, G14-G16 still to look at |
| Done by | agent (Claude Opus 5), on the user's screenshots |
| Follows | [2026-09-24-06](2026-09-24-06_wgt-01-project-list.md) |

## Goal

The user opened the widget in 3DDashboard for the first time and sent
screenshots of it beside three OOTB ENOVIA widgets (Project Gantt, Change
Governance, Libraries), with three things to fix.

## What the first run proved

| Check | Result |
|---|---|
| G1 grid renders | **pass** - three projects listed |
| G2 no `Mismatched anonymous define()` | **pass** - `TabulatorLoader` works. The grid could not have drawn at all had the UMD bundle failed |
| G3 **open item A2** | **pass** - no "server refused the state filter" strip, so `state` **is** accepted by `/resources/v1/modeler/projects`. Recorded in [api.md §4](../../requirements/WGT-01-project-landing/api.md) |

A2 had been open since 2026-09-23 and the design deliberately made the widget
answer it by itself rather than leaving it for a test session. That worked.

**New open item A4**, seen in the same screenshot: the list shows `simple
project`, an ordinary OOTB **`Project Space`**, next to our `EPMAnalysisProject`
and `EPMResearchProject`. The service returns every project the user can see and
takes no type parameter. Nothing was changed - showing a project that exists is
safer than hiding it, and the Category column names the type - but whether the
landing page should list only our subtypes is a question for the user.

## What was changed

**1. The pager now sits at the bottom of the widget.** It had been sitting
directly under the single row, half way up an empty frame. Tabulator only pins
its footer when it knows its own height, and it had none. `height` is now
measured - `clientHeight - host.getBoundingClientRect().top - 8`, floor 180px -
set when the table is built, again after each load (a warning strip pushes the
grid down) and again on every `onResize` through `table.setHeight()`.
`height: '100%'` was considered and rejected: it needs every ancestor to have a
definite height, which a UWA `widget.body` does not.

**2. One search control instead of a filter box per column.** All
`headerFilter` definitions were removed. The toolbar now carries an
`input-group`: a field picker (All fields / Project No. / Title), an input, a
magnifier button and Clear. It searches **Project No. and Title only** (the
user's instruction); an empty term calls `clearFilter` rather than installing a
match-everything filter. Enter works as well as the magnifier. The magnifier is
an inline SVG - no icon font is bundled and one shape is cheaper than adding
Bootstrap Icons for a single glyph.

**3. Denser rows.** The cause was measured, not guessed: the
`tabulator_bootstrap5` theme sets `font-size: 16px`, and our `badge rounded-pill`
was the tallest object in every row. The theme was switched to
`tabulator_simple` (14px) and the badges made square and 11px.

That alone did not reach the OOTB look, so **the widget now has one custom CSS
file**, `IRSProjects/css/IRSProjects.css`, about 60 lines, every rule under the
root class `.irs-projects`. Rule R1 allows this when Bootstrap and Tabulator
cannot do it and the reason is recorded in the requirement's `design.md` - it is,
in §6. The short version: row density is font size, line height, cell padding and
border colour; none is a Tabulator option and none is reachable with a Bootstrap
class, because the cells are Tabulator's own DOM. The file changes only density,
border greys, alternating row shading and a hover colour.

## Verification

```
node src/test/js/jazzysole-credentials.test.js      ALL CREDENTIALS TESTS PASSED
node src/test/js/jazzysole-router.test.js           ALL ROUTER TESTS PASSED
node src/test/js/jazzysole-request.test.js          ALL REQUEST TESTS PASSED
node src/test/js/irsprojects-projectservice.test.js ALL PROJECT SERVICE TESTS PASSED
node src/test/js/irsprojects-search.test.js         ALL SEARCH TESTS PASSED   (new)
```

`irsprojects-search.test.js` pins the new search rule down: "All fields" must
match Project No. and Title and **nothing else** - department, customer, status
and category values must not match. Two of its assertions were wrong on the
first run (a fixture whose title contained the word "research", and a search for
`-` that matched `PRJ-0001`); the fixture was corrected so the assertions test
what they claim.

`node --check` clean; `IRSProjects.html` still well-formed XML; application
restarted (2.125 s) and the new CSS, the `tabulator_simple` theme and every
changed module verified served with full TLS validation.

**Not verified:** the visual result. The reworked grid has not been looked at in
the dashboard yet - G14 (pager on the bottom edge) and G15 (row height beside an
OOTB widget) are exactly the two checks that judge this work.

## Next

1. Reload the dashboard tab (DevTools, "Disable cache") and look at G14 and G15,
   then work through the rest of the checklist -
   [test.md §3](../../requirements/WGT-01-project-landing/test.md).
2. **A4:** decide with the user whether plain `Project Space` projects belong on
   the landing page.
3. **A3:** more than 20 projects, so the pager can be judged at all.
4. Then the detail page: wire `JazzySole/Router` into `App.js` (WGT-02 N1-N3).

## Update 2026-09-24 - toolbar trimmed to one row

The user looked at the reworked grid and confirmed the three fixes, then asked
for the toolbar itself to go:

| Asked | Done |
|---|---|
| Remove the "3 projects" count | dropped. Tabulator's footer already says "Showing 1-3 of 3 rows" - the count was on screen twice. `ListToolbar` no longer exposes `setCount`, and `ProjectListView` no longer calls it |
| Remove the "IRS Projects" heading | dropped. The widget's own dashboard title bar names it |
| Put Refresh next to Clear | moved into the end of the search `input-group`, so the toolbar is now a single row: switch on the left, then field picker, input, magnifier, Clear, Refresh |

That gives the grid one more row of height, which is the scarcest thing in a
widget frame. `setBusy` still disables Refresh, the switch and the magnifier
while a load runs.

Five test suites still pass; the trimmed `ListToolbar.js` and `ProjectListView.js`
were re-verified served (200, full TLS validation) after a restart. The visual
result is, again, for the user to confirm - checks G14 and G15 are unchanged.
