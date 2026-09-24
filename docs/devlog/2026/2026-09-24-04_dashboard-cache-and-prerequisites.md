# 2026-09-24-04 - Dashboard cache disabled; widget prerequisites confirmed complete

| | |
|---|---|
| Requirement | WP03 O2 (closed), development workflow |
| Status | done |
| Worklog | `worklog/entries/2026/2026-09-24-02_dashboard-widget-cache-disabled.md` |
| Follows | [2026-09-24-03](2026-09-24-03_credentials-1.1.0-single-path.md) |

## The log after the 1.1.0 cleanup

The `DS/ENOXWidgetPreferences` 404 is **gone**. Nothing in the console comes from
our code any more. Two entries remain, neither ours:

| Entry | Whose | Verdict |
|---|---|---|
| `DS/3DXContentChecker/...` 404 | the dashboard's `FrameExtension.js:234` | expected for every external widget (rule C6) |
| `wss://<platform>/socketio.rtc/` WebSocket failures, from `RTDriver.js checkSocketStatus` | the platform | missing Apache proxy rule - see below |

### The WebSocket failure is a platform gap

`3DNotification_httpd_fragment.conf` defines `<Location /socket.io>` (proxied to
`:8089`, with a `ws://` RewriteRule) and `<Location /3dnotification>`. The browser
asks for **`/socketio.rtc/`**, for which no `<Location>` exists anywhere in the
Apache config, so the upgrade never reaches the node. `mod_proxy_wstunnel` is
loaded and 3DNotification is running, so it is only a missing rule. It affects
platform real-time features; our widget uses no WebSocket. Left untouched by user
decision, recorded as a worklog follow-up.

## Prerequisites: nothing was missing

Checked in the DS library before changing anything
(*Widget Development Fundamentals R2022x*, *Configuration & Development
Fundamentals R2023x*). There are two kinds of external widget:

| | Run Your App | **Additional App** (ours) |
|---|---|---|
| Loaded into | **untrusted** 3DDashboard domain | **trusted** 3DDashboard domain |
| Reach 3DSpace / 3DSwym | only through the proxy API | **directly** |
| Talk to other widgets, 6WTagger | no | yes |
| Created by | any user | Platform Manager role, Platform Management -> Members -> Create Additional App |

Ours is already an Additional App on the trusted domain, and its credential list
is populated - which only happens if `Get Me` against 3DSpace through
`WAFData.authenticatedRequest` succeeded. So trusted-domain web-service access
works and **WP03 open item O2 is closed**. No registration step was outstanding.

## What did need doing: the dashboard cache

The guide (p.87) is explicit: 3DDashboard caches **the widget's HTML and CSS** per
instance, and *"the users may need to re-add the widget in their tab to refresh
the widget, unless the cache is disabled or emptied."* Disabling the browser cache
only covers the JavaScript - which is exactly why the `ENOXWidgetPreferences` 404
disappeared once the browser cache was off, while HTML changes would still have
gone unnoticed. This would have bitten as soon as WGT-01 adds Tabulator's script
and stylesheet tags to `IRSProjects.html`.

Done on the VM (worklog `2026-09-24-02`): `uwp.cache.type = nocache`,
`uwp.cache.enabled = false` in the dashboard's `context.properties`, TomEE temp
folder emptied (2631 items), DB caches flushed, service restarted. Verified clean
startup and the user confirmed the dashboard in the browser.

### Two things worth knowing next time

- **Release drift.** The R2022x guide tells you to set `uwp.cache.type`; in
  R2024x that property is marked *"DEPRECATED As of release R423GA, replaced by
  `uwp.cache.enabled`"*. It also feeds a config **filename**
  (`cache-persistence-<type>.xml`) - and no such file exists anywhere in the
  install, not even for the `infinispan` value in use, so the reference is dead
  and `nocache` cannot break startup. Worth checking before trusting a
  guide written for an older release.
- **R2024x has a narrower switch**, `uwp.cache.service.externalWidget`, which
  disables only the external-widget code cache and leaves the other dashboard
  caches alone. Not used - the user chose the documented full deactivation. Both
  are global rather than per widget.

## Consequence for our workflow

Widget HTML and CSS edits now take effect on a dashboard reload, instead of
needing the widget removed and re-added to the tab. **Re-enable the cache before
any production-like use** - the guide says deactivation slows the server and is
for development only; the backup and restart are in the worklog entry.
