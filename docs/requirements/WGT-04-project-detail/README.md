# WGT-04 - Project detail page

| | |
|---|---|
| Status | **skeleton built 2026-09-24**; not yet opened in the dashboard |
| Work package | [WP03](../../../../documents/work-packages/03-project-widget/README.md) |
| Opened from | [WGT-01](../WGT-01-project-landing/README.md) - a click on the project title |
| Navigation | [WGT-02](../WGT-02-navigation-state/README.md) - `JazzySole/Router`, now wired in |
| Source of the fields | WP02 doc 05 §12, the R&D-PRJ-01 coverage table (verified in MQL 2026-09-23) |
| Form | `R&D-PRJ-01-Rev.06`, sections I-XVI + header and signature block |
| Design and code | [design.md](design.md) |

## What is asked

> "there will be one page where we will show the project information, this will
> be the first page, and the order will be in which the field is given in the
> forms. The project no also will come there and on the click of the button we
> will give the project no to the project, and once number will be taken then
> this field is no more editable or button will not show."
> (user, 2026-09-24)

Plus, as topics of their own: **risks and opportunities**, **lessons learnt from
failures**, the **business unit / department** connection and the **customer**
connection. Layout: **tabs and sections**, with the first page showing the
project's high-level information (user, 2026-09-24).

## 1. The page

```
┌──────────────────────────────────────────────────────────────────────┐
│ ‹ Projects   AP project   [Analysis] [Create]                        │
│ Project No.          Department      Customer     Start      Planned │
│ [Assign project no.] Not linked yet  Not linked   Sep 23     Sep 23  │
├──────────────────────────────────────────────────────────────────────┤
│ Overview │ Organisation │ Risks & opportunities │ Lessons learnt │ … │
├──────────────────────────────────────────────────────────────────────┤
│ III  Need of the Project                                             │
│      …                                                               │
└──────────────────────────────────────────────────────────────────────┘
```

The header is the printed form's header block. The tabs are the topics.

## 2. The tabs

| Tab | Holds | State |
|---|---|---|
| **Overview** | the project information: sections I-XVI in the form's own order, then the signature block | **built** - shows the 12 created attributes |
| **Organisation** | Department + its parent Business Unit (the stream), and the Customer | **skeleton** - neither relationship exists on the platform yet |
| **Risks & opportunities** | form XIII: the OOTB `Risk` and `Opportunity` objects with their RPN scores | **skeleton** - the objects exist and are linked; the read call is not known |
| **Lessons learnt** | form XII | **skeleton** - `EPMLessonsLearnt` is not created yet |
| Planning | form XVI: the OOTB work breakdown (Subtask, Task, Phase, Gate, Milestone) | planned, tab disabled |
| Team & cost | form R&D-PRJ-02: project personnel and cost estimation | planned, tab disabled |
| Documents | deliverables and attachments | planned, tab disabled |
| Approvals | PM, In-Charge / HOD and Divisional Head - Route steps, not fields | planned, tab disabled |

A section that lives on another tab still appears in its numbered place on
Overview with a link across, so someone reading along with the paper form never
finds a hole where XIII should be.

## 3. What we capture on a project

Taken from WP02 doc 05 §12 and encoded once, in
`js/config/ProjectForm.js`. Adding a field to the form is a row in that file.

| Form | Field | Where it lives | Status |
|---|---|---|---|
| Header | Project Name | basic `title` | OOTB |
| Header | **Project No.** | `EPMProjectNo` | attribute exists; **no numbering scheme (R20)** |
| Header | Department | relationship `IRSDepartmentProject` | **not built** |
| I | Project Category | the subtype itself (`EPMAnalysisProject` / `EPMResearchProject`) | OOTB |
| II | Customer name, city, country, contact, e-mail | relationship `IRSProjectCustomer` → `Company` | **not built** (the Company fields all exist) |
| III | Need of the Project | `EPMNeedOfTheProject` | ✔ |
| IV | Project Overview | `EPMProjectOverview` | ✔ |
| V | Scope of Work | `EPMScopeofWork` | ✔ |
| VI | Input - technical data, information, references | `EPMInput` | ✔ |
| VII | Methodology | `EPMMethodology` | ✔ |
| VIII | Complexity of the design and development activity | `EPMComplexity` | ✔ (D&D only) |
| IX | Identified standards, codes, acts, rules, regulations | `EPMIdentifiedStandards` | ✔ |
| X | Feedback from previous similar design | `EPMFeedback` | ✔ (D&D only) |
| XI | Potential consequences of failure | `EPMPotentialConsequencesOfFailure` | ✔ (D&D only) |
| XII | **Lessons learnt from failures** | `EPMLessonsLearnt` | **not created** (D&D only) |
| XIII | **Risks and opportunities** | OOTB `Risk` / `Opportunity` objects via the `Risk` relationship | objects exist and are linked |
| XIV | Stage-validation, verification and validation | `EPMStageValidation` | ✔ |
| XV | Deliverables / Handing Over | `EPMDeliverables` | ✔ |
| XVI | Project planning | the OOTB work breakdown | OOTB |
| Footer | Screening Committee approval obtained | `EPMScreeningApprovalObtained` (a range) | **not created** |
| Footer | PM / HOD / Divisional Head approval | Route steps | **not built** |

Agreed for the **to-be** form (RSD Figure-16) and not built: `EPMResources`,
`EPMSoftwareUsed`, `EPMRequiredCompetenceSkill`, `EPMSubmissionOfProject`,
`EPMDHComment`. They are in the catalogue and shown on Overview behind a
"not built yet" disclosure, so they are not quietly forgotten.

So of the form's own fields **12 attributes exist, 6 do not**, plus 2
relationships and the route.

## 4. The Project No. button

Behaviour, agreed:

| Project No. | What the header shows |
|---|---|
| empty | the button **Assign project number** |
| set | the number as plain text, **no button**, not editable |

Built as **user interface only** (user: "as of now lets build the ui part,
later we build the schema and mechanism for it"). Pressing it explains that the
number cannot be generated yet and writes nothing. Two things are missing and
both are outside the widget:

1. the **numbering scheme (R20)** has to come from IRS - `EPMProjectNo` is a
   plain writable string today, with no generator behind it;
2. the **write call** on the project service has never been tested from here.

Deliberately not done: inventing a format such as `PRJ-2026-0001`. A provisional
number written onto a real project is expensive to take back.

## 5. Decisions log

| Date | Decision |
|---|---|
| 2026-09-24 | Tabs with sections; the first tab is the project information in the form's order |
| 2026-09-24 | Risks and opportunities are OOTB objects, **not** a text attribute (confirms WP02 doc 05 §13.2) |
| 2026-09-24 | Lessons learnt gets a tab of its own rather than a paragraph on Overview |
| 2026-09-24 | Department, Business Unit and Customer share one "Organisation" tab |
| 2026-09-24 | The Project No. button is built, the number generation is not |
| 2026-09-24 | Every field is declared once in `config/ProjectForm.js`, including the ones that do not exist yet, so the page can say *why* a box is empty |

## 6. Open questions

| # | Question |
|---|---|
| B1 | **Lessons learnt: one text box, or a list of dated entries?** An attribute cannot become a list later without migrating data, so this decides the schema. The tab states both options |
| B2 | The read call that returns a project's linked `Risk` / `Opportunity` objects - `$include` documents members and tasks, not risks |
| B3 | The project **write** call (needed by the Project No. button, and by any editing at all) - never tested from the widget |
| B4 | `EPMLessonsLearnt` and `EPMScreeningApprovalObtained` still have to be created on the platform |
| B5 | When and how a project is linked to its Department and Customer - carried over from WP02 doc 05 §9.5 (Q18-Q20), still open |
| B6 | Is this page read-only for now, or does editing the twelve attributes come next? Nothing here writes anything today |
