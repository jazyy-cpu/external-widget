# 2026-10-19-01 - Proposal form labels now read exactly as R&D-PRJ-01-Rev.06

The user, on the PROJECT PROPOSAL / PROFILE task page: *"we are showing the
incomplete name of attributes, just make sure we show exact same name as
showing in form R&D-PRJ-01-Rev.06"*.

## What was wrong

The labels in `IRSTasks/js/data/forms/project-proposal.json` were generated on
2026-10-07 from `IRSProjects/js/config/ProjectForm.js`, which had **shortened**
the form's headings - the qualifiers in brackets were dropped and kept, at
best, as a `note` that the page does not print (`showNote` is off for every
proposal row).

## The fix - data only, no code, no CSS

Every label taken word for word from the form
(`documents/as-is-markdown/.../1.R&D/Forms/R&D-PRJ-01.md`, converted from the
source PDF):

| Ref | Was | Now |
|---|---|---|
| VI | Input - Technical Data, ... | Input **–** Technical Data, Information and References (the form's en dash) |
| VIII | Complexity of the design and development activity | ... **(applicable only for design and development of new product/service)** |
| IX | Identified Standards, ... legal requirements | ... **, etc. along with its version/year as applicable** |
| X | Feedback from previous similar design | ... **(applicable only for design and development of new product/service)** |
| XI | Potential consequences of failure | ... **(applicable only for design and development of new product/service)** |
| XII | Lessons learnt from failures | ... **(applicable only for design and development of new product/service)** |
| XIII | Risks and opportunities | ... **(Please specify if other than identified in Chap 8: III R&D)** |
| XIV | Details of stage-validation, verification and validation | ... **(if applicable)** |
| XVI *(hidden)* | Project Planning: task break-up, sequencing, review stages | Project Planning: Task break-up, sequencing, Review Stages and stage-validation, verification and validation stages (Refer to sample format: Page 2 of R&D-PRJ-02) |
| Footer *(hidden)* | Approval from Screening Committee obtained | Approval from Screening Committee **is** obtained |

Unchanged because they already matched: Project Name, Project No.,
Department, Project Category, Customer Name and Contact, Need of the Project,
Project Overview, Scope of Work, Methodology, Deliverables / Handing Over,
Project Manager, In-Charge / HOD, Divisional Head.

Two deliberate differences from the paper remain, both pre-existing
decisions: the trailing colons (`Customer Name and Contact:`) are not printed,
as on every other label; the Roman numerals stay off (user, 2026-10-09).
`Business Unit` is the widget's own addition beside Department and has no
counterpart on the form.

## Not changed

- `IRSProjects/js/config/ProjectForm.js` (the Project widget's Overview tab)
  still carries the short labels. It was not in the request.
- The PDF renderer (`IRSApprovalPdf_mxJPO` / `IRSApprovalRouteConfig.json`)
  has its own labels and was not touched.

## Tests

`irstasks-detail.test.js` line 821 checked the heading text
`'Risks and opportunities'` exactly; it now checks the form's full wording.
All 21 sections pass when run against the moved REST JAR path (see below).

**Pre-existing breakage, not fixed here:** `irstasks-detail.test.js:3148`
reads `external-widget/rest-jar/irs-project-rest/.../ProjectContextReader.java`,
which has moved to `PLM_PRD_CUSTOMIZATION/jar-development/irs-project-rest/`.
Run as-is, the file stops there and the sections after it do not run. Verified
with a temporary copy pointing at the new path (deleted afterwards).

`target/classes` already serves the edited JSON; a widget reload shows it.
