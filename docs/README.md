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

## Index

### Reference

| File | Content |
|---|---|
| [reference/uwa-rules-and-libraries.md](reference/uwa-rules-and-libraries.md) | UWA rules from the DS documentation; JazzySole libraries and versions |
| [reference/ootb-meeting-widget.md](reference/ootb-meeting-widget.md) | patterns from the OOTB Meeting widget on the VM |
| [3dexperience-tls.md](3dexperience-tls.md) | platform HTTPS certificate and Java trust |

### Requirements

See [requirements/INDEX.md](requirements/INDEX.md).

### Development log

See [devlog/INDEX.md](devlog/INDEX.md).
