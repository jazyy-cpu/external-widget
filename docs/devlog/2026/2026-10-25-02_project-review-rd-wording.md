# 2026-10-25-02 - Project Review: the two area-specific labels now read as the paper form

| | |
|---|---|
| Date | 2026-10-25 |
| Requirement | G7 Project Review (task detail form) |
| Status | done - form definition changed; widget needs a rebuild to serve it |
| Worklog | `worklog/entries/2026/2026-10-25-05` |

## What changed

Three labels in
`WidgetPacket/IRSTasks/js/data/forms/project-review.json`:

| Was | Now |
|---|---|
| `Validation (R&D form only)` | `Validation` |
| `Data copied to the project common drive (R&D form only)` | `Data related to relevant task copied in the project common drive` |
| `Follow-up Action Recommended` | `Follow-up Action Recommended (relevant to completed task)` |

The third was added on the same day, immediately after, when the user saw it
flagged on the rendered page. Its `hint` - "Note: Refer to the planning
document for carrying out the review" - is unchanged: that is the paper's
instruction to the reviewer, not part of the label.

All three now read exactly as **R&D-REV-Rev.02** writes them. The second is the
printed sentence in full; it was shortened before to fit a label column.

## Why it was edited HERE and not in the PDF config

The user asked for the **PDF**. The PDF's block is generated from this file by
`gen-g7-pdf-block.py`, which looks its labels up by the widget's own label
text - deliberately, so screen and page cannot grow two vocabularies. Changing
the PDF alone would have meant either hard-coding a second label in the
generator or breaking its lookup. One edit here, both outputs.

**So the widget screen changes too**, and that is the intended behaviour of
this arrangement rather than a side effect.

## What this gives up

The `(R&D form only)` suffix was a deliberate choice of 2026-10-10: these are
the only two rows that exist on R&D-REV-Rev.02 and not on RDAREA-REV-Rev.00,
and the suffix was what told a reader on an **Analysis (AR)** project why
their paper form stops at item 3. Both rows are still drawn on both areas, so
that reader is now told nothing.

This is the same unresolved question the footer already raises - an AR
project's review prints the R&D form code and effective date (WP05 B25) - and
the page now raises it twice. Recorded in `_twoAreas` in the route config and
in `_twoFormsOneSubtype` here; the 2026-10-10 reasoning is kept as history
rather than deleted, because it was sound and may be wanted back.

## To take effect in the widget

The file is a static resource of the Spring app. The running widget serves its
own copy, so it needs a rebuild / restart before the screen shows the new
labels. The PDF already does - the page CI was deployed and a render verified.
