# 2026-10-07-01 - The task grid reads live data: one call, two filters, and the baseline-copy trap

| | |
|---|---|
| Date | 2026-10-07 |
| Requirement | [WGT-06](../../requirements/WGT-06-task-landing/README.md) |
| Status | built; **not yet opened in 3DDashboard** - checks A1-A9 open |
| Done by | agent (Claude), on the user's instructions |

## Goal

The user, 2026-10-07: *"first lets get all the task ... lets first show the task,
and with task we will show the project also and we will show only our custom
task that we have created."*

So: the grid stops being empty. Only the four IRS gateway subtypes, with the
project on each row.

## The call - one request, not one per row

    GET resources/v1/modeler/tasks
        ?$include=assignees,deliverables
        &$fields=basics
        &showProjectTasks=true
        &currentTaskFilter=all

This is the POC's call (`Task_POC.js:279`), which is the one spelling of this
resource known to work on this platform. **There is an "all tasks" resource** -
the open question O-T3 was framed as "every custom task the user may see, or the
tasks of one project chosen first", on the belief that the first needed a search.
It does not.

Better still, the response carries per task:

| In the payload | Gives us |
|---|---|
| `relateddata.DPMProject` | the project's id, **type**, name and title |
| `relateddata.route` | the route's id and name |
| `relateddata.assignees` | first and last name per assignee |

So the Project column costs **no second call**, which answers **O-T4** - written
as "showing the route task beside the task may be one extra call per row".

### Two parameters were checked rather than copied

- **`currentTaskFilter`** - the POC sent `assigned`, which lists only the current
  user's own tasks. DS's own Collaborative Tasks widget defaults to **`all`**:
  `C.getFilter() || C.setFilter("all")`, written into
  `enoviaServer.preferences.currentTaskFilter`
  (`3dspace\webapps\CollaborativeTasks\CollaborativeTasks.js`). The user asked
  for all tasks, so `all` it is - and it sits in one constant, because what the
  server means by it is exactly what the first live run has to tell us (new
  check **A8**).
- **`showProjectTasks`** - also a DS preference (boolean, default true). Sent
  explicitly, since a preference somewhere else could otherwise flip it.

`$fields=basics` rather than a hand-made list: an untested name in `$fields`
returns 400 for the **whole** call, and narrowing the payload is not worth that
until there is a measured reason. `TaskFields.LIST_FIELDS` was therefore renamed
`DETAIL_FIELDS` - it was never used by the list call and keeping the old name
would have implied it was.

## The finding that matters: a task exists five times

Before writing the filter I looked at what is actually in the database, and
every custom task name appeared **five times with five different ids**:

    T-0000103 / 231791096408193 -> to[Subtask].from = EPMAnalysisProject "ana"
    T-0000103 / 871791203537541 -> to[Subtask].from = Project Baseline "B-...0106"

**Copying a project copies its whole WBS.** Four of those five are inside
Project Baselines - which exist because the G4 baseline capture built in this
project creates them. Unfiltered, a project with four baselines shows every task
five times, and the duplicates look exactly like the real row.

The POC could not have found this: it had no baselines.

So the service drops any task whose own project is a copy container, from a
**deny** list (`Project Baseline`, `Project Snapshot`, `Experiment`) rather than
an allow list of real project types - a task on a project type nobody thought of
should still appear, because being shown something unexpected is recoverable and
silently hiding a real task is not.

## What the grid filters, and why it says so

| Filter | Why it is in the widget |
|---|---|
| only the four gateway subtypes | the resource has no type parameter, and it returns OOTB `Task`, `Gate`, `Milestone` and the routes' `Inbox Task` objects as well |
| no baseline / snapshot copies | above |
| completed tasks hidden unless asked | the toolbar switch, as before |

All three happen in the widget, so the service now **reports its counts** and
the page prints a line such as *"3 of 47 tasks shown (41 not an IRS subtype, 2
inside a baseline or snapshot, 1 completed)"*. A grid that shows three rows out
of forty-seven should say which filter did it; the first live run needs that
number more than it needs a tidy page.

## Two platform facts confirmed while here

- **Policy `Project Task` states are `Create | Assign | Active | Review |
  Complete`**, and every live custom task carries that policy - not the
  `Software Task` policy its type also names (whose states are
  `Identify | Assign | Working | Complete`). That closes **O-T5**; the POC's
  `Not Started` / `In Work` spellings are gone from the state lists, though they
  are kept in the badge map so an unexpected one still draws.
- **`Active` is the state the platform labels "In Work"**, which is what makes it
  the one editable state (below).

## Edit only when the task is In Work

The user's rule, recorded as a requirement rather than built yet: *"based on the
task state we can give edit option for some task not all task if task in
inwork"*.

`TaskFields.EDITABLE_STATES = ['Active']` plus `isEditable(state)`, and every row
carries `editable`. It is a **list, not a boolean test**, so if `Assign` turns
out to need editing too that is one entry and nothing else changes - and no view
ever names a state itself.

Stated in the module where it matters: this governs what the widget **offers**.
The platform's policy access decides what a save is allowed to do, and a widget
cannot be the thing that enforces it.

## Files

```
js/config/TaskFields.js     the four subtypes, the copy-container deny list,
                            the real states, EDITABLE_STATES, DETAIL_FIELDS
js/services/TaskService.js  the live call, the row mapping, the two filters,
                            the counts and the note
js/views/TaskColumns.js     Project cell hovers its title (name and title do
                            not both fit)
js/views/TaskListView.js    comments only - the note handling already existed
css/IRSTasks.css            one muted left-edge colour per subtype
src/test/js/irstasks-landing.test.js
```

## Verification

`node src/test/js/irstasks-landing.test.js` - **all assertions passed**. The
service is now tested against a response shaped like the real one, with a fake
`JazzySole/Request`:

- five tasks in, **one row out** - the completed one, the baseline copy, the
  OOTB `Task` and the `Inbox Task` all drop, and the counts say which;
- `includeClosed` brings the completed one back, still `editable: false`;
- the call's parameters are asserted, including `currentTaskFilter=all`, so the
  decision cannot drift silently;
- the project's name, title and type arrive from `relateddata`, which is the
  one-call claim made executable;
- every column's `field` exists on the row shape, and no value is `undefined`.

The running app was confirmed to **serve the new files** (`curl` over HTTPS on
localhost: `TaskFields.js` carries `EPMPROJECT_STAGE_VALIDATION`,
`IRSTasks.css` carries `irs-type-validation`). Static resources are served from
`target/classes`, so the five changed files were copied there - the next Maven
build regenerates them from `src` anyway.

**Nothing has been seen in 3DDashboard.** A1-A9 are all open, and A8 is the one
that could change the call.

## Next

1. Open it in the dashboard and run A1-A9. **A8 first**: does `currentTaskFilter=all`
   return every task the user can read, or only their own in every flavour? If
   the latter, a PM will not see tasks assigned to others, and the fallback is a
   fan-out over `/projects` then `/projects/{id}/tasks`.
2. The **task view**: one JSON file per form driving which attributes are shown
   (`js/data/forms/<fields>.json`, the `fields` key of each descriptor), read-only
   unless the task is In Work. That is what the user asked for next, and it is
   where the route's approval levels belong - `GET .../dsrt/routes/{id}?$include=tasks`,
   one call for one task rather than one per grid row.
3. **Department** is still blank (O-T7): it is not in this payload, and it comes
   from the project's `IRSDepartmentProject` link.

## Links

- Platform findings in `worklog/`:
  [2026-10-07-02](../../../../worklog/entries/2026/2026-10-07-02_task-copies-and-task-rest-parameters.md)
- The POC call this was taken from: `SpringProject_IRS_POC/poc_demo/src/main/resources/static/WidgetPacket/Task_POC/Task_POC.js:279`
- Work package: [WP06](../../../../documents/work-packages/06-task-approval-widget/README.md)

## Update 2026-10-07 - the response has no baseline tasks: the filter is insurance, not a fix

The user checked the live response and **no baseline task is in it**.

Measured in the database for contrast: **61 of 93 custom tasks are baseline
copies**, spread over nine baselines, and **nine of those copies are open**
(8 `Create`, 1 `Active`) - so it is not the completed-state filter that hides
them. Something inside `/modeler/tasks` does.

The mechanism is **not established**. What was ruled out: project membership and
access, since both a project and its baseline carry `Member` rows and their own
`Project Access List`. The plausible one left is that the resource resolves
tasks through the projects a user can open as projects, and a baseline is not
one of those - unverified, so it is not written down as fact anywhere.

So the duplication claim above is true of the **data**, not of the **response**.
The filter stays for three reasons, none of which is "it fixed a bug we saw":

1. one array lookup per row;
2. the failure mode is silent duplicate rows that look identical to the real
   ones, in a list people approve things from;
3. the protection we are relying on is unverified and may not survive the
   fan-out fallback over `/projects/{id}/tasks` that check **A8** could force.

And it reports on itself: `counts.copies` is in the note above the grid. Zero
forever means the filter is a free no-op; non-zero once means it earned its
place.

### Check this at the same time as A8

Only **one** of the 32 custom tasks on real projects is open (`Assign`, OSCP
project). The default grid hides completed tasks, so it should show **one row**,
and about 32 with "show completed" ticked. A very different number says
something about the call's scope, not about the filters.
