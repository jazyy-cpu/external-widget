/**
 * One task and its project, for the task page.
 *
 * ## Why two calls, and why the page refetches at all
 *
 *     GET resources/v1/modeler/tasks/{id}?$include=assignees,deliverables,references,route&$fields=basics,nlsType
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
 * ## Deliverables and attachments ride along
 *
 * `deliverables` and `references` are both `relateddata` of the task, so the
 * documents panel adds **no call at all** - it reads two lists out of the
 * response the page already has. Measured on T-85756263-0000137, 2026-10-08:
 * `deliverables` held `config.toml`, `references` held the `JIWAN TEST` PDF,
 * both with `hasfiles: "TRUE"`.
 *
 * Downloading a file IS a call, and it is `DocumentService`'s, made only when
 * the user clicks.
 *
 * ## The route rides along too, the chain does not
 *
 * `route` is `relateddata` as well, so the approval panel's entry point is
 * free: this call returns the route's id and name. The route's TASKS - the
 * inbox tasks that are the approval chain - are a second object, and reading
 * them is one more call, made by `RouteService` only when `task.routes` is
 * non-empty. 33 of the live routes were measured and 32 have a single route, so
 * that is one extra call for a task under approval and none for a task that has
 * never been sent.
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

    /**
     * The platform's display name for an object's type.
     *
     * `nlsType` is the field you ASK for in `$fields`; `typeNLS` is the key the
     * platform emits on RELATED objects. Both are read, so this works whichever
     * shape a response carries - and reading only `typeNLS`, as this file did
     * until 2026-10-08, meant the request asked for a field that does not exist
     * and the fallback label fired every time.
     */
    function nlsType(item) {
        return value(item, 'nlsType') || value(item, 'typeNLS') || '';
    }

    /**
     * One document on the task - a deliverable or an attachment.
     *
     * The two are the same object type and the same JSON, and differ only in
     * which relationship holds them, so one shaper serves both and `kind` says
     * which list it came from.
     *
     * `hasFiles` decides whether a download can be offered at all. A Document
     * may exist with nothing checked in - every deliverable in the October
     * capture was like that - and the panel must not offer a button that can
     * only fail.
     */
    function toDocument(entry, kind) {
        var de = (entry && entry.dataelements) || {};
        return {
            id: (entry && entry.id) || '',
            kind: kind,                              // 'deliverable' | 'attachment'
            name: de.name || '',
            title: de.title || '',
            revision: de.revision || '',
            type: de.typeNLS || (entry && entry.type) || '',
            state: de.stateNLS || '',
            // the platform spells these booleans as the STRINGS "TRUE"/"FALSE"
            hasFiles: String(de.hasfiles || '').toUpperCase() === 'TRUE',
            extension: de.fileExtension || '',
            icon: de.image || ''
        };
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
            typeLabel: nlsType(item) || Fields.typeLabel(type),
            typeFromPlatform: !!nlsType(item),
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
            projectTypeLabel: projectData.nlsType || projectData.typeNLS ||
                              (project && project.type) || '',
            projectName: projectData.name || '',
            projectTitle: projectData.title || '',
            route: (route && (route.dataelements || {}).name) || '',
            /**
             * Every approval route on this task, id first.
             *
             * A list, not one route: a task that was rejected and resent has
             * more than one (one task in the October capture has two), and the
             * approval panel shows each as its own cycle. `RouteService.forTask`
             * takes this and reads the chain.
             */
            routes: related(item, 'route').map(function (entry) {
                var rde = entry.dataelements || {};
                return {
                    id: entry.id || '',
                    name: rde.name || '',
                    title: rde.title || ''
                };
            }).filter(function (entry) { return !!entry.id; }),
            /**
             * Everything the task carries as a file.
             *
             * Two lists, not one, because the platform keeps two relationships
             * and they mean different things to a reader: a DELIVERABLE is what
             * this task is meant to produce, an ATTACHMENT is supporting
             * material somebody added. Merging them would lose that, and the
             * panel heads them separately for the same reason.
             */
            deliverables: related(item, 'deliverables').map(function (entry) {
                return toDocument(entry, 'deliverable');
            }),
            attachments: related(item, 'references').map(function (entry) {
                return toDocument(entry, 'attachment');
            }),
            // the FIRST deliverable, kept for the fields the page already reads
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
            typeLabel: nlsType(item) || item.type || '',
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
        // `references` is the ATTACHMENTS slot - proved on T-85756263-0000137,
        // 2026-10-08. Adding it costs NOTHING: it rides in the call the page
        // already makes, so the documents panel needs no round trip of its own
        // `route` rides along for the same reason: the approval chain's entry
        // point is `relateddata.route`, so finding the route costs NOTHING.
        // `RouteService` makes the one call that reads the chain itself
        return { '$include': 'assignees,deliverables,references,route',
                 '$fields': 'basics,nlsType' };
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
        return Request.get(PROJECT_PATH + id, {
            params: { '$include': 'none', '$fields': 'nlsType' }
        }).then(first);
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
                            ? 'the platform (nlsType)' : 'TaskFields fallback') +
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
