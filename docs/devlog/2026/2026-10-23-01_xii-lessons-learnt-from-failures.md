# 2026-10-23-01 - Proposal XII in the task widget: Lessons Learnt from Failures

User: "recenty we have worked on teh lesson learnt from falute , now we need to
make the change on the widget also for this".

## What changed on the platform

Two worklog entries changed this:

- worklog `2026-10-23-03` created the `IRSLessonLearnt` object;
- the last update of worklog `2026-10-23-02` changed the R&D-PRJ-01 PDF's XII.

That XII now lists the lessons **created in this project**
(`IRSProjectLessonLearnt`), every state, in two columns: **Lesson** and **Lessons
Learnt from Failures**. It has no From project column. Before this change, the
widget's XII still showed the Key Learnings reused from other projects
(`learnings.reused`, with a From project column).

## What was built

| Piece | Change |
|---|---|
| JAR `ProjectContextReader` + JPO twin `IRSProjectContext` | new `$include` section `lessons`: `lessons[{id, physicalId, no, title, text, state}]`, `lessonError`, `counts.lessons`. One `getRelatedObjects` (Project Space -FROM-> IRSLessonLearnt), every name symbolic with a fallback |
| `js/services/ProjectContextService.js` | `toLesson`, `shape()` gives `lessons` / `lessonError`, `sectionsFor` maps `display: lessons` to `lessons` |
| `js/views/TaskDetailView.js` | `lessonsBlock` with the PDF's two columns; the text column uses the existing `irs-lines` (pre-line) so the line breaks show; `lessons` is a full-width block; the whole-call failure fallback carries `lessons` and `lessonError` |
| `js/data/forms/project-proposal.json` | XII: `display: lessons`, `learningScope` removed, note rewritten. Label unchanged |

The `learnings` sections (Key Learnings) stay in the JAR and the service for any
form that asks for them. No form asks for them now.

No new CSS.

## Tests

`irstasks-detail.test.js`:

- the form's service displays and `$include` now name `lessons`;
- new section 8b uses the JPO's real output on R&D-26002-HY (LLF-0000001/2) to check:
  - shaping, with the line breaks kept;
  - the two headings;
  - the `irs-lines` cell;
  - the empty note and the failure text;
  - the fallback.

The suite still stops at the old `rest-jar/...ProjectContextReader.java` path
(open since 2026-10-19). All sections before it pass, including 8b.
`irstasks-landing`, `-stm`, `-pes`, `-publication` and `irsprojects-detail`
pass.

## Open

- JAR deploy: the user stops TomEE. Until the new JAR is deployed, the old JAR
  refuses `$include=lessons` with a 400 (`BAD_INCLUDE`). The page then shows
  the failure reason on XII, XIII and the customer rows.
- Live check: the PPF-0000002 task on R&D-26002-HY.

Worklog `2026-10-23-04`.
