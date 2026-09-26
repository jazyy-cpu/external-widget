# 2026-09-26-02 - The fixed crash reappeared verbatim: the browser was running the cached module

| | |
|---|---|
| Date | 2026-09-26 |
| Requirement | [WGT-01](../../requirements/WGT-01-project-landing/README.md) |
| Status | done |
| Done by | agent (Claude Opus 5) |
| Follows | [2026-09-26-01](2026-09-26-01_tabulator-async-build-crash.md) |

## What happened

After 2026-09-26-01 fixed the `setHeight` race and the served file was verified
over TLS, the user reported the **identical** stack trace, "still issue is there".

The trace was the evidence:

```
at ProjectListView.js?v=20240118T194043Z:176:40
```

Line 176 of the file being served is inside `build()` - `table.on('tableBuilt', ...)`.
There is no `setHeight` anywhere near it. The browser was executing the previous
copy of the module.

## Why the copy was stale

Two things lined up:

1. **The `?v=` does not change.** The dashboard appends the *platform's* resource
   version to our URLs (`20240118T194043Z`). It is not our file's version, so
   editing a module leaves the URL byte-identical.
2. **We sent no `Cache-Control` at all.** Spring's static resource handler sent
   only `Last-Modified`:

   ```
   HTTP/1.1 200
   Last-Modified: Sat, 26 Sep 2026 10:09:27 GMT
   ```

   With no explicit policy a browser is free to apply **heuristic freshness** -
   roughly 10% of the document's age - and serve its own copy *without
   revalidating*. Nothing asked the server whether the file had changed.

"Tick Disable cache" was already trap #1 in HANDOFF, and it is still good advice,
but relying on a habit to make a code change visible is not a fix. It cost two
rounds here: a correct fix, shipped and verified served, that read as "not
working".

## The fix

`application.properties`:

```
spring.web.resources.cache.cachecontrol.no-store=true
spring.web.resources.cache.cachecontrol.must-revalidate=true
```

`no-store` means no cache - browser or dashboard proxy - may keep the response at
all, so what runs is always what is on disk. Verified:

```
HTTP/1.1 200
Cache-Control: no-store, must-revalidate
```

on the module, the CSS and the widget HTML.

This is a **development** setting, and it is the right trade here: the widget is
a handful of small files on the same LAN, and an invisible edit costs far more
than a re-fetch. Before production-like use it should become versioned URLs plus
a long `max-age` - noted alongside the dashboard cache in HANDOFF section 5.

## The lesson worth keeping

**Read the line number in a stack trace against the file on disk before believing
the bug.** If the line the trace names is not the code you edited, the browser is
running something else and there is nothing to debug. That check is now part of
trap #1.

## Next

Reload once with "Disable cache" ticked - the already-cached entry was stored
under the old headers, so it takes one revalidated fetch to evict; after that
`no-store` keeps it honest. Then the open checks: the grid itself (G6), and the
display names of `Hold` and `Cancel` (G18).
