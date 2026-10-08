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

## Links

| | |
|---|---|
| Running notes | devlog [2026-10-08-01](../../devlog/2026/2026-10-08-01_proposal-form-sections-and-bootstrap-only.md), Updates 10-15 |
| The form itself | [WGT-07](../WGT-07-task-page/README.md) |
| The list it hangs off | [WGT-06](../WGT-06-task-landing/README.md) |
| Signature endpoint | worklog [2026-10-03-03](../../../../worklog/entries/2026/2026-10-03-03_signature-image-rest-endpoint.md) |
| POC route logic | `SpringProject_IRS_POC/poc_demo/.../Task_POC.js`, `Task_POC_RouteTaskForm.js`, and `Documents/API/Route/` |
