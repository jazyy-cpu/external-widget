# 2026-10-10-05 - PROJECT REVIEW: the fourth form, and the Review No. taken from the right document

The last of the four gateway forms. `js/data/forms/project-review.json`, from
`R&D-REV-Rev.02`: **10 visible rows of 15**, running on live data, read-only.

With this one every subtype `TaskFields` declares has a form file. The 404
banner that section 19 of the test suite was written for has nothing left to
catch.

## What the page draws

| Row | Source | Note |
|---|---|---|
| Project Name, Project No. | the PROJECT | the project call the page already makes |
| **Review No.** | the task's own review DOCUMENT | its revision - see below, this is the interesting one |
| **Reviewer(s)** | the task's `assignees` | free in the task call; the reviewer pool by the user's own rule |
| Adhesion to the Schedule | task `EPMAdhesionToSchedule` | a `boolean`, so Yes / No |
| Status of completion | task `EPMStatusOfCompletion` | `multiline FALSE`, so one line |
| Validation *(R&D form only)* | task `EPMValidation` | a range of four |
| Technical finding / Observations | task `EPMTechnicalFindingObservations` | prose |
| Follow-up Action Recommended | task `EPMFollow_upActionRecommended` | prose |
| Data copied to the project common drive *(R&D form only)* | task `EPMDataDrive` | Yes / No / **NA** |

Hidden: both dates, the two signatory lines, and the report number. Each of the
five is a recorded decision and the file says which - see *What it deliberately
does not show*.

**Seven attributes, one call.** `print type EPMPROJECT_REVIEW select attribute`
returns exactly seven custom attributes, all of them TYPE attributes, so all
seven arrive in `dataelements` of the task call the page already makes. This
form reads more from the platform than any of the other three and still adds no
call: `ProjectContextService` is skipped because the spec has no `service` row,
`BaselineService` because it has no visible `baseline` row. Both gates are
asserted in the test, with the cost form as the contrast so an empty result
cannot pass for a working check.

The live task `T-85756263-0000155` carried **all seven populated** - the first
time that has happened on any subtype here, so the rows were resolved against
real values rather than against empty strings.

## The Review No.: three candidate sources, two of them wrong

The Review No. is the review document's **revision**, decided on 2026-10-07:
Project Review *revises* one document family per project where stage validation
creates a new document per task, so the revision chain **is** the review
sequence and no counter of our own is needed.

The hard part is *which document*. A review task carries more than one: the
reviewer attaches the signed form and the reviewed reports the printed page asks
for, and **an attachment uses the same `Task Deliverable` relationship as our
generated document**. So:

1. **The first deliverable** - what the cost form did until today. Wrong
   whenever anything was connected before the route ran, and wrong silently: a
   plausible number in the right place.
2. **The id the platform already stores.** The project keeps the review
   document's id in `IRSProjectReviewDocumentId` (interface
   `IRSProjectDocuments`), which is what the approval JPO uses to find the
   family to revise, and which holds real values on three live projects. It
   cannot be read from the widget, for two independent reasons, both measured
   on 2026-10-10:
   - **it never arrives** - the project response carries TYPE attributes only.
     Every `EPM*` attribute of the project is in `dataelements`, including the
     empty ones, and the `IRS*` interface attribute is absent. The same was
     already found for `IRSTaskDocumentId` on the task side, so this is a
     property of the OOTB resources, not of one object;
   - **the id formats differ** - the stored value is the MQL object id
     (`39261.35329.24628.655`) and REST answers physical ids
     (`299036CE0000A4346ACA4802000009CA`). The same document, two spellings,
     and converting between them is another call.
3. **The deliverable's own type name** - what is used. Our generated document is
   `DMPPROJECT_REVIEW`; an upload is a plain `Document`. The type is already in
   the response, so this costs nothing, and it is **more** correct than the
   stored id: that id points at one revision, while each review task is
   connected to its own, so it would answer only for the latest review.

`toDocument` gained `typeName` beside `type` for this. `type` prefers `typeNLS`
because that is what a reader should see (*"PROJECT REVIEW"*), which makes it
useless for deciding which document a row means; the raw name is the only thing
that separates ours from an upload.

**The cost form was corrected the same way** - `Rev. No.` now names
`documentType: "DMPPERSONNEL_COST"` instead of reading the first deliverable.
That closes open item **O-P11**, and the test now pins the failing case
directly: an upload connected *first*, with the form document second, must still
yield the form document's revision.

### Off by one, still open

New document families start at revision `01` (`firstRevision` in the route
config), so revision `01` is Review No. 1 and the row prints the revision as it
is. Families created **before** 2026-10-07 start at `0` under the
`Document Release` policy and therefore read one low. The page does not add one:
that would be wrong for every new document, and arithmetic the page cannot
verify is worse than a number that is right for everything created from here on.
Open item.

## The two areas genuinely differ - and this is the form where that is true

`R&D-REV-Rev.02` carries two numbered items that `RDAREA-REV-Rev.00` does not:

- *Validation: Stage / Final / Not Required / Not Applicable* - `EPMValidation`
- *Data related to relevant task copied in the project common drive: Yes / No /
  NA* - `EPMDataDrive`

They are additive, so AR is simply an older revision of the same form, and one
subtype carries both attributes. **This is the to-be document's R06 note, and
this form is where it was actually true** - it was recorded on the stage
validation spec as *not* applying there, where the two papers were identical.

The project subtype would have answered the area for free
(`EPMAnalysisProject` = AR, `EPMRandD` / `EPMResearchProject` = R&D, verified in
MQL), so hiding the two rows on an Analysis project was buildable. The user
chose on 2026-10-10 to **draw both rows on both areas, labelled
*(R&D form only)*** instead: a visible labelled row tells the reader what the
difference is, where a hidden row tells them nothing.

The label is where the note goes because short rows have nowhere else to put it
- `showNote` renders on table blocks only, and adding note rendering to the
label-and-value grid would have been a layout change for one sentence.

A knock-on: **the printed section numbers stay off the screen**, and on this
form that is not just consistency with the other three. The same item is
numbered 4 on the R&D form and 3 on the AR one, because AR has no Validation
row, so a printed number would be wrong for one of the two readers. The `ref`
keys keep the R&D numbering, because that is how the paper form is discussed.

## What it deliberately does not show

1. **Both dates - parked** (user, 2026-10-10: *"park both for now"*), for
   different reasons the file keeps straight:
   - *Review Date*, at the top of the paper, has **no attribute anywhere** -
     the same gap as the stage validation form's Date. Its four candidate
     sources are named in the row, and on this form the reviewer's **approval
     date** is the strongest of them, because the page says *"(To be filled by
     Reviewer only)"*.
   - *Next Review Date* **has** one: `EPMNextReviewDate`, a `timestamp`, which
     held `2026-10-21T06:30:00.000Z` on the live task. So this is the only
     parked row on any of the four forms whose attribute exists *and holds
     data* - hidden by decision, not by absence, and wired to the `date` format
     so unhiding it is deleting one line.
2. **The report number** (`PRV-nnnnnnn`) - the document's name, as against its
   revision, which the Review No. prints. Not on the paper and not drawn: a
   review is identified by Project No. plus Review No., which the page shows,
   and a second identifier beside them invites the question of which to quote.
   Kept as a row because the same question is open on stage validation (O-P15),
   where there is no revision and the document name is the only identifier. The
   two should be decided together.
3. **Grade A / the skill-based reviewer lookup** - not implemented, by decision
   of 2026-10-07 (*"forget about grade"*). The reviewer comes from the task's
   assignees, which is exactly what the Reviewer(s) row prints.

## What this cost

Three files and one new format:

- the form spec, which is the feature;
- `typeName` on `toDocument`, so a row can name which document it means;
- the `derived` branch of `resolve()`: `documentType` picks that document, and
  an Array value joins with `", "` so the Reviewer(s) row prints a list rather
  than `a,b,c`;
- `VALUE_FORMAT.choice`, which spaces a range token (`NotRequired` ->
  `Not Required`). The fourth member of a family that all exists for one reason:
  **the platform's spelling is not the printed form's**. A range value is an
  identifier, a boolean is the string `"TRUE"`, a DMC real is `150000.0`, and a
  man-day count is `16.0`.

No new DMC attribute, no new API call, no CSS, no service change, no JAR, no
JPO, no restart. `VALUE_FORMAT` is now exported as `_format` for the tests - the
value a customer signs is worth a seam of its own, separate from `resolve()`,
which decides only *where* a value comes from.

Test suite: **20 suites**, section 25 added (`irstasks-project-review`), all
passing; section 4 stays skipped for the missing `ABCLogs` fixture, as before.

Platform reads, the corrected cost form, and the full
`IRSProjectReviewDocumentId` finding: worklog
[2026-10-10-08](../../../../worklog/entries/2026/2026-10-10-08_project-review-form-sources.md).

## Update - 2026-10-10: *Review Observations* is one box, as the paper draws it

The user sent the printed form's own *Review Observations* panel and asked for
it: **one heading, with the values in a table under it.** So the four numbered
items are no longer four rows of the form - they are one section:

```
Review Observations
+-------------------------------------------+---------------------------+
| 1) Adhesion to the Schedule               | Yes                       |
| 2) Status of completion to the relevant.. | status is ok for the ..   |
| 3) Validation (R&D form only)             | Final                     |
| 4) Technical finding / Observations       | (prose, line breaks kept) |
+-------------------------------------------+---------------------------+
```

This supersedes the row table at the top of this entry: **7 visible rows of
12**, one of which is this box carrying four more. Nothing about where the
values come from changed - the same four task attributes, the same formats, the
same single call.

**Why the box is better than four rows**, beyond matching the paper: as
separate short fields they paired off two to a line with whatever happened to
precede them, so *Adhesion to the Schedule* could share a line with
*Reviewer(s)*. Three of the four carried `newLine` to fight that. They are one
thought - the reviewer's observations - and the printed form says so by drawing
a box around them.

The items are **data** in the spec's `rows`, each with its own `format`,
because the four are four different shapes: a boolean, a one-line string, a
range value and prose. A fifth observation stays a JSON edit.

### The numbers are printed, which reverses the rule above

The section *"The two areas genuinely differ"* above argues that printed
numbers would be wrong for an AR reader, and that still holds for section
numbers everywhere else on these forms. **Inside this box the number is the
content**: a reviewer reads item 3 off `R&D-REV-Rev.02`, which the page header
names, and looks for item 3 on screen. An AR reader sees four items where their
paper has three, and the third carries *(R&D form only)* in its label, which is
what tells them why. The reversal is recorded in the spec's `_numbering` so it
cannot be read later as an oversight.

### One latent bug found on the way

A block row that reads its own data carries no `field`, so `resolve()` was
returning it as **`missing`** - the cost table, the man-day table and the
monthly plan have all been resolving that way since they were built. Nothing
rendered wrong, because `blockBody` branches on the display type before it
looks at `missing`, but it is a lie about a section that draws perfectly and
anything that counted missing rows would have believed it. `resolve()` now
returns such a row as empty, which is what it is.

## Update - 2026-10-10: Next Review Date is drawn

The user: *"next review date is one attribute that is on the task, lets add it
to the form also"*. The row was already wired - `source: task`, field
`EPMNextReviewDate`, `display: date` - so this was deleting its `hidden` line,
which is exactly what parking it that way was for.

**8 visible rows of 12**, and all seven of the subtype's attributes are now on
screen.

It prints `21 Oct 2026` from `2026-10-21T06:30:00.000Z`: no clock, because the
reviewer recorded a day and not a moment. Empty until somebody schedules the
next review, which is empty and not missing.

**The two dates were never the same question**, and parking them together for
half a day obscured that. *Next Review Date* has an attribute on the subtype
and live data in it. The top *Review Date* has no attribute anywhere - the same
gap as the stage validation form's Date - so it stays hidden with its four
candidate sources named, and the reviewer's approval date is the strongest of
them, because the printed page says *"(To be filled by Reviewer only)"*. The
spec's `_whyBothDatesAreParked` is replaced by `_theTwoDates`, which says that.

Open item **O-P17** is closed by this.
