# 2026-10-08-01 - The proposal form: where all 23 rows come from, and Bootstrap only

| | |
|---|---|
| Requirement | WGT-07 (task page), WGT-04 (project detail, question B2) |
| Status | **done** - sections XII and XIII now render live data; all nine suites pass |
| Depends on | the REST JAR deployed 2026-10-08 (worklog `2026-10-07-04`) |

## Why this entry exists

The JAR went live and the user asked two things: *"explain me the items that we
will cover line by line and how we will get this information in our widget"*,
and *"regarding look and feel what approach we can take - bootstrap form and
table, or tabulator excel look and feel"*.

## The 23 rows, and their four sources

| # | § | Item | Source |
|---|---|---|---|
| 1 | Header | Project Name | project `title`, **falling back to `name`** |
| 2 | Header | Project No. | project `EPMProjectNo` |
| 3 | Header | Department | **none** - the `IRSDepartmentProject` link, no call yet |
| 4 | I | Project Category | **derived** - the project's own subtype, under its `typeNLS` name |
| 5 | II | Customer Name and Contact | **none** - the OOTB `Company` object |
| 6-14 | III-XI | Need, Overview, Scope, Input, Methodology, Complexity, Standards, Feedback, Consequences | project attributes, nine of them |
| 15 | XII | **Lessons learnt from failures** | **service** - the `IRSLearning` objects |
| 16 | XIII | **Risks and opportunities** | **service** - the `Risk` / `Opportunity` objects |
| 17-18 | XIV-XV | Stage-validation, Deliverables | project attributes |
| 19 | XVI | Project Planning | **none** - the WBS. Closest of the remaining four: the task-list call already returns tasks per project |
| 20 | Footer | Screening Committee approval | **pending** - `EPMScreeningApprovalObtained` not created in DMC |
| 21-23 | Footer | PM / HOD / Divisional Head | **none** - collected by the approval route when the approver acts, never typed |

Fourteen rows are project attributes, one is derived, **two are service-backed**,
six are not available. So **17 of 23 render today**.

### Two rows changed meaning, and one of them was stale

`XII` was marked `display: "pending"` against `EPMLessonsLearnt`. That attribute
was **cancelled** - WP02 doc 08 says of it *"and must not be"*, because the
`IRSLearning` object replaced it. The row had been left waiting for something
that is never going to be created. It now reads the learnings from the JAR, and
a test forbids any row from naming `EPMLessonsLearnt` again.

`XIII` was `source: "none"` with a note explaining that the objects exist but
the call was unknown. The call now exists. That also closes **WGT-04 question
B2**, open since 2026-09-24.

### A new source kind, and a fallback

**`derived`** reads the project *object* rather than its `dataelements`. Only
section I uses it: "Research or Analysis" is answered by the subtype itself,
and `typeLabel` already holds the platform's display name, so no call and no
attribute is needed.

**`fallbackField`** was added for Project Name. `title` is **empty on every
project measured** - TEST PROJECT and Solize XYZ both - while `name` is filled.
Printing a dash on the first line of a controlled form reads as missing data
rather than as an unused field, so the row shows `name` and records
`usedFallback`.

## The layout decision: Bootstrap only

I recommended Bootstrap for the form with Tabulator confined to the four row
blocks. **The user chose Bootstrap only:**

> *"i think lets use only bootstrap then, because bootstrap also have table
> elements, and this will keep uniformity across the form, so only we will use
> bootstrap then"*

That is the better call, and not only for uniformity:

| | |
|---|---|
| Shape | sixteen of the sections are a heading and a paragraph of prose. A grid forces them into fixed-height cells, which is the wrong shape for the content and nothing like the paper form the approver signs |
| Print | doc 02's own open item **E2** already concluded that a per-person form must print through `printAsHtml` or jsPDF, *"not the raw grid"*. So Tabulator would not have earned its place on the output that matters most |
| Signal | an Excel-like grid says "editable spreadsheet" on a document that is a controlled approval record, read-only unless the task is In Work |
| Risk | Tabulator needs the UMD `define.amd` workaround. Keeping it off this page entirely means one less thing that can take the form down |

So the two object sections are `table table-sm table-bordered align-middle`
inside the same card as everything else, and the page loads no grid library at
all.

## How it is wired

`ProjectContextService` calls
`resources/v1/irsproject/projects/{id}/context` through the usual `Request`
wrapper - tenant and SecurityContext come along, and the JAX-RS resource
ignores them.

The call is made **only when the form definition asks for it**: the view reads
the spec first (a local JSON file, so there is nothing worth parallelising) and
calls the JAR only if some row has `source: "service"`. The other three
subtypes have none, so they will cost nothing.

**A failure never reaches the page.** The call's rejection is turned into an
empty context carrying the reason, and the two sections print that reason where
their tables would have been. The other twenty-one rows still render. The same
rule applies inside the payload: the JAR reports `riskError` and
`learnings.error` per section, and those are carried through verbatim, because
"no risks are linked" and "the risks could not be read" must never look alike on
an approval form.

## One case the live data taught us

Solize XYZ reuses LRN-0000002 and LRN-0000006, and **both come back with an
empty `originProject`**. That is not a defect: WP02 doc 08 records that a
learning may exist with no origin, because `R&D-PRJ-01` XII can cite work that
predates the system. The Source column says **"Source not recorded"** rather
than leaving the cell blank, since a blank cell on this form reads as a fault.

That case is now pinned by a test against the real captured response
(`As-Is  Understanding/manual logs/data-2026108838.json`), which is the only
reason it was noticed before it reached a screen.

## Tests

`src/test/js/irstasks-detail.test.js` grew a sixth section covering the new
service against the **live** capture: the risk and opportunity rows, the
physical id being the one the table links with, the three learnings in origin-
first order, the "Source not recorded" case, the cited-origin label
`Solize XYZ (R&D-26010-HY)`, a failed section staying distinguishable from an
empty one, and an empty body not throwing.

Also added: the `derived` resolver with and without a project, the Project Name
fallback, and a `service` row never being reported as missing data. The
fixture's project was changed to `title: ''` so it matches what the platform
actually returns.

All nine suites pass.

## What is left on this form

| | |
|---|---|
| XVI Project Planning | the nearest of the four unavailable rows - the task list already returns tasks per project |
| Header Department, II Customer | need the `IRSDepartmentProject` and `Company` links |
| Footer screening approval | needs `EPMScreeningApprovalObtained` created in DMC |
| The three signatures | the approval route, G6/G7 work |
| Editing | still nothing writes. In Work only, through the JAR |

## Update 2026-10-08 - the form definition 404'd, and O-T2 is the reason

The page went to the dashboard for its own configuration file:

```
GET https://<server>/3ddashboard/api/widget/js/data/forms/project-proposal.json
404 Not Found
```

`ConfigService`'s own open item **O-T2** had called this exactly, including the
fix. Worth recording why the wrong half of its reasoning was wrong: the note
argued that because the module `<script>` tags load from a relative path, XHR
should too. It does not follow. **UWA rewrites the markup's `src` and `href`
attributes** to absolute URLs on the widget's real host - that is why the
scripts load - and it cannot rewrite a URL assembled inside JavaScript. So the
relative XHR path resolved against the *proxied document* and asked the
dashboard for a file only the widget's host has.

### The fix: three steps, in this order

| | |
|---|---|
| 1 | `widget.getSettings().baseUrl` - UWA's own answer, right by construction, and what O-T2 prescribed. Only inside a live widget runtime |
| 2 | the `src` of a script that demonstrably loaded - an already-resolved absolute URL, so whatever host served it works. Covers a plain browser tab |
| 3 | the relative path, as before - degraded, but the widget starts and only the config file fails |

Step 1 is first deliberately: if the dashboard ever serves the module scripts
*through* the proxy rather than rewriting them, step 2 would derive the proxy's
own base and reproduce this very 404.

The failure message now carries the URL. The old one gave only the status,
which is why a wrong-host bug looked like a missing file.

### Scope

`ConfigService` is the only place in either widget that builds a URL by hand -
everything else goes through `JazzySole/Request`, which resolves against the
3DSpace root. `IRSProjects` has no `ConfigService` and no raw `XMLHttpRequest`,
so nothing else needed changing.

### Tests

A seventh suite section, with a stubbed `document` and `widget`: UWA `baseUrl`
beating a script `src` that points at the dashboard proxy, a trailing slash not
doubling, `currentScript` null falling through to the scan, a cache-buster query
not confusing the path cut, **no `document` at all** not throwing at load, and
the error message naming the URL.
