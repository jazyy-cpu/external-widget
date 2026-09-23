# 02 - Reference: the OOTB Meeting widget (`ENXMeetingMgmt`)

Source on the VM (read only):
`C:\DassaultSystemes\TomEE\3DSpaceCas\apache-tomee-plus-9.1.2\webapps\3dspace\webapps\ENXMeetingMgmt\`

`ENXMeetingMgmt - Copy.js` has the **same SHA-256** as `ENXMeetingMgmt.js`,
so it is an unmodified copy of the shipped file. Studied from a copy in the
session scratchpad; nothing on the VM was changed.

## 1. File layout

| File | Size | Role |
|---|---|---|
| `ENXMeetingMgmt.html` | 2.6 KB | the UWA page: metas, title, preferences, `widget.addEvents`, a loading spinner in the body |
| `ENXMeetingMgmt.js` | 799 KB, 22,432 lines | **all 108 AMD modules concatenated** into one file (a build output) |
| `ENXMeetingMgmt.css` | 22 KB | the widget's CSS, loaded through `css!` |
| `ENXMeetingMgmt_<lang>.js` | 13-22 KB each, 13 languages | NLS bundles: `define("DS/ENXMeetingMgmt/assets/nls/ENOMeeting", {meeting:"Meeting", ...})` |
| `assets/` | folder | icons and images |

**Lesson:** one HTML shell, one JS bundle of named modules, one CSS, one
string bundle per language. We develop as separate files and can bundle
later.

## 2. The HTML shell

```html
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:widget="http://www.netvibes.com/ns/">
<head>
  <meta name="author" content="Dassault Systemes" />
  <meta name="brand" content="ENOVIA" />
  <meta name="autoRefresh" content="0" />
  <meta name="description" content="ENOVIA Meeting Management" />
  <title>Meetings</title>
  <widget:preferences>
    <widget:preference type="hidden" name="x3dPlatformId" defaultValue="OnPremise"></widget:preference>
    <widget:preference type="hidden" name="collabspace"   defaultValue=""></widget:preference>
    ...
  </widget:preferences>
  <script>
    widget.addEvents({
      onLoad: function () {
        require(['UWA/Core', 'DS/ENXMeetingMgmt/View/Widget/ENOMeetingInit'],
          function (UWA, ENOMeetingInit) { new ENOMeetingInit().onLoad(); });
      },
      onRefresh: function () { /* same, .onRefresh() */ }
    });
  </script>
</head>
<body><!-- spinner until onLoad renders --></body>
```

**Lessons:**
- The HTML holds **no logic**: `onLoad` / `onRefresh` only `require` one init module.
- Platform id (`OnPremise`) and security context are **hidden preferences**,
  so they persist per widget instance.
- A spinner in the static body gives feedback before the code loads.

## 3. Module structure

108 modules under `DS/ENXMeetingMgmt/`, grouped by role:

| Folder | Count | Examples |
|---|---|---|
| `View/` | 55 | `Widget/ENOMeetingInit`, `Home/MeetingSummaryView`, `Grid/*DataGridView`, `Form/*`, `Dialog/*`, `Facets/*`, `Menu/*ContextualMenu` |
| `Config/` | 14 | grid column configs, toolbar configs, facet (tab) configs |
| `Utilities/` | 13 | `MeetingWidgetUtil`, `DataFormatter`, `SearchUtil`, `DragAndDrop` |
| `Model/` | 8 | one model per grid / facet |
| `Components/` | 6 | `MeetingEvent` (event bus), `MeetingNotify` (messages), wrappers |
| `Services/` | 5 | `MeetingServices` (REST calls), `LifeCycleServices`, `WidgetCommonServices` |
| `Actions/` | 4 | toolbar / menu actions |
| `Controller/` | 2 | `EnoviaBootstrap` (platform, security context, requests), `MeetingController` |

**Lesson:** a clean split - Config (declarative), Model, View, Services
(REST only), Controller (platform plumbing), Components (cross-cutting).
We adopt the same split, with Tabulator in place of the DS DataGridView.

## 4. Start-up sequence (`ENOMeetingInit.onLoad`)

1. Create the event bus (`widget.meetingEvent = new MeetingEvent()`) and the
   notification helper (`widget.meetingNotify`), both hung on `widget`.
2. `MeetingWidgetUtil.init()`:
   - `EnoviaBootstrap.start(...)` - resolves the 3DSpace URL through
     `i3DXCompassPlatformServices` (`serviceName: '3DSpace'`);
   - adds preferences at run time (`widget.addPreference`), including an
     `objectLimit` range preference;
   - `ENOXWidgetPreferences.addPlatformSelectionPreferenceToWidget(...)` then
     `addCredentialPreferenceToWidget()` - the **OOTB platform and
     credential (security context) pickers** in the widget preferences;
   - stores the chosen context in the hidden `collabspace` preference.
3. Only then `_initializeComponent()` builds the UI.

`onRefresh` destroys the views and the event bus, re-creates them, and
builds the UI again.

**Lessons:**
- Resolve platform URL and security context **before** any UI or data call.
- Use `DS/ENOXWidgetPreferences` for the credential picker instead of our own
  `getsecuritycontext` call - it gives the user the standard OOTB chooser.
  (Our `PlatformServices.js` reads the preferred credential only.)
- Clean up properly on refresh: destroy views, unsubscribe events.

## 5. The request wrapper (`EnoviaBootstrap.authenticatedRequest`)

Every REST call goes through one function that:

1. appends **`tenant=<x3dPlatformId>`** to the URL;
2. appends **`SecurityContext=ctx::<credential>`** (except for `/bps/cspaces`);
3. appends `$debug=true` in widget debug mode and `$language=<swymlang>` from
   the cookie;
4. wraps `onComplete` to capture the **`X-DS-CSRFTOKEN`** response header;
5. calls `WAFData.authenticatedRequest(url, options)`.

Service URLs are built from the 3DSpace root, for example
`<3DSpace>/resources/v1/modeler/meetings`,
`<3DSpace>/resources/v1/modeler/documents`,
`<3DSpace>/resources/v3/e6w/service`.

**Lesson:** we write the same single wrapper in our `PlatformServices`
module. No service module calls `WAFData` directly.

## 6. Events, messages, NLS

| Concern | OOTB solution | Our equivalent |
|---|---|---|
| Component-to-component events | `DS/CoreEvents/ModelEvents` wrapped as publish / subscribe / subscribeOnce / unsubscribe / destroy | same module, or a tiny own bus |
| User messages | `DS/Notifications/NotificationsManagerUXMessages` + `NotificationsManagerViewOnScreen`, stacking policy 9 | same OOTB module - gives the platform look |
| Labels | `i18n!DS/ENXMeetingMgmt/assets/nls/ENOMeeting` + one bundle per language | English-only first; keep labels in one NLS module so other languages can be added |
| Grid / form controls | `DS/Controls/*`, `DS/TreeModel/*`, DataGridView | **Bootstrap + Tabulator** (D3) |
| Object search | `DS/SNInfraUX/SearchCom` | OOTB search popup - worth reusing for picking Department / Customer (WP02 doc 05 §9.5) |
| Open in another app | compass socket `onSetX3DContent` + `onLaunchApp` with `3DXContent` protocol | later |
