# IRS Tasks widget

UWA widget served by `external-widget`, for the **custom task subtypes and
their approval** (WP06). Current state: **the landing page only** - toolbar,
Tabulator grid, columns and states - on top of the shared credential bar and
router. **The grid is empty by design**: the custom task subtypes do not exist
on the platform yet, so `TaskService` makes no call.

It is a sibling of the `IRSProjects` widget and deliberately identical in look
and behaviour (user, 2026-10-03). Both can sit on one dashboard: every
preference key here is its own (`jzTaskRoute`, `xPrefTasksShowClosed`), so
neither widget moves the other's page.

Development documentation: `external-widget/docs/` - start at
[WGT-06 README](../../../../../../docs/requirements/WGT-06-task-landing/README.md),
then its [design.md](../../../../../../docs/requirements/WGT-06-task-landing/design.md).
High-level scope is [WP06](../../../../../../../documents/work-packages/06-task-approval-widget/README.md).

## Files

```
IRSTasks/
├── IRSTasks.html            UWA shell: metas, preferences, script tags, widget.addEvents - no logic
├── css/
│   └── IRSTasks.css         the widget's ONLY custom CSS, all under .irs-tasks:
│                             row density, the toolbar band, the maturity palette,
│                             the task-type palette, the "action required" badge
└── js/
    ├── App.js               AMD IRSTasks/App - onLoad / onRefresh / onResize, start sequence, routes
    ├── config/
    │   └── TaskFields.js    THE subtype registry (WP06 F1) + states, labels, badges, $fields
    ├── data/
    │   └── departments.json department id -> name + per-department field rules (empty for now)
    ├── services/
    │   ├── ConfigService.js loads js/data/*.json once each and caches it
    │   └── TaskService.js   the list call - a deliberate stub; the real calls are written down in it
    ├── components/
    │   └── TaskToolbar.js   the completed switch, the search control, Clear, Refresh
    └── views/
        ├── TaskColumns.js   Tabulator column definitions (taken from the POC grid)
        └── TaskListView.js  toolbar + grid: load, filter, paginate, redraw
```

Shared libraries it uses from `../JazzySole/`: `Credentials`, `Request`,
`Router`, `Notify`, `TabulatorLoader`, and the two promoted on 2026-10-03 for
this widget - `Ui/Format.js` (`JazzySole/Format`) and `Ui/CredentialBar.js`
(`JazzySole/CredentialBar`).

## Lifecycle

`IRSTasks.html` holds no logic. `widget.addEvents` forwards the three UWA events
to `IRSTasks/App`, which on every load and refresh:

1. shows a spinner in `widget.body`;
2. runs `Credentials.init()` - the preference is created or refreshed and the
   active credential validated;
3. renders the shared top row (the page's controls left, the credential picker
   far right) and opens the page the router remembers.

Routes: `tasks` (the list) and `task/:id` (**a placeholder** - it says the form
is not built and offers a way back). The placeholder is a real route on purpose,
so navigation, the back path and the remembered page are exercised from the
first day; the approval form then only replaces what it renders.

## The two things to know before changing it

1. **Tabulator is loaded through `JazzySole/TabulatorLoader`**, never a
   `<script>` tag - its UMD bundle would call an anonymous `define()` and break
   the module graph.
2. **Tabulator's constructor is asynchronous.** `setHeight` or `setFilter`
   called before its `tableBuilt` event throws inside Tabulator and leaves the
   grid half-built. `TaskListView` waits for that event; keep it that way.

## Tests

`node src/test/js/irstasks-landing.test.js` from `external-widget/` - the
subtype registry, the search control, the column set against the row shape, and
the stub service. No DOM and no platform needed.
