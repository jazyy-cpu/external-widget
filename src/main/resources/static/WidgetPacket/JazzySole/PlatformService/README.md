# JazzySole PlatformService

| File | AMD module | Version | What |
|---|---|---|---|
| `Credentials.js` | `JazzySole/Credentials` | 1.1.0 | the user's 3DSpace credential (security context): stored, changeable, survives refresh and other browsers |
| `PlatformServices.js` | `DS/PlatformServices/PlatformServices` | from the IRS POC | 3DSpace URL + preferred security context. Older helper; its module id sits in the DS namespace and it reads the deprecated `preferredcredentials`. New widgets use `Credentials.js` |

## Credentials 1.1.0

### How it works

One path, no branches:

- The credential is the widget preference **`xPref_CREDENTIAL`** - the key
  the OOTB apps use. 3DDashboard stores widget preferences **server-side**
  per user and widget instance, so the choice survives a refresh, a
  dashboard reload and a login from another browser.
- `init()` builds that preference from the documented DS use case
  "Credentials with Widget App": Get Me
  (`/resources/modeler/pno/person?current=true&select=collabspaces`) +
  `widget.addPreference`, with the same values, labels and ordering as
  `DS/ENOXWidgetPreferences`.
- A stored value that is still valid is kept; otherwise the first option
  (sorted by label, admin credentials last) becomes active.

### Order of the picker, and what happens when new roles appear

Options are sorted by label, except that roles matching `ADMIN_ROLE_PATTERN` are
placed **last**:

```js
var ADMIN_ROLE_PATTERN = /(3ddrestrictedowner|vplmprojectadministrator|vplmadmin)/i;
```

This matters because **the first option becomes the active credential** when the
user has nothing stored yet, or when what they had stored is no longer valid. An
administrator credential must never win that position by alphabetical accident.

**A new role in the platform needs no change here.** Every credential the user
holds is always offered - nothing is filtered. `ADMIN_ROLE_PATTERN` is an
*ordering* rule, not a registration list. A role it does not match simply sorts
by its label like any other. Test `5b` in
`src/test/js/jazzysole-credentials.test.js` pins this down: a role the code has
never heard of still appears in `list()`, in label order, while the admin role
stays last.

Add a role to the pattern only when it should be pushed to the bottom. The likely
next candidate is a **read-only role**, for the same reason as admin: a user who
holds both a reader and an author credential should not silently default into a
context where they cannot do anything.

One consequence to accept knowingly: the three names in the pattern are exactly
the set `DS/ENOXWidgetPreferences` uses, so today our order matches the OOTB apps
that read the same preference. Adding a fourth makes our order differ from
theirs. Since the stored value is shared, that only changes which credential
becomes the default for a user who has none yet - whichever app they open first
decides. Worth knowing, not a reason to avoid it.

### Why it does not use `DS/ENOXWidgetPreferences`

Version 1.0.0 tried that module first and fell back when it failed. Measured
in 3DDashboard on 2026-09-24, the OOTB branch **can never succeed** from an
external widget: the dashboard proxies the widget, so the AMD loader's base is
our own package root and a `DS/<app>/...` id is looked for inside our served
directory, returning 404 for every variant `requireDs` tries. The branch was
dead code plus a console error on every load, so 1.1.0 removed it.

See UWA rule **C6** in `docs/reference/uwa-rules-and-libraries.md` and
`docs/requirements/WGT-03-credential/README.md` section 6. The preference
**key** stays the OOTB one on purpose, so our widget and the OOTB apps remain
interchangeable on the same dashboard. A test asserts the branch does not come
back.

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
| `init()` | create / refresh the preference, make sure a valid credential is active. Resolves `{ value, label, spaceUrl }`; rejects when the user has no credential |
| `get()` | raw value `role.organization.collabspace` |
| `getSecurityContext()` | `ctx::role.organization.collabspace` - for the `SecurityContext` header or parameter |
| `getLabel()` | display label of the active credential |
| `list()` | all credentials `[{ value, label }]` |
| `set(value)` | activate another credential from `list()`; rejects unknown values; notifies `onChange` listeners |
| `onChange(fn)` | `fn(info, previousValue)` after `set()`; returns an unsubscribe function |
| `info()` | `{ value, label, spaceUrl }` |
| `get3DSpaceUrl()` | Promise of the 3DSpace base URL (cached) |
| `KEY`, `VERSION` | `"xPref_CREDENTIAL"`, `"1.1.0"` |

A change made in the widget's Preferences dialog fires UWA `onRefresh`;
calling `init()` there picks it up. `onChange` covers changes made through
`set()` from the widget itself.

### Tested

`src/test/js/jazzysole-credentials.test.js` (Node, fakes for `widget`,
`WAFData` and platform services): builds the preference from Get Me with
admin credentials last, keeps a valid stored value, replaces an invalid one,
organization in the label only with several organizations, `set()` and
`onChange`, a user with no credential rejects, and a guard that the removed
OOTB branch has not come back. Run in 3DDashboard on 2026-09-24.

### Change log

| Version | Date | Change |
|---|---|---|
| 1.1.0 | 2026-09-24 | removed the `DS/ENOXWidgetPreferences` branch - unreachable from an external widget (UWA rule C6). `info()` no longer returns `source` |
| 1.0.0 | 2026-09-23 | first version |
