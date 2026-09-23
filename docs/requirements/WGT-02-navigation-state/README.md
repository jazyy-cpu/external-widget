# WGT-02 - Navigation that survives a refresh

| | |
|---|---|
| Status | **built** - shared library `JazzySole/Router` 1.0.0, logic tested; dashboard test pending |
| Work package | [WP03](../../../../documents/work-packages/03-project-widget/README.md) |

## What is asked (user, 2026-09-23)

The widget has several levels (landing list -> project -> a section of the
project). If the user refreshes when one or two levels deep, the widget must
come back to the **same page**, not the landing page.

## 1. Router libraries checked (npm, 2026-09-23)

| Library | Latest | Released | Note |
|---|---|---|---|
| Navigo | 8.11.1 | 2021-04 | hash / history router, vanilla JS |
| page.js | 1.11.6 | 2020-04 | Express-style, history API |
| Director | 1.2.8 | 2015-02 | abandoned |

All three are unmaintained, and all route on `window.location`. In a
3DDashboard widget that is the problem, not the solution:
- the widget runs in an iframe whose URL the **dashboard** sets; a widget
  refresh (UWA `onRefresh`) or a dashboard reload loads the widget from its
  registered URL again, so a hash or path we set is not guaranteed to survive;
- the dashboard URL itself belongs to the dashboard (tabs, other widgets).

## 2. How the OOTB widget does it

The Meeting widget keeps its "where am I" in **hidden widget preferences**
(`meetingId`, `meetingName`) - see
[reference/ootb-meeting-widget.md](../../reference/ootb-meeting-widget.md) §2.
Widget preferences are stored by the platform **per widget instance**, so
they survive a refresh, a dashboard reload and a new browser session.

## 3. Proposal: a small own router module, state in a hidden preference

- One module `Router` (one file, rule R4), no external library.
- Routes are plain strings with parameters, for example
  `projects` (landing), `project/<physicalId>` (detail),
  `project/<physicalId>/<section>` (a tab of the project).
- `Router.go(route)` renders the page and saves the route with
  `widget.setValue('irsRoute', route)` - a `<widget:preference type="hidden"
  name="irsRoute" defaultValue="projects">` in the HTML shell.
- On `onLoad` and `onRefresh` the init module reads `widget.getValue('irsRoute')`
  and opens that page; if the object no longer exists or is not accessible,
  it falls back to `projects` with a Bootstrap alert.
- A Bootstrap `breadcrumb` shows the path and lets the user go back up.
- Optional later: also mirror the route in `location.hash` for deep links
  when the widget is run standalone (outside the dashboard).

Why not a library: 50-100 lines of our own code do exactly this, with no
dependency on `window.location` and nothing unmaintained to carry.

## 3a. Built (user, 2026-09-23)

The proposal was accepted and built as a **shared library** so every widget
can use it: `src/main/resources/static/WidgetPacket/JazzySole/Router/Router.js`
(AMD module `JazzySole/Router`), documented in the
[library README](../../../src/main/resources/static/WidgetPacket/JazzySole/Router/README.md).
Node test: `src/test/js/jazzysole-router.test.js` - passes.

## 4. To verify in the first dashboard test

| # | Check |
|---|---|
| N1 | A hidden preference set with `widget.setValue` is still there after widget refresh, dashboard reload and logout / login. Strong indication already: the Meeting app's credential preference survives refresh and a login from another browser (user, 2026-09-23), because 3DDashboard stores widget preferences server-side - see WGT-03 section 1 |
| N2 | Two instances of the widget on one dashboard keep separate routes |
| N3 | `widget.setValue` on the hidden preference does not itself trigger `onRefresh` (the UWA spec says implementations SHOULD fire it when preferences change - would cause a loop if it did for hidden ones) |
