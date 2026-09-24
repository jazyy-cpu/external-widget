# Handoff - read this first

Living document: **where the widget stands, what to do next, and the traps**.
Updated 2026-09-24, after the project detail page was built as a skeleton and
the router was wired in.

History belongs in the [devlog](devlog/INDEX.md) and the workspace `worklog/`;
this page is only ever the current picture. Keep it that way - rewrite it, do
not append to it.

---

## 1. What exists today

One UWA widget, `IRSProjects`, served as static content by the Spring app
`external-widget/` over HTTPS, registered in 3DDashboard as an **Additional App**
(appId `MAP-GWNOVXXGJ`, a trusted domain, so it may call 3DSpace directly).

| Requirement | State |
|---|---|
| [WGT-03](requirements/WGT-03-credential/README.md) credential | **working in the dashboard**, survives a browser reload. Checks T2-T4 pending |
| [WGT-02](requirements/WGT-02-navigation-state/README.md) router | **wired into the widget** 2026-09-24: `projects` and `project/:id`, state in the hidden preference `jzRoute`. Checks N1-N3 pending |
| [WGT-01](requirements/WGT-01-project-landing/README.md) project list | **running in the dashboard** 2026-09-24. G1-G3 pass; G4-G16 open, in [test.md](requirements/WGT-01-project-landing/test.md) §3 |
| [WGT-04](requirements/WGT-04-project-detail/README.md) project detail | **skeleton built** 2026-09-24 and opened once, then reworked: Overview is a two-column Bootstrap form, messages go through `JazzySole/Notify`. Organisation, Risks and Lessons are deliberate placeholders. **Nothing on this page writes anything** |

So the immediate next action is not to write code: **open a project from the
list in the dashboard**. That first click answers three things at once - does
the detail call work, do the twelve EPM attributes really arrive in
`dataelements`, and does a browser refresh come back to the same project (rule
R6, the router's first real use). Then finish the grid checks G4-G16.

Questions waiting on the user: **B1** (lessons learnt - one text box or a list
of dated entries? it decides the schema, and an attribute cannot become a list
later), **B6** (does the detail page stay read-only, or is editing next?),
**A4** (should plain `Project Space` projects be listed, or only our EPM
subtypes?) and **A3** (may we create ~25 test projects?).

## 2. Start it, test it

```powershell
cd 'D:\PROJECT DATA\19 IRCLASS\external-widget'
.\scripts\start-widget.ps1 -Background      # logs to target\widget-run.log
.\scripts\stop-widget.ps1

# all seven unit-test suites, no browser needed
Get-ChildItem src\test\js\*.test.js | ForEach-Object { node $_.FullName }
```

Host-side HTTP check: use **`https://localhost/...`**, not
`external.solize.com` - that name resolves only on the VM (see §5).

```powershell
curl.exe -s -o NUL -w '%{http_code}' --cacert "$env:USERPROFILE\.irs-certs\external-widget.crt" `
  https://localhost/WidgetPacket/IRSProjects/IRSProjects.html      # 200
```

Never `curl -k`. Certificate and hostname verification stay on.

## 3. The traps, in the order they will bite

| # | Trap | What to do |
|---|---|---|
| 1 | **Stale JavaScript.** The dashboard proxy cache-busts our files with the *platform's* resource version, so the browser happily serves yesterday's code | DevTools open with **"Disable cache"** ticked, always. The dashboard's own HTML/CSS cache is already disabled on this VM |
| 2 | **`DS/<app>/...` is unreachable** from an external widget (UWA rule **C6**). The proxy makes the AMD loader's base our own package root, so a platform module id 404s inside our directory | Never `require` a `DS/<app>/…` id. `DS/WAFData` and `DS/i3DXCompassPlatformServices` are injected by the frame and do work. The credentials test fails the build if a `require(` reappears |
| 3 | `Failed to load module "DS/3DXContentChecker/3DXContentChecker_v2.1"` in the console | **Not ours.** The dashboard's `FrameExtension.js` asks for it for *every* external widget; proved with a bare control widget (devlog 2026-09-24-05). Ignore it |
| 4 | **A UMD bundle loaded with a `<script>` tag** raises `Mismatched anonymous define()` under the AMD loader | Bootstrap's JS is not used at all; Tabulator goes through `JazzySole/TabulatorLoader`. Load one UMD library at a time - see [WGT-01 design.md §3](requirements/WGT-01-project-landing/design.md) |
| 5 | `wss://<platform>/socketio.rtc/` WebSocket errors | Platform-wide: Apache has no `/socketio.rtc` rule. User decision: note it, do not touch it |
| 6 | **A Tabulator grid with no explicit `height`** puts its footer under the last row, half way up the frame, and never fills the widget | measure the height and `setHeight()` on every resize, as `ProjectListView` does. `height: '100%'` does not work - a UWA body has no height to inherit |
| 7 | **The dashboard cache is off for development** | Re-enable it before any production-like use: restore `context.properties.bak-2026-09-24` on the VM and restart `3DDashboard_R2024x` |

## 4. Where the code is

```
src/main/resources/static/WidgetPacket/
├── JazzySole/                 shared by every future widget
│   ├── PlatformService/Credentials.js   1.1.0  active credential (WGT-03)
│   ├── PlatformService/Request.js       1.0.0  THE request wrapper - rules R3, R5
│   ├── Router/Router.js                 1.0.0  navigation across refresh (WGT-02)
│   ├── Tabulator/TabulatorLoader.js     1.0.0  UMD-safe Tabulator load
│   ├── Notify/Notify.js                 1.0.0  sliding notifications; ONE policy table
│   │                                           decides how long each type stays
│   ├── Tabulator/, bootstrap/                  the libraries themselves
│   └── */README.md                             each library documents itself
└── IRSProjects/               the widget
    ├── IRSProjects.html       UWA shell: metas, preferences, script tags, addEvents - no logic
    ├── css/IRSProjects.css    the ONLY custom CSS, every rule under .irs-projects
    └── js/
        ├── App.js             lifecycle + the router (projects, project/:id)
        ├── config/            ProjectFields (list) · ProjectForm (THE field catalogue)
        ├── utils/  services/  components/
        └── views/  + views/detail/   one module per tab of the detail page
```

**`js/config/ProjectForm.js` is the field catalogue** - every field of
R&D-PRJ-01, in the form's order, with whether it exists on the platform. It is
copied from **WP02 doc 05 §12**, which is verified against MQL. Change the two
together, and do not add a field to the page anywhere else.

Rules that are not negotiable: one AMD module per file (R4), all REST through
`JazzySole/Request` (R3), CSRF tracked and retried once (R5), navigation and view
state survive a refresh (R6), **minimal custom CSS** (R1 - one scoped file exists,
with its reason written in WGT-01 design.md §6; anything more needs the same),
render only into `widget.body`.

## 5. Loose ends that are not blocking

| # | Item |
|---|---|
| A1 | Project manager name is not available from the project service; needed on the detail page only. Options in [WGT-01 api.md §3](requirements/WGT-01-project-landing/api.md) |
| ~~A2~~ | **Closed 2026-09-24: `state` is accepted.** The widget shows a warning strip when it has to fall back; none appeared |
| A4 | The list shows plain OOTB `Project Space` objects as well as our `EPMAnalysisProject` / `EPMResearchProject`. Only ours, or everything? **Ask the user** - one line in `ProjectService` either way |
| A3 | Three test projects on the VM: the pager cannot be judged below 20 rows. Create more in the OOTB project widget |
| O3 | `JazzySole/PlatformService/PlatformServices.js` still defines ids in the `DS/` namespace. Rename them out of it - now more than cosmetic, since `DS/` ids resolve against our own package root |
| B1-B6 | The detail page's open questions - see [WGT-04](requirements/WGT-04-project-detail/README.md) §6. B1 and B4 need platform work; B3 (the project **write** call) blocks every edit, including the Project No. button |
| O5, O6 | API Labs reachability; whether to bundle/minify the widget |
| - | Elevated `scripts\setup-https-host.ps1` on the **host**: hosts entry, trusted root, firewall rule. Only needed to open the widget URL directly in a host browser; the dashboard does not need it |
| - | After the firewall rule exists, change the VM hosts entry `192.168.1.6 external.solize.com` to the stable VMnet8 address `192.168.125.1` |
| - | A dangling **HelloTest** Additional App registration still points at a deleted URL; only a Platform Manager can remove it (Platform Management -> Members) |

## 6. Documentation rules, in one paragraph

Project-level scope and status go to
`documents/work-packages/03-project-widget/`; all development detail goes here,
one folder per requirement under `requirements/`, with a dated append-only entry
in `devlog/`. Anything that touches the VM, the platform database or agent
tooling **also** gets a workspace `worklog/` entry, and the two link each other.
Never write a password, key, token or session cookie into any of them. The full
rules are in [README.md](README.md).
