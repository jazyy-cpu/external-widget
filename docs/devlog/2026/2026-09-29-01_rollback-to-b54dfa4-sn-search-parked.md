# 2026-09-29-01 - Working tree rolled back to the last good commit; the SN-search attempt parked on a branch

| | |
|---|---|
| Requirement | WGT-05 (organisation links), and the search work that grew out of it |
| Status | rolled back; the work is parked, not lost |
| Asked by | user |

## Why

The search built on the copied `SNInfraUX` packet did not work. The user asked
to go back one step before starting the new widget, and to pick the search up
again later for a use case.

## What the repository actually looked like

None of it was committed. `main` was still at the last commit:

```
b54dfa4  tabulated issue fiexed        Sat 26 Sep 2026 16:02
```

and everything since sat in the working tree:

| | |
|---|---|
| modified | `docs/HANDOFF.md`, `docs/devlog/INDEX.md`, `docs/reference/uwa-rules-and-libraries.md`, `docs/requirements/INDEX.md`, `docs/requirements/WGT-04-project-detail/README.md`, `IRSProjects.html`, `IRSProjects/README.md`, `js/views/detail/OrganisationTab.js` - 210 insertions, 44 deletions, of which 205 lines in `OrganisationTab.js` |
| new | `docs/requirements/WGT-05-organisation-links/`, `docs/devlog/2026/2026-09-27-01_...`, `js/components/ObjectField.js`, `js/config/OrgPickers.js`, `js/services/OrganisationService.js`, `WidgetPacket/JazzySole/ObjectPicker/`, **`WidgetPacket/SNInfraUX/` (1.7 MB)**, `src/test/js/irsprojects-organisation.test.js` |

So "roll back one step" meant discarding all of that, not reverting a commit.

## What was done

Discarding it outright would have thrown away the WGT-05 requirement folder, the
devlog entry and the picker work along with the failed search - and the user
intends to return to the search later. So the work was **committed to a branch
first**, then `main` restored:

```
git checkout -b wip/wgt-05-org-pickers-and-sn-search
git add -A
git commit -m "WIP: WGT-05 organisation pickers and the SN-search attempt"   -> cf89cf7
git checkout main
```

`main` is now clean at `b54dfa4`, and nothing was deleted: everything is on
`wip/wgt-05-org-pickers-and-sn-search`.

## Verified

| Check | Result |
|---|---|
| `git status` on main | clean |
| `git log -1` | `b54dfa4 tabulated issue fiexed` |
| `WidgetPacket/` | `IRSProjects`, `JazzySole` only - **`SNInfraUX` gone** |
| `JazzySole/` | its eight committed packets intact (ChartJS, DragAndDrop, Notify, PlatformService, PureCss, Router, Tabulator, bootstrap); the untracked `ObjectPicker` removed |
| `OrganisationTab.js` | back to 71 lines |
| `js/components/` | committed files only; `ObjectField.js` gone. `js/services/` no longer exists |
| branches | `main`, `wip/wgt-05-org-pickers-and-sn-search` |

## To resume the search work later

```
git checkout wip/wgt-05-org-pickers-and-sn-search
```

or cherry-pick pieces out of `cf89cf7` onto whatever `main` has become by then.

The branch is **local only** - it has not been pushed to `origin`. If this
machine is rebuilt before the work resumes, it goes with it.

## Note

`main` is level with `origin/main`, so nothing was rewritten on the remote and
no history was lost. The rollback only moved the working tree.
