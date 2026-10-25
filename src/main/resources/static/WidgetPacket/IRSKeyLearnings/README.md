# IRSKeyLearnings widget packet

The G14 Key Learnings register: every project's key learnings, filtered by the
date they were originated. Requirement:
[WGT-11](../../../../../../docs/requirements/WGT-11-key-learnings-register/README.md),
work package WP11.

**Built and unit-tested 2026-10-25; not yet opened in 3DDashboard.**

## Run it

Static content served by the Spring app, like the other packets:

```
scripts/start-widget.ps1
```

then add `https://external.solize.com/WidgetPacket/IRSKeyLearnings/IRSKeyLearnings.html`
as an Additional App. **Nothing runs on the platform side for this widget** -
no JAR, no JPO. It reads the search index through the platform's own
`/federated/search`.

```
node src/test/js/irskeylearnings.test.js
```

## How it reads

Pick From and To, press Show. Nothing is read before that. Then three index
searches, whatever the number of rows:

1. the learnings originated in the range (paged, at most 2000);
2. their origin projects - manager and members come from the project's index
   document;
3. the members - full names.

## Layout

```
IRSKeyLearnings.html                 shell: preferences, script tags, UWA events
css/IRSKeyLearnings.css              the only custom CSS, all under .irs-learnings
js/App.js                            start-up, top band, credential
js/config/LearningFields.js          THE file to edit: predicates, queries, limits, range rule
js/services/IndexSearch.js           federated search: page, all pages to a ceiling, chunked lookup
js/services/LearningService.js       the three searches and the join into rows
js/components/LearningToolbar.js     From / To / Show, search, Export, Print
js/views/LearningColumns.js          the nine columns
js/views/LearningListView.js         the grid
```

## Things worth knowing before editing

- **The index stores dates in UTC.** `LearningFields.indexBounds` turns the
  user's local days into UTC bounds. Do not "simplify" it to bare days: a
  learning written before 05:30 IST would move to the previous day.
- **Use `originated`, not `ds6w:created`, in the query.** The 6W name returns a
  500 when compared; the native field works to the second.
- **The index answers custom names in lower case.** `IndexSearch.flatten`
  lower-cases every key once; read fields through `IndexSearch.first / all`.
- **Members are the project's `_PRJ` multiple-ownership entries.** They matched
  the `Member` connections exactly on both test projects; `LearningFields.memberLogin`
  is the one place that parses them.
- **Export writes the row's field, not the formatted cell.** Keep every column's
  field holding the text a CSV should carry.
- `tabulator_simple`, not `tabulator_bootstrap5` - the same density as the other
  IRS widgets.
- **No state is kept across a reload** - no range, no search, no rows. The
  user asked for a clean start every time (2026-10-25); do not add
  preferences for them back. A test guards it.
