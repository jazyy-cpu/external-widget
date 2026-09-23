# 2026-09-23-07 - Widget step 1: IRSProjects shell, credentials with OOTB fallback, Hello World

| | |
|---|---|
| Date | 2026-09-23 |
| Requirement | [WGT-03](../../requirements/WGT-03-credential/README.md) |
| Status | done (host side); dashboard test pending |
| Done by | Claude Code |

## Goal

First runnable widget: credentials only, Hello World, UWA lifecycle done
properly. Handle the risk that the OOTB AMD module is not reachable from an
external server.

## What was done

- `JazzySole/PlatformService/Credentials.js` (AMD `JazzySole/Credentials`
  1.0.0) + README: OOTB `DS/ENOXWidgetPreferences` first (require error
  callback + 6 s timeout), fallback to Get Me + `widget.addPreference`,
  same key `xPref_CREDENTIAL`.
- Widget `WidgetPacket/IRSProjects/`: `IRSProjects.html` (XHTML UWA shell,
  events only), `js/App.js` (onLoad / onRefresh share one guarded start,
  spinner, error alert), `js/components/CredentialBar.js`,
  `js/views/HelloView.js`, `README.md`.
- Test `src/test/js/jazzysole-credentials.test.js`.

## Decisions and findings

- Change control is a native Bootstrap `form-select`: Bootstrap's UMD
  JavaScript loaded by `<script>` clashes with RequireJS (anonymous define).
  Same care needed for Tabulator in WGT-01.
- The Hello page shows which credential path ran, so the first dashboard
  run answers the "external server" question directly.
- A first test run failed because Node's own `require` shadowed the fake
  AMD `require` in the test harness; the loader was fixed, the module was
  not at fault.

## Verification

- `node src/test/js/jazzysole-credentials.test.js` -> ALL CREDENTIALS TESTS PASSED
- `node src/test/js/jazzysole-router.test.js` -> ALL ROUTER TESTS PASSED
- `IRSProjects.html` parses as well-formed XML; `node --check` on all JS.
- Spring not started: Maven is not on this session's PATH. Static files are
  under `src/main/resources/static/` (served by Spring Boot by default).

## Next

Serve over HTTPS and add to 3DDashboard (WP03 O1/O2), then run WGT-03
checks T1-T5. After that: router + WGT-01 grid.
