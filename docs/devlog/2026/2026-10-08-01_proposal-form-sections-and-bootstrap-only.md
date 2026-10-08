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
