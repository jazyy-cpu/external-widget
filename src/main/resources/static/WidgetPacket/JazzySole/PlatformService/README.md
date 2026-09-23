# JazzySole PlatformService

| File | AMD module | Version | What |
|---|---|---|---|
| `Credentials.js` | `JazzySole/Credentials` | 1.0.0 | the user's 3DSpace credential (security context): stored, changeable, survives refresh and other browsers |
| `PlatformServices.js` | `DS/PlatformServices/PlatformServices` | from the IRS POC | 3DSpace URL + preferred security context. Older helper; its module id sits in the DS namespace and it reads the deprecated `preferredcredentials`. New widgets use `Credentials.js` |

## Credentials 1.0.0

### How it works

- The credential is the widget preference **`xPref_CREDENTIAL`** - the key
  the OOTB apps use. 3DDashboard stores widget preferences **server-side**
  per user and widget instance, so the choice survives a refresh, a
  dashboard reload and a login from another browser.
- `init()` first loads the OOTB module `DS/ENOXWidgetPreferences` and calls
  `addCredentialPreferenceToWidget()` (as the OOTB Meeting app does).
- A widget served from an external server may not reach that module. If it
  fails to load or does not answer within 6 s, `init()` falls back to the
  documented DS use case "Credentials with Widget App": Get Me
  (`/resources/modeler/pno/person?current=true&select=collabspaces`) +
  `widget.addPreference`, same key, same labels and order as OOTB.
- Either way: a stored value that is still valid is kept; otherwise the
  first option (sorted by label, admin credentials last) becomes active.
- `info().source` says which path ran: `"ootb"` or `"fallback"`.

### Install

```html
<widget:preferences>
  <widget:preference type="hidden" name="x3dPlatformId" defaultValue="OnPremise"></widget:preference>
</widget:preferences>
<script type="text/javascript" src="../JazzySole/PlatformService/Credentials.js"></script>
```

Needs the platform modules `DS/WAFData/WAFData` and
`DS/i3DXCompassPlatformServices/i3DXCompassPlatformServices` (available to
dashboard widgets).

### Use

```js
define('MyWidget/App', ['JazzySole/Credentials'], function (Credentials) {
    function start() {                              // call on onLoad AND onRefresh
        return Credentials.init().then(function (info) {
            // info = { source, value, label, spaceUrl }
            // render; send Credentials.getSecurityContext() with each 3DSpace call
        });
    }
    Credentials.onChange(function (info, previousValue) { /* reload the page */ });
    return { onLoad: start, onRefresh: start };
});
```

### API

| Member | What it does |
|---|---|
| `init()` | create / refresh the preference, make sure a valid credential is active. Resolves `{ source, value, label, spaceUrl }`; rejects when the user has no credential |
| `get()` | raw value `role.organization.collabspace` |
| `getSecurityContext()` | `ctx::role.organization.collabspace` - for the `SecurityContext` header or parameter |
| `getLabel()` | display label of the active credential |
| `list()` | all credentials `[{ value, label }]` |
| `set(value)` | activate another credential from `list()`; rejects unknown values; notifies `onChange` listeners |
| `onChange(fn)` | `fn(info, previousValue)` after `set()`; returns an unsubscribe function |
| `info()` | `{ source, value, label, spaceUrl }` |
| `get3DSpaceUrl()` | Promise of the 3DSpace base URL (cached) |
| `KEY`, `VERSION` | `"xPref_CREDENTIAL"`, `"1.0.0"` |

A change made in the widget's Preferences dialog fires UWA `onRefresh`;
calling `init()` there picks it up. `onChange` covers changes made through
`set()` from the widget itself.

### Tested

`src/test/js/jazzysole-credentials.test.js` (Node, fakes for `widget`,
`WAFData`, platform services and `require`): OOTB path, fallback on load
error, fallback on timeout, keep a valid stored value, replace an invalid
one, admin credentials last, organization in the label only with several
organizations, `set()` and `onChange`. Not yet run inside 3DDashboard.

### Change log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-09-23 | first version |
