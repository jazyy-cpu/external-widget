# 2026-09-23-01 - Foundation: JazzySole libraries, UWA rules, OOTB reference, documentation pattern

| | |
|---|---|
| Date | 2026-09-23 |
| Requirement | - |
| Status | done |
| Done by | Claude Code |

## Goal

Prepare the Spring project for widget development and set up this
documentation folder.

## What was done

- Copied `JazzySole` from the IRS POC into
  `src/main/resources/static/WidgetPacket/JazzySole`, same hierarchy.
  Bootstrap kept at 5.3.8 (latest); Tabulator upgraded 6.3.1 -> 6.5.3 from
  the npm tarball, checksum verified. Details:
  [reference/uwa-rules-and-libraries.md](../../reference/uwa-rules-and-libraries.md).
- Collected the UWA rules from the DS documentation (same file).
- Studied the OOTB Meeting widget on the VM:
  [reference/ootb-meeting-widget.md](../../reference/ootb-meeting-widget.md).
- Set up the documentation pattern: [../README.md](../../README.md). The
  two reference files were first written in WP03 and moved here, because
  they are development detail.

## Decisions and findings

- Detail lives here; WP03 keeps only the project-level view (user,
  2026-09-23). The rule is also in the workspace `CLAUDE.md` and `AGENTS.md`.
- Our own documentation pattern; JBM, Planner extension and POC are read-only
  references for APIs and patterns.
- Open: HTTPS for the widget, trusted-domain registration, rename
  `PlatformServices` out of `DS/` (WP03 plan O1-O3).

## Verification

- `tabulator.min.js` header `Tabulator v6.5.3`; Bootstrap files `v5.3.8`.
- Spring app not started; no Java changed; nothing committed.

## Next

Agree the widget scope with the user (WP03 plan S3), then open the first
requirement folder.

Workspace worklog: `worklog/entries/2026/2026-09-23-08_wp03-widget-foundation.md`.
