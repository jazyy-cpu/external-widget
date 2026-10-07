/**
 * IRSTasks service - reads the task list for the landing page.
 *
 * ## The call
 *
 *     GET resources/v1/modeler/tasks
 *         $include=assignees,deliverables
 *         $fields=basics
 *         showProjectTasks=true
 *         currentTaskFilter=all
 *
 * **One call for task + project + route.** The response carries, per task,
 * `relateddata.DPMProject` (the project the task belongs to), `relateddata.route`
 * and `relateddata.assignees`, so the project column costs no extra request.
 * That answers open item **O-T4** better than expected: it was written as "the
 * route task is a second object, so showing it may be one call per row", and
 * the route's own name is not.
 *
 * This is the POC's call, verbatim in substance (`Task_POC.js:279`) - the one
 * spelling of this resource known to work on this platform. Two parameters were
 * checked rather than copied:
 *
 *   - `currentTaskFilter` - the POC sent `assigned`, which lists only the
 *     current user's tasks. DS's own Collaborative Tasks widget defaults to
 *     **`all`** (`CollaborativeTasks.js`: `C.getFilter() || C.setFilter("all")`,
 *     written into `enoviaServer.preferences.currentTaskFilter`), and the user
 *     asked for "all the task", so `all` it is. It stays in `FILTER` here, one
 *     line to change, because what `all` means server-side - every task the user
 *     can read, or every flavour of *their own* task - is the one thing the
 *     first live run has to tell us (check A8).
 *   - `showProjectTasks` - also a DS preference (boolean, default true). Project
 *     tasks are the only kind this widget shows, so it is sent explicitly rather
 *     than relying on a default that a preference could flip.
 *
 * `$fields=basics,typeNLS,stateNLS` - the set, plus two named fields.
 *
 * `basics` alone is what the POC sent, and in the one captured response it does
 * NOT carry `typeNLS` on the task items, which is why the grid showed our own
 * labels instead of the platform's (user, 2026-10-07). `typeNLS` is the name set
 * in DMC - "PROJECT PROPOSAL / PROFILE" - and it is the right thing to show,
 * because it is the name the rest of the platform shows the same person.
 *
 * Mixing a set name with explicit fields is the syntax `ProjectService` already
 * proves live (`$fields=none,title,state,...`). It is still an **untested name**
 * on this resource, and an untested name in `$fields` returns 400 for the whole
 * call - so the call falls back once to plain `basics`. Either way the page
 * draws; `nlsNames` in the counts says which happened, so this is settled by
 * observation rather than by belief.
 *
 * ## Two filters, both applied here
 *
 *   1. **Only our four subtypes** (`TaskFields.isListed`) - the user's
 *      instruction of 2026-10-07. The resource has no type parameter, and it
 *      returns OOTB tasks and route Inbox Tasks as well.
 *   2. **No baseline or snapshot copies** (`TaskFields.isCopy`). Copying a
 *      project copies its WBS, so a project with four baselines would otherwise
 *      show every task five times. See the comment on `COPY_PROJECT_TYPES`.
 *
 * ## What is NOT here
 *
 * The approval levels of a task's route - who has to approve, in what order,
 * and what each one has done. The POC read them with
 * `GET resources/v1/modeler/dsrt/routes/{routeId}?$include=tasks`, which is one
 * call per task and belongs to the task view, not to a grid of fifty rows. The
 * row keeps `routeTask` and `actionRequired` so the view can fill them without
 * the grid changing shape.
 */
define('IRSTasks/services/TaskService', [
    'JazzySole/Request',
    'IRSTasks/config/TaskFields'
], function (Request, Fields) {
    'use strict';

    var PATH = 'resources/v1/modeler/tasks';

    /** See the file comment - the first live run decides whether this holds. */
    var FILTER = 'all';

    /** The set, plus the platform's own display names for type and state. */
    var FIELDS = 'basics,typeNLS,stateNLS';
    var FIELDS_FALLBACK = 'basics';

    /** A field may arrive inside `dataelements` or as a sibling of it. */
    function value(item, name) {
        var de = item.dataelements || {};
        return de[name] !== undefined ? de[name] : item[name];
    }

    /** `relateddata.<key>` as an array, whatever the service sent. */
    function related(item, key) {
        var rd = item.relateddata || {};
        var list = rd[key];
        if (!list) { return []; }
        return Array.isArray(list) ? list : [list];
    }

    /** "Jiwan Dhiman" from firstname/lastname, falling back to the login name. */
    function personName(entry) {
        var de = entry.dataelements || {};
        var full = [de.firstname, de.lastname].filter(Boolean).join(' ').trim();
        return full || de.name || '';
    }

    /**
     * One Tabulator row. Dates stay as the ISO-like strings the service returns
     * ("2026-02-15T17:00:00.000"): they sort correctly as text and the column
     * formatter does the display.
     */
    function toRow(item) {
        var type = item.type || value(item, 'type') || '';
        var assignees = related(item, 'assignees').map(personName).filter(Boolean);
        var project = related(item, 'DPMProject')[0] || null;
        var projectData = (project && project.dataelements) || {};
        var route = related(item, 'route')[0] || null;
        var state = value(item, 'state') || '';
        // the platform's own names when it sends them, ours when it does not
        var typeNLS = value(item, 'typeNLS') || '';
        var stateNLS = value(item, 'stateNLS') || '';

        return {
            id: item.id || value(item, 'id') || '',
            type: type,
            typeLabel: typeNLS || Fields.typeLabel(type),
            stateLabel: stateNLS || Fields.stateLabel(state),
            fromPlatform: !!typeNLS,
            title: value(item, 'title') || '',
            state: state,
            // the grid shows this; the task view uses it to decide whether to
            // offer an edit control at all (user, 2026-10-07)
            editable: Fields.isEditable(state),
            assignedTo: assignees.join(', '),
            projectId: (project && project.id) || '',
            projectType: (project && project.type) || '',
            projectName: projectData.name || '',
            projectTitle: projectData.title || '',
            department: '',       // not in this payload - see O-T7
            route: (route && (route.dataelements || {}).name) || '',
            routeId: value(item, 'routeTaskRouteId') || (route && route.id) || '',
            routeTask: '',        // the approval level - the task view's call
            actionRequired: value(item, 'routeTaskAction') || '',
            finish: value(item, 'taskEstimatedFinishDate') || '',
            start: value(item, 'taskEstimatedStartDate') || ''
        };
    }

    function toRows(body) {
        var data = (body && Array.isArray(body.data)) ? body.data : [];
        return data.map(toRow);
    }

    function params(fields) {
        return {
            '$include': 'assignees,deliverables',
            '$fields': fields || FIELDS,
            showProjectTasks: 'true',
            currentTaskFilter: FILTER
        };
    }

    /**
     * Why the counts are reported: the two filters below are the widget's own,
     * so when the grid shows four rows out of two hundred the page can say why
     * instead of looking broken. The first live run needs that number more than
     * it needs a tidy note.
     */
    function note(counts) {
        if (counts.total === 0) {
            return 'The service returned no task at all. If tasks are expected, ' +
                   'check the credential - a task is only visible in the ' +
                   'collaborative space it lives in.';
        }
        if (counts.kept === 0) {
            return 'None of the ' + counts.total + ' tasks returned is one of the ' +
                   'four IRS gateway subtypes.';
        }
        var dropped = [];
        if (counts.otherType) { dropped.push(counts.otherType + ' not an IRS subtype'); }
        if (counts.copies) { dropped.push(counts.copies + ' inside a baseline or snapshot'); }
        if (counts.closed) { dropped.push(counts.closed + ' completed'); }
        return dropped.length
            ? counts.kept + ' of ' + counts.total + ' tasks shown (' +
              dropped.join(', ') + ').'
            : '';
    }

    return {
        /**
         * @param {Object} [opts]
         * @param {boolean} [opts.includeClosed]  also list Complete tasks
         * @returns {Promise<{rows: Array, counts: Object, note: string}>}
         */
        list: function (opts) {
            opts = opts || {};

            // one retry with the plain field set, in case the named fields are
            // refused - see the file comment
            var call = Request.get(PATH, { params: params() }).catch(function () {
                return Request.get(PATH, { params: params(FIELDS_FALLBACK) });
            });

            return call.then(function (body) {
                var rows = toRows(body);
                var counts = {
                    total: rows.length,
                    otherType: 0,
                    copies: 0,
                    closed: 0,
                    kept: 0,
                    nlsNames: 0
                };

                var kept = rows.filter(function (r) {
                    if (!Fields.isListed(r.type)) { counts.otherType++; return false; }
                    if (Fields.isCopy(r.projectType)) { counts.copies++; return false; }
                    if (!opts.includeClosed && Fields.isClosed(r.state)) {
                        counts.closed++;
                        return false;
                    }
                    return true;
                });
                counts.kept = kept.length;
                counts.nlsNames = kept.filter(function (r) { return r.fromPlatform; }).length;

                return { rows: kept, counts: counts, note: note(counts) };
            });
        },

        /** for tests only */
        _toRow: toRow,
        _params: params,
        _note: note
    };
});
