# 2026-09-25-01 - The landing page, dressed to match the OOTB grids

| | |
|---|---|
| Date | 2026-09-25 |
| Requirement | [WGT-01](../../requirements/WGT-01-project-landing/README.md) |
| Status | done; not yet looked at in the dashboard |
| Done by | agent (Claude Opus 5), on the user's screenshots |
| Follows | [2026-09-24-09](../2026/2026-09-24-09_credential-right-and-type-filter.md) |

## What was asked

> "can we make landing page lil more professional, just change little table
> column header, just see what we can, try to make top bar more visible, lets
> make some changes and try to match with ootb screen shared specially status
> and project type" (user, 2026-09-24)

Three OOTB screenshots came with it, which is what made this answerable rather
than a matter of taste: the Project Gantt grid, Change Governance, and our own
page for comparison.

## What the OOTB screens actually show

Read off the shared screenshots before changing anything:

| | |
|---|---|
| **Type** column | **plain text**, no badge, carrying the platform's full label - "Analysis Project", "Research Project", "Project Space" |
| **Maturity State** column | a solid rectangular badge in the platform's palette: **purple** for Draft, **teal** for In Work |
| Date heading | "Estimated Finish Date" |
| Column headings | a light band, solid dark text, a definite rule underneath |
| Controls | a distinct strip above the grid, not floating |

Ours had it almost backwards: Category was a grey badge and Status was a
Bootstrap badge in blue/grey, so the two columns carried the same visual weight
and neither matched the platform.

## What changed

1. **Category becomes Type, and loses its badge.** `TYPE_LABELS` now holds the
   platform's own labels - "Analysis Project", not "Analysis" - so the same
   project reads identically in our grid and in an OOTB one.
2. **Status becomes Maturity State, in the platform's colours.** A state no
   longer maps to a Bootstrap contextual suffix but to a CSS class of ours,
   `irs-state-<key>`. Eight colours, following the platform: purple
   Create/Assign (as Draft), teal Active (as In Work), amber Review/Hold (as
   Frozen), green Complete (as Released), grey Archive/Cancel (as Obsolete).
3. **Date headings** are the platform's: Estimated Start, Estimated Finish.
4. **The headings** sit on `#eef0f2` with a 2px `#c8ccd0` rule and
   `font-weight: 600`, instead of the simple theme's white and thin grey.
5. **The top row is a toolbar band** (`.irs-toolbar`): `#f5f5f5`, 1px border,
   3px radius. It used to float above the grid with nothing separating it.

`Format.badge` now takes either a Bootstrap suffix or a ready class list, so the
one helper serves both palettes and no caller has to know which is which.

## Decisions worth recording

**The vocabulary trade-off, stated rather than buried.** "Type" and "Maturity
State" are the *platform's* words; the R&D-PRJ-01 form says "Project Category",
and our grid said "Status" until today. Matching the OOTB screen was the
explicit instruction, and a user moving between the two widgets now sees one
vocabulary. If IRS would rather have the form's words on this page, both are one
line each in `views/ProjectColumns.js` and no data changes.

**A mapping in JS and colours in CSS can drift.** So the test walks every state
of both lifecycle policies, asks `ProjectFields.stateBadge` for its class, and
fails if `css/IRSProjects.css` has no rule for it - and separately fails if any
state falls through to `irs-state-unknown`. A ninth state added to the policy
without a colour is now a failing test rather than a grey badge nobody notices.

**This is the third and last block of custom CSS** in the widget (rule R1), and
it is here for the same reason as the first: Bootstrap has no contextual colour
near the platform's Draft purple or In Work teal, and `navbar` is not a toolbar.
The reason is recorded in the requirement's design.md section 6a, as R1 asks.

## Verification

Seven suites pass. Two existing assertions had to change with the labels rather
than be deleted - the mapped category is now "Analysis Project" in both the list
and the detail tests - and four were added: the platform labels, the maturity
classes, that no state is unmapped, and the CSS cross-check above.

`node --check` clean, application restarted (1.656 s), and the reworked CSS and
the four changed modules verified served with full TLS validation. The served
CSS carries all nine `irs-state-*` rules.

**Not verified: the look.** None of this has been seen in the dashboard yet -
checks G15 (row height beside an OOTB widget) and the new G17 below.

## Next

1. Look at it beside an OOTB widget on the same tab, and say whether the
   vocabulary change ("Type", "Maturity State") is right for IRS.
2. The rest of the grid checklist, G4-G17.
