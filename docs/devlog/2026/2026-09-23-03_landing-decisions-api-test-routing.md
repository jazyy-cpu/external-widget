# 2026-09-23-03 - Landing decisions, project API test, routing, rules R4-R6

| | |
|---|---|
| Date | 2026-09-23 |
| Requirement | [WGT-01](../../requirements/WGT-01-project-landing/README.md), [WGT-02](../../requirements/WGT-02-navigation-state/README.md) |
| Status | done |
| Done by | Claude Code |

## Goal

Record the user's landing-page decisions, test the project list API, find
a way to keep navigation across refresh, and add the new rules.

## What was done

- WGT-01 updated: default hides Complete / Archive; Tabulator pagination;
  no create button (OOTB widget creates); Department / Customer columns
  empty for now; CAT / Screening later.
- API test (API Labs, read-only GET, 4 calls):
  `GET /resources/v1/modeler/projects` with `$include` / `$fields`.
  Results in [WGT-01 api.md](../../requirements/WGT-01-project-landing/api.md).
- Router libraries checked (Navigo 8.11.1, page.js 1.11.6, Director 1.2.8 -
  all unmaintained, all tied to `window.location`). Proposal: own `Router`
  module with the route in a hidden preference, as the OOTB Meeting widget
  does ([WGT-02](../../requirements/WGT-02-navigation-state/README.md)).
- Rules R4 (many small files), R5 (CSRF tracked and renewed), R6
  (navigation survives refresh) added to `docs/README.md`, `CLAUDE.md`,
  `AGENTS.md`.

## Decisions and findings

- The OOTB project service returns our subtype and **all 12 EPM
  attributes** with no extra work. `$fields` trims; `$include=none` avoids
  the task tree.
- No project manager name from this service (only member ids) - open A1.
- `state` filter documented but not in the OpenAPI spec, so not testable in
  the lab - verify from the widget (A2).
- CSRF: valid for the Java session, invalid after a new 3DSpace login; the
  project GET response also carries the token.

## Verification

API calls returned 200 with the expected JSON; exchange ids in the lab.
No writes, nothing built.

## Next

User: WGT-02 proposal and A1 (project manager source). Then build the
widget skeleton (HTML shell, init, request wrapper, router) and WGT-01.
