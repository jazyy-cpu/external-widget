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
    'IRSTasks/Log'
], function (Request, Log) {
    'use strict';

    var PATH = 'resources/v1/irsproject/tasks/';

    function text(value) {
        return (value === null || value === undefined) ? '' : String(value).trim();
    }

    /**
     * The payload, flattened to what the form resolver reads.
     *
     * `attributes` is deliberately the same shape the task and the project
     * carry, so a `source: "baseline"` row resolves through exactly the same
     * code path as a `source: "project"` one - the resolver stays one function
     * with three holders rather than growing a third branch.
     */
    function shape(body) {
        body = body || {};
        var raw = body.baseline || {};
        return {
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
                        ? 'task is linked to ' + out.name
                        : 'no baseline captured for this task'));
                    return out;
                });
        },

        /** for tests only */
        _shape: shape
    };
});
