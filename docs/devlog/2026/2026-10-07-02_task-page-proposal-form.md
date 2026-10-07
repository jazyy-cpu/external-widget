# 2026-10-07-02 - The task page: a sidebar, a JSON-driven form, and what the captured log settled

| | |
|---|---|
| Date | 2026-10-07 |
| Requirement | [WGT-07](../../requirements/WGT-07-task-page/README.md) |
| Status | built for PROJECT PROPOSAL / PROFILE, read-only; **not yet opened in 3DDashboard** - checks B1-B7 open |
| Done by | agent (Claude), on the user's instructions |

## Goal

Open a task and show its data: a context sidebar, the form's content in the main
area, the fields decided by a JSON file per form, and PROJECT PROPOSAL / PROFILE
first - its data read from the **project**.

## What the user's captured log settled

The user pointed at `As-Is  Understanding/manual logs/ABCLogs`. It is a real
`/resources/v1/modeler/tasks` response from the live system - 65 tasks - and it
answered four questions that would otherwise have been guesses.

### 1. `$fields=basics` already returns a task's own custom attributes

| Task subtype | Custom attributes in the response |
|---|---|
| `EPMPROJECT_PROPOSAL` | **none** |
| `EPMPROJECT_PERSONNEL_COST` | `EPMChangeOfScope` |
| `EPMPROJECT_STAGE_VALIDATION` | `EPMValidationDetails`, `EPMValidationRemarks` |
| `EPMPROJECT_REVIEW` | all seven |

So no `$fields` list has to be maintained per form - and the proposal task
genuinely has **nothing of its own**, which is why its page calls the project.
The user's instruction and the payload agree.

### 2. `typeNLS` and `stateNLS` - the platform's own display names

Present on related objects:

| Type | `typeNLS` |
|---|---|
| `EPMPROJECT_PROPOSAL` | `PROJECT PROPOSAL / PROFILE` |
| `EPMPROJECT_PERSONNEL_COST` | `PROJECT PERSONNEL / COST ESTIMATION` |
| `EPMPROJECT_STAGE_VALIDATION` | `STAGE-VALIDATION REPORT` |
| `EPMPROJECT_REVIEW` | `PROJECT REVIEW` |
| `EPMAnalysisProject` | `Analysis Project` |
| `DMPPROPOSAL` | `DMPPROPOSAL` (no display name set in DMC) |

and `stateNLS` gives `Completed`, `In Work`, `Archived`.

**Yes, we should use it** - that was the user's question. It comes from DMC, so
renaming a type there changes the widget with no code change, and it is the
name the rest of the platform shows the same person. The page uses it where it
arrives and falls back to our own label where it does not.

The honest caveat: in this capture `typeNLS` is on the **related** objects, not
on the task items themselves. Whether the single-task call returns it is check
**B6**, and the shaped task carries `typeFromPlatform` so the live run answers
it instead of leaving it to belief.

### 3. `dataelements.project` is NOT the project

It reads `Hydrodynamics and Multiphysics`, `Research and Development`,
`Common Space` - the **collaborative space**, not the Program Central project.
The project is `relateddata.DPMProject`, which is what both services use. A
cheap mistake avoided: that field looks exactly like the one you want.

### 4. No baseline tasks, and the deliverable arrives with the task

Every `DPMProject` in the capture is an `Analysis Project` or a
`Department Training Plan` - **no Project Baseline**, which confirms the user's
observation from the grid with independent evidence.

And `relateddata.deliverables[0]` carries the generated form document with its
`name`, `revision`, `title` and `stateNLS` - `PPF-0000004 rev 01, In Work`. The
sidebar shows it without another call.

## The page

```
sidebar (col-lg-4)              main (col-lg-8)
task number                     the form's title + its revision
type badge                      one row per field of the JSON definition
status, project, project no.,
project type, planned start,
due, finished, % complete,
owner, assignees, route,
form document + revision
```

Bootstrap only - a row, two columns, a card and a definition list. No new CSS.

### The form definition is a JSON file

`js/data/forms/<id>.json`, named by the `fields` key of the subtype's entry in
`TaskFields`. Each field says `source` (`project` | `task` | `none`), `field`,
`display` and a `note`. **`TaskDetailView` knows about `source` and `display`
and about no attribute name at all**, so changing what the form shows is editing
the JSON - which is what was asked for.

The file was **generated** from `IRSProjects/js/config/ProjectForm.js` rather
than retyped. That catalogue's source of truth is WP02 doc 05 section 12, where
all 23 fields of `R&D-PRJ-01-Rev.06` were verified in MQL on 2026-09-23. Typing
23 field names by hand to produce a file whose whole job is to name them
correctly would have been the one avoidable error in this change.

### Four states per field, not three

| State | Shown as |
|---|---|
| has a value | the value - dates formatted, prose keeping its line breaks |
| **empty** | an em dash |
| **missing** from the payload | a red line naming the field, plus a count in the banner |
| `source: none` | the note - a relationship, its own objects, the WBS, the route |

*Empty* and *missing* are deliberately different. An empty box reads as "nobody
typed anything"; if the real cause is a spec naming an attribute that does not
exist, that must be visible. `display: pending` is the third case - **agreed but
not created on the platform yet** (2 of the 23) - so its absence is expected and
the note says so rather than crying wolf.

A `source: none` field **must** carry a note; the test enforces it. The
catalogue left the three signature rows bare because the project page draws them
as a tab, so the generator gives them one: *"An approval signature - collected
by the route task when the approver acts, not typed into the form."*

### Read-only, and saying so

`EDITABLE_STATES = ['Active']`, and `Active` is what the platform labels **In
Work**. The page prints which case it is in, so the rule is visible before
anything acts on it. Nothing here writes.

## Verification

`node src/test/js/irstasks-detail.test.js` - **all assertions passed**, and
`irstasks-landing.test.js` still passes.

The new suite tests against the **real capture** rather than a hand-made
fixture, because the shapes that cost the POC time (`dataelements` vs
`relateddata`, arrays of one) are all in it:

- the form definition: 23 fields, every `source` and `display` known, a `field`
  wherever a value is expected, a `note` wherever one is not, and **zero**
  task-sourced fields, which is the measured claim about this subtype;
- the resolver's four states, including that a `pending` field is not reported
  as missing and that `source: none` never is;
- `_toTask` on a real proposal task from the capture: the project arrives with
  it, `projectTypeLabel` is `Analysis Project` from `typeNLS`, the document is
  `PPF-...` with its revision, and nothing in the shaped object is `undefined`;
- `typeNLS` winning when present, our label when not;
- the two calls, with `$fields=basics` and the mandatory `$include=none`;
- a project that returns 403: the task page still opens and says why;
- the single-task retry without parameters, asserting the second call sends none.

The running app serves the new files (HTTP 200 for `TaskDetailView.js` and for
`forms/project-proposal.json`, and the shell carries both new script tags).

**Nothing has been seen in 3DDashboard.** B1-B7 are open; B6 is the one that
changes a visible string.

## Next

1. Open a proposal task in the dashboard and run B1-B7.
2. The other three forms: their JSON files, all three using `source: "task"`
   since those subtypes do carry their own attributes (O-P1).
3. The approval levels on the page (O-P3) - one route call per task, and the
   capture already shows which Inbox Task fields carry the evidence.
4. Then editing an In Work task, through the REST JAR (O-P2).

## Update 2026-10-07 - the grid was still showing OUR label, not the platform's

The user's screenshot: the Task Type column read *Project Proposal* and
*Personnel & Cost* - our own shortened names - not the DMC names.

Two causes, both now addressed.

### 1. The list never read `typeNLS` at all

`TaskService` always called `Fields.typeLabel(type)`. Only the task page read
`typeNLS`. Both services now read `typeNLS` and `stateNLS` and fall back to the
registry, and the grid's two badge columns take the display name **from the
row** rather than from the registry.

### 2. `$fields=basics` does not include it

In the captured response the task items carry no `typeNLS`, so even after (1)
the grid would still show the fallback. Both calls now ask for it:

    $fields=basics,typeNLS,stateNLS

Mixing a set name with explicit field names is the syntax `ProjectService`
already proves live (`$fields=none,title,state,...`). It is still an untested
name on this resource, and an untested name in `$fields` returns **400 for the
whole call** - so the list call **retries once** with plain `basics`. Either way
the page draws.

`counts.nlsNames` records how many listed rows got their name from the platform,
so the next live run settles by observation whether the field can be asked for
at all. That also answers check **B6** for the task page.

### 3. The fallback labels are now the platform's names

If the field cannot be asked for, the fallback is what the user sees - so the
four labels in `TaskFields` were changed from our shortened names to the DMC
names read out of the capture (`PROJECT PROPOSAL / PROFILE`,
`PROJECT PERSONNEL / COST ESTIMATION`, `STAGE-VALIDATION REPORT`,
`PROJECT REVIEW`). The user sees the right text either way; where the platform
sends the name, the platform still wins.

The Task Type column went from 150px to 230px, because those names are three
times longer than the ones it was sized for, and gained a tooltip.

### Verified

Both suites pass. New assertions: the `$fields` value, `typeNLS`/`stateNLS`
winning when present with `fromPlatform` true, `counts.nlsNames`, and the retry
- asserting that the second call sends plain `basics`.

Supporting evidence for asking at all: `typeNLS` appears **120 times** in the
shipped 3DSpace webapp JavaScript, so it is a field the platform's own clients
read, not a name invented here.
