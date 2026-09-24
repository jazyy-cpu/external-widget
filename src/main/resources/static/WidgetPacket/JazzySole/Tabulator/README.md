# JazzySole Tabulator

Tabulator **6.5.3** (`js/`, `css/`, `LICENSE`) plus one file of ours:

| File | |
|---|---|
| `TabulatorLoader.js` | AMD module `JazzySole/TabulatorLoader` 1.0.0 - the **only** supported way to load Tabulator inside a UWA widget |

## Why a loader at all

`js/tabulator.min.js` is a UMD bundle. Its second branch is

```js
typeof define === 'function' && define.amd ? define(factory) : global.Tabulator = factory()
```

A 3DDashboard widget always runs with an AMD loader present, so that branch is
taken - and because the bundle was loaded by a plain `<script>` tag rather than
requested through the loader, the loader cannot tell which module id the
anonymous `define()` belongs to and raises

```
Mismatched anonymous define() module
```

Bootstrap's JavaScript has the same shape, which is why this project does not
use it at all (UWA rule C3) and builds every control from Bootstrap classes and
native form elements instead. Tabulator cannot be replaced that way, so it is
loaded here with `define.amd` hidden for the duration of the load; the bundle
then takes its third branch and publishes `window.Tabulator`.

**Never add `tabulator.min.js` as a `<script>` tag to a widget's HTML.** The
theme CSS is a normal `<link>` - CSS has no such problem.

## Usage

In the widget's HTML, the loader and the theme only:

```html
<link rel="stylesheet" type="text/css"
      href="../JazzySole/Tabulator/css/tabulator_bootstrap5.min.css" />
<script type="text/javascript" src="../JazzySole/Tabulator/TabulatorLoader.js"></script>
```

In a view module:

```js
define('MyWidget/views/Grid', ['JazzySole/TabulatorLoader'], function (TabulatorLoader) {
    return {
        render: function (host, rows, columns) {
            return TabulatorLoader.load().then(function (Tabulator) {
                return new Tabulator(host, { data: rows, columns: columns });
            });
        }
    };
});
```

## API

| Member | |
|---|---|
| `load()` | `Promise<Tabulator>`. Loads once; later calls return the same promise, or resolve immediately if `window.Tabulator` already exists. A network failure clears the cached promise so a retry is possible |
| `VERSION` | the loader's version (`1.0.0`) |
| `TABULATOR_VERSION` | the bundled Tabulator version (`6.5.3`) |
| `SRC` | the resolved bundle URL, useful in an error message |

The bundle URL is derived from `document.currentScript.src` **at file scope** -
`currentScript` is already `null` by the time the AMD factory runs - so the
loader works wherever the package is mounted, including under the 3DDashboard
proxy path.

## Limitation

`define.amd` is global. While the bundle is loading, **no other AMD module may
be loaded**, or it would also miss `define.amd`. Call `load()` once, early, from
a point where nothing else is loading, and never load two UMD libraries in
parallel.

## Change log

| Version | Date | |
|---|---|---|
| 1.0.0 | 2026-09-24 | first version, written for the WGT-01 project grid |
