# 2026-10-10-02 - The STAGE-VALIDATION REPORT form: the one that cost nothing

| | |
|---|---|
| Requirement | WGT-07 (the task page) |
| Status | **built, running on live data.** Read-only, as the other two forms are |
| Worklog | [2026-10-10-03](../../../../worklog/entries/2026/2026-10-10-03_stage-validation-form-sources.md) (the platform reads behind it, and one correction to the record) |

The third of the four forms, from `R&D-VAL-Rev.00`. It is the **smallest**, and
the only one so far that needed **no new DMC attribute, no new API call and no
server-side change** - one JSON file, and it was done.

That is worth recording precisely, because the other two were not like this and
the reason is not luck.

## What the printed form asks for

Four blocks, one page - the whole of it:

```
Project No.            Date
Validation Details:    (all technical details such as comparison with
                        published results done at all the identified stages)
Remarks:
Checked by:            In-Charge/HOD -
```

No members, no tables, no cost figures, no Rev. No.

## What the page draws

**Four visible rows of seven**, in `js/data/forms/stage-validation.json`.

| Row | Source | Call |
|---|---|---|
| Project Name | the PROJECT's `name` | the project call the page already makes |
| Project No. | the PROJECT's `EPMProjectNo` | same call |
| Validation Details | the TASK's `EPMValidationDetails` | the task call the page already makes |
| Remarks | the TASK's `EPMValidationRemarks` | same call |

Three rows are `hidden`: the printed form's **Date**, and the **two signatory
lines**, which are approvals and are drawn by the WGT-09 panel below the form.

**Project Name is not on the paper.** It was added at the user's request
(2026-10-10) beside the Project No. the form does ask for: a reader of one page
should not have to decode a project number.

## Why it cost nothing - and the rule behind it

`print type EPMPROJECT_STAGE_VALIDATION select attribute` returns
`EPMValidationDetails` and `EPMValidationRemarks` and **no other custom
attribute**. Both are TYPE attributes, so both arrive in `dataelements` of the
task call - verified against the live response, not inferred:

```
GET /resources/v1/modeler/tasks/299036CE0000A4346AC9CFC300000090
    ?$include=deliverables&$fields=basics,nlsType

  "nlsType": "STAGE-VALIDATION REPORT",
  "EPMValidationDetails": "some smaple validin \ngood valin g\n1. pokng \n2. pong",
  "EPMValidationRemarks": "some smaple validin \ngood valin g\n1. pokng",
```

The page therefore makes the **same two calls it makes for any form** - task,
then project - and no third. That is not an accident of this form being small;
it is the loading rule, which both extra calls are gated by:

- `ProjectContextService` runs only if the spec has a `source: "service"` row;
- `BaselineService` runs only if it has a visible `source: "baseline"` row.

This form has neither, so neither fires. The test pins exactly that, and pins
the contrast against the cost form, so an empty result cannot pass for a
working check.

**The lesson is about the FORM, not the code.** Personnel/cost needed four
calls because the paper asks for members, a baseline's dates and a baseline's
whole task list. This one asks for two paragraphs the task already holds. When
a form is expensive, the paper form is what made it expensive.

## The line breaks survive, measured from the raw bytes this time

Both attributes are `string` with `multiline TRUE`, and the live values are
genuinely multi-line. The response above carries the `\n` characters in the
**raw payload**, which is the only honest place to read whitespace: on
2026-10-10 a value read through a browser's JSON viewer produced a wrong
correction, because the viewer collapses breaks for display. The test now
asserts the breaks reach the resolved row.

## Three things the form deliberately does NOT show

Each is an earlier decision this file inherits rather than re-opens:

1. **No stage.** There is no field naming which stage the report validates
   (user, 2026-10-06): *the stage is the task's position in the WBS*, and an
   attribute would duplicate it and be free to disagree with it. The task name
   carries the stage - into the document title, the route name and the page
   header this form is drawn under - so the stage is already on screen.
2. **No Rev. No.** This form's document is **never revised**: each record
   validates a different stage, so a revision would assert that it supersedes
   the previous stage's validation, which is false (user, 2026-10-06). Every
   task gets its own `SVR-nnnnnnn` and they all stay current side by side. The
   other two forms revise and do print a Rev. No.
3. **No Date - yet.** Parked by the user: *"date we will see later"*. The paper
   asks for a Date and the platform has no attribute for it, so the question is
   which date it means. Four candidates, all already in the task response and
   none needing a new call: `actualFinishDate` (when the validation was done -
   empty until the task completes), `dueDate` (the planned finish, always
   populated), `originated` (when the task was raised), and the approval date,
   which the WGT-09 panel already shows per approver. The row is kept in the
   file, hidden, with the note that says so - a recorded decision rather than a
   silent omission, and bringing it back is deleting one line and naming a
   source.

## One form, two areas

`R&D-VAL-Rev.00` and `RDAREA-VAL-Rev.00` are **identical apart from the form
code** - same four blocks, same effective date 01.03.2021 - so one subtype and
one JSON file serve both R&D and AR. The to-be document's R06 note that the
R&D and AR forms differ is true for **Project Review** (G7), not for stage
validation. Recorded in the spec itself, because the two are easy to confuse
and the next form built is the one where it matters.

## Tests

`src/test/js/irstasks-detail.test.js`, now **19 suites** -
`irstasks-stage-validation` is new. What it pins, beyond the field mapping:

- **the form cannot name an attribute the type does not carry.** The two
  measured attribute names are hard-coded; a row naming anything else would
  resolve as `missing` on every task forever, and nothing else would notice.
- **both attributes are read** - neither is left on the floor.
- **the two calls, and only the two** (the gating above, with the cost form as
  the contrast).
- **the parked Date names its candidates**, or the row is just a hole.
- **empty is not missing**: a report in `Create` with no text is a normal state,
  not a platform failure.
- Details before Remarks, matching both the paper and the platform's own
  properties form.

## Files

```
js/data/forms/stage-validation.json   new - the whole feature
src/test/js/irstasks-detail.test.js   section 24
```

No view change, no CSS, no service change, no JAR, no JPO, no restart: every
display type this form uses (`text`, `longtext`, `pending`, `approval`) was
already built for the other two. Confirmed served by the running widget,
`HTTP 200`.
