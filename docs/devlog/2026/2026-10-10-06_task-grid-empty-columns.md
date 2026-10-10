# 2026-10-10-06 - Four columns of dashes: three removed, one that was a bug

The user pointed at four columns of the task grid - **Department**, **Route
Task**, **Action Required**, **Est. Finish** - every cell of every row a dash,
and asked what they were for and whether they could go.

Three go. The fourth was a typo that had been hiding in plain sight since the
grid was built.

## What was measured

One read of the live list, the same call the grid makes
(`GET resources/v1/modeler/tasks?$include=assignees&$fields=basics,nlsType`),
**87 tasks, 40 of them IRS subtypes**:

| Field the row mapped | Non-empty | On the 40 IRS rows |
|---|---|---|
| `taskEstimatedFinishDate` | **0 of 87** | 0 - the field does not exist |
| `dueDate` | 50 of 87 | **39 of 40** |
| `routeTaskAction` | 35 of 87 | **0** |
| `routeTaskRouteId` | 0 of 87 | 0 |
| department, in any spelling | - | not in the payload at all |

## Est. Finish was a bug, not an empty column

`finish` was mapped from **`taskEstimatedFinishDate`**, which nothing returns.
The task's planned finish is **`dueDate`** - on a task with
`estimatedStartDate` 2027-03-02 and a 10-day duration it reads 2027-03-15,
which is exactly what the column claims to show.

**The grid's default sort is that field**, so the list has been sorting on an
empty string since the column was added. Nobody noticed, because a sort that
does nothing looks like a list in some order. That is the real cost of an empty
column: it is not only useless, it hides a broken thing behind a plausible one.

`start` had the same shape and now reads `estimatedStartDate`, with the old
name kept as a fallback.

## Why the other three cannot be filled from this call

- **Action Required** is the interesting one, because the field *is* in the
  payload - and non-empty on 35 rows, every one of them an inbox task rather
  than a project task. This grid filters those out (*"48 not an IRS subtype"*
  in its own banner), and they have their own tab, where the same column
  already exists as **Action** and is filled from `InboxTaskService`. So the
  column was showing, on the tasks tab, a property of objects the tasks tab
  does not list.
- **Route Task** was never assigned a value at all - the row carried
  `routeTask: ''` with a comment saying the view would fill it later. The route
  task is a separate object; reading it is one call per row, which is the
  reason the approval chain is not in this grid in the first place.
- **Department** is not in the task payload in any spelling. It comes from the
  project's `IRSDepartmentProject` link, so filling it means asking our REST
  JAR once per **project** in the list. That is a feature, not a column
  definition, and **O-T7 stays open** - the reason it was asked for on
  2026-10-03 has not gone away: a form hides attributes depending on the
  project's department, so a grid that says which one a task belongs to is
  worth having. It is worth having *filled*.

## The rule this leaves

**An always-empty column is worse than a missing one**, because it reads as
data that failed to load rather than as data nobody asked for. The three were
added on 2026-10-03 against a future that needed a different call, and a
comment promising a later fill kept them alive for a week.

Each is a few lines to restore once something can answer it, and the removal
says in the file what that something is.

The task grid now shows: `#`, Title, Task Type, Status, Assigned To, Project,
Route, Est. Finish.
