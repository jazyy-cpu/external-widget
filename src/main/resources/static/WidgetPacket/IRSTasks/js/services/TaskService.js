/**
 * IRSTasks service - reads the task list for the landing page.
 *
 * **It returns an empty list on purpose** (user, 2026-10-03: "as of now just
 * create empty table"). The custom task subtypes do not exist on the VM yet, so
 * there is nothing to query; the grid, the toolbar, the columns and the states
 * are what is being built first.
 *
 * Everything the real call needs is written down below rather than left to be
 * rediscovered, but no request is made, so the page cannot fail for a reason
 * that has nothing to do with the layout.
 *
 * ## The call this becomes
 *
 * The POC read tasks from the project it was opened on:
 *
 *     GET resources/v1/modeler/projects/{projectId}/tasks
 *
 * and for the route side, per task:
 *
 *     GET resources/v1/modeler/tasks/{taskId}/deliverables
 *     GET resources/v1/modeler/dsrt/routes/{routeId}/tasks
 *
 * Two things to settle before the first live call (api.md):
 *
 *   1. **Which tasks does the landing page list?** Every custom task the user
 *      may see across projects, or the tasks of one project chosen first? The
 *      POC did the second, with a project picker. The first needs a search,
 *      because there is no "all tasks for me" project resource.
 *   2. **The route task is a second object.** Point 4 of the user's list asks
 *      for the custom subtask *and* the route task connected to it in one grid.
 *      That is one call per task unless the route task arrives with the task, so
 *      the row shape below keeps both sets of fields and the service decides
 *      later how they are filled.
 *
 * `$include=none` is mandatory on the project resources - the default expands
 * the whole task tree. When the call is wired up it goes through
 * `JazzySole/Request`, which adds tenant, SecurityContext and CSRF (rule R3);
 * it is left out of the dependency list until then rather than sitting unused.
 */
define('IRSTasks/services/TaskService', [
    'IRSTasks/config/TaskFields'
], function (Fields) {
    'use strict';

    /** A field may arrive inside `dataelements` or as a sibling of it. */
    function value(item, name) {
        var de = item.dataelements || {};
        return de[name] !== undefined ? de[name] : item[name];
    }

    /**
     * One Tabulator row. Dates stay as the ISO-like strings the service returns
     * ("2026-02-15T17:00:00.000"): they sort correctly as text and the column
     * formatter does the display.
     *
     * The route fields are part of the row shape from the start, so adding the
     * route call later changes this function and nothing in the view.
     */
    function toRow(item) {
        var type = item.type || value(item, 'type') || '';
        return {
            id: item.id || value(item, 'id') || '',
            type: type,
            typeLabel: Fields.typeLabel(type),
            title: value(item, 'title') || '',
            state: value(item, 'state') || '',
            assignedTo: value(item, 'owner') || '',
            projectId: '',
            projectName: '',
            department: '',       // from the project's Department relationship
            route: '',            // the route this task's approval runs through
            routeTask: '',        // the connected route task (user's point 4)
            actionRequired: '',   // the route task's action for the current user
            finish: value(item, 'taskEstimatedFinishDate') || ''
        };
    }

    return {
        /**
         * @param {Object} [opts]
         * @param {boolean} [opts.includeClosed]  also list completed tasks
         * @returns {Promise<{rows: Array, note: string}>}
         */
        list: function (opts) {
            opts = opts || {};
            // No request yet - see the file comment. Resolved rather than
            // thrown, so the grid draws its headings and its placeholder.
            return Promise.resolve({
                rows: [],
                note: 'No task is listed yet: the custom task subtypes are not ' +
                      'deployed and the list call is not wired up.'
            });
        },

        /** for tests only */
        _toRow: toRow
    };
});
