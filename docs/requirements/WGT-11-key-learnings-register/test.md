# WGT-11 - test

## 1. Unit suite - `src/test/js/irskeylearnings.test.js`

```powershell
cd 'D:\PROJECT DATA\19 IRCLASS\external-widget'
node src/test/js/irskeylearnings.test.js
```

Runs under `TZ=Asia/Kolkata`, so the UTC conversion is tested where it bites.
Fixtures are the VM's real index values of 2026-10-25.

**Result 2026-10-25: 29 of 29 pass.**

| Section | Checks |
|---|---|
| range | both dates required; malformed / 31 Feb refused; To before From refused; IST midnight -> `18:30` UTC the day before; the exact query proven on the index; quoting of lookup keys; member entries parsed; file name; export list |
| index search | server-root URL; case-insensitive flatten with multi-values; request body (query, predicates, paging, SecurityContext); 450 hits = 3 pages; 2500 hits stop at 2000 with `truncated`; 120 ids = 3 chunked queries |
| register | LRN-0000003's full row (manager, 5 members sorted, 11:04 IST); newest first; 8 members on ANA PRJ 01; "no access to the project"; no-origin learning; no range = no call; **end to end = 3 searches** |
| view | search box: words, any column, any case; the nine columns in the user's order; every column and search key is a real row field |
| packet | every module in the shell and every tag exists; one `define` per file with the right id, no `require(`, no `DS/WAFData`; preferences declared; CSS scoped; no call to the removed `irsproject` endpoint |

Other suites, same run: all pass except `irstasks-detail`, which stops at the
stale `rest-jar/...ProjectContextReader.java` path - open since 2026-10-19,
unrelated.

## 2. Served copy

The Spring app serves the packet: all 9 files downloaded from
`https://localhost/WidgetPacket/IRSKeyLearnings/...` are byte-identical to the
source (SHA-256), so there is no stale copy (HANDOFF trap 1).

## 3. Live checks - open

K1-K10 in [README.md](README.md). Register the widget first:
`https://external.solize.com/WidgetPacket/IRSKeyLearnings/IRSKeyLearnings.html`
as an Additional App, then open it as the project manager (IPLT_USER65).
Watch the console for the first `/federated/search` response: it answers
api.md A1-A4 in one look.
