# 2026-09-24-05 - Why `DS/3DXContentChecker` fails, and a control widget to prove it

| | |
|---|---|
| Requirement | none - diagnostic |
| Status | evidence gathered; dashboard confirmation pending |
| Follows | [2026-09-24-04](2026-09-24-04_dashboard-cache-and-prerequisites.md) |

## Question

After `Credentials` 1.1.0 removed our own `DS/` require, one error still appears
in the console of the `IRSProjects` widget:

```
Script error for: DS/3DXContentChecker/3DXContentChecker_v2.1
```

Is it produced by the dashboard for **every** external widget, or by something
in `IRSProjects`?

## Evidence found on the VM (before testing anything)

The module is real and deployed - it just lives on the **3DSpace** server, not
ours:

| | |
|---|---|
| Actually at | `3DSpaceCas\...\webapps\3dspace\webapps\3DXContentChecker\3DXContentChecker.js` (24,283 bytes) |
| Also deployed under | `3DSpaceNoCas\...\webapps\internal\webapps\`, `FedSearch\...\webapps\federated\webapps\` |
| The loader asked for | `.../proxy/external/<appId>/<b64>/<token>/<version>/WidgetPacket/3DXContentChecker/3DXContentChecker.js` -> **404** |

That is the **same failure as `ENOXWidgetPreferences`**, which sits in the very
same `3dspace\webapps\` folder. Under the dashboard proxy the AMD loader's base
is our widget's package root, so a `DS/<app>/...` id is looked for inside our
served directory - exactly UWA rule **C6**.

The request comes from `FrameExtension.js:234`, the dashboard's own frame code,
not from ours. `requireDs` then tries its fallback names - the concatenated
module, the individual scripts, and `3DXContentChecker_v2.1.js`, a versioned
variant that does not exist even on 3DSpace - and after the last one fails it
raises `scripterror`. That is why the message names the `_v2.1` form.

## The control widget

Evidence is not proof, so `WidgetPacket/HelloTest/HelloTest.html` was added: a
deliberately empty UWA widget with **no libraries, no AMD modules, no
`require()`, no preferences and no CSS** - only `onLoad` writing "Hello World"
into `widget.body`. Verified served at
`https://external.solize.com/WidgetPacket/HelloTest/HelloTest.html`
(HTTP 200, full TLS validation, well-formed XML).

Anything in the console while that widget runs cannot have come from our code.

### Prediction, stated before the test

`DS/3DXContentChecker` **will still 404** for `HelloTest`, because
`FrameExtension.js` requests it for any external widget regardless of content.
The `socketio.rtc` WebSocket failures will also still appear - they are
platform-wide (worklog `2026-09-24-02`).

If the error does **not** appear for `HelloTest`, the prediction is wrong and
something in `IRSProjects` triggers it - that would be the more interesting
result and worth chasing.

## To run it

Register `HelloTest.html` as a second Additional App (Platform Management ->
Members -> Create Additional App), drop it on a tab, open the console.

## Result

**Confirmed 2026-09-24 by the user: the error appears for `HelloTest` too.**

A widget containing nothing but `onLoad` writing "Hello World" - no libraries, no
AMD modules, no `require()`, no preferences, no CSS - still produces:

```
Failed to load module "DS/3DXContentChecker/3DXContentChecker_v2.1"
due to error "scripterror"
```

So the prediction held and the cause is settled: **3DDashboard requests this
module for every external widget, and it can never resolve.** Nothing in
`IRSProjects` contributes to it, and there is nothing for us to fix. The user's
decision: leave it.

### How to recognise it again

| Signal | Meaning |
|---|---|
| A `DS/<app>/...` 404 under `.../proxy/external/.../WidgetPacket/` | rule C6 - the loader resolved a platform module id against our package root |
| The requesting frame is `FrameExtension.js` | the dashboard asked, not us |
| The requesting frame is one of our files | **our** bug - a `DS/` require we should remove |

That last row is the only case worth acting on.

## Update 2026-09-24 - control widget deleted

The user asked for `HelloTest` to be removed once it had answered the question,
so `WidgetPacket/HelloTest/` was deleted from the source tree and from
`target/classes`. The recommendation in its README to keep it as a permanent
control was the agent's suggestion, not a requirement; the technique is recorded
here and the widget is three minutes to recreate if it is ever wanted again.

Note for whoever registered it: the matching **Additional App still exists in
3DDashboard** and now points at a URL that returns 404. Remove it through
Platform Management -> Members, since only a Platform Manager can.
