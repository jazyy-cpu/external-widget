# 01 - UWA rules and the JazzySole libraries

## 1. UWA rules the widget must follow

Sources (DS RAG library):
- `library/UWA/pdf/Universal Web App (UWA).pdf` - the UWA specification (**U**)
- `library/UWA/pdf/UWA Class_ UWA.Widget.pdf` - the `widget` object API (**W**)
- `library/R2023x/3DEXPERIENCE Configuration & Development Fundamentals R2023x_v1.7.pdf`, "Additional App Widget - Development" (**F**)
- `library/R2021x/3DEXPERIENCE Web-Services R2021x_v1.5.pdf` (**S**)

### 1.1 The file

| # | Rule | Source |
|---|---|---|
| U1 | The widget is **one XHTML page**: well-formed XML, **UTF-8**, extension `.html` / `.xhtml` / `.xml` | U, F |
| U2 | The `<html>` element carries the widget namespace: `xmlns="http://www.w3.org/1999/xhtml" xmlns:widget="http://www.netvibes.com/ns/"` | U |
| U3 | The **head** is the application: metas, `<title>`, preferences, scripts, CSS links | U, F |
| U4 | Metas use `name`/`content` (author, description, version, apiVersion, autoRefresh, debugMode, strictMode, thumbnail, screenshot). The platform reads them for display or behaviour | U |
| U5 | Every tag closed - XHTML, so `<meta ... />`, `<link ... />`, no bare `<br>` | U |

### 1.2 Preferences

| # | Rule | Source |
|---|---|---|
| P1 | Preferences live in the head, inside **exactly one** `<widget:preferences>` element | U |
| P2 | One `<widget:preference>` per preference, always closed with `</widget:preference>`; `<widget:option>` closed with `</widget:option>` | U |
| P3 | Types: `text`, `boolean`, `hidden`, `password`, `list`, `range` | U |
| P4 | Read with `widget.getValue(name)` (or `widget.getPreference(name).value`), write with `widget.setValue(name, value)`. Preferences can also be added at run time with `widget.addPreference({...})` (the Meeting widget does this) | W, ootb-meeting-widget |
| P5 | Never store a password in a preference - we use the platform session, not credentials | project rule |

### 1.3 Events and lifecycle

| # | Rule | Source |
|---|---|---|
| E1 | **`onLoad` MUST be declared**, otherwise none of the widget's JavaScript runs. No other event is dispatched before `onLoad` | U, W |
| E2 | The UWA environment may not be fully ready until `onLoad` fires - do no DOM or platform work before it | U |
| E3 | `onRefresh`: manual or programmatic refresh, and SHOULD fire when preferences change. If it is not declared, `onLoad` fires instead. Required for `setAutoRefresh` | U, W |
| E4 | `onResize`: container resized (column width, maximise). Use it to redraw Tabulator (`table.redraw()`) | U, W |
| E5 | Others available: `onViewChange`, `onKeyboardAction`, `onUpdatePreferences`, `onShowEdit`, `onHideEdit` | U, W |
| E6 | Register with `widget.addEvents({ onLoad: ..., onRefresh: ... })` in the head | U, ootb-meeting-widget |

### 1.4 Code and DOM

| # | Rule | Source |
|---|---|---|
| C1 | The `widget` object is the widget's `window`. Render into **`widget.body`** (`widget.setBody`, `widget.addBody`, `widget.getElement(s)`), not into `document.body` - several widgets share one page | U, W |
| C2 | Load code as **AMD modules** (`define` / `require`); the platform supplies RequireJS and the `UWA/*` and `DS/*` modules | F, ootb-meeting-widget |
| C3 | "You are free to use your favorite libraries" - Bootstrap and Tabulator are allowed; keep their CSS scoped so it does not restyle the dashboard | F |
| C4 | Calls to 3DEXPERIENCE services go through **`DS/WAFData/WAFData.authenticatedRequest`**. Only widgets on the trusted domain (additional apps) may call platform web services | S, F |
| C5 | A widget served over HTTPS that must call plain HTTP uses `WAFData.proxifiedRequest` | F (R2022x Widget Development Fundamentals) |

### 1.5 Consequences for our build

- The widget HTML is served by Spring from `static/WidgetPacket/<widget>/`.
  3DDashboard is HTTPS, so the widget URL must be **HTTPS** too, or the
  browser blocks it as mixed content. `external-widget` currently runs on
  `http://localhost:8080` - see open item O1 in WP03 `01-plan-and-status.md`.
- Library files are referenced **relative** to the widget HTML
  (`../JazzySole/bootstrap/css/bootstrap.min.css`), as the POC does.
- Bootstrap's global styles (reboot) touch `body` and base tags. Inside a
  dashboard iframe this is harmless, but the widget CSS should still be
  written under one root class.

## 2. JazzySole library inventory

Copied on 2026-09-23 from the POC
(`SpringProject_IRS_POC/poc_demo/.../WidgetPacket/JazzySole`) into
`external-widget/src/main/resources/static/WidgetPacket/JazzySole`, same
hierarchy.

| Library | Folder | Version | Latest stable (npm, 2026-09-23) | Action |
|---|---|---|---|---|
| Bootstrap | `bootstrap/css`, `bootstrap/js` | **5.3.8** | 5.3.8 (2025-08-26) | kept - already latest |
| Tabulator | `Tabulator/css`, `Tabulator/js` | 6.3.1 in the POC -> **6.5.3** | 6.5.3 (2026-09-15) | **upgraded**: from the npm tarball `tabulator-tables-6.5.3.tgz`, SHA-1 verified against the registry (`2593efcf...`); `dist/js/tabulator(.min).js(.map)` and all 48 `dist/css` files; `LICENSE` added |
| PlatformService | `PlatformService/PlatformServices.js` | IRS/SOLIZE code | - | kept from the POC (see below) |
| Chart.js | `ChartJS/chart.min.js`, `chart.umd.min.js` | from the POC | not checked | kept; not in the agreed set, available if needed |
| Pure.css | `PureCss/pure-min.css` | from the POC | not checked | kept |
| DragAndDrop | `DragAndDrop/DragAndDropArea.js/.css` | IRS/SOLIZE code | - | kept |

| Credentials | `PlatformService/Credentials.js`, `PlatformService/README.md` | **1.0.0 - our own** (2026-09-23) | - | AMD `JazzySole/Credentials`; OOTB credential preference with fallback |
| Router | `Router/Router.js`, `Router/README.md` | **1.0.0 - our own** (2026-09-23) | - | new shared library, AMD module `JazzySole/Router`; see its README |

Not copied: `Tabulator/Tabulator.js`, a **0-byte placeholder** in the POC.

Tabulator 6.3 -> 6.5 is a minor upgrade within major version 6 and keeps the
same API. Worth a quick check of the release notes if a POC feature behaves
differently.

### 2.1 `PlatformServices.js`

- An AMD module built on `UWA/Class` (singleton), `DS/i3DXCompassPlatformServices`
  and `DS/WAFData`. It resolves the 3DSpace / 3DSwym / 3DCompass URLs through
  `getPlatformServices({platformId: "OnPremise"})`, then reads the user's
  security context from `/resources/pno/person/getsecuritycontext`.
- The POC and the JBM copies are identical except for the module id:
  JBM `define('PlatformServices', ...)`, POC
  `define('DS/PlatformServices/PlatformServices', ...)`. The POC copy is the
  one taken.
- The `DS/` namespace belongs to Dassault Systemes modules. Using it for our
  own module risks a clash with a future DS module of the same name. **Proposal:**
  rename to an IRS namespace (for example `IRS/PlatformServices`) when the
  widget is written - open item O3.
- Compared with the OOTB pattern (`ootb-meeting-widget.md`), it does not yet add `tenant` and
  `SecurityContext` to every request, and does not keep the CSRF token. The
  Meeting widget does both in one wrapper.
