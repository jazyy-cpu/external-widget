# IRS Projects widget

UWA widget served by `external-widget`. Current state: **the project list**
(WGT-01) and a **skeleton project detail page** (WGT-04), on top of the
credential bar (WGT-03) and the router (WGT-02). Nothing writes anything yet.

Development documentation: `external-widget/docs/` - start at
[HANDOFF.md](../../../../../../docs/HANDOFF.md), then
[WGT-01 design.md](../../../../../../docs/requirements/WGT-01-project-landing/design.md).

## Files

```
IRSProjects/
├── IRSProjects.html            UWA shell: metas, preferences, script tags, widget.addEvents - no logic
├── css/
│   └── IRSProjects.css         the widget's ONLY custom CSS, all under .irs-projects:
│                                row density, the detail form, the toolbar band,
│                                and the platform's maturity palette
└── js/
    ├── App.js                  AMD IRSProjects/App - onLoad / onRefresh / onResize, start sequence
    ├── config/
    │   ├── ProjectFields.js    lifecycle states, the $fields list, subtype labels, badge colours
    │   └── ProjectForm.js      THE field catalogue: every R&D-PRJ-01 field, in form order
    ├── utils/
    │   └── Format.js           locale date, Bootstrap badge as a DOM node
    ├── services/
    │   ├── ProjectService.js   the project list call and the row mapping
    │   └── ProjectDetailService.js  one project by id
    ├── components/
    │   ├── CredentialBar.js    active credential + change, far right of the top row (WGT-03)
    │   ├── ListToolbar.js      the closed switch, the search control, Clear, Refresh
    │   ├── Tabs.js             Bootstrap nav-tabs without Bootstrap's JS; panes build lazily
    │   ├── FieldList.js        renders form fields - and says WHY one is empty
    │   └── ProjectHeader.js    the form's header block + the Project No. button
    └── views/
        ├── ProjectColumns.js   Tabulator column definitions
        ├── ProjectListView.js  toolbar + grid: load, filter, paginate, redraw
        ├── ProjectDetailView.js  header + tabs (WGT-04)
        └── detail/             one module per tab
            ├── OverviewTab.js      the form, in printed order
            ├── OrganisationTab.js  Department, Business Unit, Customer
            ├── RisksTab.js         form XIII - OOTB Risk / Opportunity objects
            └── LessonsTab.js       form XII
```

Shared libraries from `../JazzySole/`: Bootstrap CSS, the Tabulator
`simple` theme CSS, `PlatformService/Credentials.js`,
`PlatformService/Request.js`, `Tabulator/TabulatorLoader.js`.

The `simple` theme, not `bootstrap5`: that one renders at 16px, which is about
twice the row height of the OOTB grids the widget sits beside. The rest of the
density is in `css/IRSProjects.css` - the reason is recorded in the requirement's
`design.md` section 6, as rule R1 asks.

**Tabulator's JavaScript is deliberately not a `<script>` tag** - its UMD bundle
would raise `Mismatched anonymous define()` under the dashboard's AMD loader.
`JazzySole/TabulatorLoader` loads it; see that folder's README.

## Lifecycle

| UWA event | What runs |
|---|---|
| `onLoad` | `App.onLoad()` -> spinner -> `Credentials.init()` -> credential bar, then the router opens the remembered page |
| `onRefresh` (menu Refresh, or Preferences saved) | same start sequence; a start already running is reused, not doubled |
| `onResize` | `ProjectListView.redraw()` -> `table.setHeight(...)` + `table.redraw(true)`, so the pager stays on the frame's bottom edge |

Changing the credential re-renders the page: a different security context can see
a different set of projects.

**One shared top row:** the open page's own controls on the left (the list puts
its toolbar there), the credential picker hard right. `App.js` owns the row and
hands the page the left slot.

**Only our project types are listed:** `EPMAnalysisProject` and
`EPMResearchProject`, from `config/ProjectFields.js` (`LIST_TYPES`). The project
service has no type parameter, so the filter is ours. The detail page does not
filter - it opens a project of any type.

Everything renders into `widget.body`. User-visible text is set with
`textContent`, and Tabulator formatters return DOM nodes - never HTML strings.

## Preferences

| Name | Type | |
|---|---|---|
| `x3dPlatformId` | hidden | tenant for every call |
| `xPref_CREDENTIAL` | list | the active credential, created by `JazzySole/Credentials` |
| `xPrefShowClosed` | hidden | the "show completed / archived" switch, so it survives a refresh (rule R6) |
| `jzRoute` | hidden | the open page (`projects` or `project/<id>`), so a refresh comes back to it (`JazzySole/Router`) |

## URL

`https://external.solize.com/WidgetPacket/IRSProjects/IRSProjects.html`

That host name resolves on the **VM** (which is what 3DDashboard needs); on the
development host use `https://localhost/WidgetPacket/IRSProjects/IRSProjects.html`
until the elevated `scripts/setup-https-host.ps1` has been run there.

HTTPS is required by 3DDashboard (WP03 open item O1, done 2026-09-24). Spring
serves port 443 with our own SAN certificate. See
[3dexperience-tls.md](../../../../../../docs/3dexperience-tls.md) for the
certificate, the keystore and the truststore step on the platform VM.
