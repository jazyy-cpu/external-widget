# 2026-09-23-05 - Credential requirement: DS use case, Get Me, design

| | |
|---|---|
| Date | 2026-09-23 |
| Requirement | [WGT-03](../../requirements/WGT-03-credential/README.md) |
| Status | done |
| Done by | Claude Code |

## Goal

Design how the widget stores, changes and shows the user's credential.

## What was done

- Read the JBM `PreferenceTest` example (read-only reference).
- Read the DS R2024x guides "Credentials with Widget App" (CAAi3DXPnOSCChoice)
  and "Get Me" through API Labs. Get Me has no executable OpenAPI operation
  in the lab catalog, so it was not called live.
- Wrote the WGT-03 design.

## Decisions and findings

- `select=preferredcredentials` is deprecated since 2024x FD01; the DS use
  case removed "preferred" in Feb 2024. Not used.
- The JBM example resets the stored credential on every load
  (`setValue` unconditionally) - avoided: keep the stored value when valid.
- Proposed shared module `JazzySole/Credentials`.

## Verification

Design only; checks C1-C5 listed for the first dashboard test.

## Next

User answers Q1 / Q2, then build with the widget skeleton.
