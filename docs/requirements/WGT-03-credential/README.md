# WGT-03 - Credential (security context): store, change, show

| | |
|---|---|
| Status | **working in 3DDashboard** (2026-09-24): `JazzySole/Credentials` **1.1.0** + widget `IRSProjects` showing Hello World and the credential bar. T1 done - the OOTB module is unreachable from an external widget, so that branch was **removed** and the module now has one path (§6, §7); T2-T4 pending |
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
| Order, our note | we reproduce this exactly. It is an **ordering** rule, not a list of known roles - a new role appears in the picker without any code change (test `5b`). It matters because the first option becomes the default credential, so an admin role must not win that spot. A read-only role is the likely next addition - see §8 |
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
| `JazzySole/PlatformService/Credentials.js` (**shared**, AMD `JazzySole/Credentials`) | Get Me + `widget.addPreference` on the OOTB key `xPref_CREDENTIAL`; `init()`, `get()`, `getLabel()`, `list()`, `set(value)`, change event. Generic - any widget can use it |
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
| `JazzySole/Credentials` 1.0.0 (now 1.1.0, see §7) | `src/main/resources/static/WidgetPacket/JazzySole/PlatformService/Credentials.js`, doc `README.md` next to it |
| OOTB first, fallback second | *(1.0.0 only - removed in 1.1.0, see §7)* `require()` of the OOTB module with an error callback and a 6 s timeout; on failure the DS use case (Get Me + `addPreference`) with the same key `xPref_CREDENTIAL`. `info().source` = `ootb` or `fallback` |
| Widget | `WidgetPacket/IRSProjects/` - `IRSProjects.html` (UWA shell, no logic), `js/App.js` (lifecycle), `js/components/CredentialBar.js`, `js/views/HelloView.js` |
| Top bar | Bootstrap `form-select` for the change - no Bootstrap JavaScript needed (see note) |
| Hello page | shows active credential, `ctx::` value, 3DSpace URL (the "which path was used" row went away with 1.1.0) |
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

Keep only Get Me + `widget.addPreference` on the same `xPref_CREDENTIAL` key.
Making the OOTB module load would mean a RequireJS `paths` mapping to an
absolute 3DSpace URL, which buys nothing - this path produces the same
preference key, the same labels and the same ordering, and it is ours to
maintain.

The OOTB branch was **deleted** in 1.1.0 rather than kept for a hypothetical
in-platform deployment - see §7.

### Two 404s in the console are expected

| Module | Whose | Verdict |
|---|---|---|
| `DS/ENOXWidgetPreferences/...` | was ours, via `loadOotb()` | **gone since 1.1.0** - the branch was removed, so this 404 no longer appears |
| `DS/3DXContentChecker/...` | **the dashboard's own**, requested by `FrameExtension.js:234` | not ours, fails for the same namespace reason, nothing to fix |

### Caching caution for development

The proxy serves our files with the **platform's** resource version as the
cache-buster (`Credentials.js?v=20240118T194043Z`), not ours. That key only
changes when the platform is updated, so edited files can be served stale.
Hard-reload when a change does not show up.

## 7. Cleanup: `Credentials` 1.1.0 (2026-09-24)

User decision after §6: *"remove the code that is not working for credentials
and let's have clean working option only."* The dead branch was deleted rather
than kept behind a flag - it could never succeed (§6), and it put a 404 plus a
`console.info` in every load.

### Removed

| Piece | Why |
|---|---|
| `loadOotb()` | required `DS/ENOXWidgetPreferences/js/ENOXWidgetPreferences`, which 404s from an external widget |
| `OOTB_MODULE`, `OOTB_TIMEOUT_MS` | only used by `loadOotb()` |
| `state.source` and `info().source` | with one path there is nothing to report |
| the `console.info("OOTB path not used, fallback: ...")` line | the fallback is now simply the behaviour |
| "Credential source" row on the Hello page | same reason |

`loadFallback()` was renamed **`loadPreference()`** - it is not a fallback any
more, it is the way this works. `init()` no longer wraps it in an extra
`get3DSpaceUrl()`; `loadPreference()` already resolves the URL and the result is
cached.

### Unchanged on purpose

- The preference **key stays `xPref_CREDENTIAL`**, and the values, labels and
  ordering still match `DS/ENOXWidgetPreferences`, so our widget and the OOTB
  apps remain interchangeable on the same dashboard.
- Storage is still the server-side widget preference, so the choice still
  survives refresh, dashboard reload and another browser.
- The public API is otherwise identical: `init()`, `get()`,
  `getSecurityContext()`, `getLabel()`, `list()`, `set()`, `onChange()`,
  `info()`, `get3DSpaceUrl()`. **Only `info().source` disappeared**, and
  `HelloView` was the one caller.

### Tests

`src/test/js/jazzysole-credentials.test.js` was reduced from 7 scenarios to 6 -
the three OOTB scenarios (module loads, load error, timeout) no longer describe
anything real. Added instead:

- a user with no credential at all -> `init()` rejects with
  "No credentials assigned";
- a **guard against regression**: the module source must contain no `require(`
  call and no `loadOotb` / `OOTB_MODULE` / `OOTB_TIMEOUT` identifier, and
  `info()` must not carry `source`. If someone re-adds a `DS/<app>` require, the
  suite fails with the reason.

Both suites pass (`ALL CREDENTIALS TESTS PASSED`, `ALL ROUTER TESTS PASSED`).

### Note on sections 1a and 5 above

They are kept as the record of the original decision and are **superseded** by
§6 and §7. Section 1a's recommendation to call
`ENOXWidgetPreferences.addCredentialPreferenceToWidget()` was the right call on
the evidence available then; it is simply not possible from an external widget.
Q1 (confirm reusing the OOTB credential preference through a wrapper) is
answered by events: the key is reused, the module is not.

## 8. Adding roles later (noted 2026-09-24)

User point: as IRS adds roles - a Reader role was the example - they will need
handling here.

Clarified: **only if they should not be the default.** `ADMIN_ROLE_PATTERN` in
`JazzySole/Credentials` decides which roles sort to the **bottom** of the picker,
nothing else. Every credential the user holds is always offered; no role is ever
filtered out, so new platform roles work with no code change. Test `5b` in
`src/test/js/jazzysole-credentials.test.js` asserts exactly that, using a role the
code has never seen.

The reason the bottom of the list matters: the **first** option becomes the active
credential when the user has nothing stored yet, or when their stored value is no
longer valid. So the pattern exists to stop a privileged role becoming somebody's
default by alphabetical accident.

### When a Reader role arrives

It should probably go in the pattern, for the same reason as admin: a user holding
both a reader and an author credential should not silently default into a
read-only context and wonder why nothing can be edited. That is a one-word change
to the regex in `Credentials.js`, plus a line in the test.

### The trade-off to accept knowingly

The three names in the pattern are exactly the set `DS/ENOXWidgetPreferences`
uses, so our ordering currently matches the OOTB apps that share the
`xPref_CREDENTIAL` preference. Adding a fourth name makes our order differ from
theirs. Because the stored **value** is shared, the only effect is on a user who
has no credential stored yet: whichever app they open first picks their default.
Minor, and worth it if the alternative is defaulting somebody into a read-only
context - but it should be a decision, not a surprise.
