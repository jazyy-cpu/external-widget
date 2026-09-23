# 2026-09-23-02 - Landing page brainstorm; minimal-CSS rule

| | |
|---|---|
| Date | 2026-09-23 |
| Requirement | [WGT-01](../../requirements/WGT-01-project-landing/README.md) |
| Status | done |
| Done by | Claude Code |

## Goal

Propose the fields and the look of the first page before building it.

## What was done

- New rule R1 (user): minimal custom CSS, Bootstrap and Tabulator out of the
  box. Added to `docs/README.md`, workspace `CLAUDE.md` / `AGENTS.md`.
- Read the project lifecycle in MQL (read only): `Project Space` =
  Create, Assign, Active, Review, Complete, Archive; `Project Space Hold
  Cancel` = Hold, Cancel.
- Wrote the WGT-01 draft: status filter mapping, default and optional
  columns, layout sketch, data source, open questions L1-L7.

## Decisions and findings

- Department and Customer columns depend on relationships not yet built.
- Project list source to verify: `/resources/v1/modeler/projects`.

## Verification

Draft only; nothing built. Awaiting the user's review of L1-L7.

## Next

User review, then `api.md` (test the project list call) and the build.
