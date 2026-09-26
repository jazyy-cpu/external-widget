# 2026-09-26-01 - The grid came up empty: Tabulator had not built itself yet

| | |
|---|---|
| Date | 2026-09-26 |
| Requirement | [WGT-01](../../requirements/WGT-01-project-landing/README.md) |
| Status | fixed; not yet looked at in the dashboard |
| Done by | agent (Claude Opus 5), on the user's console output |
| Follows | [2026-09-25-02](2026-09-25-02_state-names-and-enovia-styling.md) |

## The report

> "RowManager.js:1046 Uncaught (in promise) TypeError: Cannot read properties of
> null (reading 'getBoundingClientRect')
>     at f.adjustTableSize (RowManager.js:1046)
>     at f.redraw (RowManager.js:1120)
>     at A.setHeight (Tabulator.js:867)
>     at ProjectListView.js?v=...:176
> ==> getting this issue today, project is not showing in widget" (user)

Line 176 was `table.setHeight(availableHeight())` in `load()`.

## The cause, read out of the shipped bundle

`Tabulator`'s constructor does **not** build the table:

```js
//delay table creation to allow event bindings immediately after the constructor
setTimeout(() => { this._create(); });
```

`_create()` is what calls `_buildElement()`, and only that gives
`columnManager` an element. A promise `.then` is a microtask, so our
`build().then(...)` always ran **before** that timeout - the race was not
intermittent, it was certain.

`setHeight()` is one of the few public methods with **no `initGuard()`**:

```js
setHeight(height){
    this.options.height = ...;
    this.element.style.height = this.options.height;
    this.rowManager.initializeRenderer();
    this.rowManager.redraw(true);        // -> adjustTableSize()
}
```

and `adjustTableSize()` opens with
`this.table.columnManager.getElement().getBoundingClientRect()`. `getElement()`
returned null, hence the message.

**Why it looked fine until today.** `setHeight` sets `options.height` and the
element's style *before* it throws, so the table that built a tick later normally
came out at the right height and the console error was the only trace. What it
also did was call `rowManager.initializeRenderer()` against a tree that did not
exist yet; once the real build reused that renderer, the grid came up with no
rows. Same bug, worse symptom.

## The fix

1. `build()` now resolves on Tabulator's own **`tableBuilt`** event rather than
   on the constructor returning.
2. A `ready()` test - `table.initialized === true`, Tabulator's flag - guards
   everything that touches the table: `setHeight` (via `fitHeight()`),
   `setFilter`/`clearFilter`, and the resize path.
3. A reload that arrives while the first build is still running now waits for
   `built` before `replaceData`, instead of calling it on a half-built table.
4. The load chain's error handling was `.then(ok, err)`, so a throw inside `ok` -
   exactly this crash - became an unhandled rejection: the spinner kept turning
   and the user was told nothing. It is now a `.catch` after the `.then`.

## Verification

Seven suites pass. The search suite gained source assertions, because the race
cannot be reproduced without a DOM: the view must subscribe to `tableBuilt`,
`ready()` must test Tabulator's own `initialized` flag, and every `setHeight`
call must sit within three lines of a `ready()`/`fitHeight` guard.

`node --check` clean, application restarted (2.115 s), and the served
`ProjectListView.js` confirmed over TLS to carry the `tableBuilt` subscription,
`ready()` and `fitHeight()`.

**Not verified: the dashboard.** Whether the projects are back is the user's
next look - and if the grid is still empty, the cause is elsewhere and the next
thing to read is the network tab for the projects call, not this file.

## Next

1. Reload with "Disable cache" ticked: projects listed, no console error, pager
   still on the frame's bottom edge (check G6).
2. Still open from yesterday: the display names of `Hold` and `Cancel` (G18).
