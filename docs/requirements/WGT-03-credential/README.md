# WGT-03 - Credential (security context): store, change, show

| | |
|---|---|
| Status | **working in 3DDashboard** (2026-09-24): `JazzySole/Credentials` 1.0.0 + widget `IRSProjects` showing Hello World and the credential bar; T1 done - the OOTB module is not reachable from an external widget, the fallback carries it (§6); T2-T4 pending |
| Work package | [WP03](../../../../documents/work-packages/03-project-widget/README.md) |

## What is asked (user, 2026-09-23)

1. Store the credential the user selects, per widget.
2. Let the user change it; everything after that runs with the new one.
3. Show the **active credential at the top** of the widget.

Example given: JBM `WidgetDevelopment/PreferenceTest` (read-only reference).

## 1. Sources

| Source | What it gives |
|---|---|
| DS use case **"Credentials with Widget App"** (CAAi3DXPnOSCChoice, R2024x, API Labs catalog) | the documented recipe: Get Me -> list preference `SC` via `widget.addPreference` -> keep the previous value if still valid, else the user must choose -> send it as the `SecurityContext` header |
| DS **"Get Me"** (R2024x) | `GET /resources/modeler/pno/person?current=true&select=collabspaces`; no `SecurityContext` header needed. **`select=preferredcredentials` is deprecated since 2024x FD01** |
| JBM `PreferenceTest` | same idea; builds `ctx::role.org.collabspace` and a display label `collabspace ● org ● role` |
| OOTB Meeting widget | uses the internal `DS/ENOXWidgetPreferences.addCredentialPreferenceToWidget()` ([ootb-meeting-widget.md](../../reference/ootb-meeting-widget.md) §4) |

### What we do differently from the JBM example

| JBM example | Problem | Ours |
|---|---|---|
| calls `widget.setValue('SC', preferred)` on **every load** | overwrites the user's own choice each time the widget loads - the opposite of the requirement | keep the stored value when it is still in the list (DS rule) |
| relies on `preferredcredentials` | deprecated since 2024x FD01; DS removed "preferred" from the use case in Feb 2024 | not used |
| global `window.*` functions, inline styles, one big file | against rules R1 / R4 | module file, Bootstrap only |

### The OOTB way, read from the VM (user pointer, 2026-09-23)

The user observed that the Meeting app keeps its credential across a widget
refresh **and** a login from another browser. The module behind it,
`DS/ENOXWidgetPreferences/js/ENOXWidgetPreferences` (VM:
`webapps/3dspace/webapps/ENOXWidgetPreferences/ENOXWidgetPreferences.js`,
13.7 KB, read-only copy), does this:

| Step | What the OOTB code does |
|---|---|
| Key | preference **`xPref_CREDENTIAL`** (`getCredentialPreferenceKey()`), type `list`, label "Credentials" (NLS) |
| List | Get Me: `/resources/modeler/pno/person?current=true&select=collabspaces&tenant=<x3dPlatformId>&timestamp=...`, `Accept-Language: widget.lang`, 5 s timeout |
| Values | `role.organization.collabspace` (internal names) |
| Labels | `collabspace title ● role nls`, with `● organization title` in the middle only when the user has more than one organization |
| Order | sorted by label; admin credentials (roles containing `3DDRestrictedOwner`, `VPLMProjectAdministrator`, `VPLMAdmin`) listed **last** |
| On load | stored value still in the list -> **kept**; empty or no longer valid -> **first option** is set |
| Placement | inserted as the 1st preference (2nd if a visible platform preference exists) |
| Edit dialog | listens to `onEdit` / `endEdit` / `onUpdateValue`: reloads the list when the platform changes, restores the old values on Cancel |
| Use | the Meeting widget sends `SecurityContext=ctx::` + `widget.getValue('xPref_CREDENTIAL')` |

**Why it survives refresh and another browser:** the value is a **widget
preference, which 3DDashboard stores server-side per user and per widget
instance** - not browser storage. Any preference we create (this one, and
the router's hidden `irsRoute` in WGT-02) gets the same persistence. This is
also the answer to router check N1 in principle; it still needs one test.

## 1a. Decision: reuse the OOTB credential preference

Recommended (confirm Q1): call
`ENOXWidgetPreferences.addCredentialPreferenceToWidget()` exactly as the
Meeting widget does, instead of re-implementing the DS use case.

| For | Against |
|---|---|
| identical behaviour to the OOTB apps users already know: same "Credentials" entry in Preferences, same labels, same order | internal DS module, not in the public API docs - may change between releases |
| proven: keeps the choice across refresh, reload and browsers (user observation) | when nothing is stored it takes the first option instead of asking |
| handles platform switch and Cancel in the Preferences dialog, which we would otherwise write ourselves | |

Mitigation: wrap it in our own shared module `JazzySole/Credentials`, so the
widget never calls the DS module directly. If the DS module is missing or
fails, the wrapper falls back to the documented DS use case (Get Me +
`widget.addPreference`) with the **same key `xPref_CREDENTIAL`**, so the
stored value is shared either way.

This also answers **Q2**: follow the OOTB default (first option in the
sorted list), consistent with the other apps. The top bar shows the active
credential, so a wrong default is seen at once and changed.

## 2. Design

### 2.1 Data

- Get Me response: `collabspaces[] { name, title, couples[] { organization { name, title }, role { name, nls } } }`.
- One credential per couple:
  - **value** `role.org.collabspace` (internal names), sent as `SecurityContext: ctx::<value>`;
  - **label** as the OOTB module builds it: `collabspace(title) ● role(nls)`, with `● org(title)` in the middle when the user has several organizations.

### 2.2 Storage

The OOTB list preference **`xPref_CREDENTIAL`**, created at every load by
`ENOXWidgetPreferences.addCredentialPreferenceToWidget()` through our
wrapper (section 1a). Read with `widget.getValue('xPref_CREDENTIAL')`.

UWA stores the selected value per widget instance, so it survives refresh,
dashboard reload and new sessions - same mechanism as the router (WGT-02).

### 2.3 Which credential is active on load

| Situation | Result |
|---|---|
| stored value still in the list | kept (OOTB) |
| no stored value, or it is no longer valid (role removed) | first option of the sorted list (OOTB) - visible in the top bar |
| no credential at all | OOTB rejects with "No credentials assigned to the current user." -> Bootstrap alert; nothing else loads |

### 2.4 Top bar (on every page)

Bootstrap only - a `navbar` row above the breadcrumb:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔑 Project Leader ● Company Name ● Common Space            [Change ▾] │
├──────────────────────────────────────────────────────────────────────┤
│ Projects › AP project                                                │  breadcrumb (WGT-02)
```

- "Change" is a Bootstrap `dropdown` listing all credentials, the active one
  checked. The same choice is also possible from the widget's standard
  Preferences dialog.
- The dropdown uses the preference's own `options` (value + OOTB label), so
  the top bar and the Preferences dialog always show the same list.

### 2.5 What happens on a change

1. `widget.setValue('xPref_CREDENTIAL', value)`.
2. The request wrapper reads the credential **at each call**, so the next
   request uses it; the cached CSRF token is kept (it belongs to the session,
   not the credential).
3. `router.reload()` - the current page is rendered again with the new
   credential. If the object is not visible with it, the router falls back
   to the landing page (WGT-02 behaviour) with an alert.
4. A change made in the Preferences dialog fires UWA `onRefresh`, which runs
   the same start sequence and picks the new value up.

### 2.6 Code placement (rule R4)

| File | Role |
|---|---|
| `JazzySole/PlatformService/Credentials.js` (**shared**, AMD `JazzySole/Credentials`) | wraps `ENOXWidgetPreferences` (fallback: Get Me + `addPreference`, same key); `init()`, `get()`, `getLabel()`, `list()`, `set(value)`, change event. Generic - any widget can use it |
| widget `components/CredentialBar.js` | the top bar and the chooser (Bootstrap markup) |
| widget `services/Request.js` | the request wrapper; adds `SecurityContext` from `Credentials.get()` |

## 3. To verify in the first dashboard test

| # | Check |
|---|---|
| C1 | Get Me on this VM returns `collabspaces` with `couples` as documented |
| C2 | A value chosen in our dropdown shows as selected in the Preferences dialog, and the other way round |
| C3 | Our widget: the credential chosen in browser A is active after login in browser B (what the user saw in the Meeting app) |
| C4 | Header form: `SecurityContext: ctx::role.org.cs` accepted by the project service (the Meeting widget passes it as a URL parameter instead) |
| C5 | `setValue` on the list preference does not itself trigger `onRefresh` (same question as router N3) |

## 4. Questions

| # | Question |
|---|---|
| Q1 | Reuse the OOTB `ENOXWidgetPreferences` through our `JazzySole/Credentials` wrapper (recommended, section 1a)? |
| Q2 | Answered by following OOTB: first option when nothing is stored |

## 5. Built (2026-09-23)

User concern: the widget is served from an external server, so the AMD
module `DS/ENOXWidgetPreferences` (a 3DSpace webapp) may not be reachable.
Handled in the shared module:

| Piece | Where |
|---|---|
| `JazzySole/Credentials` 1.0.0 | `src/main/resources/static/WidgetPacket/JazzySole/PlatformService/Credentials.js`, doc `README.md` next to it |
| OOTB first, fallback second | `require()` of the OOTB module with an error callback and a 6 s timeout; on failure the DS use case (Get Me + `addPreference`) with the same key `xPref_CREDENTIAL`. `info().source` = `ootb` or `fallback` |
| Widget | `WidgetPacket/IRSProjects/` - `IRSProjects.html` (UWA shell, no logic), `js/App.js` (lifecycle), `js/components/CredentialBar.js`, `js/views/HelloView.js` |
| Top bar | Bootstrap `form-select` for the change - no Bootstrap JavaScript needed (see note) |
| Hello page | shows active credential, `ctx::` value, **which path was used**, 3DSpace URL |
| Tests | `src/test/js/jazzysole-credentials.test.js` - 7 scenarios, pass |

Note on Bootstrap JavaScript: `bootstrap.bundle.js` is a UMD file; loaded
with a plain `<script>` tag while RequireJS is present, it calls an
anonymous `define()` and RequireJS reports "Mismatched anonymous define()".
The native `form-select` avoids the problem and needs no custom CSS. The
same applies to Tabulator's UMD build - to handle when WGT-01 is built.

### First dashboard test - what to look at

| # | Check | Result |
|---|---|---|
| T1 | Hello page appears; "Credential source" = OOTB or Fallback - answers whether the OOTB module is reachable from our server | **done 2026-09-24: Fallback** - see §6 |
| T2 | Change the credential in the bar, press the widget's Refresh: same credential still selected | pending |
| T3 | Log in from another browser: same credential (C3) | pending |
| T4 | Change it in the widget Preferences dialog: the bar follows after save | pending |
| T5 | Browser console: no RequireJS errors | done - the only errors are the two `DS/...` 404s explained in §6, both expected |

## 6. T1 answered (2026-09-24): the OOTB module is NOT reachable

Ran in 3DDashboard on the VM, widget instance `#AQtD0p30g7qAFd5j4G0Y`. The
widget loaded, the whole UWA chain fired (`registerWidget` -> `onDomReady` ->
`launchWidget` -> `onLoad` -> `App.start()` -> `Credentials.init()`), and the
credential survived a browser reload. Console:

```
Credentials.js:167 [JazzySole/Credentials] OOTB path not used, fallback:
  Script error for: DS/ENOXWidgetPreferences/js/ENOXWidgetPreferences
```

So `info().source === 'fallback'`. **The concern that raised this design was
correct**, and the reason is structural, not a configuration mistake.

### Why `DS/` module ids cannot work from an external widget

3DDashboard does not let the browser talk to our server at all. It fetches our
files **server-side** and re-serves them from its own origin under

```
https://<platform>/3ddashboard/api/widget/proxy/external/<appId>/<base64 widget url>/<token>/<platform version>/WidgetPacket/...
```

The AMD loader therefore has our widget's package root as its base, and it
resolved the OOTB module id against **that**, not against 3DSpace:

```
GET .../WidgetPacket/ENOXWidgetPreferences/js/ENOXWidgetPreferences.js  404
```

`DS/` is a platform namespace only for widgets hosted inside the platform's own
webapps. For an external widget it maps into our own served directory, where the
module cannot exist. `requireDs` tried all three variants it knows -
concatenated, individual scripts, and `_v2.1` - and each returned 404.

One good outcome: it failed through RequireJS's **script-error** callback, not
our `OOTB_TIMEOUT_MS` timer, so the fallback starts immediately with no 6 s
stall.

### Decision

Stay on the fallback (Get Me + `widget.addPreference`, same `xPref_CREDENTIAL`
key). Making the OOTB module load would mean a RequireJS `paths` mapping to an
absolute 3DSpace URL, which buys nothing - the fallback produces the same
preference key, the same labels and the same ordering, and it is ours to
maintain. The OOTB path stays in the code because a widget hosted inside the
platform would still use it.

### Two 404s in the console are expected

| Module | Whose | Verdict |
|---|---|---|
| `DS/ENOXWidgetPreferences/...` | ours, via `loadOotb()` | expected; the fallback handles it |
| `DS/3DXContentChecker/...` | **the dashboard's own**, requested by `FrameExtension.js:234` | not ours, fails for the same namespace reason, nothing to fix |

### Caching caution for development

The proxy serves our files with the **platform's** resource version as the
cache-buster (`Credentials.js?v=20240118T194043Z`), not ours. That key only
changes when the platform is updated, so edited files can be served stale.
Hard-reload when a change does not show up.
