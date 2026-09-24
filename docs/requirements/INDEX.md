# Requirements

| Id | Title | Status | Work package |
|---|---|---|---|
| [WGT-01](WGT-01-project-landing/README.md) | Project landing page: minimum columns, no task data, closed projects behind a switch, horizontal scroll | **running in 3DDashboard** 2026-09-24; A2 answered (`state` works). Reworked after the first live look: pager on the bottom edge, one search control, compact rows. Checks G4-G15 open ([test.md](WGT-01-project-landing/test.md)) | [WP03](../../../documents/work-packages/03-project-widget/README.md) |
| [WGT-02](WGT-02-navigation-state/README.md) | Navigation that survives a refresh - shared `JazzySole/Router` | built; **wired into the widget 2026-09-24** (`projects`, `project/:id`, preference `jzRoute`); dashboard checks N1-N3 pending | [WP03](../../../documents/work-packages/03-project-widget/README.md) |
| [WGT-04](WGT-04-project-detail/README.md) | Project detail page: project information in form order, plus tabs for organisation, risks & opportunities and lessons learnt | **skeleton built 2026-09-24**; not yet opened in the dashboard. 6 open questions, B1-B6 | [WP03](../../../documents/work-packages/03-project-widget/README.md) |
| [WGT-03](WGT-03-credential/README.md) | Credential: store the user's choice, change it, show the active one at the top | **working in 3DDashboard**, survives reload; T1 answered - OOTB module unreachable from an external widget, so that branch was removed in `Credentials` 1.1.0; T2-T4 pending | [WP03](../../../documents/work-packages/03-project-widget/README.md) |
