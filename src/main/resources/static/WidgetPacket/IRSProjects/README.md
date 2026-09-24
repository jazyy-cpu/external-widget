# IRS Projects widget

UWA widget served by `external-widget`. Current state: **step 1 -
credentials + Hello World** (WGT-03). The project list (WGT-01) and the
router (WGT-02) come next.

Development documentation: `external-widget/docs/` (requirements and devlog).

## Files

```
IRSProjects/
├── IRSProjects.html            UWA shell: metas, preferences, script tags, widget.addEvents - no logic
└── js/
    ├── App.js                  AMD IRSProjects/App - onLoad / onRefresh / onResize, start sequence
    ├── components/
    │   └── CredentialBar.js    AMD IRSProjects/components/CredentialBar - active credential + change
    └── views/
        └── HelloView.js        AMD IRSProjects/views/HelloView - temporary first page
```

Shared libraries from `../JazzySole/`: Bootstrap CSS, `PlatformService/Credentials.js`.

## Lifecycle

| UWA event | What runs |
|---|---|
| `onLoad` | `App.onLoad()` -> spinner -> `Credentials.init()` -> credential bar + page |
| `onRefresh` (menu Refresh, or Preferences saved) | same start sequence; a start already running is reused, not doubled |
| `onResize` | nothing yet (grid redraw with WGT-01) |

Everything renders into `widget.body`. User-visible text is set with
`textContent` (never built into HTML strings).

## URL

`https://external.solize.com/WidgetPacket/IRSProjects/IRSProjects.html`

HTTPS is required by 3DDashboard (WP03 open item O1, done 2026-09-24). Spring
serves port 443 with our own SAN certificate; `https://localhost/...` works too,
since `localhost` is one of the certificate's SANs. See
[3dexperience-tls.md](../../../../../../docs/3dexperience-tls.md) for the
certificate, the keystore and the truststore step on the platform VM.
