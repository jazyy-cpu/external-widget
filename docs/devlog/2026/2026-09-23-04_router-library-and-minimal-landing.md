# 2026-09-23-04 - JazzySole Router library; landing page cut to minimum columns

| | |
|---|---|
| Date | 2026-09-23 |
| Requirement | [WGT-01](../../requirements/WGT-01-project-landing/README.md), [WGT-02](../../requirements/WGT-02-navigation-state/README.md) |
| Status | done |
| Done by | Claude Code |

## Goal

Apply the user's landing-page decisions and build the router as a shared
library in `JazzySole`.

## What was done

- WGT-01: no task data; 8 minimum columns (Project No., Title, Category,
  Department, Customer, Status, Start, Planned end); progress and project
  manager moved to the detail page; horizontal scroll bar with the first two
  columns frozen; `$fields` list shortened in api.md.
- New shared library `static/WidgetPacket/JazzySole/Router/Router.js`
  (AMD `JazzySole/Router`, v1.0.0) with `README.md` (install, usage, API,
  behaviour, change log). No dependencies; state in a hidden widget
  preference, memory fallback outside a dashboard.
- Test `src/test/js/jazzysole-router.test.js` (Node, fake `widget`).

## Decisions and findings

- Library documentation sits next to the library so it travels with
  `JazzySole` to other projects; `docs/README.md` links to it.
- A page is saved only after its handler succeeds; a failed restore
  (deleted object, no access) falls back to the default page.
- Project manager (A1) no longer blocks the landing page.

## Verification

`node src/test/js/jazzysole-router.test.js` -> `ALL ROUTER TESTS PASSED`
(matching, optional params, encoding, save/restore in a new instance, back
stack, guard cancel, not-found and failed-restore fallback, memory store).

## Next

Widget skeleton (HTML shell, init, request wrapper with CSRF renewal) and
the WGT-01 grid; then the dashboard checks N1-N3 for the router.
