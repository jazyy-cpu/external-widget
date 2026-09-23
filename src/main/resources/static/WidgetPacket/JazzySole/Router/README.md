# JazzySole Router 1.0.0

Page navigation for UWA widgets that **survives a widget refresh and a
dashboard reload**. Shared library: any widget under `WidgetPacket/` can use
it.

Why our own: the npm routers (Navigo 8.11.1, page.js 1.11.6, Director 1.2.8)
are unmaintained and route on `window.location`, which a 3DDashboard widget
does not control. This router keeps its state in a **hidden widget
preference**, as the OOTB Meeting widget does. Background:
`external-widget/docs/requirements/WGT-02-navigation-state/README.md`.

## Install in a widget

HTML shell (UWA):

```html
<widget:preferences>
  <widget:preference type="hidden" name="irsRoute" defaultValue=""></widget:preference>
</widget:preferences>
<script type="text/javascript" src="../JazzySole/Router/Router.js"></script>
```

The file defines the named AMD module **`JazzySole/Router`**; load it with
`require(['JazzySole/Router'], ...)` or list it in a `define` dependency.

## Use

```js
define('IRSProjects/App', ['JazzySole/Router', 'IRSProjects/Views/ProjectList',
                           'IRSProjects/Views/ProjectDetail'],
function (Router, ProjectList, ProjectDetail) {
    var router = new Router({
        defaultPath: 'projects',
        prefName: 'irsRoute',                  // the hidden preference above
        onNotFound: function (path) { console.warn('unknown route', path); },
        onError: function (err, route) { /* show a Bootstrap alert */ }
    });

    router
        .add('projects', function () { return ProjectList.render(); }, 'Projects')
        .add('project/:id', function (p) { return ProjectDetail.render(p.id); }, 'Project')
        .add('project/:id/:section', function (p) { return ProjectDetail.render(p.id, p.section); }, 'Section');

    router.onChange(function (current) { /* redraw breadcrumb from router.getBreadcrumb() */ });

    return router;
});

// UWA events
widget.addEvents({
    onLoad:    function () { require(['IRSProjects/App'], function (router) { router.start(); }); },
    onRefresh: function () { require(['IRSProjects/App'], function (router) { router.start(); }); }
});

// from a view
router.go('project/:id', { id: row.id });   // or router.go('project/' + id)
router.back();
```

## API

| Member | What it does |
|---|---|
| `new Router(options)` | `defaultPath` (required); `prefName` (default `jzRoute`); `store` (custom `{read, write}`); `maxStack` (default 20); `onNotFound(path)`; `onError(err, route)` |
| `add(pattern, handler, name)` | register a route. Pattern parts: literal, `:param`, optional `:param?`. `handler(params, route)` renders the page and may return a Promise. `name` is the breadcrumb label. Chainable |
| `start()` | open the saved page (or `defaultPath`). Call in `onLoad` **and** `onRefresh`. Guards are not asked when restoring |
| `go(path)` / `go(pattern, params, opts)` | navigate; `opts.replace: true` does not add a back-stack entry. Resolves with the current route |
| `back()` | previous page, or `defaultPath` when the stack is empty |
| `reload()` | render the current page again |
| `getCurrent()` | `{ path, pattern, params, name }` or `null` |
| `getBreadcrumb()` | `[{ path, name, params }]`: the default page, then every leading part of the current path that is a route |
| `onChange(fn)` | `fn(current, previous)` after each completed navigation; returns an unsubscribe function |
| `beforeLeave(fn)` | `fn(to, from)`; return `false` (or a Promise of `false`) to cancel, e.g. unsaved form. Returns an unsubscribe function |
| `Router.buildPath(pattern, params)` | build a path; values are URI-encoded |
| `Router.VERSION` | `"1.0.0"` |

## Behaviour

- **Saved state:** after each successful navigation the router writes
  `{"v":1,"path":"project/123","stack":["projects"]}` into the preference.
  The page is saved only **after** its handler succeeded.
- **Restore:** `start()` reads that state. If the saved path matches no
  route, or its handler fails (object deleted, no access), the router opens
  `defaultPath` instead and saves that, so the user is never stuck on a
  broken page. `onError` is still called so the widget can show a message.
- **Outside a dashboard** (no global `widget`): state is held in memory;
  everything else works the same. Useful for local testing.
- **One navigation at a time:** a `go()` while another is running is
  rejected.
- Paths are case-sensitive; leading `#` / `/` and trailing `/` are ignored.
- Only paths and ids go into the preference - never data, tokens or
  anything sensitive. The preference is visible to anyone who can open the
  widget's settings.

## Tested

Logic tested with Node against a fake `widget` object (2026-09-23):
matching, optional params, build/encode, save/restore across a new Router
instance, back stack, guard cancel, not-found and failed-restore fallback.
Still to test inside 3DDashboard: that `widget.setValue` on a hidden
preference persists across refresh and reload, and does not itself trigger
`onRefresh` (WGT-02 checks N1-N3).

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-09-23 | first version |
