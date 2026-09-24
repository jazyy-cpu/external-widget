# 2026-09-24-09 - Credential to the far right, and only our project types listed

| | |
|---|---|
| Date | 2026-09-24 |
| Requirement | [WGT-01](../../requirements/WGT-01-project-landing/README.md), [WGT-03](../../requirements/WGT-03-credential/README.md) |
| Status | done; not yet looked at in the dashboard |
| Done by | agent (Claude Opus 5), on the user's screenshot |
| Follows | [2026-09-24-08](2026-09-24-08_project-detail-skeleton.md) |

## What was asked

> "move the credential to the extreme right with refresh button, and we will only
> show research and analysis project in the widget. in future if required we will
> show the more project types here" (user, 2026-09-24)

## 1. One shared top row

The credential picker used to be a row of its own, with a bottom border, above
the page. It cost a line of height on every page for a control that is changed
once a session.

`App.js` now builds a single top row: a **left slot** the open page fills with
its own controls, and the credential picker after it, hard right. The list view
renders its toolbar into that slot (`options.toolbar`), so the row reads

```
( ) Show completed / archived    [All fields v][    ][search][Clear][Refresh]  Credential [ ... v]
```

A page with no toolbar - the detail page - simply leaves the left empty and the
credential still sits where the user expects it. `freshPage()` clears the slot
as well as the page area, so one page's controls cannot survive into the next.

`ProjectListView.render` takes the slot as an option and falls back to its own
root when none is given, so the view still works on its own.

## 2. Only Analysis and Research projects (open item A4, closed)

A4 had been open since the grid first ran, when the list showed `simple
project`, an ordinary OOTB `Project Space`, beside our two subtypes. The user has
now answered it: **ours only**.

The filter is in the widget because **the project service takes no type
parameter at all**; it returns every project the user can see. The list of types
is `ProjectFields.LIST_TYPES`, next to the state lists and the label map, so
adding a subtype later is one line and nothing else changes - the Category
label already reads from the same file.

Two decisions worth recording:

- It matches on the **exact type name**, not "anything deriving from
  `EPMRandD`". The response carries a type name and nothing about its parent, so
  derivation cannot be judged in the widget. If IRS adds a third subtype it must
  be listed here deliberately, which is the safer failure: a missing project is
  noticed, a silently included one is not.
- The **detail page does not filter**. A project opened by id is shown whatever
  its type, so a link from elsewhere never lands on a blank page.

## Verification

Seven suites pass. `irsprojects-projectservice.test.js` gained four cases: a
`Project Space` and the parent type `EPMRandD` are dropped, no type parameter is
sent (the filter is ours), the "show completed / archived" switch does not
smuggle other types back in, and `LIST_TYPES` / `isListed` are what they claim.

One existing case had to move rather than be deleted. Case 2c asserted that an
unknown subtype shows its own name instead of an empty cell - which it did,
through the list. The list now drops unknown subtypes, so that assertion could
no longer be made there. It is now made against `ProjectFields.typeLabel`
directly, because the behaviour still matters: the detail page opens any type
and still needs a readable label.

`node --check` clean, application restarted (1.658 s), and the six changed
modules verified served with full TLS validation.

**Not verified:** the layout. The credential's new position has not been looked
at, and neither has the shorter list.
