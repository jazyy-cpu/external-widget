# 2026-10-10-03 - WGT-10 Annual Monitoring: specification, and O1 answered

| | |
|---|---|
| Date | 2026-10-10 |
| Requirement | [WGT-10](../../requirements/WGT-10-annual-monitoring/README.md) |
| Status | done - specified; no code written |
| Done by | Claude |

## Goal

Specify the Annual Monitoring widget, and answer the one question that decides
how much of it can be built without the custom REST JAR.

## What was done

Wrote `requirements/WGT-10-annual-monitoring/` - README, design, api - in the
WGT-06/07 shape. Registered it in `requirements/INDEX.md` and in WP01.

**The id is WGT-10, not WGT-09.** The user asked for WGT-09; that is the
approval route, built two days ago. WGT-05 is free but left alone so numbering
stays chronological.

## Decisions and findings

### Almost nothing here is new UI

`JazzySole` already provides the request wrapper, router, credential bar,
formatters, notifications, Tabulator and Bootstrap, and three widget packets
exist to copy patterns from. The **only genuinely new pattern** is the editable
rating grid: man-days as the sole input, points and grade as computed read-only
columns, `columnCalcs: "bottom"` giving the 228-day ceiling for free, and the
Domain column frozen.

Two rules written into the design because they are easy to get wrong:

- the browser computation is **feedback only** - the server writes points and
  grade from the stored man-days;
- the ceiling is **enforced server-side**; a browser total is a courtesy.

### O1 - what OOTB REST can actually do

Tested live, read-only. Federated search **does** return our custom types:
`flattenedtaxonomies:"types/IRSDomain"` gives 35 hits with id, Title, name,
subtype, policy, `ds6w:what/ds6w:status` (= `IRSDomain.Active`, policy and state
in one field), dates, owner, collaborative space and the department id.

But it returns **no custom attribute values** - `TOF-0000010`'s six DMC
attributes are absent - and **no relationships**, because search indexes objects
and not links.

**So the build order was wrong and has been corrected in design.md.** It claimed
steps 1-4 need no JAR. In fact only the *shell* of a list page is free: the year,
period and range on a round, the reports under it, the ratings, and the
`IRSRatedDomain` REL2REL all sit outside search. The JAR is needed earlier.

### The question worth answering next

**O7:** is there an OOTB detail/expand service that returns custom attributes
and expands relationships for a plain business object? The Project Web Services
do exactly that for the EPM attributes (WGT-01 api.md §2). If an equivalent
exists, the service shrinks a lot; if not, it has to carry every read as well as
every write. Cheap to test, and it changes the size of the job.

### Prerequisite found

The three Annual Monitoring types have **never been indexed**, so search will
not find them even once objects exist - unlike `IRSDomain` and
`DMPTrainingOffering`, which were indexed on 2026-10-04/05. Logged as **O8**.

### Incidental

`TOF-0000010` is now `Document Release.RELEASED`. Doc 09 recorded every offering
as `IN_WORK`; that note is corrected.

## Verification

No code, so nothing to test. The O1 evidence is in
[api.md](../../requirements/WGT-10-annual-monitoring/api.md), with the exact
queries and the fields returned.

## Next

1. O7 - the OOTB detail/expand question.
2. B2 - prove a POST from the widget through the request wrapper.
3. O8 - index the three types.
4. Then step 1 of the build order, the department picker.

Workspace worklog: `2026-10-10-06_annual-monitoring-widget-specified-and-o1-tested.md`.
