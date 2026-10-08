/**
 * The approval route behind a task, and the inbox tasks on it.
 *
 * ## How a task reaches its route
 *
 *     task.relateddata.route[]  ->  route physical id
 *     GET resources/v1/modeler/dsrt/routes/{routeId}?$include=tasks
 *
 * **The task already carries the route.** `route` is `relateddata` of the task,
 * exactly like `deliverables` and `references`, so finding the route costs no
 * call at all - `TaskDetailService` asks for it in the one request the page
 * already makes. This service makes the SECOND call, the one that reads the
 * route's own approval chain, and only when the task actually has a route.
 *
 * That is also the answer to *"we need to check whether the task is connected
 * to our custom task"*. We never search routes and then test them: we start
 * from OUR task's own `relateddata.route`, so every route this service reads is
 * connected to that task by construction. Verified from the other direction
 * too - an inbox task's `relateddata.scopes[0]` and `relateddata.contents[0]`
 * both point back at the custom task, carrying its name and its
 * `EPMPROJECT_*` type (measured on inbox task `IT-85756263-0000169`,
 * 2026-10-08).
 *
 * ## `$include=tasks` is undocumented but proven
 *
 * The 2024x `Routes Web Services` OpenAPI spec declares no `$include` on
 * `GET /dsrt/routes/{routeId}`, and declares no route-tasks operation at all -
 * the API-labs validator rejects the parameter for exactly that reason. It
 * nonetheless works, and is the only way to read the chain in one call. It was
 * measured against **33 live routes** on 2026-10-08, every route reachable from
 * the 75 tasks the landing list returns:
 *
 *     Finished  / Approved               28   every step `Inbox Task`, Complete
 *     Not Started / Not Started           4   every step `Route Node`
 *     Started   / Awaiting your Approval  1   step 1 `Inbox Task`/Assigned,
 *                                             steps 2-3 still `Route Node`
 *
 * Both POCs use the same call: `Task_POC.js` route inspection, and the JBM
 * widget's `ChangeSummary.js`. It is the one spelling of this known to work
 * here.
 *
 * ## The two kinds of step - this is the whole state machine
 *
 * `tasks[]` mixes two types, and the difference IS the progress indicator:
 *
 *   - **`Inbox Task`** - the step has been activated. It has `current`
 *     (`Assigned` while it waits, `Complete` once acted on) and
 *     `approvalStatus` (`None`, `Approve`, `Reject`).
 *   - **`Route Node`** - the step exists but has not been reached. It has
 *     NEITHER field. Showing it is the point: it is what tells a reader who is
 *     still to come.
 *
 * So "the inbox task will come when the task goes into approval" is literally
 * what the data does - a step is a `Route Node` until the route reaches it, and
 * becomes an `Inbox Task` at that moment.
 *
 * ## Two corrections to the POC's documented behaviour
 *
 * Both were checked rather than copied, and both matter:
 *
 *  1. **The role is `title`, not `assigneeTitle`.** `Task_POC.js` maps
 *     `assigneeTitle` to its sign-off fields. On live data `assigneeTitle` is
 *     useless: across the three steps of the finished route it came back `""`,
 *     `""` and the literal string `"title"`. `title` held `Project Manager`,
 *     `In-Charge / HOD`, `Division Head` - and that matches the inbox task's
 *     own `dataelements.title`. Note `Division Head`, where the POC's table
 *     says `Divisional Head`; a hardcoded role-to-field map would have missed
 *     it, which is why this service returns the chain as an ORDERED LIST and
 *     lets the view render whatever roles the route actually has.
 *  2. **`revision` and `isLatestRevision` do not exist** on this platform.
 *     The POC keeps only the route with `isLatestRevision === 'TRUE'`; neither
 *     field was present on any of the 33 routes, so that test would discard
 *     every route. Every route is therefore kept, in the order the task lists
 *     them, and the view shows each as its own cycle. One task in the October
 *     capture has two routes (rejected, then restarted), so the multi-route
 *     case is real - what it is NOT yet is orderable. See the open item in the
 *     devlog.
 *
 * ## Cost
 *
 * One call per route, made only when `task.routes` is non-empty, and 32 of the
 * 33 live routes have exactly one. They go out together rather than in
 * sequence, and a route that fails to read leaves the others standing - the
 * same rule as the project call on this page.
 */
define('IRSTasks/services/RouteService', [
    'JazzySole/Request',
    'IRSTasks/Log'
], function (Request, Log) {
    'use strict';

    var ROUTE_PATH = 'resources/v1/modeler/dsrt/routes/';

    /**
     * The route resource answers FLAT - `state` and `routeStatus` sit directly
     * on the object, with no `dataelements` wrapper (verified live). The POC's
     * own analysis note shows them nested, but its code reads them flat and the
     * code is right. Both are read anyway, for the same reason the task service
     * does: it costs one `||` and removes a bet.
     */
    function value(item, name) {
        if (!item) { return ''; }
        var de = item.dataelements || {};
        return item[name] !== undefined ? item[name]
             : (de[name] !== undefined ? de[name] : '');
    }

    function first(body) {
        if (!body) { return null; }
        if (Array.isArray(body.data)) { return body.data[0] || null; }
        if (body.data && typeof body.data === 'object') { return body.data; }
        return (body.id || body.dataelements) ? body : null;
    }

    /**
     * One step of the chain.
     *
     * `pending` is the single thing the view branches on, and it is derived
     * from the TYPE rather than from `current` being empty - a `Route Node`
     * carries no `current` at all, so testing the type says what is meant
     * instead of inferring it from an absence.
     */
    function toStep(entry) {
        var type = value(entry, 'type') || (entry && entry.type) || '';
        var pending = type === 'Route Node';
        var current = value(entry, 'current');

        return {
            id: (entry && entry.id) || '',
            type: type,
            pending: pending,
            // the step number the platform itself assigns - a string ("1"),
            // so it is made a number here for sorting
            order: parseInt(value(entry, 'taskOrder'), 10) || 0,
            /** the ROLE - `title`, not `assigneeTitle`; see the module comment */
            role: value(entry, 'title') || value(entry, 'assigneeTitle') || '',
            name: value(entry, 'name') || '',
            assignee: value(entry, 'taskAssignee') || '',
            assigneeUsername: value(entry, 'taskAssigneeUsername') || '',
            /** what was ASKED of the approver: `Approve`, `Notify`, ... */
            action: value(entry, 'taskAction') || '',
            /**
             * What they DID: `Approve` or `Reject`, and `''` until they have.
             *
             * The platform spells "not decided yet" as the STRING `"None"`,
             * which is truthy - so passing it through made a waiting step look
             * decided, and the panel drew that approver's signature against a
             * step they had not signed (seen live, 2026-10-08). `None` is
             * normalised away here so no caller can repeat the mistake.
             */
            decision: (function () {
                if (pending) { return ''; }
                var status = value(entry, 'approvalStatus') || '';
                return status === 'None' ? '' : status;
            }()),
            /** `Assigned` while it waits, `Complete` once acted on */
            state: pending ? '' : current,
            waiting: !pending && current !== 'Complete',
            dueDate: value(entry, 'taskDueDate') || '',
            completedOn: value(entry, 'taskActualCompletionDate') || '',
            instructions: value(entry, 'instructions') || '',
            comments: value(entry, 'comments') || '',
            requiresESign: String(value(entry, 'requiresEsign') ||
                                  value(entry, 'routeTaskRequiresESign') ||
                                  '').toUpperCase() === 'TRUE'
        };
    }

    function steps(item) {
        var list = (item && item.tasks) || [];
        if (!Array.isArray(list)) { list = [list]; }
        return list.map(toStep).sort(function (a, b) { return a.order - b.order; });
    }

    /**
     * One route, with its chain.
     *
     * `routeStatus` is the field to read, not `state`: `state` is `Complete`
     * for BOTH a finished route and a rejected one (`Stopped`), which is the
     * trap the POC's own analysis records. `activityState` is the platform's
     * own words for the same thing and is shown as-is, because it is already
     * the sentence a reader wants - "Awaiting your Approval".
     */
    function toRoute(item) {
        var status = value(item, 'routeStatus') || '';
        var chain = steps(item);

        return {
            id: (item && item.id) || '',
            name: value(item, 'name') || '',
            title: value(item, 'title') || '',
            description: value(item, 'description') || '',
            state: value(item, 'state') || '',
            status: status,                                  // Not Started | Started | Stopped | Finished
            activityState: value(item, 'activityState') || '',
            owner: value(item, 'ownerFullName') || value(item, 'owner') || '',
            completionAction: value(item, 'routeCompletionAction') || '',
            started: status === 'Started',
            finished: status === 'Finished',
            notStarted: status === 'Not Started',
            // a rejected route is `Stopped` AND `Complete` - `Complete` alone
            // is also what a finished route says, so both are required
            rejected: status === 'Stopped',
            steps: chain,
            /** the step the route is sitting on, or null when it sits on none */
            currentStep: chain.filter(function (s) { return s.waiting; })[0] || null,
            raw: item
        };
    }

    function getRoute(id) {
        return Request.get(ROUTE_PATH + id, { params: { '$include': 'tasks' } })
            .then(first, function (err) {
                // `$include` is undocumented, so a platform that rejects it
                // must still give the route's header rather than nothing - the
                // panel then shows the status with no chain under it
                Log.warn('route ' + id + ': reading the chain failed (' +
                         ((err && err.message) || err) + '); retrying without $include');
                return Request.get(ROUTE_PATH + id).then(first);
            }).then(function (item) {
                if (!item) { throw new Error('The route could not be read.'); }
                return toRoute(item);
            });
    }

    return {
        /**
         * Every route on a task, each with its approval chain.
         *
         * @param {Object} task as shaped by `TaskDetailService` - reads `routes`
         * @returns {Promise<Array>} one entry per route that could be read, in
         *          the order the task lists them. Resolves to `[]` when the
         *          task has no route - which is the normal case for a task that
         *          has not been sent for approval yet, and is not an error.
         */
        forTask: function (task) {
            var routes = (task && task.routes) || [];
            if (!routes.length) { return Promise.resolve([]); }

            // in parallel, and one failure must not cost the others - a task
            // with two routes where the older one is unreadable should still
            // show the current one
            return Promise.all(routes.map(function (entry) {
                return getRoute(entry.id).then(function (route) {
                    Log.info('route ' + route.name + ': ' + route.status +
                             ' / ' + route.activityState + ', ' +
                             route.steps.length + ' step(s)' +
                             (route.currentStep
                                ? ', waiting on ' + route.currentStep.role
                                : ''));
                    return route;
                }, function (err) {
                    Log.warn('route ' + entry.id + ' could not be read: ' +
                             ((err && err.message) || err));
                    return null;
                });
            })).then(function (list) {
                return list.filter(Boolean);
            });
        },

        /** for tests only */
        _toRoute: toRoute,
        _toStep: toStep
    };
});
