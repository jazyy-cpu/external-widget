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

## Update 2026-10-08 (2) - the form is scrollable, and Project Name is `name`

### Scrolling

The form is 23 sections tall, the widget body has no height of its own, and a
widget has no page behind it to scroll - so the dashboard simply clipped it.
The user could see as far as section IV.

The fix is a scrolling region, `.irs-scroll`, around the form:

| | |
|---|---|
| CSS | `max-height: calc(100vh - 220px)` + `overflow-y: auto`. The **fallback** - it holds for the first paint and on any host where the measurement cannot run. 220px is deliberately generous: a region slightly too short scrolls, one too tall clips again |
| JS | `TaskDetailView.fit()` measures what is actually left - `window.innerHeight - content.getBoundingClientRect().top - 8` - and sets `maxHeight`. It runs after each render and from `redraw`, which `App` already calls on resize |

Measured rather than a fixed `calc()`, because the toolbar, the credential bar
and any warning banner above the form all take space, and the number is wrong
the moment one of them wraps or a warning appears. Below 120px of available
height nothing is set: the widget is collapsed or hidden, and a scrollbar
around nothing is worse than none.

`overflow-x` is `hidden` on purpose. A horizontal bar here would mean the form
is too wide, which is a layout fault to fix rather than to scroll around.

Bootstrap has `overflow-auto` but nothing that says "as tall as the viewport
allows", which is the whole requirement - so this is custom CSS under the one
root class, with the reason recorded (rule R1).

### Project Name reads `name`

> *"this version 24x there is possibly of only adding the name, so project name
> will be mapped to name of project"* - user, 2026-10-08

So `name` is **the field**, not a fallback for an empty `Title`, and the note
says so. `fallbackField: "title"` stays, costing nothing, in case a project is
ever given one.

The `fallbackField` mechanism keeps its tests - one case where an empty primary
falls through, and one where a filled primary does **not** consult the
fallback.

### Still wrong on screen: Project Category

It prints the raw `EPMResearchProject` instead of a display name. Cause: the
project call sends `$include=none` and **no `$fields`**, so no `typeNLS` comes
back and `toProject` falls through to the raw type. The display name is an NLS
resource, not an MQL property - confirmed on the VM, where the type object
carries only its name and its parent `EPMRandD`.

The fix is to ask for it - `$fields=basics,typeNLS` on the project call, with
the same retry-without-parameters insurance the task call already has, since
that resource's tolerance of `$fields` is unproven. **Deferred to the next
change**, at the user's sequencing.

## Update 2026-10-08 (3) - `$include`, the two learning groups, and the type scale

Three changes on the user's instruction.

### 1. `$include` on our own service

```http
GET /resources/v1/irsproject/projects/{id}/context?$include=risks,learnings.reused
```

| Section | |
|---|---|
| `risks`, `opportunities` | one relationship carries both, so the call is made when **either** is asked for and skipped only when neither is |
| `learnings` | both groups |
| `learnings.created`, `learnings.reused` | the halves - separate relationships, **separate round trips**, so asking for one does not pay for the other |

Omitting the parameter means everything, which is what the first version did -
so a caller written before it existed is unaffected, and the widget's new
parameter is harmless against the JAR already deployed.

Two decisions worth keeping:

- **A section not asked for is absent from the response**, not present and
  empty. The caller can then tell "I did not ask" from "there are none" - the
  same distinction the per-section error fields keep. The response carries its
  own `included` array so it is self-describing.
- **An unknown section is a 400**, naming the offender and listing the valid
  ones. A silently ignored typo would look exactly like a project with no
  risks, which is the worst possible failure for this screen.

The project header is always read. It is one round trip and it is what makes a
response identifiable; a caller asking only for risks pays two round trips
rather than one, which is the right trade for not serving an anonymous list.

Proven at JPO cost before any redeploy - `exec program IRSProjectContext
<id> risks`, `... learnings.reused`, and `... nonsense` for the rejection.

### 2. The two learning groups answer two different forms

> *"for learning we have different requirement: in current form we want to show
> the old learning, and in next upcoming form we want to show the new
> learning"* - user, 2026-10-08

So the form definition says which group it wants, with `learningScope`:

| Form | Scope | Shows |
|---|---|---|
| `R&D-PRJ-01` XII (proposal) | `reused` | lessons cited from **earlier** projects, with the project each came from |
| `R&D-COM` (closure, not built) | `created` | what **this** project produced |
| anything else | omitted | both |

This is the object model doing what doc 08 designed it for: one `IRSLearning`
seen from two ends, the proposal consuming and the closure producing.

The **Source column is dropped on the `created` list** - every row there would
read "This project", which is a column of noise - and renamed **"From project"**
on the reused list, where it is the point of the section. The empty-state
sentence differs per scope too: "No learning from an earlier project has been
cited yet" says something quite different from "This project has not recorded a
key learning yet".

### 3. The type scale

> *"the elements are very small as of now, lets make them lil big, its looking
> small in comparison to our main table"*

Two causes, only one of them CSS. Several blocks carried Bootstrap's `small`
(0.875em of an already reduced body) - the prose box among them, which is most
of what the form shows. Those classes are gone.

Then a scale under `.irs-form`: body and labels **15px**, tables **14px**,
field notes **12.5px**. The grid stays at 13px, deliberately, to match the
density of the OOTB grids beside it; a form is *read* rather than scanned, so
it sits one step up. The notes stay smallest because they are guidance about a
field, not its content, and must not compete with the value above them.

### Two faults in our own tooling, found doing this

**`guestfs.ps1 upload` reports `OK` when the copy failed.** It printed
`OK upload` for the JAR into `WEB-INF\lib` while `Copy-Item` had thrown "being
used by another process", and it did the same earlier when the destination
folder did not exist. The live JAR was verified by hash afterwards and is
**unchanged** - but a deployment that says OK and did nothing is a bad failure
mode. Worth fixing in the agent bundle.

**A test depended on a scratch log.** Section 6 read the captured response from
`As-Is  Understanding/manual logs/`, which the user prunes - and it broke the
same day. The capture now lives in the test tree as
`src/test/js/fixtures/project-context-solize.json`, a committed fixture. A test
may not depend on a file somebody else is expected to delete.

Also fixed: section 8 was replacing `Request.get` while section 5's promise
chain was still pending, so section 5 counted section 8's calls. It now loads
its own module instance with its own fake. Sections of a suite must not share
mutable state.

## Update 2026-10-08 (4) - the NLS field is `nlsType`, not `typeNLS`

Found by driving the user's own browser: reading the console of the live
widget, then watching what the **OOTB Project Gantt** asks for.

### The bug

We had been sending `$fields=basics,typeNLS,stateNLS` since 2026-10-07. There
is no field called `typeNLS`. The platform ignored it, returned nothing extra,
and our fallback label fired every single time - which the console stated
plainly once we could read it:

```
Task Type shows "PROJECT PROPOSAL / PROFILE", from TaskFields fallback
```

The right name is **`nlsType`**. Proved live against both resources:

```
tasks/{id}?$fields=basics,nlsType   -> "nlsType": "PROJECT PROPOSAL / PROFILE"
projects/{id}?$fields=nlsType       -> "nlsType": "Research Project"
```

**Both spellings are real, which is exactly what hid it:**

| | |
|---|---|
| `nlsType` | the **requestable field** - what goes in `$fields` |
| `typeNLS` / `stateNLS` | the **key names emitted on RELATED objects** |

We read `typeNLS` off a captured *related* project in `ABCLogs`, and reused that
key as a *request* name. The capture was right; the inference from it was not.
A correction to what this devlog said earlier: the task resource does serve the
display name - we were asking for the wrong thing.

Both are now read (`nlsType` first, then `typeNLS`), so either response shape
works, and a test pins each.

### `nlsState` does not exist

Tested. A task's own state display name is not served as a field, so
`Fields.stateLabel` stays in charge of "In Work" and the rest until the
definition dictionary is read.

### Verified live

Console after the fix:

```
Task Type shows "PROJECT PROPOSAL / PROFILE", from the platform (nlsType)
task:    dataelements keys = ..., nlsType, ...
project: dataelements keys = ..., nlsType, ...
```

and **Project Category now renders "Research Project"** instead of the raw
`EPMResearchProject`, on screen.

One risk that did not materialise: adding `$fields=nlsType` to the project call
could have narrowed the response and dropped the EPM attributes the form needs.
`nlsType` **alone** is the spelling that was proved on that resource - it adds
the field and still returns everything - and the key list above confirms all 25
EPM attributes still arrive. `basics,nlsType` was not tested there and is not
used.

### The bigger find, not yet taken: `$definition=true`

The OOTB Gantt sends it. It returns the platform's whole dictionary for the
object:

| | |
|---|---|
| type display names | `EPMResearchProject` -> Research Project |
| **our four task types** | `EPMPROJECT_PROPOSAL` -> PROJECT PROPOSAL / PROFILE, and the other three |
| state labels **per policy** | Project Task: `Active` -> **In Work**, `Create` -> Draft, `Review` -> In Approval |
| **every attribute label** | `EPMNeedOfTheProject` -> "Need of the Project" |
| ranges | `External_Projects` -> External Project |
| `viewConfig` | field type, multiline, default, and `editable: false` |

So `TaskFields.TASK_TYPES`, `STATE_LABELS`, the form's labels and the JAR's
`projectTypeLabel()` all duplicate data the platform already serves. The catch
is size: ~357 KB, nearly all of it the currency list, so it is a fetch-once-and
-cache job rather than a per-page call.

**Not done**, deliberately - it is a design change (where the dictionary lives,
whether the form JSON keeps its labels as fallback) and the user asked for the
NLS fix first.

## Update 2026-10-08 (5) - the Summary Report look

The user showed a screenshot of the platform's own `CA-98456-00000715: Summary
Report` page and asked for that: *"the look and feel is lil off ... i want some
fields to come on side by side ... remove all the other infor lines, now lets
have clean form"*.

Three changes, all presentation. No field, no source and no call changed.

**Short values pair off.** A run of short fields collects into one Bootstrap
`row`, each pair a `col-md-6` holding a bold label and its value. The pairing
follows the form's own order rather than a fixed split, so `Project Name` and
`Project No.` share a line because they are next to each other on the paper
form. The full-width sections - prose, the two tables and the customer block -
end the run and start a new one after it.

**The long sections keep the full width**, under a ruled heading that carries
the printed numeral (`III. Need of the Project`). `Header` and `Footer` are our
grouping words, not anything printed on R&D-PRJ-01, so they no longer appear.

**The notes are gone from the page.** They stay in `project-proposal.json`,
which is where they were always the useful thing to read; on screen they were a
line of guidance under all 23 rows, telling an approver about the form instead
of showing them the project. Two other lines went with them: the "N field(s)
were not returned" banner, and the red sentence under each such row - a missing
field now says `not returned` in its own value cell, which is the same fact in
two words instead of two lines. The customer's External/Internal badge went
too: `Customer` and `Project Type` are already rows of the block one line below
it.

The customer block is now the same label-and-value pairs as the header, which
is what *"based the customer form"* asked for. Its Field / Value table was a
table drawn around two columns that are not data.

**Custom CSS.** Six rules, all inside `.irs-form`. Bootstrap's nearest
component is `dl.row`, and it gives a label column and nothing else: no rule
between rows, its own margins, and a label that wraps to full width instead of
holding a column. A report's attribute block is a specific dense thing, and
these rules are it. The `.form-text` rule was deleted - nothing carries that
class any more.

**Tested.** The suite had stopped at the resolver and tested no DOM at all.
Section 11 of `irstasks-detail.test.js` renders the whole form against a stub
`document` and asserts what the change is actually about: Project Name and
Project No. land adjacent in one grid, every pair is `col-md-6`, the prose
sections get a numbered ruled heading, our grouping words never reach the page,
and **no note from the spec appears anywhere in the rendered text**. All nine
suites pass.

## Update 2026-10-08 (6) - the tables align, and five rows are parked

Two corrections to Update (5), from screenshots.

**The tables did not line up.** Under section XIII the Risks table and the
Opportunities table sat one above the other with their columns in different
places, and `No.` had taken roughly a third of the row for a value that is
never longer than about twelve characters (user: *"the risk no will never be
more then 10 or 12 so align the tables it is not looking good"*).

Cause: the browser's automatic table layout sizes each column from **its own
table's** contents, so two tables with different data never agree. `table()`
now takes a `width` per column and the CSS sets `table-layout: fixed`, which is
what makes a declared width binding. Both tables pass the same three widths -
`No.` 10rem, Title the remainder, State 9rem - so they come out identical. The
learnings table is sized the same way.

**Five rows are parked.** The footer rows all showed a label and a dash: XVI
Project Planning, the screening-approval attribute, and the three signatures.
The user asked for them off the page *"just comment the code later when
required we will show them"*.

JSON has no comment syntax, and deleting the rows would throw away the field
names, the notes and the printed section numbers that took a day of MQL to
establish. So the rows carry `"hidden": true` instead, and the view drops them
before anything else happens - they are not resolved, not drawn, and their
`$include` section is not fetched. Deleting that one line brings a row back.

The five are exactly the rows that have no value to show yet, which the test
now asserts rather than trusting: each hidden row must be `source: "none"` or
`display: "pending"`, must keep its note, and the file must still hold all 23.

Section 11 also gained the alignment case: the two tables must declare equal
widths, and `No.` must be the narrow one. All nine suites pass.

## Update 2026-10-08 (7) - deliverables and attachments, in a side panel

The user asked for the task's deliverables and attachments on the page,
downloadable, *"used very frequently"*, and chose a side panel with the two
headed separately and one collapse/expand control.

### What the platform actually keeps

Measured live on **T-85756263-0000137**, which the user had just loaded with one
of each (MCP federated search for the id, then the task GET):

| On screen | `relateddata` key | Object |
|---|---|---|
| Deliverable | `deliverables` | `DOC-85756263-0000021` "config.toml", `.toml`, `hasfiles: TRUE` |
| Attachment | `references` | `DOC-85756263-0000019` "JIWAN TEST", `.pdf`, `hasfiles: TRUE` |

So **`references` is the attachments slot.** It was empty on all 65 tasks of the
October capture, which made it look unused - it was simply that nothing had been
attached yet. `contents` and `scopes` are populated on route tasks but point
back at the task being approved, not at files.

Both are plain `Document` objects with the same JSON, so one shaper serves both
and `kind` records which relationship it came from.

**The panel costs no round trip.** The task call already sent
`$include=assignees,deliverables`; adding `references` brings both lists in the
response the page already has. `TaskDetailService` had been keeping
`deliverables[0]` and discarding the rest since the sidebar was built - the data
was there all along.

### Downloading is two steps

There is no URL that serves the file. 3DSpace issues an FCS ticket:

    PUT resources/v1/modeler/documents/{docId}/files/DownloadTicket
      -> data[0].dataelements.ticketURL / fileName

then the browser fetches `ticketURL` on the FCS host. The response keys came
from the vendor OpenAPI document (`200-DownloadTicket` -> `x-schemas/
DownloadTicket`) - the Markdown guide lists the endpoints but never prints the
response, so reading the schema was the only way not to guess.

It is a **PUT**, so the CSRF token is mandatory even though nothing is written.
`JazzySole/Request.send` already holds the token, sends it on write methods and
refetches once on a token failure (R5), which is why `DocumentService` calls it
rather than `fetch`.

Two decisions worth recording:

- **the ticket is fetched on the click**, never while drawing the panel. It is
  single-use and short-lived, so pre-fetching would issue tickets that mostly
  expire unused and turn one page open into one PUT per document;
- **the whole-document form** (`.../files/DownloadTicket`) is used rather than
  the per-file one. The task response says a document HAS files but not their
  ids, so the per-file form would need a second call to find out, and these
  documents hold one file each.

### The panel

`TaskDocumentsPanel` - sticky, inside `.irs-scroll` so the page still has one
scrollbar, with the whole card header acting as the toggle (a 12px caret is a
target people miss). The count badge stays visible while collapsed: a collapsed
panel that says nothing has to be opened just to find out whether it was worth
opening.

Layout is `col-xl-8` / `col-xl-4`, not `lg`: the form's prose needs room, and
below xl the two stack with the panel taking `order-1` so it lands **above** the
form rather than under three screens of it.

The collapse state is a module variable - it follows the user between tasks in a
session, and a reload returns to open, because open is the frequent case.

A document with `hasfiles: FALSE` gets no button and says `no file` instead.
That is not an edge case here: every deliverable in the October capture was one.

### Tested

Section 12 of `irstasks-detail.test.js` covers the shaping from the live
response shape, the `$include`, the ticket parsing and its two rejections, and
the panel's DOM - two groups never merged, buttons only where there is a file,
counts kept while collapsed. The section builds its own `Request` fake and its
own module instance rather than reusing the shared one, because earlier sections
still have promise chains in flight against it - the bug that bit section 8.

All nine suites pass.

## Update 2026-10-08 (8) - the CSS audit: 26 rules down to 4

The user asked that we use Bootstrap out of the box with very little CSS. Both
the Summary Report layout (Update 5) and the documents panel (Update 7) had
been written with a block of hand-made rules, so they were audited against the
**bundled** `bootstrap.min.css` rather than from memory.

Bootstrap here is **5.3.8, CSS only - its JavaScript is not loaded by this
widget at all.** That settles two questions: the accordion / collapse component
is unavailable, so the panel keeps its own toggle; and every utility below was
confirmed present in the bundled file before being used.

Replaced:

| Was hand-written | Is now |
|---|---|
| `.irs-kv`, `.irs-kv-label`, `.irs-kv-value` | a nested `row` with `col-5` / `col-7`, `border-bottom`, `px-2 py-1`, `text-break` |
| `.irs-kv-grid` | `border-top` |
| `.irs-sum-head`, `.irs-sum-sub`, `.irs-sum-text` | `border-bottom pb-1 mb-2 mt-3 fw-semibold text-primary-emphasis`, `px-2` |
| `.irs-sum-table > thead/tbody` rules | the default `.table`, which already rules every row |
| `.irs-docs-sticky` | `sticky-top` |
| `.irs-docs-toggle` + its hover and focus rules | `btn btn-light w-100 text-start border-0 rounded-0 d-flex align-items-center gap-2` - `btn-light` brings Bootstrap's own hover and focus ring |
| `.irs-docs-header` | `p-0` |
| `.irs-doc-count` | `badge rounded-pill text-bg-light border` |
| `.irs-doc`, `.irs-doc-head`, `.irs-doc-group` | `d-flex align-items-center gap-2 py-1 border-bottom`, `mt-3` |
| `.irs-doc-title`, `.irs-doc-meta` | `fw-medium text-truncate`, `small text-secondary text-truncate` |
| `.irs-doc-nofile`, `.irs-doc-empty` | `small fst-italic text-secondary flex-shrink-0` |
| `.irs-doc-btn` | `d-inline-flex align-items-center flex-shrink-0` |

Kept, four rules, each because 5.3.8 has no utility for it:

- **`table-layout: fixed`** - `w-25`/`w-50` exist but are only suggestions under
  automatic layout, which is the bug Update (6) fixed;
- **`min-width: 0`** - there is **no `min-w-0` class in 5.3.8** (checked against
  the bundled file). Without it a flex item will not shrink below its content,
  so `text-truncate` never truncates and the download button is pushed out of
  the panel;
- **`font-size: 14px`** on the panel - the widget's density scale, the reason
  this stylesheet exists at all;
- **`max-height`** on the panel body - `overflow-auto` is Bootstrap's, a
  viewport-relative max-height is not, and without it a task with fifteen
  attachments makes the panel taller than the screen and `sticky-top` stops
  working.

Two things were dropped rather than reimplemented: the vertical rule between
the two columns of pairs (Bootstrap 5 has no responsive border utilities, and
the horizontal hairlines carry the structure on their own) and the panel
header's ENOVIA-blue band (`btn-light` is close enough not to be worth a rule).

**Guarded.** Section 13 of `irstasks-detail.test.js` reads the stylesheet and
fails if any of the eighteen replaced selectors reappears, asserts the four
survivors are still there, and checks the two view files actually use
`sticky-top`, `col-5`, `badge rounded-pill`, `text-truncate` and `btn-light` -
so the rules are provably replaced rather than merely deleted.

All nine suites pass.

## Update 2026-10-08 (9) - the second download, and multi-file documents

The user reported that the first download worked and the second *"is not
opening"*, and asked that multi-file documents behave as OOTB does.

### The platform was never at fault

Checked both tickets directly against FCS before touching any code:

| Document | Ticket | FCS reply |
|---|---|---|
| `config.toml` (deliverable) | 200 | `attachment`, 231 bytes |
| `R&D-26003-RR_Project Verification Form.pdf` (attachment) | 200 | `attachment`, 194 335 bytes |

Both correct, both the same `/internal/servlet/fcs/checkout` form. The file
listing (`GET /documents/{id}/files`) confirmed one file each - so this was
never the multi-file case either.

**The fault was `window.open`.** FCS answers `Content-Disposition: attachment`,
so the browser downloads and discards the tab - usually. Measured here: the
231-byte `.toml` downloaded and its tab vanished; the 194 KB PDF left a tab
**sitting on a Chrome error page**. An FCS ticket is also single-use, so any
tab that survives and is later reloaded hits a consumed ticket and errors. A
tab is simply the wrong instrument for something that is not a page.

### What OOTB does, measured

Opened the platform's own Document Management widget (the dashboard's
`document` tab) and watched it download a document holding **four** files:

    PUT .../documents/{docId}/files/DownloadTicket
        ?useDOCMParamSettings=true&useObjectNameForZip=true&lightweight=false

- **the same endpoint we use**, plus three parameters;
- **no tab opens at all.** After the download nothing matching `fcs` is left
  anywhere in its DOM - it creates an element, clicks it, removes it;
- it then shows a toast: *"'multiple documet' download has been started."*

Its list also carries a **`Files` count** column, which is where the four-file
document was visible in the first place.

### The fix

`DocumentService` now sends those three parameters and hands the file over by
clicking a detached, hidden `<a>` and removing it immediately. No tab, no popup
blocker, no dangling error tab, and nothing left in the page pointing at a
single-use ticket. `rel="noopener noreferrer"` stays, because `download` is
ignored cross-origin and the FCS origin must never get a handle on the
dashboard window.

**Multiple files are left to the server, deliberately.** `useDOCMParamSettings`
is what applies the Document Management zipping rule and `useObjectNameForZip`
names the zip after the object. The alternative - listing files and zipping
decisions in the client - costs one extra call per document and would
re-implement a platform rule that could then drift from it. The response says
which happened: `fileName` for one file, `fileNames` for several, and
`DocumentService` reports `zipped` from that.

### Verified live

Reloaded the widget, clicked both buttons in sequence:

    [IRSTasks] download: config.toml -> config.toml
    [IRSTasks] download: JIWAN TEST -> R&D-26003-RR_Project Verification Form.pdf

Both fired, **no tab opened**, no error shown in the panel.

### Tested

Section 12 gained the case that would have caught this: a stub `document` and
`window`, asserting `window.open` is called **zero** times, that the anchor is
created, clicked, and removed from the body, and that it carries
`rel="noopener noreferrer"`. Plus the OOTB parameter set, and a multi-file
ticket response resolving to `zipped: true`.

All nine suites pass.

### Two OOTB behaviours we do NOT have

Recorded rather than quietly skipped:

- **no "download has been started" toast.** The file simply downloads. Worth
  adding through `JazzySole/Notify`.
- **no `Files` count** in the panel. The task response carries `hasfiles` as a
  boolean only; a count needs `GET /documents/{id}/files` per document, which
  is one call per row - against the one-round-trip rule for a page that may
  show several. Only the ticket response reveals it today, after the click.


## Update 2026-10-08 (10) - the route, and the inbox tasks on it

> *"task can have route ... route have inbox task ... we need to understand how
> we will get route from task, then we need to make api to get the ... so
> wherever our task is going in approval the inbox task will come ... in the
> context we need to check whether the task is connected to our custom task ...
> take the reference our poc widget, there we will find some similar logic"*

### How a task reaches its route - it already carries it

    task.relateddata.route[]  ->  route physical id
    GET resources/v1/modeler/dsrt/routes/{routeId}?$include=tasks

`route` is `relateddata` of the task, exactly like `deliverables` and
`references`. So **finding the route costs nothing**: adding `route` to the
`$include` the page already sends returns the route's id and name in the one
call. Only the route's own tasks are a second object, and that is the one extra
call - made only when `task.routes` is non-empty.

### "Is it connected to our custom task" - by construction

We never search routes and then test them. We start from **our** task's
`relateddata.route`, so every route read is connected to that task by
definition.

It was checked from the other side too. Reading inbox task
`IT-85756263-0000169` directly:

    relateddata.scopes[0]    -> EPMPROJECT_PERSONNEL_COST  T-85756263-0000134
    relateddata.contents[0]  -> EPMPROJECT_PERSONNEL_COST  T-85756263-0000134

The inbox task points **back** at the custom task, carrying its name *and* its
`EPMPROJECT_*` type. That also settles what `contents`/`scopes` are for - noted
in Update (7) as "the task being approved", now confirmed as exactly the link.

In the October capture, route `...F67800000BB8` appears twice: once on task
`...F5AA00000A66` (the custom task `T-85756263-0000134`) and once on
`...F6A400000C4C` (an Inbox Task titled "Project Manager"). **The shared route
id is the join.**

### `$include=tasks` - undocumented, and proven

The 2024x `Routes Web Services` spec declares no `$include` on
`GET /dsrt/routes/{routeId}`, and declares no route-tasks operation at all; the
API-labs validator refuses the parameter for that reason (`Undocumented query
parameter: $include`). It nonetheless works, and is the only way to read the
chain in one call. Both POCs use it - `Task_POC.js` route inspection and the JBM
`ChangeSummary.js`.

Measured against **33 live routes** - every route reachable from the 75 tasks
the landing list returns:

| `routeStatus` / `activityState` | count | the chain |
|---|---|---|
| `Finished` / `Approved` | 28 | every step an `Inbox Task`, `Complete` |
| `Not Started` / `Not Started` | 4 | every step a `Route Node` |
| `Started` / `Awaiting your Approval` | 1 | step 1 `Inbox Task`/`Assigned`, 2-3 still `Route Node` |

### The two kinds of step ARE the state machine

`tasks[]` mixes two types, and the difference is the progress indicator:

- **`Inbox Task`** - activated. Has `current` (`Assigned` while it waits,
  `Complete` once acted on) and `approvalStatus` (`None`/`Approve`/`Reject`).
- **`Route Node`** - exists, not reached. Has **neither** field.

So *"the inbox task will come when the task goes into approval"* is literally
what the data does: a step is a `Route Node` until the route reaches it, and
becomes an `Inbox Task` at that moment.

A rejected route is `routeStatus: Stopped`. Its `state` is `Complete` - the
**same** as a finished route - so `state` alone cannot tell approval from
rejection. `routeStatus` is the field to read.

### Two corrections to the POC, both checked rather than copied

1. **The role is `title`, not `assigneeTitle`.** `Task_POC.js` maps
   `assigneeTitle` onto its three sign-off inputs. On live data that field is
   useless: across one route's three steps it came back `""`, `""` and the
   literal string `"title"`. `title` held `Project Manager`, `In-Charge / HOD`,
   `Division Head` - matching the inbox task's own `dataelements.title`.
   Note **`Division Head`**, where the POC's table says `Divisional Head`: a
   hardcoded role-to-field map drops that step silently. The service therefore
   returns the chain as an **ordered list** and the panel renders whatever roles
   the route actually has.
2. **`revision` and `isLatestRevision` do not exist here.** The POC keeps only
   the route with `isLatestRevision === 'TRUE'`; neither field was present on
   **any** of the 33 routes, so that test would discard every route. Every route
   is kept, in the order the task lists them, each shown as its own cycle.

### This also answers three parked form rows

Update (6) parked five rows as `hidden`, three of them **Project Manager**,
**In-Charge / HOD** and **Divisional Head** - listed since Update (2) as "rows
with no source". They have one: they are the route's steps, with the assignee
and the decision. Still parked, because where they belong is now a design
question (the form's signature block, or the panel that already shows them) and
not a data one.

### What was built

- **`RouteService`** - `forTask(task)` reads every route on the task in
  parallel, shapes `{status, activityState, started, finished, rejected,
  steps[], currentStep}`. A route that fails to read drops without costing the
  others; a refusal of `$include` retries once without it, so the status still
  shows even when the chain cannot.
- **`TaskApprovalPanel`** - under the documents panel in the sticky side column.
  One row per step: order badge, role, assignee, due or completion date, and a
  decision badge. The waiting step gets a warning left border; pending steps are
  muted with a hollow number. The card header badge names **who it is sitting
  with**.
- Shows the whole chain, not only the live inbox task: the same response already
  carries who approved and who is next, so one list answers three questions for
  one call.

**No new CSS.** The panel reuses `irs-docs` for density and is otherwise
`list-group-flush`, `badge rounded-pill`, `text-bg-*`, `border-start`. The
stylesheet still holds the same four rules, and section 14 carries the same kind
of guard section 13 does: it asserts `irs-approval` has no rule behind it.

### Verified live

Task `T-85756263-0000142`, `PROJECT PROPOSAL / PROFILE`, state **In Approval**:

    [IRSTasks] route Project Proposal approval route for R&D-26011-HY -
               T-85756263-0000142: Started / Awaiting your Approval,
               3 step(s), waiting on Project Manager

and on screen - `Route [Started]`, "Awaiting your Approval", step 1 **Project
Manager / Sharad S Dhavalikar / due 2026-10-09 / Awaiting approval** boxed, with
`In-Charge / HOD` and `Division Head` below it greyed as *Not yet reached*.

Three of the four states were then confirmed in the UI: **Started** (above),
**Not Started** (`T-85756263-0000140`, two hollow steps) and **Finished**
(`T-85756263-0000137`, `Approved`, completion timestamp and the approver's
comment). **Rejected** has no live example on this system and is covered by the
unit test instead.

### Tested

New section 14, with its own `Request` fake and its own module instance - the
mistake sections 8 and 12 each made once. It asserts all four route states, that
the role comes from `title` and not `assigneeTitle`, that a `Route Node` reports
no state and no decision, that steps sort by the platform's `taskOrder`, that
`$include=tasks` is the parameter sent, that a task with no route costs **zero**
calls, that both cycles survive on a two-route task, and that one unreadable
route does not cost the other.

One assertion was written wrong and the code was right: the `$include` retry
*recovers* the route rather than dropping it, so the test now asserts the retry
(two calls, the second without the parameter, header but no chain) and a
separate case covers a route that cannot be read at all.

All nine suites pass.

### Open

- **Ordering several cycles.** A task rejected and resent has more than one
  route, and `isLatestRevision` does not exist to pick the current one. Today
  they render in the order the task lists them. The JBM POC sorted by the
  route's `originated` date, which comes from a *different* resource
  (`/resources/v1/modeler/routes?whereUsed=`) - an extra call. Needs a decision
  before a rejected-and-resent task is demonstrated.
- **Nothing acts yet.** The panel is read-only; approving or rejecting from the
  widget is not built.
- The landing grid's `Route Task` and `Action Required` columns stay empty on a
  custom task: those `routeTask*` fields belong to the **Inbox Task**, not to
  the task being approved. They could be filled from the current step now that
  the chain is read.
- The list currently returns **28 Inbox Tasks among 75 rows** (`currentTaskFilter=all`),
  which is why the grid shows rows that are approval steps rather than IRS
  tasks. Worth deciding whether to filter them out, now that they are shown
  properly on the task they belong to.


## Update 2026-10-08 (11) - the chain goes horizontal, and gets signatures

> *"can we have route coming horizontally and below the form, lets show then in
> order and with the date completed, if there is any due date then we put the
> due date then approved comments, also check our worklog some time back we have
> created one api, with that api we get the signature photo in svg file, and
> also we need to show the signature"*

Update (10) put the chain in the right sidebar. The user moved it, with a
screenshot of the platform's own route diagram as the shape to match.

### Where it is now

**Below the form, full width**, appended to the page content rather than to the
`col-xl-4` sidebar. A horizontal strip wants the whole width: three boxes inside
the sidebar would have been about 70px each. The sidebar keeps the documents
panel only - the chain is **not** rendered twice.

### The box

    +- 1 ------------- Approved -+
    | Project Manager            |   the role (`title` on the step)
    | Sharad S Dhavalikar        |   the approver
    | .......................... |
    |      [ signature SVG ]     |   only once the step is decided
    | .......................... |
    | Completed  8 Oct 2026      |   or "Due ..." while it waits
    | "approve"                  |   the approval comment
    +----------------------------+

A pending step (`Route Node`) is the same frame greyed, with a hollow number and
no signature, date or comment - because it has none of them.

**Overflow scrolls sideways** (the user's choice from three offered). Wrapping
leaves an arrow pointing off the end of a line; shrinking squashes the signature
strip past about four steps. Fixed-width boxes with `flex-shrink-0` inside an
`overflow-auto` strip keep the left-to-right reading at any width, and every
route on this system is two or three steps, which fits without scrolling.

**A task with no route says so** rather than hiding the section, so a reader can
tell "not sent for approval yet" from "the panel failed to load".

### The dates

The platform spells them **two different ways in the same response**:
`taskDueDate` is ISO (`2026-10-08T07:37:08.000Z`) and
`taskActualCompletionDate` is US display (`10/7/2026 1:07:21 PM`). Both are
reduced to `8 Oct 2026`. Anything unparseable is shown as it came - a date we
cannot read beats a dash. The completion date wins when there is one; otherwise
the due date, labelled as such.

Comments arrive as HTML (`<p>ASDFASD</p>`) and are shown as words.

### The signature - the join was already there

`GET resources/v1/irs/signatures/{loginId}` is **our own REST JAR**, built on
2026-10-03 (worklog `2026-10-03-03`). `{loginId}` is a platform login, and a
route step already carries `taskAssigneeUsername` - so the chain needs **no
person lookup at all**. Measured on the finished route of `T-85756263-0000134`:

| step | person | `taskAssigneeUsername` | signature |
|---|---|---|---|
| Project Manager | Sharad S Dhavalikar | `admin_platform` | 200, 2524 B |
| In-Charge / HOD | Sachin S Awasare | `PlmUser2` | 200, 2011 B |
| Division Head | Dr. Asokendu Samanta | `PlmUser1` | 200, 1988 B |

That run also **closed a check open since 3 October**: the endpoint had only
ever been proved to redirect anonymously to 3DPassport, never to answer in a
signed-in session. Worklog `2026-10-03-03` moves from partial to done.

Shown only on a **decided** step: a signature against a step nobody has acted on
would be a claim the data does not make.

#### `Accept` is mandatory - the bug this cost

The first live run rendered **no signatures at all**. The service produces
`image/svg+xml` only, and the widget's transport sends a JSON `Accept`, so every
request answered **406 Not Acceptable**. The probes that "proved" the endpoint
earlier had all set the header by hand, which is exactly why they hid it.
`Accept: image/svg+xml` is now sent explicitly, and a test asserts it.

#### A blob, not a direct `<img src>`

Two independent reasons:

1. **The widget is cross-origin to 3DSpace** - served from `external.solize.com`
   through the dashboard proxy - so a direct `<img>` is a third-party request
   whose session cookie is not dependable. Going through `Request` uses the same
   authenticated transport as every other call on the page.
2. **An SVG inside `<img>` cannot run script.** The alternative, assigning the
   fetched markup to `innerHTML`, would make a remote document part of this
   page's DOM. These files are ours and the endpoint sets a sandbox CSP, but a
   blob removes the question rather than arguing it.

Cached per login for the session, promise and all, so two steps asking at once
make one call - and a **miss is cached too**, so a 404 does not become a 404 per
step. `get()` resolves `null` rather than rejecting: outside the three-login
pilot a person simply has no signature, and that is not an error.

### CSS: two more rules, both justified

Still no hand-written rule that Bootstrap could have given:

    .irs-step-box { width: 15rem; }                 5.3.8 has no min-w-*/w-56 scale
    .irs-sign     { height: 3rem; object-fit: contain; }

`img-fluid` caps the **width**, which is the dimension that does not matter for
a 3:1 signature; the height is what must be capped so every box is the same
height. `object-fit` has no Bootstrap utility at all. The guard in section 13
now lists six survivors instead of four.

### Verified live

- `T-85756263-0000142` (**In Approval**) - step 1 boxed amber, *Awaiting
  approval*, **Due 9 Oct 2026**; steps 2 and 3 greyed *Not yet reached*. No
  signatures, correctly: nothing is decided yet.
- `T-85756263-0000134` (**Completed**) - all three steps *Approved*, each with
  its **signature**, `Completed 7 Oct 2026`, and the approver's comment.

### Tested

New section 15: the strip is horizontal and scrolls (and must not wrap), the
chain is appended to the content and **not** to the sidebar, both date spellings
reduce correctly, an unparseable date survives, HTML comments become words, the
badges read properly, the signature is requested with `type: 'text'` **and**
`Accept: image/svg+xml`, it is cached per login, a miss resolves `null` and is
cached, an HTML login page is not treated as a signature, and a **pending step
never asks for one**.

A pre-existing cross-section leak surfaced doing this: section 7's rejection
handler does `delete global.document` asynchronously, so a stub set
synchronously is gone by the time a later callback runs. Section 15 sets its own
inside the callback rather than changing section 7.

All nine suites pass.

### Open

- The signature endpoint is still a **three-login dummy pilot**. It is now on
  screen, so WP05's folder ACL, install/replace rule and approval-context read
  rule matter more than they did. A fourth approver renders no signature.
- Ordering several cycles is still undecided (see Update 10).
- Nothing acts yet: approving or rejecting from the widget is not built.

## Update 2026-10-08 (12) - capturing the inbox tasks, and checking the connection

> *"first we capture the task with inbox task and check whether the task is
> connected to our custom type and show --> lets do this much and then we do the
> next action"*

Read side only. Nothing writes, and no approve/reject is built.

### The check the platform answers for us

An inbox task carries the object being approved in `relateddata.contents`:

    contents[0].type      EPMPROJECT_PROPOSAL        <- the test
    contents[0].id        the custom task's id
    contents[0].name      T-85756263-0000143
    contents[0].stateNLS  "In Approval"
    contents[0].typeNLS   "PROJECT PROPOSAL / PROFILE"

So the check is `Fields.isListed(contents[0].type)` - **the same allow-list the
landing grid already uses for tasks**, asked of the connected object instead.
Nothing new had to be invented, and the two lists cannot drift apart.

Measured live across the 29 inbox tasks the resource returns:

| | |
|---|---|
| connected to one of our four subtypes | **28** - kept |
| no `contents` at all | 1 - dropped |
| connected to something else | 0 |

The four seen were `EPMPROJECT_PROPOSAL`, `_PERSONNEL_COST`, `_REVIEW` and
`_STAGE_VALIDATION` - our complete set. `scopes` held the same object as
`contents` on every one, so only `contents` is read.

### Where they show

A **second view**, not a second kind of row. An inbox task is not an IRS task -
`TaskFields.isListed()` has kept them out of the landing grid since
2026-10-07 - so the toolbar gained a two-button switch, `IRS Tasks` /
`Approvals`, with the waiting count on the button. The view survives a refresh
like every other navigation state here (rule R6).

Columns are deliberately different, because an approval row answers a different
question - *what is asked of me, on what, by when*:

    #  Role  On task  Task Type  Task Status  Action  Due  Route

No `Title` column: an inbox task's own title **is** the role, so it would repeat
`Role` exactly. No `Assigned To`: with `currentTaskFilter=assigned` every row is
the signed-in user's.

**`On task` is the link, and it opens the custom task** - the form, its
documents and its approval chain - never the inbox task, which has nothing to
show that its row does not already say.

By default the list shows only what is **waiting**; `Show decided` reveals steps
already acted on. A decided step is history, and the approval chain on the task
page already shows it with the signature.

### Cost: one call

Same resource and parameters as the grid's own, bar `$include=contents`. If the
landing page ever needs both lists at once, adding `contents` there and
splitting the rows in memory would make this free - noted, not done, because the
approvals view is opened deliberately rather than on every page load.

### An unproven assumption, recorded

`currentTaskFilter=assigned` is the right intent - *"each assignee of the inbox
task will see the task"*. But measured on `admin_platform`, `assigned` and `all`
returned the **same 29 inbox tasks**; only the ordinary task count changed (40
rows against 77). That login is an approver on every route here, so the test
cannot distinguish "the filter does nothing for inbox tasks" from "this user
really is assigned all of them".

**Whether another approver sees only their own rows is therefore unproven.** It
is platform access control, not something the widget can enforce, and it needs a
check from a second login before anyone relies on it.

### Verified live

Switching to `Approvals` showed:

    2 of 29 inbox tasks shown (1 not connected to any object, 26 already decided).

    #  Role             On task              Task Type                   Status        Action   Due
    1  Project Manager  T-85756263-0000142   PROJECT PROPOSAL / PROFILE  In Approval   Approve  Oct 09, 2026
    2  Project Manager  T-85756263-0000143   PROJECT PROPOSAL / PROFILE  In Approval   Approve  Oct 09, 2026

Clicking `T-85756263-0000143` opened that custom task's form. The view and the
`Show decided` wording both survived a reload.

### The next action, already scoped

Not built, and deliberately so. For the record, what was established while
checking:

- the decision is `PUT /resources/v1/modeler/tasks/{inboxTaskId}` with
  `data[0].dataelements` carrying `routeTaskApprovalAction`,
  `routeTaskApprovalComments` and `state: 'Complete'`;
- the spec declares `routeTaskApprovalAction` as
  **`Approve | Reject | Abstain | None`** - `Abstain` is a fourth option the POC
  does not offer;
- the POC uses **POST** with an `updateAction: 'MODIFY'` key that **does not
  exist in the documented schema**, and its own header comment
  (`PUT ...?action=Approve|Reject`) describes neither. The documented PUT is
  what to use;
- there is no approve or complete operation in the Routes API at all.

**This will be the widget's first write**, and an approval advances a live route
with no undo from the widget.

### Tests - WRITTEN, BUT THE SUITE CANNOT RUN

New section 16 covers the shaping, the `None` decision, the connection check
across all four subtypes and four non-ours types, `null` for an inbox task with
no contents, the `contents` parameter, the end-to-end filter with its counts and
note, `includeDecided`, and that the grid's link opens `connectedId`.

**It has not been run.** The suite's fixture - the captured task response at
`As-Is  Understanding/manual logs/ABCLogs`, loaded at startup for section 4 -
**is missing from the workspace**. The folder is empty and the file is nowhere
on the drive. It was read successfully earlier in the same session and was never
written to. Cause unknown.

So today: eight of nine suites pass; `irstasks-detail.test.js` cannot load at
all, which takes sections 1-16 with it. This is recorded rather than worked
around - replacing a lost fixture with one built to satisfy the assertions that
depend on it would make the test pass by construction instead of by evidence.
A live recapture is possible (the data is still there, 77 tasks), but
`showProjectTasks` and `currentTaskFilter` are undocumented, so the API-labs
validator refuses them and only the browser can fetch it.

## Update 2026-10-08 (13) - Approve and Reject: the widget's first write

> *"form is looking good, but now we need to approve or reject the task,
> currently there is no option"*

### The call, and why it is not the POC's

    PUT resources/v1/modeler/tasks/{inboxTaskId}
    { data: [ { id, dataelements: {
          routeTaskApprovalAction:   'Approve' | 'Reject',
          routeTaskApprovalComments: '...',
          state:                     'Complete'
    } } ] }

Checked against the 2024x `Task Rest Services` request-body schema rather than
copied from `Task_POC_RouteTaskForm.js`. The three fields are right - all are
writable, and `routeTaskApprovalAction` is an enumeration of
`Approve | Reject | Abstain | None` - but the POC differs three ways:

- it sends **POST**; the documented operation is **PUT**;
- it adds `updateAction: 'MODIFY'`, which appears **nowhere in the body
  schema** (zero hits) - tolerated or ignored;
- its own header comment claims `PUT .../tasks/{id}?action=Approve|Reject`,
  matching neither its code nor the spec. Stale.

`state: 'Complete'` is what finishes the step and lets the route advance;
writing the decision without it would leave the route sitting on a step that
has already been answered. There is no approve or complete operation in the
Routes API at all.

**`Abstain` is not offered.** It is a real platform value, but no route on this
system has used anything but `Approve`, and what it does to a route's progress
has not been observed here. A control whose effect we have not seen is worse
than one that is missing.

### Who gets the buttons - the platform decides

`modifyAccess` on the inbox task is the platform's own per-user verdict, so that
is what is asked. Comparing the signed-in login against the step's
`taskAssigneeUsername` would re-implement an access rule in the client, and
would be wrong the moment a route allows a delegate or a group assignee.

It costs one GET, made **only** when a route is actually sitting on a step -
never on a finished, rejected or unstarted route. The route's own `tasks[]`
payload does not carry `modifyAccess` (checked: 25 keys, not among them), so it
cannot ride along free.

### The bar

Under the chain, on the task page - the approver's question is *"is this form
right"*, and the form is on this page. A separate approval screen would mean
reading the form, going elsewhere, and deciding from memory.

    Your decision - Project Manager
    <the step's own instructions>
    [ comment                                  ]
    [ Approve ] [ Reject ]

- **A comment is required to reject, optional to approve.** A rejection sends
  the form back to someone who then has to work out what to change; one with no
  reason is unactionable. An approval needs no justification, and demanding one
  produces comments like "ok" - which is what the live data already shows
  ("ASDFASD", "FASDF").
- **Two clicks.** There is no undo, here or in the Routes API, so the first
  click arms the decision and states what will happen - *"This advances the
  route to the next approver. It cannot be undone."* - and the second sends it.
  The other button becomes Cancel until then.
- On success the chain is **re-read**, not patched: who it waits on, the new
  signature and the route's own status have all changed.

### A bug the first render exposed

Step 1 showed **a signature on a step nobody had signed**. `approvalStatus` is
the string `"None"` while a step waits, which is truthy, so the signature guard
(`!step.pending && step.decision`) passed. `RouteService` now normalises `None`
to `''` at the source, so no caller can repeat it. Confirmed fixed live: the
awaiting step draws no signature, the three approved ones still do.

### Verified live, WITHOUT submitting

On `T-85756263-0000143`, whose route sits on `Project Manager`:

- the bar appeared under the chain, headed *"Your decision - Project Manager"*,
  carrying the step's own instructions;
- **Approve enabled, Reject disabled** until a comment is typed;
- clicking Approve once turned it into **Confirm approve** (green), turned
  Reject into **Cancel**, and printed the cannot-be-undone warning - **with no
  request sent**;
- Cancel restored both buttons.

**No decision has been submitted.** Doing so advances a live route with no way
back, so it waits for an explicit go-ahead.

### The fixture, and the suite

Update (12) recorded that `irstasks-detail.test.js` could not load at all,
because the captured response it reads at startup went missing. That took
sections 1-17 down over one absent input, so the read is now **guarded**:
section 4 - the only one that tests the captured shape - skips with a loud
console warning naming the file, and everything else runs.

It is skipped, **not replaced**. Rebuilding the capture from live data to
satisfy the assertions that depend on it would make them pass by construction
instead of by evidence. Section 5 does get a small inline task, because its
subject is the two calls and their parameters, not the captured content.

New section 17 covers the decision: `DECISIONS` excludes `Abstain`, the
`modifyAccess` verdict in all four shapes (true, false, unreadable, no id),
`None` never reading as a decision, **PUT** not POST, the exact body, no
`updateAction`, an empty comment string rather than `undefined`, a bad decision
refused before anything is sent, and a `statusCode: 403` **inside** an HTTP 200
treated as the failure it is.

All nine suites pass, with section 4 skipped.

### Still open

- **The first real submission has not happened.** Needs a go-ahead and an
  agreed subject (`T-85756263-0000142` or `T-85756263-0000143`).
- Whether another approver sees only their own rows is still unproven - it
  needs a second login (Update 12).
- `Abstain` is unoffered and unobserved.
- Ordering several cycles on a rejected-and-resent task (Update 10).

## Update 2026-10-08 (14) - the decision bar made bigger, and a rem trap

> *"can we make it lil bigger, as it is little smaller the approval box and
> button"*

The bar inherited 14px from `.irs-docs`, and its controls were `btn-sm` /
`form-control-sm` on top of that - the two smallest controls on the page were
the two that do something irreversible.

### The trap: every Bootstrap size utility is `rem`, and this widget scales its root

The first attempt added **`fs-6`** to the bar, expecting 1rem = 16px. Measured
afterwards, the bar computed to **10px** - *smaller* than the 14px it had
inherited. `fs-6` is `font-size: 1rem`, `rem` is relative to the ROOT, and this
widget scales its own root inside the dashboard frame, so 1rem is 10px here.
The same applies to `.btn` and `.form-control`, whose own rem font-size the
root scale shrinks: `px-4` widened the buttons but left the text tiny.

**No Bootstrap font utility can express an absolute size in this widget.** That
is the justification for the rule, and it is worth remembering for every future
`fs-*` reached for here.

So: three absolute declarations under one selector, at **15px** - the form's own
body size, because the approver reads the form and then acts, and the two should
not change size between those steps.

    .irs-tasks .irs-decide                      { font-size: 15px; }
    .irs-tasks .irs-decide .btn,
    .irs-tasks .irs-decide .form-control        { font-size: 15px; }

The controls also lost their `-sm` variants and the textarea went from two rows
to three - a one-line box invites a one-word reason, and the reason is the whole
point of a rejection.

Measured after: bar 15px, textarea 77px tall (was 54), buttons 32px tall and
88/72 wide (were 24px tall, 69/58). Section 13's guard lists `.irs-decide` among
the survivors, and section 15 now asserts the bar carries **no** `fs-*` utility -
a rem-based size here is a bug, not a shortcut.

### The route moved while this was being done

Reloading to check the sizing showed step 1 **Approved**, the route advanced to
`In-Charge / HOD`, and the bar correctly re-addressed to that step. Checked
against the route:

    1  Project Manager   Complete   Approve   10/8/2026 10:53:17 PM   "Approved"
    2  In-Charge / HOD   Assigned   None
    3  Division Head     Route Node

**This was not the agent.** The only clicks made here were one Approve (which
merely arms) followed by Cancel, with the comment box **empty** - and an empty
box is exactly why Reject was disabled at the time. A submission from that test
would have carried `""`, not `"Approved"`. The decision came from someone typing
that word.

Incidentally it proves the rest of the panel on freshly decided data: step 1 now
draws its signature, `Completed 8 Oct 2026` and the comment, and the decision
bar re-targeted itself to the next approver without any special handling.

## Update 2026-10-08 (15) - the bar offered somebody else's step (HTTP 400)

> *"after the first approved have approved this task then issue is coming that
> immediately the second task is getting opened in the same window of the first
> approver ... also system is not allowing ... so after approval we need to again
> fetch the route that should resolve our issue"*

### What actually happened

The refetch was already there and was working correctly - Update (13) re-reads
the route after every decision, and it duly reloaded onto step 2. The fault was
that **step 2 was then offered to the wrong person**.

Measured live on the route of `T-85756263-0000143`:

| | |
|---|---|
| signed in | `admin_platform` |
| step 2 assigned to | `PlmUser2` (Sachin S Awasare) |
| step 2 `modifyAccess` | **TRUE** |

So the bar appeared, the user submitted, and the platform refused the write with
**HTTP 400**.

### The design error, named

Update (13) chose `modifyAccess` over comparing logins, and argued that
comparing would "re-implement an access rule in the client". That reasoning was
wrong, because the two are not the same question:

- **`modifyAccess`** = *may you edit this object* - true for an administrator on
  an object they do not own as approver;
- **what the bar needed** = *is this your approval to give*.

Asking the platform was the right instinct; asking it the wrong question was the
mistake. The join on the assignee is not re-implementing anything - it is the
only question that was ever meant.

### The fix

New `SessionService` reads the signed-in person from the OOTB
`GET resources/modeler/pno/person?current=true` - the same resource
`JazzySole/Credentials` already uses, so no new dependency and nothing from the
signature pilot JAR. It answers `name` (the login) and `pid` (the Person id,
which matches an inbox task's `assignees[0].id`). Cached per session; the
promise is cached, so two panels opening at once make one call.

The bar now asks **two** questions, in order:

1. `SessionService.isMe(step.assigneeUsername)` - is this step mine?
2. `ApprovalService.check(step.id).modifiable` - will the platform take a write?

(2) is kept, because it still catches a locked or closed object, but it is no
longer trusted alone. An identity that cannot be read resolves to an empty login
rather than rejecting, so the controls stay **hidden** - showing them on a failed
identity check is the one outcome that must not happen.

The refusal also reads as something actionable now. The user saw
`NetworkError: URL "https://..." return ResponseCode with value "400"`, which
says nothing about what to do; a 400 or 403 is now reported as *"the step is
assigned to someone else, or has already been decided"*.

### Verified live, end to end - the first write this widget has made

On `T-85756263-0000142`, at the user's instruction, through the widget's own
controls: typed a comment, clicked Approve (which armed), clicked Confirm
approve. Afterwards, read back from the route resource:

    1  Project Manager   Complete   Approve   10/8/2026 11:18:44 PM
       "Reviewed the proposal form - approved by Project Manager."
    2  In-Charge / HOD   Assigned   None
    3  Division Head     Route Node

and on screen: step 1 **Approved** with its signature, completion date and the
comment; step 2 **Awaiting approval**; and **the decision bar is gone**, because
step 2 belongs to `PlmUser2`. That is the reported bug, fixed.

### A side finding that revises Update (12)

With step 2 now sitting on `PlmUser2`, the Approvals list shows **one** row - the
user's own - and not that step. So `currentTaskFilter=assigned` **does** scope
inbox tasks to the signed-in user. Update (12) recorded this as unproven because
`assigned` and `all` had returned the same 29 rows; that was because every step
then open happened to be `admin_platform`'s. It is now evidence, from one login,
that the filter works. A second login would still be the stronger test.

### Tested

New section 18, built around the bug: `name` is the login, `pid` is the person
id, the result is cached, the comparison is case-insensitive, an unknown
identity grants nothing, and - the assertion that would have caught this -
`isMe('PlmUser2')` is **false** for `admin_platform`. Plus that the panel asks
the assignee question **first**, and that a 400/403 is explained rather than
passed through as a transport error.

All nine suites pass, section 4 still skipped for the missing fixture.
