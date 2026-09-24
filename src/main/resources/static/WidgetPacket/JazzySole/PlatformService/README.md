# JazzySole PlatformService

| File | AMD module | Version | What |
|---|---|---|---|
| `Credentials.js` | `JazzySole/Credentials` | 1.1.0 | the user's 3DSpace credential (security context): stored, changeable, survives refresh and other browsers |
| `Request.js` | `JazzySole/Request` | 1.0.0 | **the one request wrapper** for 3DSpace REST calls: tenant, security context, CSRF |
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

## Request 1.0.0

Development rule **R3**: every REST call goes through one wrapper, so no service
module ever calls `DS/WAFData` itself. Rule **R5**: that wrapper owns the CSRF
token.

### What it does to every call

1. resolves a **relative** path against the 3DSpace root from
   `Credentials.get3DSpaceUrl()` (an absolute URL is used as given);
2. appends `tenant=<x3dPlatformId>`;
3. appends `SecurityContext=ctx::<active credential>` - suppress with
   `noContext: true` for the few services that reject it;
4. sends `Accept-Language` from `widget.lang`;
5. encodes the `params` object, dropping `undefined`, `null` and `''` but
   keeping `0`;
6. rejects with an `Error` carrying `.status` and `.body` where they could be
   determined - **including** an HTTP 200 whose body says `success: false`,
   which several DS services do.

### CSRF (rule R5)

- Needed for `PUT`, `PATCH`, `POST` and `DELETE` only, so a widget that just
  reads never fetches a token.
- The token is picked up from any response that carries one: a `csrf` object in
  the body (the project list does this) or the `X-DS-CSRFTOKEN` header.
- A write with no token held fetches one from
  `GET /resources/v1/application/CSRF` first. Parallel writes share that one
  call.
- A write rejected with 403 or a CSRF-looking message fetches a **fresh** token
  and retries **once**. A second failure is reported to the caller.
- The value is never logged, never written to a preference and not reachable
  through the public API - `hasCsrfToken()` only says whether one is held. A
  test asserts that the module contains no `console.*` at all.

### Use

```html
<script type="text/javascript" src="../JazzySole/PlatformService/Credentials.js"></script>
<script type="text/javascript" src="../JazzySole/PlatformService/Request.js"></script>
```

```js
define('MyWidget/services/Thing', ['JazzySole/Request'], function (Request) {
    return {
        list: function () {
            return Request.get('resources/v1/modeler/projects',
                               { params: { '$include': 'none' } });
        },
        rename: function (id, title) {
            return Request.send('resources/v1/modeler/projects/' + id,
                                { method: 'PATCH', data: { title: title } });
        }
    };
});
```

`Credentials.init()` must have resolved before the first call - it is what
establishes the 3DSpace URL and the active credential.

### API

| Member | |
|---|---|
| `send(path, opts)` | `Promise<body>`. `opts`: `method`, `params`, `data` (object or string), `headers`, `type` (default `json`), `timeout` (default 30000), `noContext` |
| `get(path, opts)` | `send` with `method: 'GET'` |
| `hasCsrfToken()` | whether a token is currently held. The value is not exposed |
| `resetCsrfToken()` | drop it, for example after a new 3DSpace login |
| `VERSION` | `1.0.0` |
| `_buildUrl`, `_isCsrfFailure` | tests only |

### Tested

`src/test/js/jazzysole-request.test.js` - URL building, tenant and security
context, both token sources, the fetch-before-write, the single retry, a
non-token failure not retried, `success: false`, timeouts, and that the token
cannot leak. Run with `node`, no browser needed.

### Change log

| Version | Date | |
|---|---|---|
| 1.0.0 | 2026-09-24 | first version, written with WGT-01 (the project list) |
