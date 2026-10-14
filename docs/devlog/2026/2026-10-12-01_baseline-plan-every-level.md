# 2026-10-12-01 - The baseline plan was showing one level of a three-level WBS

The user pointed at task `39261.35329.20156.746` and the monthly plan on its
R&D-PRJ-02 form: three rows - **Phase 1**, **Phase 2 Task**, **Phase 3 Task** -
for a baseline that holds ten tasks. *"we are showing only first level task, so
maywith some seq no we can show the flat list then nothning wil change"*.

## The cause was one missing query parameter

`BaselineService.readPlan` asks the OOTB project resource for the baseline's
tasks. **That service answers with the first level only unless `level` asks
for more.** The request sent no `level`.

Nothing had shown this because every baseline captured before this one was
flat - first level and whole plan were the same list. `WGT-07 O-P10` had the
risk written down and called it untested.

The stakes are higher than a missing row: this plan is the plan **as
approved**, it carries a Rev. No. and it is signed. A page that quietly drops
seven of ten tasks is worse than one that fails to load, because nothing on it
says anything is missing.

## Four requests, one answer

All against baseline `B-85756263-0000125`, in one signed-in browser session:

| request | rows | children |
|---|---|---|
| no `level` | 3 | none |
| `level=10` | 3 | none |
| `$depth=10` | 3 | none |
| **`level=0`** | **10** | **nested under `children`** |

**`level=10` is the trap.** It is the value DS's own code uses - 
`ENOProjectMgmtModels.js` appends `&level=10` to the projects collection URL -
and it reads like a depth request. It is the Gantt's lazy-expansion hint.
Copying the product's literal would have left the bug in place while looking
like it had been checked against the product.

The gaps in `sequenceOrder` gave the bug away before the children did: the top
level read **1, 5, 8**, so six rows were unaccounted for.

## What the deep answer carries

- **`sequenceOrder`** - 1..n over the whole plan, depth first.
- **`taskWBS`** - the hierarchical number: `1`, `1.1`, `1.2`, `1.2.1`.
- The **same fields at every depth**. `$fields` is not repeated per level, so a
  child three deep arrives with its title, type, state and dates filled in.
  The plan is still **one round trip** - no per-task fetch, no N+1.

MQL (`expand ... from relationship "Subtask" recurse to all`) confirmed the ten
tasks independently, and settled something an earlier version of this file got
wrong: the `Sequence Order` and `Task WBS` **attributes** on the Subtask
relationship are stored as **1 on every link**. The numbers are computed by the
service. No amount of MQL was ever going to produce the order - which is why
the plan is read over REST.

## The fix

Flat, with the number in front - what was asked for, and the right answer for a
printed form.

- `BaselineService.readPlan`: `level: '0'`, plus `tasks.taskWBS` in `$fields`.
  `flattenPlan` walks `children` depth first (accepting `tasks` as well, so a
  flat answer still reads), keeps `wbs` and `depth` per row, caps at 20 levels.
- `TaskDetailView.planTable`: the number prints **inside the name cell**, not
  in a column of its own. `.irs-plan-name` is sticky at `left: 0` because it is
  the first column; a second one would have to be made sticky too. **No CSS
  changed.**

Rows are not indented and no column was added. Both were available and both
were against the request; a flat numbered list also reads better on paper,
which is where this form ends up.

## Tests

`irstasks-detail.test.js`, two new sections:

- **`irstasks-plan-nested`** - `level=0` is sent and `tasks.taskWBS` asked for;
  a three-level fixture flattens to `1, 1.1, 1.2, 1.2.1, 2` in `sequenceOrder`,
  with type and dates intact three levels down, and the form's own row still
  found when it is a child rather than a top-level task.
- **`irstasks-plan-wbs-column`** - the columns are unchanged, a row reads as its
  number and its name, the sticky column is still the first, and a plan with no
  WBS numbers (every baseline captured before today) prints its names with no
  stray prefix.

All other sections and the other eleven test files still pass.

Worklog: [2026-10-12-05](../../../../worklog/entries/2026/2026-10-12-05_baseline-plan-shows-every-level.md).
