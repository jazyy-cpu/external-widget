# 2026-10-14-02 - Creating a round: JPO proven, JAR built

| | |
|---|---|
| Date | 2026-10-14 |
| Requirement | [WGT-10](../../requirements/WGT-10-annual-monitoring/README.md) |
| Status | done - deployed, and a round created from the widget end to end |
| Done by | Claude |

## Goal

User: *"lets build the assessment, first we will build the data for the R&D ...
and then we will test the solution."*

## What was built

`POST /resources/v1/irsmonitoring/assessments` and
`GET  /resources/v1/irsmonitoring/assessments?department={id}`, backed by
`MonitoringWriter` - a port of the JPO method proven first, as always.

One POST builds the round, one report per department member, and one rating per
domain **that member holds**, with the REL2REL to the department+domain link and
the division's interfaces attached.

## The test that actually proves §10.6

Hydrodynamics has **five** domains and **two** members. A per-department-domain
build would have produced ten ratings. It produced **two** - only the domain each
person really holds. That rule has been written down since 2026-10-05; this is
the first time it has been demonstrated rather than asserted.

Reading the round back also proved the REL2REL resolves both ways: the rating
knows its domain *and* its department.

## Two findings

**A `kind date` attribute rejects ISO.** `2026-04-01` gives
`#5000001: Invalid date/time format`. The widget's date inputs emit ISO, so the
server converts - the browser should not have to know the platform's date
format.

**Creation is not atomic, and we found out the hard way.** The first run failed
on that date format *after* the round object existed, and `ASM-0000001` survived
as a bare object that had to be deleted by hand. Phase 2 should make creation
**resumable** rather than claim atomicity the platform does not give us.

## Listing no longer needs the search index

`assessments()` reads the department's own links, not federated search, because
search returns no custom attributes (api.md O1) - year, period and the dates
would all be blank. One round trip, and **O8 stops mattering for this widget**.

## Widget side

`AssessmentService.create` was sending `departmentId`/`departmentCode`; the
service's parameter is `department`. Sending the wrong key would have been a
silent "created nothing" - the service would read an empty department and
refuse. Fixed, and the reason is in the code.

22 unit checks pass.

## Blocked

Deploying the JAR needs TomEE stopped, and the agent's permission classifier
refused it as a production deploy. Nothing is half-applied: the running JAR is
still the one with the two department endpoints. The commands are in the
worklog and were handed to the user.

Workspace worklog: `2026-10-14-25_assessment-creation-built-and-tested.md`.

## Update 2026-10-14 - end to end from the dashboard

Listing shows the round; a duplicate is refused with 400; a 2027 round creates,
and reading it back shows both reports, both ratings, the R&D interfaces and the
REL2REL links. **B2 answered in full** - a POST from this widget, with its CSRF
token, to a custom modeler path.

Two widget-side defects, both found only by using it:

1. **`params` and `data`, not `query` and `body`.** JazzySole/Request ignores an
   option it does not know, silently, so the list request went out with no
   department. Two regression checks now assert the option NAMES - the unit
   suite could not see this, because the fake Request accepted anything.
2. **The server's message was swallowed.** Both refusals printed "the REST
   service is not built yet", so a duplicate round reported a wrong and useless
   cause. The view now prints `error.message` from the body. A message written
   before the thing it describes exists will outlive it.

Still rough: the dates render as `4/1/2026 12:00:00 AM`, and editing the Year
does not move the From/To range - ASM-0000003 is a 2027 round holding the 2026
dates.
