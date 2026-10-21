# 2026-10-21-01 - G17 periodic evaluation approvals in the task widget

The user: the periodic evaluation (G17) is built, so show its approval task in
the widget the way other tasks are shown. Decisions on the plan: use the paper
R&D-PES-Rev.01 wording with our own mapping (to be corrected later if off); the
Approvals list as before; **evidence documents only**; no Informed Users (only
the data of the custom 3DSpace form); approvers' read access assumed as for STM.

## What was in the way

- `InboxTaskService` drops an inbox task whose `contents[0].type` is not in the
  registry, so the Evaluator / Checker / Approver steps of
  `IRSPeriodicEvaluationRoute` never reached the list.
- The evaluation is neither a Task nor a Document: `modeler/tasks` and
  `modeler/documents` cannot read it, and nothing OOTB follows the
  `IRSEvaluation*` relationships.

## What was built

| Piece | Change |
|---|---|
| `js/config/TaskFields.js` | `DOCUMENT_TYPES.IRSPeriodicSoftwareEvaluation` (label `PERIODICAL EVALUATION OF SOFTWARE`, badge `pes`, `fields: pes-evaluation`, `kind: evaluation`); `kindOf()` returns the entry's `kind` |
| `js/App.js`, `js/views/TaskListView.js` | new route `evaluation/:id` with `EvaluationService` as loader; `noun` option for the error banner |
| `js/services/EvaluationService.js` | **new.** `GET resources/v1/irsproject/evaluations/{id}`, shaped as `{task, project:null, note}`; reasons mapped to the paper's tick-box wording, one per line; evidence as documents-panel rows |
| `js/views/TaskDetailView.js` | banner says "This evaluation is ..."; error banner uses `options.noun` |
| `js/views/TaskDocumentsPanel.js` | optional `task.documentGroups: [{heading, items}]`; default stays Deliverables / Attachments |
| `js/data/forms/pes-evaluation.json` | **new.** R&D-PES rows in the paper's order, plus the custom form's own Evaluation No., Title, Test summary, Approved on, Expiry date; signatures hidden (drawn by the approval panel) |
| `css/IRSTasks.css`, `IRSTasks.html` | badge `.irs-type-pes`; script tag |

## The server side

`irs-project-rest` gains `EvaluationService` + `EvaluationReader`, proven first
in the JPO twin `IRSPeriodicEvaluationContext` on PES-0000007 and PES-0000010.
2 round trips whatever the evaluation holds. Worklog `2026-10-21-12`.

## Tests

New `src/test/js/irstasks-pes.test.js`, built from the JPO's real output:
registry, inbox row, shaping, evidence-only panel groups, every visible form
row resolving, reason ranges matching the attribute CI, wiring, and the call
and error. `irstasks-stm`, `irstasks-landing` pass; the detail suite passes in
full with line 3148's moved path redirected (pre-existing, unchanged).

## Open

- JAR deploy (TomEE restart), then the live check on a new evaluation sent to
  approval - every existing PES is already Active.
- Paper-label mapping to be reviewed by the user.

## Update 2026-10-21 - after the first live look (PES-0000011)

- **Reasons:** three stored, one shown. `DomainObject.getInfo(context, selects)` returns only the first value of a multi-value ATTRIBUTE select; the reader now uses the `getInfo(context, selects, multiValueSelects)` overload (xerinfra, javap) - still one round trip. JPO proven on PES-0000011; JAR rebuilt, deploy pending. The page lists the reasons in the paper's order.
- **Removed from the form (user):** Test summary, Evaluated by, Checked by, In-Charge / HOD, Approved on, Evaluation expiry date. The people and their decisions are the approval chain below the form.
