# 2026-10-03-02 - Training widget options

| | |
|---|---|
| Date | 2026-10-03 |
| Requirement | WGT-08 (proposed) |
| Status | done |
| Done by | Codex |

## Goal

Design how HODs manage training through a Tabulator widget and compare standalone tasks with a Training Project container.

## What was done

Started review of the existing widget rules, task/project model, and Training Master design.

## Decisions and findings

Pending.

## Verification

Pending.

## Next

Pending.
## Update 2026-10-04 - Architecture selected

### Decision

The user selected the **Department Training Plan project + Training Tasks +
Training Offering Documents** design:

- one Department Training Plan per Department × April–March FY;
- one Training Task in its WBS per Person × Offering;
- one exact link from the Task to a `DMPTrainingOffering` revision;
- person/year counts derived from Tasks; no separate
  `IRSAnnualTrainingRecord`;
- only HOD-confirmed attendance counts as undergone.

The standalone-task option is closed. The old `IRSTraining` master and its
development are deprecated and excluded from WGT-08.

### Documentation changed

- rewrote WGT-08 `README.md` and `design.md` as the selected design;
- updated `requirements/INDEX.md`;
- aligned WP01 docs 09, 10, 11 and its index;
- fixed the malformed WGT-08 links line left by the earlier draft.

### Verification

The user verified `TOF-0000001` in the standard New Document dialog for
`DMPTrainingOffering`. Project and Task subtypes still require their R2024x
prototype checks. No widget code changed.

### Next

Create and test the Department Training Plan project subtype, then create the
Training Task subtype inside its WBS with one Person assignee and one exact
Offering Document link.