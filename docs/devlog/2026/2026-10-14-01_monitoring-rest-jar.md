# 2026-10-14-01 - irs-monitoring-rest: the first real API for WGT-10

| | |
|---|---|
| Date | 2026-10-14 |
| Requirement | [WGT-10](../../requirements/WGT-10-annual-monitoring/README.md) |
| Status | done - deployed, both endpoints live, the widget's degraded banner is gone |
| Done by | Claude |

## Goal

User: *"if person is logged in we should be able to get his connected
department; if we have department id, then we should be able to get person
connected. Let's create a new jar file for this."*

These are the two reads the skeleton has been faking since it was built: the
degraded banner exists precisely because neither could be answered.

## JPO first

Written and proven as `IRSAnnualMonitoringAPI` before a line of the JAR was
built. Three self-tests on live data, including the negative one - `PlmUser2`
does **not** supervise department `0000000002`. Detail and output in worklog
`2026-10-14-01`.

## What the model actually says, and the mistake it invites

Two relationships, both Department -> Person:

- **`Member`** (OOTB, attribute `Project Role`) - who belongs to the department;
- **`IRSResponsibility`** (ours, attribute `IRSResponsibilityRole`) - who is
  responsible for it.

A round is **run by** the responsible people and **written about** the members,
so `myDepartments` reads the second and `departmentPersons` reads the first.
Reading one where the other belongs returns a plausible, wrong answer rather
than an error - which is why this is the first thing in both classes' comments.

The roles are stored as tilde-joined **aliases**
(`role_IRSHeadOfDepartment~role_IRSInCharge`). The alias is compared; the
localized name is resolved for display only.

Neither fact was invented: both come from JPOs we already have
(`IRSPersonIndex`, `IRSPnoResponsibility`).

## The JAR

`irs-monitoring-rest`, application path `/resources/v1/irsmonitoring` - a
sibling of the hello and project JARs, not nested under either, so a redeploy of
one cannot break the others.

```
GET /departments/mine                     -> {login, departments:[...]}
GET /departments/{departmentId}/persons   -> {department:{...}, persons:[...]}
```

10,482 bytes, javac 17.0.8, SHA-256 `47AD8633...1F641`. The build's own guards
passed: no platform class bundled.

**One compile error worth keeping:** a private helper named `authenticate` does
not compile - `RestService` already declares `authenticate(HttpServletRequest)`
(deprecated, in favour of `getAuthenticatedContext`) with a different return
type. Renamed `platformContext`.

## The 403 is a decision, not an accident

`/persons` refuses anyone who is not HOD or In-Charge of that department. A
member list carrying designations, experience and e-mail addresses should not be
enumerable by every signed-in user, and the widget's picker is a convenience a
crafted request ignores.

It is deliberately strict and is the thing to revisit when **Q5** is answered.
The change belongs in `maySupervise`, so every later write endpoint inherits it
rather than re-deciding.

## Widget side

The endpoints moved out of `resources/v1/irs/annualmonitoring` (the hello JAR's
path) to `resources/v1/irsmonitoring`. `DepartmentService.fromService()` is now
the real call, and its fallback message changed meaning: it used to say "not
wired yet", and now reports an actual failure with the error attached, because
from here on a fallback means something is wrong rather than something is
missing.

22 unit checks pass.

## Next

1. Deploy the JAR - ~216s with 3DSpace down, so it is the user's call.
2. Then the degraded banner should disappear by itself, and A10+ become
   testable.
3. Then `POST /assessments`, written JPO-first like this one.

Workspace worklog: `2026-10-14-23_annual-monitoring-rest-api-jpo-and-jar.md`.

## Update 2026-10-14 - deployed; the banner is gone

TomEE stopped, JAR copied in, started. The deployed file's SHA-256 re-read
inside the guest matches the build. Three checks against the running server as
the signed-in user: `/departments/mine` returns one department with
`isHod: true`; `/departments/{id}/persons` returns both members with
designation, level, experience and responsibilities; and a department the user
does not run returns **403 NOT_RESPONSIBLE** - by NAME, which proves the name
and id routes reach the same authorization decision.

Reloading the dashboard, the **degraded banner disappeared on its own**. The
department picker is now the platform's HOD-checked answer, not a seeded file.
That was the point of the whole exercise: the widget no longer claims anything
it cannot prove.

`js/data/departments.json` stays as the fallback, but it is now a real
degradation path rather than the normal one - and the banner says so with the
error attached.
