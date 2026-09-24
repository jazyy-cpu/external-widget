# WGT-04 - Design and code structure

| | |
|---|---|
| Built | 2026-09-24 (skeleton) |
| Requirement | [README.md](README.md) |

## 1. Modules (rule R4: one AMD module per file)

All under `static/WidgetPacket/IRSProjects/js/`.

| Module id | File | Job |
|---|---|---|
| `IRSProjects/config/ProjectForm` | `config/ProjectForm.js` | **the field catalogue**: every field of R&D-PRJ-01 in printed order, with where it lives and whether it exists yet |
| `IRSProjects/services/ProjectDetailService` | `services/ProjectDetailService.js` | read one project |
| `IRSProjects/components/ProjectHeader` | `components/ProjectHeader.js` | the form's header block + the Project No. control |
| `IRSProjects/components/Tabs` | `components/Tabs.js` | Bootstrap nav-tabs without Bootstrap's JS; panes build lazily |
| `IRSProjects/components/FieldList` | `components/FieldList.js` | renders fields, and says *why* one is empty |
| `IRSProjects/views/ProjectDetailView` | `views/ProjectDetailView.js` | header + tabs, and the page's load/error states |
| `IRSProjects/views/detail/OverviewTab` | `views/detail/OverviewTab.js` | the project information, in form order |
| `IRSProjects/views/detail/OrganisationTab` | `views/detail/OrganisationTab.js` | Department, Business Unit, Customer |
| `IRSProjects/views/detail/RisksTab` | `views/detail/RisksTab.js` | form XIII |
| `IRSProjects/views/detail/LessonsTab` | `views/detail/LessonsTab.js` | form XII |

`views/detail/` is where the four planned tabs go too - one file each, the same
shape: `render(pane, project)`.

## 2. The catalogue is the design

`ProjectForm.js` is the only place that knows what a project captures. Each row
carries a `kind`, and `kind` is what the page draws from:

| `kind` | Meaning | What the page shows |
|---|---|---|
| `attribute` | a created EPM attribute | the value, or *"Not filled in"* |
| `basic` | an OOTB field (`title`) | the value |
| `subtype` | carried by the type | "Carried by the project type, not by a field" |
| `todo` | agreed, **not created on the VM** | an amber note naming the missing attribute |
| `rel` | a relationship, not built yet | a link to the Organisation tab |
| `object` | its own OOTB objects | a link to the Risks tab |
| `wbs` / `route` | not a field at all | what it is instead |

This distinction is the point of the whole file. Four of R&D-PRJ-01's fields do
not exist on the platform, and an empty box beside a label would claim the
project simply has nothing recorded - which is a different and much more
comfortable statement than "we never built this field". The page makes the
difference visible.

Keep `ProjectForm.js` and **WP02 doc 05 §12** in step; doc 05 is the source of
truth and is verified against MQL.

## 3. Routing (WGT-02, now wired in)

`App.js` builds one `JazzySole/Router` and keeps it:

| Path | Page |
|---|---|
| `projects` | `ProjectListView` (the default) |
| `project/:id` | `ProjectDetailView` |

The router stores the open path in the hidden preference `jzRoute`, which the
platform keeps per user and per widget instance - so a browser refresh comes
back to the project that was open (rule R6). The preference is declared in the
shell like any other.

The `project/:id` handler **returns `view.ready`**, the promise of the detail
load. If the project cannot be opened - deleted, or invisible under the current
credential - the promise rejects, and the router drops the saved page and falls
back to the list rather than reopening a broken page on every refresh. That
behaviour is `Router._open`'s `restoring` branch, and this is the first page
that actually uses it.

Changing the credential calls `router.reload()`, because a different security
context may not see the open project at all.

## 4. The detail read

```
GET <3DSpace>/resources/v1/modeler/projects/{id}?$include=none
```

No `$fields`: WGT-01 api.md §2 recorded that every EPM attribute comes back in
`dataelements` automatically. The list call trims because it returns many rows;
here we want one object whole, and a `$fields` list would have to be kept in
step with the catalogue for no gain. `$include=none` is still mandatory - the
default expands the whole task tree.

The response envelope is accepted in three shapes (`data: [obj]`, `data: obj`,
or the bare object), because the single-object form was never observed and
betting on one would be a guess.

## 5. What is deliberately not built

| Not built | Why |
|---|---|
| Any write at all | the project write call has never been tested from the widget (open item B3), and nothing has been asked for yet beyond the number |
| Project number generation | the scheme (R20) has to come from IRS. Inventing `PRJ-2026-0001` would put provisional numbers on real projects |
| The risks grid | the call that returns a project's `Risk` objects is not known (B2) |
| Department / Customer pickers | the relationships do not exist, and when and how they are linked is still open (B5) |

Each of these is a tab or a control that **says what it is waiting for**, rather
than a blank area. That is deliberate: the skeleton has to be readable as a
plan, not look like a half-finished page.

## 6. CSS

None added. The page is Bootstrap `nav-tabs`, `badge`, `alert`, `border-bottom`
and flex utilities; the one scoped file from WGT-01 (`css/IRSProjects.css`) is
about the grid and is untouched.
