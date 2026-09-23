# 2026-09-23-06 - OOTB credential preference read from the VM; WGT-03 revised

| | |
|---|---|
| Date | 2026-09-23 |
| Requirement | [WGT-03](../../requirements/WGT-03-credential/README.md) |
| Status | done |
| Done by | Claude Code |

## Goal

The user pointed out that the Meeting app keeps its credential across a
refresh and a login from another browser. Find out how.

## What was done

- Copied (read-only) `webapps/3dspace/webapps/ENOXWidgetPreferences/ENOXWidgetPreferences.js`
  and its English NLS from the VM; read `addCredentialPreferenceToWidget()`.
- Revised WGT-03: reuse the OOTB preference `xPref_CREDENTIAL` through a
  shared wrapper `JazzySole/Credentials`, with the DS use case as fallback.
- Added a section to `reference/ootb-meeting-widget.md`; noted in WGT-02 N1.

## Decisions and findings

- The persistence comes from **widget preferences being stored by
  3DDashboard server-side**, per user and widget instance. Applies to any
  preference we create, including the router's.
- OOTB default when nothing is stored: first option of the label-sorted
  list, admin credentials last. Adopted (answers Q2).

## Verification

Source read; behaviour matches the user's observation. Live checks C1-C5
stay for the first dashboard test.

## Next

User confirms Q1, then build the skeleton with `JazzySole/Credentials`.

Workspace worklog: `worklog/entries/2026/2026-09-23-09_wp03-project-api-test.md` (update).
