# 2026-10-15-01 - Two man-day rates on the Cost Estimation table

| | |
|---|---|
| Requirement | WGT-07 (task page, Personnel / Cost Estimation form) |
| Status | done - widget source updated, rebuild pending |
| Platform worklog | `worklog/entries/2026/2026-10-15-03_two-manday-rates-irs-and-outside.md` |

## What changed and why

The Cost Estimation table printed one footnote, `* Man power cost =
Rs. 15,000/- per man day.`, because one flat rate costed both columns
server-side. That made row 02, Manpower Cost (outside agency), the **IRS**
rate multiplied by an outside agency's man-days - a number with no meaning on
a form a customer signs.

The platform now keys two rates per project. The widget reads both.

## The widget change is small, and deliberately so

The renderer already knew the SHAPE of the table and nothing about which
attributes fill it - that was the point of `personnel-cost.json`. So:

```json
"footnoteRates": [
  { "label": "IRS",            "attribute": "EPMManpowerRatePerManday" },
  { "label": "Outside agency", "attribute": "EPMManpowerRatePerMandayOutsideAgency" }
]
```

replaces the single `"footnoteRate": "EPMManpowerRatePerManday"`, and
`costsBlock` loops the list instead of reading one key. **One line per rate**,
not one combined line: each rate is the basis of exactly one amount in the
table above it, and a reader checking the arithmetic has to see which
multiplier produced which figure.

A rate that is missing prints nothing rather than an empty line.

## Nothing here computes anything - still

Every figure in this block, the two rates included, is READ. The arithmetic
is a JPO fired by attribute triggers; a second implementation in the client is
how the screen and the database start disagreeing. The test still asserts the
renderer names no `EPM*` attribute and hard-codes no `15000`.

## No REST change

The project's attributes arrive through the dataelements call the page
already makes, so a new attribute flows through with no server work. Measured:
nothing in the REST JAR names these attributes.

## Tests

`irstasks-cost-form` passes. It now asserts both rates are read, in the order
the amounts above them appear, that each carries the label naming its column,
and that the old single-rate key is **gone** rather than left beside the new
one.

Unrelated and pre-existing: the suite crashes further down reading
`rest-jar/.../ProjectContextReader.java`, deleted on 2026-10-14 (worklog
2026-10-14-27). Not touched here.

## Left to do

- Rebuild and restart the widget - the source is updated, the running app is
  serving the previous build.
