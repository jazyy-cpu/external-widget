# 2026-09-24-08 - Project detail page: the skeleton, and the router finally wired in

| | |
|---|---|
| Date | 2026-09-24 |
| Requirement | [WGT-04](../../requirements/WGT-04-project-detail/README.md) (new), [WGT-02](../../requirements/WGT-02-navigation-state/README.md) |
| Status | skeleton built and unit-tested; not yet opened in the dashboard |
| Done by | agent (Claude Opus 5) |
| Follows | [2026-09-24-07](2026-09-24-07_project-grid-first-live-run.md) |

## Goal

Move from the project list to the individual project. The user asked for the
sections to be thought through first - what a project captures, and how to show
it - and then "lets build some skeleton as of now, we refine as we move ahead".

## Decisions taken with the user before building

| Question | Answer |
|---|---|
| Layout | **tabs and sections**; the first page shows the project's high-level information |
| The Project No. button | **build the UI only**; the schema and the mechanism come later |

## What was done

Nine new modules (rule R4), a new requirement folder, and the router wired in.

**The catalogue first.** `js/config/ProjectForm.js` is the design: every field
of `R&D-PRJ-01-Rev.06` in printed order, taken row by row from **WP02 doc 05
§12**, which was verified against MQL on 2026-09-23. Each row carries a `kind` -
`attribute`, `basic`, `subtype`, `todo`, `rel`, `object`, `wbs`, `route` - and
that is what the page draws from. Adding a field to the form is now a row in
that one file.

The `todo` kind matters more than it looks. Four of the form's fields do not
exist on the platform: `EPMLessonsLearnt` (XII), `EPMScreeningApprovalObtained`
and, from the to-be table, five more. An empty box beside a label would say
"nobody filled this in", which is a much more comfortable claim than "this field
was never built". The page distinguishes the two.

**The page.** Header = the form's header block (title, category, state, Project
No., Department, Customer, dates). Then tabs:

| Tab | State |
|---|---|
| Overview - sections I-XVI in form order, then the signature block | built, shows the 12 real attributes |
| Organisation - Department + Business Unit + Customer | skeleton: neither relationship exists yet |
| Risks & opportunities - form XIII | skeleton: objects exist and are linked, the read call is unknown |
| Lessons learnt - form XII | skeleton: the attribute is not created |
| Planning, Team & cost, Documents, Approvals | tabs present but disabled, so the shape of the page is visible |

A section that lives on another tab still appears in its numbered place on
Overview with a link across - someone reading along with the paper form must not
find a hole where XIII should be.

**The router (WGT-02) is now wired in**, which had been built and unit-tested
since 2026-09-23 but never used. `projects` and `project/:id`, state in the
hidden preference `jzRoute`, declared in the shell. The `project/:id` handler
returns the detail load's promise, so a project that cannot be opened - deleted,
or invisible under the active credential - makes the router drop the saved page
and fall back to the list instead of reopening a broken page on every refresh.
That is `Router._open`'s `restoring` branch, and this is the first page to use
it. Changing the credential now calls `router.reload()`.

## Decisions and findings

**1. Risks and opportunities stay objects, not text.** This confirms WP02 doc 05
§13.2 rather than re-deciding it: `Risk` and `Opportunity` derive from `Risk
Management`, sit in the same package as the projects, are already connected to
the test project through the `Risk` relationship, and each already carries an
RPN scoring object. The proposed attribute `EPMRisksAndOpportunities` stays
dropped. A test asserts the catalogue has no such field, so it cannot creep back.

**2. Lessons learnt raises a schema question, and the tab says so.** The user
wants it as a topic of its own. That invites a choice the platform has not made:
one multiline attribute on the project (faithful to the paper form), or a list of
dated entries added as the project runs (more useful, searchable across
projects, needs its own object). **An attribute cannot become a list later
without migrating data**, so it is cheaper to settle before `EPMLessonsLearnt`
is created. Logged as open item B1.

**3. Nothing writes.** The Project No. button is built and behaves as agreed -
shown while the number is empty, gone once it is set - but pressing it explains
that the number cannot be generated yet. Two things are missing and both are
outside the widget: the numbering scheme (R20) has to come from IRS, and the
project **write** call has never been tested from here (B3). Inventing a format
like `PRJ-2026-0001` was considered and rejected: a provisional number written
onto a real project is expensive to take back.

**4. The detail call sends no `$fields`.** WGT-01 api.md §2 recorded that every
EPM attribute comes back in `dataelements` with no extra parameter. The list
trims because it returns many rows; one object is wanted whole, and a `$fields`
list would have to be kept in step with the catalogue for nothing. The response
envelope is accepted in three shapes, because the single-object form has never
been observed and betting on one would be a guess.

**5. No new CSS.** Bootstrap `nav-tabs` plus utilities covered the page. The
tabs component is 90 lines because Bootstrap's own tab plugin cannot be used -
its bundle is UMD and would break the AMD loader (rule C7), and all the plugin
does is toggle a class.

## Verification

```
node src/test/js/jazzysole-credentials.test.js      ALL CREDENTIALS TESTS PASSED
node src/test/js/jazzysole-router.test.js           ALL ROUTER TESTS PASSED
node src/test/js/jazzysole-request.test.js          ALL REQUEST TESTS PASSED
node src/test/js/irsprojects-projectservice.test.js ALL PROJECT SERVICE TESTS PASSED
node src/test/js/irsprojects-search.test.js         ALL SEARCH TESTS PASSED
node src/test/js/irsprojects-detail.test.js         ALL DETAIL TESTS PASSED   (new)
```

`irsprojects-detail.test.js` pins the catalogue to doc 05: sections I-XVI all
present and in order, exactly the twelve attributes that exist on the VM, XIII
as an object and not a field, XII marked missing, Department and Customer as
relationships with no attribute duplicating them, the four design-and-development
sections marked, and every cross-reference pointing at a tab the page actually
has. Plus the detail read: path, `$include=none`, no `$fields`, the three
envelope shapes, a clear error when nothing comes back, and id encoding.

`node --check` clean on all 18 widget files; `IRSProjects.html` still well-formed
XML; application restarted (1.679 s) and all twelve new or changed files verified
served with full TLS validation.

**Not verified: anything that needs a browser.** The detail page has never been
opened. In particular the router's saved-page behaviour, the tabs, and whether
the detail call returns what the catalogue expects are all untested in reality.

## Next

1. Open a project from the list in the dashboard. First look answers: does the
   detail call work at all, do the twelve attributes arrive in `dataelements`,
   and does a refresh come back to the same project (rule R6, WGT-02 checks
   N1-N3).
2. **B1** with the user: lessons learnt as one text box, or a list of entries.
3. **B6** with the user: does this page stay read-only, or is editing the twelve
   attributes the next piece?
4. **B2**: find the call that returns a project's `Risk` and `Opportunity`
   objects, then build that grid.
5. **B4**: create `EPMLessonsLearnt` and `EPMScreeningApprovalObtained` on the
   platform - that is VM work and gets a `worklog/` entry of its own.
