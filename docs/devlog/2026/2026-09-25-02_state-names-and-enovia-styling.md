# 2026-09-25-02 - The real state names, the real maturity palette, and a blue header

| | |
|---|---|
| Date | 2026-09-25 |
| Requirement | [WGT-01](../../requirements/WGT-01-project-landing/README.md) |
| Status | done; not yet looked at in the dashboard |
| Done by | agent (Claude Opus 5), on the user's screenshots |
| Follows | [2026-09-25-01](2026-09-25-01_landing-page-ootb-look.md) |

## What was asked

> "we will not change any state for project, and in screen shot i have shared the
> actual name of each state, so we need to do the mapping. 2. now if we see in our
> widget in ootb batch the content is coming in between the batch and in our case
> it lilite off can we make it more stream line 3. can we make table header lilitel
> blue to match enovia style" (user, 2026-09-25)

The decisive screenshot was the **Maturity graph** of a real project.

## 1. The state names - the MQL name is not what the platform shows

The graph gives the platform's own lifecycle:

```
Draft -> To Do -> In Work -> In Approval -> Completed -> Archived
```

Six states, in order, against the six of the MQL `Project Space` policy in the
same order. Two are **confirmed by observation** rather than inference: the same
two projects read `Draft` and `In Work` in the OOTB grid while ours showed
`Create` and `Active`. The other four follow from the order, which matches one
for one.

`Hold` and `Cancel` belong to the second policy, `Project Space Hold Cancel`, and
do **not** appear on that graph. Their display names have not been seen, so they
keep their MQL names rather than being guessed at - "On Hold" and "Cancelled"
are the obvious guesses and either could be wrong. They are marked as
unconfirmed in `ProjectFields.STATE_LABELS` and in the requirement's table.

**The mapping is presentation only**, and keeping that line clean matters more
than the labels themselves:

| Carries the MQL name | Carries the display name |
|---|---|
| the `state` query parameter, the row data, `isClosed`, the Tabulator cell value | the badge text |

The cell keeps the MQL name, so sorting and the state filter are untouched. A
test now asserts that **no display name can reach the query** - `state=Draft`
would return nothing at all, silently, which is exactly the kind of bug that
survives a demo.

Also recorded, because it is a standing constraint rather than a detail: **the
widget changes no state.** It shows maturity; the platform drives it.

## 2. The badge text was sitting high

A Bootstrap badge is an inline-block whose height comes from the inherited
line-height, so in a 13px grid row the text drifted off centre. The badge is now
`inline-flex` with `align-items: center`, `min-height: 20px` and
`line-height: 1`: centred in both directions, and every badge in a column the
same size whatever the word.

## 3. The palette, and one deliberate deviation

Colours read off the graph and the OOTB grid badges: purple `#a32ba0` Draft,
crimson `#d0103a` To Do, teal `#0079a8` In Work, light green `#8cc98c` In
Approval, grey `#b4b4b4` Completed and Archived.

The platform draws **white** text on all six. On the three light ones that is
about **1.9:1 contrast** - not "a bit hard", genuinely unreadable. Those keep the
platform's background and take dark text instead. It is the smallest deviation
that leaves the badge legible, and it is written down rather than done quietly.

## 4. The header is ENOVIA blue

`#e8f0f7` with a 2px `#a9c5db` rule and `#12395c` text, plus a slightly deeper
hover. It was a neutral `#eef0f2` grey.

## Verification

Seven suites pass. New assertions: all eight states map to the expected display
names in order, an unmapped state shows its own name, `stateBadge` returns the
new class names, and the wire still carries MQL names only. The existing
cross-check still holds - every state of both policies has a CSS rule, and none
falls through to `irs-state-unknown`.

`node --check` clean, application restarted (1.708 s), and the served CSS
confirmed to carry the blue header and all nine `irs-state-*` rules.

**Not verified: the look.** Nothing here has been seen in the dashboard.

## Next

1. Look at it, and **confirm the two unconfirmed labels**: what does the platform
   call `Hold` and `Cancel`? Their policy has no graph in the screenshots.
2. The rest of the grid checklist, G4-G17.
