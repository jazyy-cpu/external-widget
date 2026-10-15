# 2026-10-14-04 - The year drives the title and the date range

Requirement: [WGT-10](../../requirements/WGT-10-annual-monitoring/README.md) ·
Status: done (pending a Spring restart to be seen)

## The defect

In the **New assessment round** panel, Title, Year, From and To were four
independent inputs. Year was seeded from the current financial year and so were
the dates, which made them agree on first open and only then. Editing Year moved
nothing else.

Two live records carry the result:

| Object | Year | Dates | Title |
|---|---|---|---|
| `ASM-0000004` | 2027 | 1 Apr 2026 - 31 Mar 2027 | Hydrodynamics... 2026 |
| `ASM-0000006` | 2027 | 1 Apr 2026 - 31 Mar 2027 | Hydrodynamics... 2026 |

A round labelled 2027 holding 2026 dates is not a cosmetic problem: projects and
trainings are selected by **overlap with the stored range** (doc 10 section
10.3), so such a round would report the wrong year's work under the right year's
heading.

## The decision - only one half was built

Two fixes were on the table:

1. **the control** - the service refuses a range that does not contain its own
   year;
2. **the courtesy** - the form derives the range and the title from the year.

The user **parked (1)** and asked for (2). The reasoning is sound and worth
recording, because it would otherwise look like a missing guard: the direction
is that *nothing about the range will be chosen at all*. The year will arrive as
the current financial year and the dates will be fixed 1 Apr - 31 Mar. The
pickers exist only because we are testing, and a refusal is only needed while
something can be chosen. **Open going forward, to be closed when the pickers
go.**

So this is a deliberate hole, not an oversight. Said plainly in
[design.md](../../requirements/WGT-10-annual-monitoring/design.md) section 4.1 as
well, so the next person does not "fix" it by accident and does not assume it is
enforced.

## What was built

The rule now lives in **one function**, not in a form:

```js
function rangeForYear(year) { ... y + '-04-01' ... (y + 1) + '-03-31' }
function suggestedTitle(departmentLabel, year) { label + ' ' + year }
```

`defaultRange(today)` now returns `rangeForYear(thisFinancialYear)`, so "today's
default" and "any year's range" cannot drift apart - a test asserts they agree.
When the pickers are dropped, `rangeForYear` is already the only source and
nothing moves.

The panel listens on the year input for both `input` (keystrokes, spinner) and
`change` (paste, Enter), and:

- re-derives From and To **always** - the range is a function of the year;
- rewrites the Title **only while it is still the suggested one**, compared
  against the remembered suggestion. No extra flag to keep in step, and it
  recovers if the HOD clears the box back to the suggestion.

## The test found a bug in my own fix

`Number('')` is **0**, not `NaN`. The first `rangeForYear` guarded with
`isFinite` alone, so clearing the Year field produced `0-04-01` to `1-03-31` -
and the panel would have written those into the pickers. A half-typed `20` gave
`20-04-01`.

`rangeForYear` now treats blank, non-numeric and out-of-bounds (outside
2000-2100) the same way: **no dates**, and the caller leaves the pickers
untouched. The Create handler refuses such a year outright, which it previously
did not do either.

This is why the check was written as a loop over `['', '   ', null, undefined,
'abc', '20', 1999, 2101]` rather than one empty string.

## Verification

`node src/test/js/irsannual-skeleton.test.js` - **29 checks, all passed** (24
before, 5 added):

- the range is derived from the year, for any year;
- `defaultRange` agrees with `rangeForYear` - one rule, not two;
- a blank or out-of-range year yields no dates, not `0-04-01`;
- the suggested title carries the year, and an empty label falls back to
  `Assessment`;
- the panel calls both functions, listens on the year, and **does not build
  `-04-01` itself** - the last one is a source-shape check, because this suite
  has no DOM and the wiring is the part that broke.

Not yet seen in 3DDashboard: the widget needs the pending Spring restart, which
is also still owed the `Notify.warning` toast from
[2026-10-14-03](2026-10-14-03_annual-only-and-the-refusal-message.md).

## Carried

The two mislabelled rounds are still in the database. They are test data, so
deleting them is cheap, but worth doing before anyone reads the grid as real.
