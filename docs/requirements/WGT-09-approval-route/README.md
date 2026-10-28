# WGT-09 - The approval route: inbox tasks, signatures and decisions

| | |
|---|---|
| Work package | [WP06](../../../../documents/work-packages/06-task-approval-widget/README.md) |
| Status | **Built and running on live data, 2026-10-08.** Approve and Reject work end to end; one real approval submitted through the widget. Send Back for Review not built (WP06 **C1**) |
| Source | user instructions 2026-10-08 |
| Widget | `WidgetPacket/IRSTasks/` - `services/RouteService.js`, `SignatureService.js`, `InboxTaskService.js`, `ApprovalService.js`, `SessionService.js`; `views/TaskApprovalPanel.js`, `InboxColumns.js` |

## What was asked

Four instructions over one day, each building on the last:

1. *"task can have route ... route have inbox task ... we need to understand how
   we will get route from task, then we need to make api to get the ... in the
   context we need to check whether the task is connected to our custom task"*
2. *"can we have route coming horizontally and below the form ... with the date
   completed ... if there is any due date then we put the due date then approved
   comments ... also we need to show the signature"*
3. *"first we capture the task with inbox task and check whether the task is
   connected to our custom type and show"*
4. *"now we need to approve or reject the task, currently there is no option"*

## The data model, as measured

Everything below was measured on the live system on 2026-10-08, not taken from
the POC. Where the POC differs, it is called out.

### A task reaches its route for free

    task.relateddata.route[]  ->  route physical id

`route` is `relateddata` of the task, exactly like `deliverables` and
`references`. Adding `route` to the `$include` the task page already sends
returns the route's id and name at **no extra call**. Only the route's own tasks
cost a second request.

    GET resources/v1/modeler/dsrt/routes/{routeId}?$include=tasks

`$include=tasks` is **undocumented** - the 2024x `Routes Web Services` spec
declares no `$include` on this operation and no route-tasks operation at all, and
the API-labs validator refuses the parameter. It nonetheless works, is the only
way to read the chain in one call, and is what both POCs use. Measured across
**33 live routes** - every route reachable from the 75 tasks the list returns:

| `routeStatus` / `activityState` | count | the chain |
|---|---|---|
| `Finished` / `Approved` | 28 | every step an `Inbox Task`, `Complete` |
| `Not Started` / `Not Started` | 4 | every step a `Route Node` |
| `Started` / `Awaiting your Approval` | 1 | step 1 live, steps 2-3 still nodes |

### The two kinds of step ARE the state machine

`tasks[]` mixes two types, and the difference is the progress indicator:

- **`Inbox Task`** - activated. Has `current` (`Assigned` while it waits,
  `Complete` once acted on) and `approvalStatus`.
- **`Route Node`** - exists, not reached. Has **neither** field.

A step is a `Route Node` until the route reaches it and becomes an `Inbox Task`
at that moment. So "the inbox task appears when the task goes into approval" is
literally what the data does.

**A rejected route is `routeStatus: Stopped`, and its `state` is `Complete` -
the same as a finished route.** `state` alone cannot tell approval from
rejection; `routeStatus` is the field to read.

### "Is it connected to our custom task"

An inbox task carries the object being approved in `relateddata.contents`:

    contents[0].type      EPMPROJECT_PROPOSAL        <- the test
    contents[0].id        the custom task's id
    contents[0].name      T-85756263-0000143
    contents[0].stateNLS  "In Approval"
    contents[0].typeNLS   "PROJECT PROPOSAL / PROFILE"

So the check is `Fields.isListed(contents[0].type)` - **the same allow-list the
landing grid uses for tasks**, asked of the connected object instead. Nothing new
was invented and the two cannot drift apart.

Across the 29 inbox tasks the resource returns: **28 connected to our four
subtypes** (kept), 1 with no `contents` (dropped), 0 on anything else.

From the task side the connection is by construction: the panel starts from
**our** task's own `relateddata.route`, so every route it reads is connected to
that task by definition.

`scopes` held the same object as `contents` on every inbox task measured, so only
`contents` is read.

### Two corrections to the POC's documented behaviour

| POC says | Live data |
|---|---|
| the role is `assigneeTitle` | it came back `""`, `""` and the literal string `"title"`. The role is **`title`** - and one is `Division Head` where the POC's table says `Divisional Head`, so a hardcoded role-to-field map drops that step silently |
| keep only the route with `isLatestRevision === 'TRUE'` | **neither `revision` nor `isLatestRevision` exists** on any of the 33 routes, so that test keeps nothing |

The chain is therefore returned as an **ordered list** (by the platform's own
`taskOrder`) and the view renders whatever roles the route actually has.

### The signature joins on the login, at no cost

    GET resources/v1/irs/signatures/{loginId}   ->  image/svg+xml

Our own REST JAR (worklog
[2026-10-03-03](../../../../worklog/entries/2026/2026-10-03-03_signature-image-rest-endpoint.md)).
`{loginId}` is the platform login, and a route step already carries it as
`taskAssigneeUsername` - so **no person lookup is needed**:

| step | person | `taskAssigneeUsername` | |
|---|---|---|---|
| Project Manager | Sharad S Dhavalikar | `admin_platform` | 200, 2524 B |
| In-Charge / HOD | Sachin S Awasare | `PlmUser2` | 200, 2011 B |
| Division Head | Dr. Asokendu Samanta | `PlmUser1` | 200, 1988 B |

That run also closed the signed-in verification that worklog 2026-10-03-03 had
left open since 3 October.

Two things the original build did not record:

- **`Accept: image/svg+xml` is mandatory.** The service produces that type only,
  so a caller sending a JSON `Accept` gets **HTTP 406**. Every signature came
  back empty until this was sent. The probes that had "proved" the endpoint all
  set the header by hand, which is why none of them caught it.
- **It serves exactly three login ids** and 404s everyone else. A fourth
  approver has no signature, which the panel treats as normal and renders
  nothing. It is a pilot, not an approval control - see WP05 for what real
  signatures need first.

The SVG is fetched through `JazzySole/Request` and rendered from a blob, not as
`<img src="https://3dspace/...">`, for two independent reasons: the widget is
cross-origin to 3DSpace through the dashboard proxy, so a direct image request's
session cookie is not dependable; and an SVG inside `<img>` cannot run script,
whereas assigning fetched markup to `innerHTML` would make a remote document part
of this page's DOM.

### The decision

    PUT resources/v1/modeler/tasks/{inboxTaskId}
    { data: [ { id, dataelements: {
          routeTaskApprovalAction:   'Approve' | 'Reject',
          routeTaskApprovalComments: '...',
          state:                     'Complete'
    } } ] }

Checked against the 2024x Task request-body schema. All three fields are
writable and `routeTaskApprovalAction` is an enumeration of
**`Approve | Reject | Abstain | None`**. `state: 'Complete'` is what finishes the
step and lets the route advance; the decision fields alone would leave the route
sitting on an answered step.

The POC differs three ways, and the spec was followed instead:

| POC | Documented |
|---|---|
| `POST` | **`PUT`** |
| sends `updateAction: 'MODIFY'` | **not in the body schema at all** |
| header comment says `PUT ...?action=Approve` | matches neither its own code nor the spec - stale |

There is no approve or complete operation in the Routes API.

> **This diverges from WP06's "next step 2", which says the approval write path
> goes through the REST JAR.** That decision came from worklog 2026-10-06-01 -
> a widget cannot call a JPO, so *custom server logic* must live in a REST jar.
> Approval needs no custom server logic: OOTB already ships the operation, and
> CLAUDE.md's "check what DS already ships" rule makes using it the right call.
> The REST JAR decision still stands for anything OOTB cannot do.

## What was built

| Module | Does |
|---|---|
| `services/RouteService.js` | reads every route on a task in parallel; shapes `{status, activityState, started, finished, rejected, steps[], currentStep}` |
| `services/SignatureService.js` | SVG by login, cached per session, `null` when there is none |
| `services/InboxTaskService.js` | captures inbox tasks and keeps those approving our subtypes |
| `services/ApprovalService.js` | `check()` and `decide()` - the write |
| `services/SessionService.js` | who is signed in, from OOTB `pno/person?current=true` |
| `views/TaskApprovalPanel.js` | the horizontal chain, signatures, and the decision bar |
| `views/InboxColumns.js` | the Approvals grid |

### The chain, below the form

Horizontal, full width, in `taskOrder`, with arrows - the shape of the
platform's own route diagram, which the user supplied as the target. Each box:

    +- 1 ------------- Approved -+
    | Project Manager            |   the role (`title` on the step)
    | Sharad S Dhavalikar        |   the approver
    | .......................... |
    |      [ signature SVG ]     |   only once the step is decided
    | .......................... |
    | Completed  8 Oct 2026      |   or "Due ..." while it waits
    | "approve"                  |   the approval comment
    +----------------------------+

A pending step is the same frame greyed, with a hollow number and no signature,
date or comment - because it has none of them.

**Overflow scrolls sideways**, never wraps or shrinks: a wrapped chain leaves an
arrow pointing off the end of a line, and a shrunk chain squashes the signature
past about four steps.

The whole chain is shown, not only the live step, because the same response
already carries who approved and who is next - one list answers three questions
for one call.

### The Approvals view

A second view in the task widget, reached by a two-button switch in the toolbar
with the waiting count on it. An inbox task is not an IRS task - the landing grid
has filtered them out by type since 2026-10-07 - so they get their own list
rather than a second kind of row.

    #  Role  On task  Task Type  Task Status  Action  Due  Route

**`On task` is the link**, and it opens the custom task - the form, its documents
and its chain. No `Title` column (an inbox task's title *is* the role) and no
`Assigned To` (every row is the signed-in user's). Default shows only what is
waiting; `Show decided` reveals the rest.

### STM Documents in the Approvals list (2026-10-19)

The G11 route (Archiving New Service / Tool / Method) approves an
`IRSServiceToolMethod` **Document**, not a task, so its inbox tasks carry the
Document as `contents[0]`. Decided by the user: shown **only in the Approvals
list** (never in the task grid); no Category and no Date on the page.

- `TaskFields.DOCUMENT_TYPES` holds the subtype; `isApprovable()` (task subtypes
  or document subtypes) replaces `isListed()` as the Approvals filter, and the
  task grid still uses `isListed()`.
- A row's `connectedKind` is `document`, and `On task` opens route
  `document/:id`: the same task page, with `StmDocumentService` as its loader.
- The data comes from our JAR, `GET /resources/v1/irsproject/documents/{id}/stm`
  (2 server round trips), because the OOTB document resource returns none of the
  form's attributes, not the project, not the researchers and not the route.
  The form is `js/data/forms/stm-archive.json`, using the R&D-STM labels.
- The chain, the signatures and Approve / Reject are unchanged. The route id comes from
  the JAR (`from[Object Route]`), and the decision acts on the inbox task id.
- `typeNLS` arrives as the raw `IRSServiceToolMethod`, so the label is ours
  (`SERVICE / TOOL / METHOD ARCHIVE`).

Detail: devlog [2026-10-19-02](../../devlog/2026/2026-10-19-02_stm-approval-in-task-widget.md),
worklog `2026-10-19-14`.

### G17 periodic evaluations in the Approvals list (2026-10-21)

The G17 route (`IRSPeriodicEvaluationRoute`: Evaluator, Checker, Approver)
approves an `IRSPeriodicSoftwareEvaluation`, which is neither a task nor a Document.
The same pattern as STM, decided by the user: Approvals list only, paper
R&D-PES-Rev.01 wording mapped onto the custom 3DSpace form's data, **evidence
documents only** in the documents panel, no Informed Users.

- `TaskFields.DOCUMENT_TYPES.IRSPeriodicSoftwareEvaluation`, `kind: evaluation`;
  `kindOf()` now returns the entry's own `kind`. Route `evaluation/:id`, loader
  `EvaluationService`.
- The data comes from `GET /resources/v1/irsproject/evaluations/{id}`, 2 server
  round trips: one batched `getInfo` (attributes, subject, the three role
  Persons, routes) and one `getRelatedObjects` (evidence with its files).
  The form is `js/data/forms/pes-evaluation.json`.
- `TaskDocumentsPanel` takes an optional `task.documentGroups`; the evaluation
  passes one group, *Test results (evidence)*. Tasks are unchanged.
- The chain, Approve / Reject: unchanged.

Detail: devlog [2026-10-21-01](../../devlog/2026/2026-10-21-01_g17-evaluation-in-task-widget.md),
worklog `2026-10-21-12`.

### G12 technical publications in the Approvals list (2026-10-22)

The G12 route (Researcher, In-Charge / HOD, Division Head) approves an
`IRSTechnicalPublication` Document. The STM pattern unchanged (user: "it is
same like stm"): Approvals list only, paper R&D-PRJ-03-Rev.01 wording, the
Document itself as the one row of the documents panel.

- `TaskFields.DOCUMENT_TYPES.IRSTechnicalPublication`, `kind: publication`,
  badge `pub`. Route `publication/:id`, loader `PublicationDocumentService`;
  the shaped task keeps `kind: document`, so the banner reads "This document".
- The data comes from `GET /resources/v1/irsproject/publications/{id}` - a root
  of its own because `StmDocumentService` owns `/documents`. 2 server round
  trips: one batched `getInfo` (the six G12 attributes, project, routes, files)
  and one `getRelatedObjects` (authors). The form is
  `js/data/forms/technical-publication.json`; *Type of Publication* is reach
  and medium joined, e.g. "International; Conference".
- The chain, Approve / Reject: unchanged.

Detail: devlog [2026-10-22-01](../../devlog/2026/2026-10-22-01_g12-publication-in-task-widget.md),
worklog `2026-10-22-12`.

### The decision bar

Under the chain on the task page, because the approver's question is *"is this
form right"* and the form is on this page.

- **A comment is required to reject, optional to approve.** A rejection sends the
  form back to someone who must work out what to change; one with no reason is
  unactionable. Demanding one for approvals produces comments like "ok" - which
  the live data already shows (`ASDFASD`, `FASDF`).
- **Two clicks.** There is no undo, here or in the Routes API, so the first click
  arms and states the consequence, the second sends. The other button becomes
  Cancel.
- On success the chain is **re-read**, not patched: who it waits on, the new
  signature and the route's own status have all changed.
- **`Abstain` is not offered.** It is a valid platform value, but no route here
  has used anything but `Approve` and its effect on a route has not been
  observed. See also WP06 **C1** - *Send Back for Review*, the third action the
  RSD asks for, is a separate question and is not built either.

### Who may act - the bug worth remembering

The bar first decided this from **`modifyAccess`** on the inbox task, reasoning
that the platform should own the access rule. That was the wrong question:

| | |
|---|---|
| signed in | `admin_platform` |
| step 2 assigned to | `PlmUser2` |
| step 2 `modifyAccess` | **TRUE** |

So immediately after approving step 1 the chain reloaded correctly onto step 2 -
someone else's step - and offered it; the submission came back **HTTP 400**.
`modifyAccess` means *may you edit this object*, which an administrator may, not
*is this your approval to give*.

The bar now asks **two** questions in order: `SessionService.isMe(step.assigneeUsername)`
first, then `modifyAccess` as a second guard for a locked object. An identity
that cannot be read resolves to an empty login, so the controls stay **hidden** -
showing them on a failed identity check is the one outcome that must not happen.

### G9 Verification Report: the Division Head fills the form (built 2026-10-24)

For `EPMPROJECT_VERIFICATION` the Division Head (the route's only approver) fills
the task's 14 `EPM*` attributes, then approves. The fields are written with OOTB
`PUT modeler/tasks/{taskId}`, and only then is the decision `PUT` on the inbox
task sent. Worklog
[2026-10-24-07](../../../../worklog/entries/2026/2026-10-24-07_g9-dh-fills-form-at-approval-plan.md).

**Measured as the DH (`IPLT_User4`), 2026-10-24:** the DH can modify the task
**only when they are its assignee** (`Assigned Tasks`). Holding the route step
gives them the inbox task, not the task. Their `VPLMProjectLeader` context makes
no difference.

| | DH is assignee | DH is not assignee |
|---|---|---|
| task `modifyAccess` | `TRUE` | `FALSE` |
| task `PUT` | 200 | **400** `Error: No modify access on the specified object.` |
| inbox task decision | allowed | allowed |

A bad value is refused by the server with 400 `Error: Invalid attribute range specified.`

**User decision: no new back end. The error is captured and explained.** When
the DH is not an assignee, the widget says so, and the process repairs it:

1. **Detect it before the DH types anything.** The bar already knows the step
   is theirs (`isMe`). For a G9 task it also reads the task's `modifyAccess`
   (one GET, `modeler/tasks/{taskId}`). If that is `FALSE`:
   - no inputs are rendered;
   - **Approve is disabled**: approving with an empty report is not allowed;
   - **Reject stays available**, comment required;
   - the bar shows: *"You are not an assignee of this Verification Report task,
     so you cannot fill in the report. Reject this step with a comment asking
     the Project Manager to add you as an assignee and send the route again."*
2. **Catch it at save time as well.** The assignment can change between page
   load and save. A 400 whose message contains `No modify access` is mapped to
   the same text. The approval is **not** sent, because fields are written
   first. A 400 with `Invalid attribute range` shows as a value error on the
   form instead. Any other failure keeps the platform's own words.
3. **Repair, by the Project Manager:**
   - add the DH under the task's Assignees;
   - send the route again with IRS Approval;
   - the DH then sees the inputs.

Unverified, see **O-R12**: whether IRS Approval offers a new route on a G9 task
whose previous route was rejected (`Stopped`), and what state the task is left
in after the rejection.

**Built 2026-10-24** (devlog
[2026-10-24-01](../../devlog/2026/2026-10-24-01_g9-verification-report-approver-fills.md)).
`verification-report.json` gives each task field an `input` block, and
`ApproverFormService` holds the rules and the save. `ApproverFormFields` draws
the inputs, and `TaskApprovalPanel.render(task, spec)` puts them in the bar.
`modifyAccess` comes from the task call the page already makes, so detecting
the not-assignee case costs no call. The user says the route can be restarted
after a rejection, so the repair path itself needs no widget work.

### G7 Project Review: the reviewer fills the form at level 2 (built 2026-10-28)

User, 2026-10-28: the route order stays as it is. The Project Member approves
first. Then the reviewer fills the values and approves. The reviewer is the
Project Reviewer, or the In-Charge / HOD on an external project, so an external
reviewer never approves. The Project Manager adds the reviewer as an assignee.
Every field is required except Next Review Date. The work reuses the G9
mechanism unchanged and adds four things:

- **`inputAtStep`** in the form JSON. With `2`, `ApproverFormService.inputsFor`
  gives inputs only to the step whose route order is 2. Level 1 sees a plain
  bar. A form without the key keeps the G9 behaviour: every step fills.
- **Box items.** `inputsOf` also reads `input` on the items of a `rows` box (the
  four Review Observations) and labels each with its number as drawn.
- **Labelled options.** A choice value may be `{value, label}`. The boolean
  stores `TRUE` and shows Yes; the range stores `NotRequired` and shows
  Not Required. The stored value is what is written.
- **`text` and `date` inputs.** A date is shown as a calendar day and written
  as local noon in ISO form, the shape the task GET returns. A boolean
  defaults to FALSE, so Adhesion shows "No" on a fresh task, the one input
  that cannot start unanswered.

By department profile, `forProfile` now also filters a box's items. An AR
department loses Validation and the common-drive row on screen, and with them
their inputs and their required checks. Technical finding becomes item 3.
Devlog [2026-10-28-01](../../devlog/2026/2026-10-28-01_g7-reviewer-fills-and-rdarea.md).

## Cost

| | calls |
|---|---|
| finding the route | **0** - rides in the task call |
| the chain | 1 per route (32 of 33 tasks have one) |
| a signature | 1 per distinct login, cached for the session |
| "may I act" | 1, only when a route is sitting on a step |
| the Approvals list | 1 - the same resource the grid uses, plus `contents` |
| the decision | 1 |

## Verified live

- Chain rendered in all four route states: **Started**, **Not Started**,
  **Finished**; **Rejected** has no live example and is covered by unit test.
- Signatures render on decided steps and nowhere else.
- Approvals list: `2 of 29 inbox tasks shown (1 not connected to any object,
  26 already decided)`, both rows on `PROJECT PROPOSAL / PROFILE`.
- **A real approval**, submitted through the widget on `T-85756263-0000142`:

      1  Project Manager   Complete   Approve   10/8/2026 11:18:44 PM
         "Reviewed the proposal form - approved by Project Manager."
      2  In-Charge / HOD   Assigned   None
      3  Division Head     Route Node

  and afterwards the decision bar was **gone**, because step 2 is `PlmUser2`'s.

## Tests

Sections 14-18 of `src/test/js/irstasks-detail.test.js`: the four route states,
the role from `title` not `assigneeTitle`, a `Route Node` reporting no state and
no decision, sorting by `taskOrder`, `$include=tasks`, the signature's
`Accept` header and its cached miss, the connection check across four ours and
four not-ours types, the filter counts, **PUT** not POST with no `updateAction`,
a bad decision refused before anything is sent, and `isMe('PlmUser2') === false`
for `admin_platform` - the assertion that would have caught the 400.

> **Section 4 is skipped.** Its fixture - the captured task response at
> `As-Is  Understanding/manual logs/ABCLogs` - went missing from the workspace on
> 2026-10-08. It was read successfully earlier the same day and never written to;
> cause unknown. The read is guarded so one absent input no longer takes the
> whole file down, and it is **skipped, not replaced**: rebuilding the capture
> from live data to satisfy the assertions that depend on it would make them pass
> by construction instead of by evidence.

## Open

| # | Item |
|---|---|
| O-R1 | **Send Back for Review** is not built - WP06 **C1**, and with it whether collected signatures are voided |
| O-R2 | `Abstain` is unoffered and its effect on a route unobserved |
| O-R3 | **Ordering several cycles.** A rejected-and-resent task has more than one route and `isLatestRevision` does not exist to pick the current one. They render in the order the task lists them. The JBM POC sorted by `originated`, which comes from a different resource (`/modeler/routes?whereUsed=`) - an extra call |
| O-R4 | The signature endpoint is a **three-login dummy pilot**, now visible on screen. WP05's folder ACL, install/replace rule and approval-context read rule are prerequisites for real signatures |
| O-R5 | Rejection has never been exercised live - only Approve |
| O-R6 | A second login (`PlmUser2`) would confirm that an approver sees only their own rows and only their own decision bar. Evidence from one login says yes |
| O-R7 | The missing `ABCLogs` fixture |
| O-R8 | **STM Documents (2026-10-19):** live check pending - an STM Document Frozen with its G11 route started, opened from the Approvals list as each of the three approvers |
| O-R9 | **STM read access** of the In-Charge / HOD and the Division Head to the Document and its project is assumed, not verified (user, 2026-10-19: fix it if it fails) |
| O-R10 | **G17 evaluations (2026-10-21):** live check pending after the JAR deploy - a new evaluation sent to approval, opened from the Approvals list by Evaluator, Checker and Approver; approvers' read access to the evidence assumed as for STM. Paper-label mapping to be corrected by the user if off |
| O-R11 | **G12 publications (2026-10-22):** live check pending after the JAR deploy - DOC-0002 (route R-0000128) opened from the Approvals list by Researcher, In-Charge / HOD and Division Head; approvers' read access assumed as for STM |
| O-R12 | **G9 fill-at-approval (built 2026-10-24):** live run pending; the dashboard serves a cached `IRSTasks.html` until its cache is cleared. Then live test of the repair path on the `not assingee` task. The DH rejects; the PM adds the DH as assignee and sends the route again with IRS Approval. Confirm the command is offered after a `Stopped` route, and record the task's state after the rejection |

## Links

| | |
|---|---|
| Running notes | devlog [2026-10-08-01](../../devlog/2026/2026-10-08-01_proposal-form-sections-and-bootstrap-only.md), Updates 10-15 |
| The form itself | [WGT-07](../WGT-07-task-page/README.md) |
| The list it hangs off | [WGT-06](../WGT-06-task-landing/README.md) |
| Signature endpoint | worklog [2026-10-03-03](../../../../worklog/entries/2026/2026-10-03-03_signature-image-rest-endpoint.md) |
| POC route logic | `SpringProject_IRS_POC/poc_demo/.../Task_POC.js`, `Task_POC_RouteTaskForm.js`, and `Documents/API/Route/` |
