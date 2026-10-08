# Development log

Newest first.

| Id | Title | Requirement | Status |
|---|---|---|---|
| [2026-10-08-01](2026/2026-10-08-01_proposal-form-sections-and-bootstrap-only.md) | Proposal form: all 23 rows mapped to four sources; XII and XIII live from the REST JAR; Bootstrap only, no Tabulator | WGT-07, WGT-04 | done |
| [2026-10-07-02](2026/2026-10-07-02_task-page-proposal-form.md) | The task page: context sidebar, the PROJECT PROPOSAL / PROFILE form driven by a JSON file and read from the project, and four things the captured log settled (`typeNLS`, task attributes in `basics`, `dataelements.project` is the collab space, no baseline tasks) | WGT-07 | built read-only; dashboard checks B1-B7 open |
| [2026-10-07-01](2026/2026-10-07-01_task-list-live-data.md) | The task grid reads live data: one call for task + project + route, only the four IRS subtypes, and the baseline-copy trap (a task existed five times) | WGT-06 | built; dashboard checks A1-A9 open |
| [2026-10-03-02](2026/2026-10-03-02_training-widget-options.md) | Training architecture: Project, Task and Offering Document | WGT-08 | done — architecture selected 2026-10-04 |
| [2026-10-03-01](2026/2026-10-03-01_task-widget-landing-skeleton.md) | New `IRSTasks` widget: landing page skeleton with an empty grid, columns from the POC task grid, the subtype registry, and `Format` / `CredentialBar` promoted into `JazzySole/Ui` | WGT-06 | built; not yet in the dashboard |
| [2026-09-29-01](2026/2026-09-29-01_rollback-to-b54dfa4-sn-search-parked.md) | Working tree rolled back to `b54dfa4`: the SN-search attempt and the WGT-05 picker work were uncommitted, so they were committed to `wip/wgt-05-org-pickers-and-sn-search` first and nothing was lost | WGT-05 | parked |
| [2026-09-26-02](2026/2026-09-26-02_no-store-static-resources.md) | The fixed grid crash reappeared verbatim: the browser was running the cached module. Static resources now go out `no-store` - the widget's files are no longer cacheable at all | WGT-01 | done |
| [2026-09-26-01](2026/2026-09-26-01_tabulator-async-build-crash.md) | Grid empty and a null `getBoundingClientRect` in the console: `setHeight` was called before Tabulator had built itself. The view now waits for `tableBuilt` | WGT-01 | fixed; needs a look in the dashboard |
| [2026-09-25-02](2026/2026-09-25-02_state-names-and-enovia-styling.md) | The platform's real state names mapped (Create=Draft, Active=In Work); maturity palette from the Maturity graph; badge text centred; ENOVIA-blue header | WGT-01 | done |
| [2026-09-25-01](2026/2026-09-25-01_landing-page-ootb-look.md) | Landing page matched to the OOTB grids: Type as plain text with the platform's label, Maturity State in the platform's palette, darker headings, a visible toolbar band | WGT-01 | done |
| [2026-09-24-09](2026/2026-09-24-09_credential-right-and-type-filter.md) | Credential picker moved to the far right of one shared toolbar row; the list now shows only Analysis and Research projects (closes A4) | WGT-01, WGT-03 | done |
| [2026-09-24-08](2026/2026-09-24-08_project-detail-skeleton.md) | Project detail page skeleton: field catalogue from WP02 doc 05, tabs, Project No. button (UI only), router wired in at last. Update: Overview reworked into a two-column Bootstrap form, and `JazzySole/Notify` 1.0.0 added | WGT-04, WGT-02 | skeleton built |
| [2026-09-24-07](2026/2026-09-24-07_project-grid-first-live-run.md) | Grid live in the dashboard: A2 answered (`state` works), then pager pinned to the bottom, one search control, compact rows | WGT-01 | done |
| [2026-09-24-06](2026/2026-09-24-06_wgt-01-project-list.md) | WGT-01 project list built: 8 modules, shared `JazzySole/Request` wrapper and `TabulatorLoader`; HelloView deleted | WGT-01 | built; dashboard checks pending |
| [2026-09-24-05](2026/2026-09-24-05_3dxcontentchecker-control-widget.md) | Why DS/3DXContentChecker 404s (it lives in 3dspace/webapps); confirmed with a minimal control widget, then deleted | - | done |
| [2026-09-24-04](2026/2026-09-24-04_dashboard-cache-and-prerequisites.md) | Dashboard cache disabled for development; Additional App prerequisites confirmed complete (O2 closed) | WP03 O2 | done |
| [2026-09-24-03](2026/2026-09-24-03_credentials-1.1.0-single-path.md) | `Credentials` 1.1.0: dead OOTB branch removed, single path, regression guard in the tests | WGT-03 | done |
| [2026-09-24-02](2026/2026-09-24-02_widget-live-in-dashboard-t1-answered.md) | Widget live in 3DDashboard; T1 answered - `DS/` module ids unreachable from an external widget, fallback carries it | WGT-03 | done |
| [2026-09-24-01](2026/2026-09-24-01_widget-https-certificate.md) | Widget served over HTTPS with our own SAN certificate; Apache certificates unusable (no SAN) | WP03 O1 | done |
| [2026-09-23-07](2026/2026-09-23-07_widget-step1-credentials-hello.md) | Widget step 1: IRSProjects shell, credentials with OOTB fallback, Hello World | WGT-03 | done |
| [2026-09-23-06](2026/2026-09-23-06_ootb-credential-preference.md) | OOTB credential preference read from the VM; WGT-03 revised | WGT-03 | done |
| [2026-09-23-05](2026/2026-09-23-05_credential-design.md) | Credential requirement: DS use case, Get Me, design | WGT-03 | done |
| [2026-09-23-04](2026/2026-09-23-04_router-library-and-minimal-landing.md) | JazzySole Router library; landing page cut to minimum columns | WGT-01, WGT-02 | done |
| [2026-09-23-03](2026/2026-09-23-03_landing-decisions-api-test-routing.md) | Landing decisions, project API test, routing, rules R4-R6 | WGT-01, WGT-02 | done |
| [2026-09-23-02](2026/2026-09-23-02_landing-page-brainstorm.md) | Landing page brainstorm; minimal-CSS rule | WGT-01 | done |
| [2026-09-23-01](2026/2026-09-23-01_foundation-and-docs-pattern.md) | Foundation: JazzySole libraries, UWA rules, OOTB reference, documentation pattern | - | done |
