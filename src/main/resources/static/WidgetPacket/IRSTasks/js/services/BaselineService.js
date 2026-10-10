/**
 * The Project Baseline captured for a Personnel / Cost Estimation task.
 *
 *     GET resources/v1/irsproject/tasks/{taskId}/baseline
 *
 * ## Why the form's dates come from here
 *
 * Form R&D-PRJ-02 carries a `Rev. No.`, so its Start Date and Planned End Date
 * are the dates **as approved**, not whatever the live project schedule says
 * today. The baseline is exactly that frozen snapshot. The user's call,
 * 2026-10-09: *"we will take actuly the base line date as in this form we are
 * tasking about the project"*.
 *
 * ## Why this is a second call, and not part of the project context
 *
 * Every other `service` section of this form hangs off the PROJECT, and
 * `ProjectContextService` fetches them together. The baseline does not: the
 * `IRSTaskBaseline` link starts at the **task**, and a project with four
 * personnel/cost tasks has four different baselines. So it is a sibling
 * endpoint and one extra round trip, made only by a form that asks for it.
 *
 * ## "No baseline yet" is the COMMON case
 *
 * Measured 2026-10-09: 6 of the live personnel/cost tasks have a baseline and
 * the rest do not. So `linked` is the field to branch on, and an unlinked task
 * answers HTTP 200 with empty dates - it is a normal state of a live task, not
 * a failure. Only an id that is not a task at all gives a 404.
 */
define('IRSTasks/services/BaselineService', [
    'JazzySole/Request',
    'JazzySole/Credentials',
    'IRSTasks/Log'
], function (Request, Credentials, Log) {
    'use strict';

    var PATH = 'resources/v1/irsproject/tasks/';

    /**
     * The plan comes from the OOTB project resource - the user pointed it out,
     * 2026-10-10, and it is the right source.
     *
     * A Project Baseline IS a project to this service, so
     * `GET /resources/v1/modeler/projects/{baselineId}?$include=tasks`
     * answers with every task it holds. We built the same list in the REST JAR
     * first, over `ProjectBaseline.getSubtasks`; this replaces it, and the
     * JAR's `tasks` field is no longer read.
     *
     * ## What the OOTB answer has that ours did not
     *
     * **`sequenceOrder` 1..7, the real WBS order.** Our reader could not find
     * one: MQL's `select rel attribute[Sequence Order]` returned 1 on every
     * link, which I took to mean the platform stores no sequence. It does -
     * the same numbers come back here as `relelements.sequenceOrder`, so the
     * select was wrong, not the data. The rows now come in the order the
     * platform's own pages list them.
     *
     * It also carries `nlsType` (the type's printed name, "PROJECT PERSONNEL
     * / COST ESTIMATION" rather than `EPMPROJECT_PERSONNEL_COST`),
     * `isSummaryTask`, `isTypeMilestone` and ISO dates instead of the kernel's
     * US spelling.
     *
     * ## What is deliberately NOT asked for
     *
     * The URL the user shared asks for 40-odd fields, because the Gantt editor
     * needs them: predecessors, assignees, float, constraints, access flags,
     * calendars. A read-only month grid needs nine, and every extra field is
     * work the server does per task on a form that is only printed.
     *
     * `level` is left off too. The Gantt passes `level=1`; without it the
     * service answers with the same seven tasks for this baseline, so the
     * default is at least as deep. Whether a NESTED work breakdown comes back
     * whole is untested - no project here has one yet (open item).
     */
    var PLAN_PATH = 'resources/v1/modeler/projects/';
    var PLAN_FIELDS = [
        'none', 'title',
        'tasks.title', 'tasks.nlsType', 'tasks.state', 'tasks.sequenceOrder',
        'tasks.estimatedStartDate', 'tasks.dueDate', 'tasks.sourceId',
        'tasks.isSummaryTask', 'tasks.isTypeMilestone'
    ].join(',');

    function readPlan(baselineId) {
        return Request.get(PLAN_PATH + encodeURIComponent(baselineId), {
            params: {
                '$simpleJSON': 'true',
                '$include': 'none,tasks',
                '$fields': PLAN_FIELDS
            }
        }).then(function (body) {
            var data = (body && body.data) || [];
            var tasks = (data[0] && data[0].tasks) || [];
            return tasks.map(function (item) {
                item = item || {};
                return {
                    id: text(item.id),
                    name: text(item.title),
                    type: text(item.nlsType) || text(item.type),
                    state: text(item.state),
                    // WBS order, straight from the platform - no sorting here
                    sequence: Number(item.sequenceOrder) || 0,
                    summary: text(item.isSummaryTask) === 'TRUE',
                    milestone: text(item.isTypeMilestone) === 'TRUE',
                    // the LIVE task this copy was taken from - how the form
                    // finds its own row in the plan
                    sourceId: text(item.sourceId),
                    estimatedStartDate: text(item.estimatedStartDate),
                    estimatedFinishDate: text(item.dueDate)
                };
            }).sort(function (a, b) { return a.sequence - b.sequence; });
        });
    }

    function text(value) {
        return (value === null || value === undefined) ? '' : String(value).trim();
    }

    /**
     * The baseline's own page in ENOVIA Project Management.
     *
     * ## Three links were tried; this is the one that works and reads well
     *
     * 1. `/webapps/ENOProjectMgmtList/gantt-widget.html?objectId=...` - the
     *    page `emxProgramCentralWhatIfAnalysis.jsp` redirects to. **Blank**,
     *    with no console error, and blank the same way through DS's own JSP
     *    (which fills in `physicalId`, `referenceId`, `mode`,
     *    `languageString` and `tenant`) and from the Gantt Chart tab inside
     *    the PMCSchedule portal. That component wants the 3DDashboard app
     *    context ENOPRGA_AP gives it; a plain tab cannot.
     * 2. `emxPortalDisplay.jsp?portal=PMCSchedule` - renders, but as a bare
     *    frame with no header, which the user rejected on sight.
     * 3. this one: `emxNavigator.jsp?appName=ENOPRPR_AP&targetLocation=content`
     *    opens the baseline inside ENOVIA Project Management, with its header,
     *    its WBS and the Baseline-versus-Current dates side by side.
     *
     * All three checked in the browser on this VM, 2026-10-10. This one takes
     * the physical id, which is the id we already hold.
     *
     * ## Why not the 3DDashboard Gantt, which is where it does work
     *
     * Its URL carries the dashboard's own id, the tab's name and a
     * `widgetId` generated by whichever widget opened it. A widget cannot read
     * any of them: the dashboard is a different origin from this one, so
     * `window.top.location` is blocked, and the only platform value exposed
     * here is `x3dPlatformId`. Hard-coding one dashboard's id would send every
     * other user to a dashboard that is not theirs.
     */
    var ENOVIA_PAGE = '/common/emxNavigator.jsp';
    var ENOVIA_QUERY = '?appName=ENOPRPR_AP&targetLocation=content';

    function ganttUrl(baselineId) {
        if (!baselineId) { return Promise.resolve(''); }
        return Credentials.get3DSpaceUrl().then(function (root) {
            return String(root).replace(/\/+$/, '') + ENOVIA_PAGE +
                   ENOVIA_QUERY + '&objectId=' + encodeURIComponent(baselineId);
        }).catch(function () {
            // no 3DSpace root, no link - the plan below it still draws, and a
            // broken href would be worse than no link at all
            return '';
        });
    }

    function shape(body) {
        body = body || {};
        var raw = body.baseline || {};
        // `tasks` is NOT read from our endpoint any more - readPlan fetches
        // the plan from the OOTB project resource, which has the WBS order.
        // The JAR still returns the field; it will go at its next rebuild
        return {
            tasks: [],
            linked: text(raw.linked) === 'true',
            id: text(raw.physicalId) || text(raw.id),
            name: text(raw.name),
            state: text(raw.state),
            attributes: {
                actualStartDate: text(raw.actualStartDate),
                actualFinishDate: text(raw.actualFinishDate),
                estimatedStartDate: text(raw.estimatedStartDate),
                estimatedFinishDate: text(raw.estimatedFinishDate)
            }
        };
    }

    return {
        /**
         * @param {string} taskId physical or legacy id - the JAR resolves either
         * @returns {Promise<{linked, id, name, state, attributes}>}
         *          Rejects only when the call itself failed. An unlinked task
         *          resolves with `linked: false` and empty attributes, because
         *          "no baseline captured yet" and "the read broke" must not
         *          look the same on the form.
         */
        get: function (taskId) {
            if (!taskId) {
                return Promise.reject(new Error('No task id was given.'));
            }
            return Request.get(PATH + encodeURIComponent(taskId) + '/baseline')
                .then(function (body) {
                    var out = shape(body);
                    Log.info('baseline: ' + (out.linked
                        ? 'task is linked to ' + out.name + ', ' +
                          out.tasks.length + ' task(s) in the plan'
                        : 'no baseline captured for this task'));
                    if (!out.linked) {
                        out.ganttUrl = '';
                        return out;
                    }
                    // the plan and the link together: the link costs no round
                    // trip (the 3DSpace root is already resolved), the plan is
                    // one OOTB call, and the baseline arrives complete
                    return Promise.all([
                        ganttUrl(out.id),
                        readPlan(out.id).catch(function (err) {
                            // the dates above the plan came from the call that
                            // already succeeded - they must still print, so a
                            // failed plan is an error ON THE PLAN, not on the
                            // whole section
                            Log.warn('plan could not be read: ' +
                                     ((err && err.message) || err));
                            out.planError = (err && err.message) || String(err);
                            return [];
                        })
                    ]).then(function (both) {
                        out.ganttUrl = both[0];
                        out.tasks = both[1];
                        Log.info('plan: ' + out.tasks.length + ' task(s)');
                        return out;
                    });
                });
        },

        /** for tests only */
        _shape: shape
    };
});
