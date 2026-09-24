# WGT-01 - API

Tested 2026-09-23 against the dev VM through the ENOVIA API Labs MCP server
(profile `enovia-on-premise`, read-only GET calls). Spec
`ds-onprem-2024x-project-management-project-web-services-dsproject_v1.2`,
guide "About Project Web Services" (R2024x).

## 1. The call

```
GET <3DSpace>/resources/v1/modeler/projects
    ?$include=none
    &$fields=none,title,state,estimatedStartDate,estimatedFinishDate,EPMProjectNo
    &state=<list>                      (see §4)
    &tenant=<platform>&SecurityContext=ctx::<credential>   (added by the request wrapper)
```

"Get all users Projects" - the projects the current user can see.

## 2. What it returns (verified)

- **Our subtype comes back as-is:** `"type": "EPMAnalysisProject"`,
  `objType` in `dataelements` when members are included. The type label
  ("Analysis Project") is not returned - the widget maps the type name.
- **The EPM attributes are returned automatically** in `dataelements` with
  no extra parameter - all 12, including `EPMProjectNo`. Confirms the guide
  section "Custom Attributes": DMC (TXO) attributes are supported.
- Standard fields: `title`, `name`, `revision`, `description`, `state`,
  `originated`, `modified`, `policy`, `modifyAccess`, `deleteAccess`,
  `project` (collab space), `estimatedStartDate`, `estimatedFinishDate`,
  `dueDate`, `actualStartDate`, `actualFinishDate`, `percentComplete`,
  `estimatedDuration`, `projectVisibility`, `typeicon`, and more.
- `id` is the **physical id**; `relativePath` gives the detail URL
  `/resources/v1/modeler/projects/{id}`.
- **`$fields=none,<list>` trims the payload** to the listed fields (tested).
- `$include=none` suppresses the task tree. The default `level` is 0 =
  expand all tasks, so **always send `$include=none`** on the landing page.
- The response body carries a **`csrf` object** (`name: ENO_CSRF_TOKEN`,
  `value`) - the request wrapper can refresh its token from it (rule R5).
  Values are not recorded here.

## 3. Not available from this service

| Need | Finding | Options |
|---|---|---|
| Project manager name | `owner` / `originator` are **not** accepted in `$fields`; `$include=members` returns only Person ids (`type`, `id`, `relId`) - no name, no `Project Role` | (a) second call per member to a people service; (b) 6W search; (c) a small read-only service (Spring or 3DSpace) returning project + lead in one call. To decide - open item A1 |
| Department, Customer | relationships not yet built | columns empty for now |

`$include=members` also returns `subTypesInfo` and `subTypesAndPolicies`
(type / policy maps) - large; do not include on the list call.

## 4. State filter

The guide documents `state` ("comma delimited list of candidate Project
states", **default `!Closed`**) plus `owned`, `assigned`, `structured`,
`programId`, `level`. The OpenAPI spec does not declare them, so the API
Labs validator refused `state` ("Undocumented query parameter") and it could
**not be tested here**. The widget will send it directly; to verify in the
first widget test (open item A2):
- which states `!Closed` excludes;
- that `state=Complete,Archive` returns closed projects for the switch.

Fallback if `state` does not work: load all and filter in Tabulator.

### A2 answered - 2026-09-24: `state` **is** accepted

Observed in 3DDashboard on the first live run of the grid. The widget sends
`state=Create,Assign,Active,Review,Hold,Cancel` and shows a warning strip
whenever the call has to fall back to no `state` parameter
(`ProjectService.list()` -> `serverFiltered: false`). **No strip appeared** and
the rows arrived, so the service took the parameter. The widget keeps its local
filter as a safety net regardless - see design.md §5.

Still not measured: which states `!Closed` excludes, because we never rely on
the default. Not worth a session of its own.

### A4 (new, 2026-09-24): plain `Project Space` objects are returned too

The live grid listed three projects: `AP project` (`EPMAnalysisProject`),
`Reaseach Project` (`EPMResearchProject`) and `simple project`, an ordinary OOTB
**`Project Space`**. The service returns every project the user can see; it does
not know about our subtypes.

Nothing was changed - showing a project that exists is safer than silently
hiding it, and the Category column names the type. **To decide with the user:**
should the landing page list only `EPMAnalysisProject` / `EPMResearchProject`,
or everything? If only ours, filter on `type` in `ProjectService` (one line
against `ProjectFields.TYPE_LABELS`) rather than in the query - the service takes
no type parameter.

## 5. CSRF (rule R5)

Guide "Get CSRF Token" (R2024x, common principles):
- `GET /resources/v1/application/CSRF` -> `{ csrf: { name: "ENO_CSRF_TOKEN", value } }`
- needed for 6W and PnO web services whose verb is **PUT, PATCH, POST or DELETE**
- **valid for the whole Java session; invalid after a new 3DSpace login**
- sent as request header `ENO_CSRF_TOKEN: <value>`

So expiry in practice = the 3DSpace session was renewed. The wrapper:
1. fetches the token once at start;
2. updates it from any response that carries `csrf` (the project GET does);
3. on a write that fails with 403 / a CSRF error, fetches a new token and
   retries once; a second failure is shown to the user.

## 6. Open items

| # | Item |
|---|---|
| A1 | Project manager: pick option (a), (b) or (c) in §3 - **needed for the detail page only**; not shown on the landing page (user, 2026-09-23) |
| A2 | ~~Verify `state` from the widget~~ - **answered 2026-09-24: it is accepted.** See §4 |
| A4 | Should the list show only our EPM subtypes, or every project the user can see (today: every project)? See §4 |
| A3 | With only one project on the VM, paging and volume were not tested; create a few more test projects (OOTB widget) before the grid test |
