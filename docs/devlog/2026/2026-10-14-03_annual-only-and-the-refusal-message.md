# 2026-10-14-03 - Annual only, and three attempts at one error message

| | |
|---|---|
| Date | 2026-10-14 |
| Requirement | [WGT-10](../../requirements/WGT-10-annual-monitoring/README.md) |
| Status | done - deployed and tested; the notification itself still needs a Spring restart |
| Done by | Claude |

## H1 / H2 removed

The user asked where H1 / H2 was cited. **Nowhere.** Both specification
documents and all six forms say the re-evaluation is annual; the two labels were
a design reading of *"the user can change the range if they want two reports in
one year"*, invented on 2026-10-05 and never confirmed.

Removed from the attribute, the type, the JPO, the JAR, the widget and the
tests. The rule is now **one round per department per year**, and the date range
stays editable for a shorter window - it is simply not a second labelled round.
Detail and evidence: worklog `2026-10-14-26`, doc 10 section 2.5.

The grid lost its Period column, the form lost the dropdown, and a test now
asserts the column is **gone** rather than present.

## The error message took three attempts, at three different layers

Worth writing down, because each attempt looked right.

1. **The view** was changed to prefer `err.body.error.message`. No effect -
   `err.body` was never set.
2. **The wrapper** was changed to read `transport.responseText`. No effect - the
   body is not there either.
3. **The protocol** was changed, and that worked.

The cause: on a failed request the SDK (WAFData) hands our wrapper only its own
sentence - *"NetworkError: URL ... return ResponseCode with value '400'"* - and
the response body never arrives. Two layers of the stack were ruled out before
that was obvious.

`JazzySole/Request` already had a branch for the one shape that does deliver a
body: **HTTP 200 with `success: false`**, written for the DS services that use
it, which rejects *with the parsed body attached*. Business refusals from
`POST /assessments` now use it, and the screen finally reads:

> Hydrodynamics and Multiphysics already has an assessment round for 2026:
> ASM-0000005. There is one round per department per year.

**The trade, deliberately:** the HTTP status no longer carries a business
refusal for non-browser callers - it is in `error.status` instead. Limited to
refusals the user can act on. A failure they cannot act on (no session, a broken
read) keeps its real status, where the status IS the message.

## A notification, as asked

`Notify.warning` alongside the inline box. **Warning, not error**: "this year
already has a round" is a fact about the data, not a fault, and an error toast
never auto-dismisses.

The fallback was made useful too: with no body, the status is parsed out of the
transport's sentence and turned into something actionable (session expired, not
allowed, service not answering, nothing was changed) instead of a URL and a
number.

**Not yet seen in the browser** - the view needs a Spring restart. The server
half is deployed and proven.

## Still open from this work

- Editing the **Year** moves neither the title nor the date range, so
  `ASM-0000006` is a 2027 round titled 2026 with 2026 dates. Fix both sides: the
  form follows the year, and the service refuses a range that does not contain
  it. The second is the control.
- Dates render as `4/1/2026 12:00:00 AM`. Formatting belongs in the reader.
- The `Reports` column is empty; the count is not returned.

Workspace worklog: `2026-10-14-26_period-removed-annual-only.md`.
