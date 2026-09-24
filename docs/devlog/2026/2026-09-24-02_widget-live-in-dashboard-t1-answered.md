# 2026-09-24-02 - Widget live in 3DDashboard; T1 answered (OOTB module unreachable)

| | |
|---|---|
| Requirement | WGT-03 (T1), with findings that affect WGT-01 / WGT-02 and WP03 O2 |
| Status | done |
| Source | browser console log captured by the user, `As-Is  Understanding/manual logs/chrome.logs` |
| Follows | [2026-09-24-01](2026-09-24-01_widget-https-certificate.md) |

## What happened

The widget loaded in 3DDashboard on the VM (instance `#AQtD0p30g7qAFd5j4G0Y`)
and **survives a browser reload**. The full UWA chain fires in order:

```
UWA.script -> getWidget -> registerWidget -> onDomReady -> initRemote
           -> launchWidget -> onLoad -> App.js start() -> Credentials.init()
```

No error in the log originates in our own code.

## Finding 1 - the browser never contacts our server

Every request in the log goes to the dashboard's origin:

```
https://<platform>/3ddashboard/api/widget/proxy/external/<appId>/<base64 widget url>/<token>/<platform version>/WidgetPacket/...
```

The base64 segment decodes to
`https://external.solize.com/WidgetPacket/IRSProjects/IRSProjects.html`.
3DDashboard fetches our files **server-side** and re-serves them from its own
origin. Consequences:

- The widget is **same-origin with the dashboard** - CORS and mixed content are
  non-issues, and WP03 open item O2 (trusted domain) is about the dashboard's
  proxy allow-list, not about the browser.
- Only the **VM-side** truststore import and VM -> host reachability were
  actually required to make the widget load. The host's own hosts entry and
  trusted-root import (in `scripts/setup-https-host.ps1`) are **not** needed for
  dashboard embedding; they only let a developer open the widget URL directly in
  a browser. Corrected in `docs/3dexperience-tls.md` and worklog `2026-09-24-01`.

## Finding 2 - `DS/` module ids cannot resolve from an external widget

T1 is answered, and the answer is **Fallback**:

```
Credentials.js:167 [JazzySole/Credentials] OOTB path not used, fallback:
  Script error for: DS/ENOXWidgetPreferences/js/ENOXWidgetPreferences
```

The 404 URL shows the mechanism - the AMD loader resolved the `DS/...` id
against **our widget's own package root**, because that is the loader's base
under the proxy:

```
GET .../WidgetPacket/ENOXWidgetPreferences/js/ENOXWidgetPreferences.js  404
```

`DS/` is a platform namespace only for widgets hosted inside the platform's own
webapps. `requireDs` tried all three variants it knows - concatenated,
individual scripts, `_v2.1` - and each 404'd.

This is the structural reason the concern behind the WGT-03 design was right.
The fallback (Get Me + `widget.addPreference`, same `xPref_CREDENTIAL` key) is
what carries the widget, and it produces the same key, labels and ordering as
OOTB. Decision: stay on the fallback; keep the OOTB path in the code for a
widget hosted inside the platform. Detail in
[WGT-03 §6](../../requirements/WGT-03-credential/README.md).

Good detail: the failure came through RequireJS's **script-error** callback, not
our `OOTB_TIMEOUT_MS` timer, so the fallback starts immediately - no 6 s stall.

## Finding 3 - one console 404 is the dashboard's own

`DS/3DXContentChecker/...` is requested by `FrameExtension.js:234`, the
dashboard's frame code, and fails for exactly the same namespace reason. We did
not introduce it and there is nothing to fix. Recorded so it is not chased later.

## Finding 4 - cache key is the platform's, not ours

The proxy serves our files as `Credentials.js?v=20240118T194043Z` - the
**platform's** resource version. That key changes only when the platform is
updated, so edited files can be served stale during development. Hard-reload
when a change does not appear.

## Next

- WGT-03 T2-T4 (change in the bar + Refresh, another browser, Preferences dialog).
- WGT-02 router checks N1-N3; reload survival already looks right, since widget
  preferences are stored server-side per user and instance.
- Then the WGT-01 landing grid, with the Tabulator UMD / RequireJS caution.
