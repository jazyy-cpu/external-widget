# WGT-11 - API

## 1. The call

```http
POST <server root>/federated/search?tenant=OnPremise&SecurityContext=ctx::...
Content-Type: application/json

{ "query": "...", "select_predicate": [...], "start": 0, "nresults": 200,
  "order_field": "ds6w:label", "order_by": "asc", "source": ["3dspace"],
  "tenant": "OnPremise", "login": {"3dspace": {"SecurityContext": "ctx::..."}},
  "locale": "en", "with_indexing_date": false, "with_synthesis": false,
  "with_nls": false, "label": "IRSKeyLearnings" }
```

- The **server root**, not `/3dspace` (technical note 2026-09-26 section 6);
  `IndexSearch` derives it from the 3DSpace URL `JazzySole/Credentials`
  resolves.
- Payload shape from the JBM collection marked *"WORKING PAYLOAD VERIFIED"*
  (`D:\PROJECT DATA\13 JBM\...\3DSpace_Search_API_Test.postman_collection.json`),
  which also shows the `?tenant=` query string is accepted.
- Sent through `JazzySole/Request` (rule R3). It is a POST, so Request carries
  a CSRF token; the search does not need it.
- Security: the search applies the caller's SecurityContext.

## 2. What was proven on the VM (2026-10-25)

Read-only, on the index server's own API (`localhost:19010/search-api`,
inside the guest - port 19010 is not reachable from the host on this VM).

### The learning document - everything but the people

| Field (index name) | 6W predicate requested | LRN-0000003 |
|---|---|---|
| `name` / `ds6w_58_identifier` | `ds6w:identifier` | LRN-0000003 |
| `ds6w_58_label` | `ds6w:label` | Learing -XY |
| `irs_95_learning_95_text` | `ds6wg:IRS_LEARNING_TEXT` | 1. simaltion shoud be / 2. dont do theis activy (line break kept) |
| `ds6w_58_status` | `ds6w:status` | IRSLearning.Active |
| `ds6w_58_created` | `ds6w:created` | 2026-10-23T05:34:47Z (= 11:04 IST in the database) |
| `irs_95_learning_95_project` | `ds6wg:IRS_LEARNING_PROJECT` | OSCP -Project |
| `irs_95_learning_95_project_95_no` | `ds6wg:IRS_LEARNING_PROJECT_NO` | R&D-26002-HY |
| `irs_95_learning_95_project_95_id` | `ds6wg:IRS_LEARNING_PROJECT_ID` | 39261.35329.54110.44402 (legacy id) |

### The date range

| Query | Hits |
|---|---|
| `flattenedtaxonomies:"types/IRSLearning"` | 3 |
| `... AND originated>=2026/10/19 AND originated<2026/10/24` | LRN-0000003 |
| `... AND originated>=2026/10/18 AND originated<2026/10/19` | LRN-0000001, -0000002 |
| `... AND originated>=2026/11/01` | 0 |
| `... AND originated>="2026/10/18 17:49:00" AND originated<"2026/10/18 17:50:00"` | LRN-0000001 only - **to the second** |
| `... AND ds6w:created>=2026-10-19` | **500** - the 6W name cannot be compared; use the native `originated` |

`originated` is stored in **UTC**, hence design decision W3.

### The project document - manager and members

`mxid:(39261.35329.54110.44402 OR 39261.35329.22965.46745)` -> both projects in
one query, each with:

| Field | OSCP -Project |
|---|---|
| `ds6w:responsible` | Sharad S Dhavalikar (the owner's full name) |
| `ds6w:responsibleuid` / `owner` | IPLT_USER65 |
| `ds6wg:epmprojectno` | R&D-26002-HY |
| `ownership` | `-\|IPLT_User29_PRJ\|Multiple Ownership For Object`, ... 5 entries |

`ownership` against `print bus ... select from[Member].to.name`: OSCP 5 of 5,
ANA PRJ 01 8 of 8 - **identical**.

### Persons

`flattenedtaxonomies:"types/Person" AND name:(IPLT_User12 OR IPLT_User29 OR TIVOLT_User6)`
-> 3 hits with `ds6wg:fullname` (Rakesh Kumar Sah, Ram Kumar Joga, Sachin S Awasare).

## 3. Not proven - the first live run answers these

| # | Question | If it is wrong |
|---|---|---|
| A1 | Does `/federated/search` return the `ds6wg:IRS_LEARNING_*` predicates by these names? The index has them, WP08 search columns use these names | change the names in `LearningFields.LEARNING_PREDICATES`; the parser is already case-insensitive |
| A2 | Does it return the native `ownership` and `mxid` when asked in `select_predicate`? | members would come back empty: fall back to `GET /modeler/projects/{id}?$include=members` per project + a person lookup by id |
| A3 | Does it accept the native `originated>="..."` comparison in `query`, as the index API does? | the date range would fail with an error on screen - nothing silent |
| A4 | The name of the total in `infos` (`nmatches` / `nhits` / `nresults`) | only the truncation warning's number is affected |

## 4. Limits worth knowing

- **The index is a copy.** A learning or a project change reaches the register
  when the index re-crawls it. A project renamed a minute ago may still show its
  old name.
- `ownership` is Program Central's grant of member access. If a future
  customisation adds `_PRJ` multiple-ownership entries for anything other than
  membership, they would read as members.
- API Labs could not be used for the project service checks: its account can
  read no project (`#DENIED!`, empty project list). That account is the test
  case for K10.

## Update 2026-10-25 - answers from the first dashboard run

| # | Answer |
|---|---|
| A1 | **Partly yes.** `ds6wg:IRS_LEARNING_*` came back by these names (title, text, project filled). The 6W when / what / who fields did **not** come back by their short names - federated search names them by path (`ds6w:when/ds6w:created`, `ds6w:what/ds6w:status`, `ds6w:who/ds6w:responsible`). Both forms are now requested and read |
| A2 | **Yes** - `ownership` and `mxid` are returned: the members column filled |
| A3 | **Yes** - the native `originated>="..."` range was accepted: rows arrived |
| A4 | still open - only the truncation warning uses it |