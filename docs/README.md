# external-widget documentation

All **detailed** documentation for the widget development lives here, in
the Spring project. The work packages under `documents/work-packages/` hold
only the high-level project view and link here.

## The rule: where things are written

| Level | Where | What goes there |
|---|---|---|
| Project (high level) | `documents/work-packages/<WP>/` in the IRCLASS workspace | scope, decisions, status per requirement, open items, links to this folder. No code, no API detail, no step-by-step |
| Development (detail) | `external-widget/docs/` (this folder) | per-requirement design, APIs, code structure, tests, and the development log |
| Platform activity | `worklog/` in the IRCLASS workspace | anything that touches the VM, the platform database or agent tooling (the workspace worklog rule is unchanged) |

When a widget task also touches the VM or the platform (MQL, deployment,
certificates on the VM), it gets a workspace worklog entry **and** a devlog
entry here, each linking to the other.

## Development rules

| # | Rule |
|---|---|
| R1 | **Minimal custom CSS.** Use Bootstrap 5 and Tabulator out of the box: Bootstrap classes, components and utilities; Tabulator's `tabulator_bootstrap5` theme and built-in formatters. Write own CSS only when neither can do it, keep it in the widget's one CSS file under one root class, and record why in the requirement's `design.md` (user, 2026-09-23) |
| R2 | Follow the UWA rules in [reference/uwa-rules-and-libraries.md](reference/uwa-rules-and-libraries.md) |
| R3 | All REST calls go through one request wrapper (tenant, SecurityContext, CSRF) - see [reference/ootb-meeting-widget.md](reference/ootb-meeting-widget.md) §5 |
| R4 | **Many small files.** One AMD module per file, grouped by role (config, services, views, components, utilities), like the OOTB Meeting widget. No single large JS file; the HTML shell holds no logic (user, 2026-09-23) |
| R5 | **CSRF token tracked and renewed.** The request wrapper keeps the current `ENO_CSRF_TOKEN`, sends it on every PUT / PATCH / POST / DELETE, updates it from any response that carries one, and when a write fails because the token is missing or expired (new 3DSpace login) it fetches a fresh one from `GET /resources/v1/application/CSRF` and retries **once**. The token value is never logged or written to docs (user, 2026-09-23) |
| R6 | **Navigation survives a refresh.** The current page and its parameters are kept in a hidden widget preference, so a refresh returns the user to the same page (see [WGT-02](requirements/WGT-02-navigation-state/README.md)) (user, 2026-09-23) |

## Layout

```
docs/
├── README.md                  this file: the rule, the layout, the index
├── requirements/
│   ├── INDEX.md               one row per requirement: id, title, status, WP link
│   └── <REQ-ID>-<slug>/       one folder per requirement
│       ├── README.md          what is asked, source (RSD / form), acceptance
│       ├── design.md          UI, modules, data flow, decisions
│       ├── api.md             REST calls used: URL, method, payload, response, quirks
│       └── test.md            how it was tested and the results
├── devlog/
│   ├── INDEX.md               newest first
│   └── <YYYY>/<YYYY-MM-DD-NN>_<slug>.md   one entry per development session
└── reference/                 cross-cutting technical notes (UWA, libraries, OOTB patterns, TLS)
```

Create only the files a requirement needs; `README.md` is the one that is
always there.

## Requirement ids

`<FORM or FEATURE>-<nn>`, taken from the source document where one exists,
for example `RD-PRJ-01` for the R&D project proposal form (R&D-PRJ-01), or
`WGT-01` for a widget feature with no form behind it (shell, grid, search).

## Devlog entries

Same spirit as the workspace worklog, lighter:

```markdown
# <YYYY-MM-DD-NN> - <title>

| | |
|---|---|
| Date | YYYY-MM-DD |
| Requirement | <REQ-ID> (link) or - |
| Status | in-progress / done / blocked |
| Done by | <agent or person> |

## Goal
## What was done
## Decisions and findings
## Verification
## Next
```

Rules: start the entry when the work starts, close it with verification;
append-only - correct with a dated `## Update` section; no passwords, keys,
tokens or session cookies; update `devlog/INDEX.md`.

## External references (read only)

Projects we look at for APIs and patterns. We do **not** copy their
documentation structure; ours is the one above.

| Project | Path | Useful for |
|---|---|---|
| JBM widget packet | `D:\PROJECT DATA\13 JBM\dev\SPRING\FINAL PROEJCT\final-project\src\main\resources\static\WidgetPacket` | widget code patterns, JazzySole origin |
| JBM docs | `D:\PROJECT DATA\13 JBM\dev\SPRING\FINAL PROEJCT\final-project\docs` | 3DEXPERIENCE API notes (search, engineering item, CSRF handling) |
| Planner import extension | `D:\PROJECT DATA\20 MICROSOFT PLANNER\Integration to 3dexperience\Planner-to-3DEX-Import-Extension` | project / task API usage |
| IRS POC | `SpringProject_IRS_POC/poc_demo` in the workspace | the earlier IRS widget POC |

## Where the work stands

[HANDOFF.md](HANDOFF.md) - the current picture for whoever picks the work up:
what exists, what to do next, and the traps in the order they bite. It is a
living page, rewritten rather than appended to; the history stays in the devlog.

## Index

### Reference

| File | Content |
|---|---|
| [reference/uwa-rules-and-libraries.md](reference/uwa-rules-and-libraries.md) | UWA rules from the DS documentation; JazzySole libraries and versions |
| [reference/ootb-meeting-widget.md](reference/ootb-meeting-widget.md) | patterns from the OOTB Meeting widget on the VM |
| [3dexperience-tls.md](3dexperience-tls.md) | platform HTTPS certificate and Java trust |
| [JazzySole PlatformService README](../src/main/resources/static/WidgetPacket/JazzySole/PlatformService/README.md) | shared `JazzySole/Credentials`: install, API, OOTB / fallback behaviour |
| [IRSProjects widget README](../src/main/resources/static/WidgetPacket/IRSProjects/README.md) | the widget's files and lifecycle |
| [JazzySole Router README](../src/main/resources/static/WidgetPacket/JazzySole/Router/README.md) | shared router library: install, API, behaviour. Library docs live next to the library so they travel with it |
| [JazzySole Tabulator README](../src/main/resources/static/WidgetPacket/JazzySole/Tabulator/README.md) | Tabulator and `TabulatorLoader`: why a loader is needed at all |
| [JazzySole Notify README](../src/main/resources/static/WidgetPacket/JazzySole/Notify/README.md) | sliding notifications: the one policy table (which type stays how long), the API and the override |

### Requirements

See [requirements/INDEX.md](requirements/INDEX.md).

### Development log

See [devlog/INDEX.md](devlog/INDEX.md).
