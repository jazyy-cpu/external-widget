/**
 * One task and its project, for the task page.
 *
 * ## Why two calls, and why the page refetches at all
 *
 *     GET resources/v1/modeler/tasks/{id}?$include=assignees,deliverables&$fields=basics
 *     GET resources/v1/modeler/projects/{projectId}?$include=none
 *
 * The list already has most of the task in memory, but the page **must not**
 * depend on it: the router remembers `task/:id` in a preference, so a browser
 * refresh or a dashboard reload opens this page with nothing behind it (rule
 * R6). A page that only worked when you arrived from the list would be broken
 * every second time.
 *
 * The project call is the point of this page for the proposal form. Measured on
 * a live response (`As-Is Understanding/manual logs/ABCLogs`, 65 tasks):
 *
 *   - `EPMPROJECT_PROPOSAL` carries **no custom attribute of its own**;
 *   - `EPMPROJECT_PERSONNEL_COST` carries `EPMChangeOfScope`;
 *   - `EPMPROJECT_STAGE_VALIDATION` carries its two;
 *   - `EPMPROJECT_REVIEW` carries all seven.
 *
 * So the PROJECT PROPOSAL / PROFILE form is almost entirely **project** data -
 * which is exactly what the user said - and the form spec says per field where
 * its value comes from. The two calls go out **in parallel**; the project one is
 * only skipped when the task has no project.
 *
 * `$include=none` on the project is mandatory: the default expands the whole
 * task tree. No `$fields` there either - every EPM attribute comes back in
 * `dataelements` by itself (api.md WGT-04 section 2), and a field list would
 * have to be kept in step with the form spec for no gain.
 *
 * ## The parameters, and the one retry
 *
 * The list call's spelling is proven on this platform; the **single**-task
 * resource with those parameters is not, so a failure retries once without
 * them. Same reasoning as `ProjectService`'s state retry: one cheap fallback
 * beats a page that cannot open.
 */
define('IRSTasks/services/TaskDetailService', [
    'JazzySole/Request',
    'IRSTasks/config/TaskFields',
    'IRSTasks/Log'
], function (Request, Fields, Log) {
    'use strict';

    var TASK_PATH = 'resources/v1/modeler/tasks/';
    var PROJECT_PATH = 'resources/v1/modeler/projects/';

    function value(item, name) {
        var de = item.dataelements || {};
        return de[name] !== undefined ? de[name] : item[name];
    }

    function related(item, key) {
        var rd = item.relateddata || {};
        var list = rd[key];
        if (!list) { return []; }
        return Array.isArray(list) ? list : [list];
    }

    function personName(entry) {
        var de = (entry && entry.dataelements) || {};
        var full = [de.firstname, de.lastname].filter(Boolean).join(' ').trim();
        return full || de.name || '';
    }

    /**
     * A single-object response may arrive as `data: [ {...} ]`, as `data: {...}`
     * or as the object itself. All three are accepted rather than betting on
     * one - the same guard `ProjectDetailService` needed.
     */
    function first(body) {
        if (!body) { return null; }
        if (Array.isArray(body.data)) { return body.data[0] || null; }
        if (body.data && typeof body.data === 'object') { return body.data; }
        return (body.id || body.dataelements) ? body : null;
    }

    /**
     * The task, shaped for the page. `attributes` is the whole `dataelements`
     * map, so a form spec can name any attribute without this file knowing it.
     *
     * `typeNLS` is the platform's **own display name** for the type - "PROJECT
     * PROPOSAL / PROFILE", set in DMC. It is present on related objects in the
     * live capture but not on the task itself, so it may be absent here too;
     * the page falls back to the label in `TaskFields`. Where it does arrive, it
     * is the better answer, because changing the name in DMC then changes the
     * page with no code change.
     */
    function toTask(item) {
        var type = item.type || value(item, 'type') || '';
        var state = value(item, 'state') || '';
        var project = related(item, 'DPMProject')[0] || null;
        var projectData = (project && project.dataelements) || {};
        var document = related(item, 'deliverables')[0] || null;
        var documentData = (document && document.dataelements) || {};
        var route = related(item, 'route')[0] || null;

        return {
            id: item.id || '',
            type: type,
            typeLabel: value(item, 'typeNLS') || Fields.typeLabel(type),
            typeFromPlatform: !!value(item, 'typeNLS'),
            title: value(item, 'title') || '',
            description: value(item, 'description') || '',
            state: state,
            stateLabel: value(item, 'stateNLS') || Fields.stateLabel(state),
            editable: Fields.isEditable(state),
            owner: personName(related(item, 'ownerInfo')[0]),
            originator: personName(related(item, 'originatorInfo')[0]),
            assignees: related(item, 'assignees').map(personName).filter(Boolean),
            percentComplete: value(item, 'percentComplete') || '',
            estimatedStartDate: value(item, 'estimatedStartDate') || '',
            dueDate: value(item, 'dueDate') || '',
            actualStartDate: value(item, 'actualStartDate') || '',
            actualFinishDate: value(item, 'actualFinishDate') || '',
            projectId: (project && project.id) || '',
            projectType: (project && project.type) || '',
            projectTypeLabel: projectData.typeNLS || (project && project.type) || '',
            projectName: projectData.name || '',
            projectTitle: projectData.title || '',
            route: (route && (route.dataelements || {}).name) || '',
            // the generated form document - PPF-0000004 rev 01, In Work
            documentId: (document && document.id) || '',
            documentName: documentData.name || '',
            documentRevision: documentData.revision || '',
            documentTitle: documentData.title || '',
            documentState: documentData.stateNLS || '',
            /** every attribute the service returned, for the form spec to read */
            attributes: item.dataelements || {},
            raw: item
        };
    }

    /** The project, with its attributes left whole for the same reason. */
    function toProject(item) {
        return {
            id: item.id || '',
            type: item.type || '',
            typeLabel: value(item, 'typeNLS') || item.type || '',
            name: value(item, 'name') || '',
            title: value(item, 'title') || '',
            projectNo: value(item, 'EPMProjectNo') || '',
            state: value(item, 'state') || '',
            stateLabel: value(item, 'stateNLS') || value(item, 'state') || '',
            attributes: item.dataelements || {},
            raw: item
        };
    }

    function taskParams() {
        // the set plus the platform's own display names - see TaskService
        return { '$include': 'assignees,deliverables',
                 '$fields': 'basics,typeNLS,stateNLS' };
    }

    function getTask(id) {
        return Request.get(TASK_PATH + id, { params: taskParams() })
            .then(first, function (err) {
                // the single-object resource may not take those parameters -
                // unverified, so one retry without them rather than a dead page
                return Request.get(TASK_PATH + id).then(first, function () {
                    throw err;   // report the FIRST failure, which is the real one
                });
            });
    }

    function getProject(id) {
        return Request.get(PROJECT_PATH + id, { params: { '$include': 'none' } })
            .then(first);
    }

    return {
        /**
         * @param {string} id the task's physical id
         * @returns {Promise<{task: Object, project: Object|null, note: string}>}
         */
        get: function (id) {
            if (!id) { return Promise.reject(new Error('No task id was given.')); }

            return getTask(id).then(function (item) {
                if (!item) {
                    throw new Error('The task could not be read. It may have been ' +
                                    'deleted, or the active credential cannot see it.');
                }
                var task = toTask(item);
                Log.info('task ' + task.title + ': Task Type shows "' + task.typeLabel +
                         '", from ' + (task.typeFromPlatform
                            ? 'the platform (typeNLS)' : 'TaskFields fallback') +
                         '; status shows "' + task.stateLabel + '".');
                Log.info('task: dataelements keys =',
                         Object.keys(task.attributes).sort().join(', '));

                if (!task.projectId) {
                    return {
                        task: task, project: null,
                        note: 'This task is not attached to a project, so the ' +
                              'project data of the form cannot be shown.'
                    };
                }

                // the two calls are independent: a project that cannot be read
                // must still leave the task page usable
                return getProject(task.projectId).then(function (projectItem) {
                    if (projectItem) {
                        Log.info('project: dataelements keys =',
                                 Object.keys(projectItem.dataelements || {}).sort().join(', '));
                    }
                    return {
                        task: task,
                        project: projectItem ? toProject(projectItem) : null,
                        note: projectItem ? '' :
                            'The project could not be read, so the fields that ' +
                            'come from it are empty.'
                    };
                }, function (err) {
                    return {
                        task: task, project: null,
                        note: 'The project could not be read (' +
                              (err && err.message ? err.message : err) +
                              '), so the fields that come from it are empty.'
                    };
                });
            });
        },

        /** for tests only */
        _toTask: toTask,
        _toProject: toProject,
        _taskParams: taskParams
    };
});
