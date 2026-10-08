/**
 * The inbox tasks - the approval steps waiting on a person.
 *
 *     GET resources/v1/modeler/tasks
 *         $include=contents,assignees,route
 *         $fields=basics
 *         showProjectTasks=true
 *         currentTaskFilter=assigned
 *
 * ## An inbox task is not an IRS task, and the grid already knew that
 *
 * The task resource returns everything the user can see, which includes the
 * `Inbox Task` objects of every route. `TaskFields.isListed()` has filtered
 * those out of the landing grid since 2026-10-07, because an approval step is
 * not a project task and does not belong in a list of them.
 *
 * This service is the other half of that decision: it keeps **exactly what the
 * grid throws away**, and nothing else.
 *
 * ## "Check whether the task is connected to our custom task"
 *
 * That is the whole point of this file, and the platform answers it directly.
 * An inbox task carries the object being approved in `relateddata.contents`:
 *
 *     contents[0].type     EPMPROJECT_PROPOSAL      <- the test
 *     contents[0].id       the custom task's id
 *     contents[0].name     T-85756263-0000143
 *     contents[0].stateNLS "In Approval"
 *     contents[0].typeNLS  "PROJECT PROPOSAL / PROFILE"
 *
 * So the check is `Fields.isListed(contents[0].type)` - the SAME allow-list the
 * grid uses for tasks, asked of the connected object instead. An inbox task
 * belonging to some other route in the system fails it and is dropped.
 *
 * Measured live on 2026-10-08, across the 29 inbox tasks the resource returns:
 *
 *     28  connected to one of our four subtypes   -> kept
 *      1  no `contents` at all                    -> dropped
 *      0  connected to something else
 *
 * The four types seen were `EPMPROJECT_PROPOSAL`, `_PERSONNEL_COST`,
 * `_REVIEW` and `_STAGE_VALIDATION` - our complete set.
 *
 * `scopes` carries the same object as `contents` on every inbox task measured,
 * so `contents` alone is read. It is the relationship that means "the thing
 * being approved", and asking for one costs less than reconciling two.
 *
 * ## It costs ONE call, and it is the call the grid already makes
 *
 * Same resource, same parameters bar `$include`. The two lists are not merged
 * into one request today only because the grid's call omits `contents`; if the
 * landing page ever needs both at once, adding `contents` there and splitting
 * the rows in memory would make this free. Noted rather than done, because the
 * approvals view is opened deliberately and not on every page load.
 *
 * ## `currentTaskFilter=assigned`, with a caveat recorded
 *
 * `assigned` is the right intent - *"each assignee of the inbox task will see
 * the task"*. But measured on `admin_platform`, `assigned` and `all` returned
 * the **same 29 inbox tasks**; only the count of ordinary project tasks changed
 * (40 rows against 77). That login is an approver on every route here, so the
 * test could not distinguish "the filter does nothing for inbox tasks" from
 * "this user really is assigned all of them".
 *
 * **Whether another approver sees only their own rows is therefore unproven**,
 * and it is platform access control, not something this file can enforce. It
 * needs a check from a second login before anyone relies on it.
 */
define('IRSTasks/services/InboxTaskService', [
    'JazzySole/Request',
    'IRSTasks/config/TaskFields',
    'IRSTasks/Log'
], function (Request, Fields, Log) {
    'use strict';

    var PATH = 'resources/v1/modeler/tasks';
    var TYPE = 'Inbox Task';

    /**
     * The approver's own tasks. See the caveat above: on the one login that
     * could be measured this made no difference to the inbox rows, but it is
     * the correct intent and the one line to change if it proves wrong.
     */
    var FILTER = 'assigned';

    function value(item, name) {
        var de = (item && item.dataelements) || {};
        return de[name] !== undefined ? de[name] : (item ? item[name] : undefined);
    }

    function related(item, key) {
        var rd = (item && item.relateddata) || {};
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
     * The connected object, if there is one.
     *
     * Returns `null` rather than an empty shape when the inbox task has no
     * `contents`, so the caller's test is `!connected` and a half-filled row
     * can never reach the grid.
     */
    function connectedTask(item) {
        var entry = related(item, 'contents')[0] || null;
        if (!entry || !entry.id) { return null; }
        var de = entry.dataelements || {};
        return {
            id: entry.id,
            type: entry.type || '',
            // the platform's own display name when it sends one, ours otherwise
            typeLabel: de.typeNLS || Fields.typeLabel(entry.type || ''),
            name: de.name || '',
            title: de.title || '',
            stateLabel: de.stateNLS || '',
            // the test: is the thing being approved one of OUR four subtypes
            ours: Fields.isListed(entry.type || '')
        };
    }

    /** One inbox task, shaped for the grid. */
    function toRow(item) {
        var connected = connectedTask(item);
        var state = value(item, 'state') || '';
        var decision = value(item, 'routeTaskApprovalAction') || '';
        var route = related(item, 'route')[0] || null;

        return {
            id: item.id || '',
            type: item.type || '',
            /** the ROLE this step stands for - "Project Manager" */
            role: value(item, 'title') || '',
            name: value(item, 'name') || '',
            /** `Assign` while it waits, `Complete` once acted on */
            state: state,
            decided: state === 'Complete',
            /** what is asked of the approver: Approve, Comment, Notify Only */
            action: value(item, 'routeTaskAction') || '',
            /** what they did: Approve, Reject, Abstain, None - '' until decided */
            decision: decision === 'None' ? '' : decision,
            comments: value(item, 'routeTaskApprovalComments') || '',
            instructions: value(item, 'routeTaskInstructions') || '',
            dueDate: value(item, 'routeTaskDueDate') || '',
            finishedOn: value(item, 'routeTaskActualFinishDate') || '',
            requiresESign: String(value(item, 'routeTaskRequiresESign') || '')
                .toUpperCase() === 'TRUE',
            /**
             * The platform's own answer to "may this user act on it".
             * Captured now and shown; nothing acts on it yet.
             */
            modifiable: String(value(item, 'modifyAccess') || '')
                .toUpperCase() === 'TRUE',
            assignedTo: related(item, 'assignees').map(personName)
                .filter(Boolean).join(', '),
            routeId: (route && route.id) || '',
            routeName: (route && (route.dataelements || {}).name) || '',
            /** the custom task being approved - null when there is none */
            connected: connected,
            // flattened for the grid, which reads plain fields
            connectedId: connected ? connected.id : '',
            connectedName: connected ? connected.name : '',
            connectedType: connected ? connected.type : '',
            connectedTypeLabel: connected ? connected.typeLabel : '',
            connectedState: connected ? connected.stateLabel : '',
            raw: item
        };
    }

    function params() {
        return {
            // `contents` is the whole point - it is what says which object this
            // step is approving. `route` and `assignees` ride along free
            '$include': 'contents,assignees,route',
            '$fields': 'basics',
            showProjectTasks: 'true',
            currentTaskFilter: FILTER
        };
    }

    /**
     * Why the counts are reported: the filters below are ours, so when the view
     * shows two rows out of twenty-nine it can say why rather than look broken.
     * Same reasoning as `TaskService.note`.
     */
    function note(counts) {
        if (!counts.inbox) {
            return 'The service returned no inbox task at all, so there is ' +
                   'nothing waiting for approval.';
        }
        var dropped = [];
        if (counts.noContents) {
            dropped.push(counts.noContents + ' not connected to any object');
        }
        if (counts.notOurs) {
            dropped.push(counts.notOurs + ' connected to another type');
        }
        if (counts.closed) {
            dropped.push(counts.closed + ' already decided');
        }
        return counts.kept + ' of ' + counts.inbox + ' inbox tasks shown' +
               (dropped.length ? ' (' + dropped.join(', ') + ')' : '') + '.';
    }

    return {
        /**
         * Capture the inbox tasks, and keep the ones approving OUR tasks.
         *
         * @param {Object} [opts]
         * @param {boolean} [opts.includeDecided] also list steps already acted
         *        on. Off by default: the list answers "what is waiting on me",
         *        and a decided step is history - the task page's approval chain
         *        already shows that, with signatures.
         * @returns {Promise<{rows: Array, counts: Object, note: string}>}
         */
        list: function (opts) {
            opts = opts || {};
            Log.info('inbox: GET', PATH, params());

            return Request.get(PATH, { params: params() }).then(function (body) {
                var data = (body && Array.isArray(body.data)) ? body.data : [];
                var inbox = data.filter(function (item) { return item.type === TYPE; });

                var counts = {
                    total: data.length,
                    inbox: inbox.length,
                    noContents: 0,
                    notOurs: 0,
                    closed: 0,
                    kept: 0
                };

                var rows = inbox.map(toRow).filter(function (row) {
                    // the check, in order, so each reason can be counted
                    if (!row.connected) { counts.noContents += 1; return false; }
                    if (!row.connected.ours) { counts.notOurs += 1; return false; }
                    if (!opts.includeDecided && row.decided) {
                        counts.closed += 1;
                        return false;
                    }
                    return true;
                });

                counts.kept = rows.length;

                // newest first is wrong here - what matters is what is overdue,
                // so the soonest due date leads
                rows.sort(function (a, b) {
                    return String(a.dueDate).localeCompare(String(b.dueDate));
                });

                Log.info('inbox: ' + counts.inbox + ' inbox tasks, ' +
                         counts.kept + ' on our types' +
                         (counts.noContents ? ', ' + counts.noContents + ' with no contents' : '') +
                         (counts.notOurs ? ', ' + counts.notOurs + ' on other types' : '') +
                         (counts.closed ? ', ' + counts.closed + ' already decided' : ''));
                Log.table('inbox: what each row will show', rows.slice(0, 10).map(function (r) {
                    return {
                        role: r.role, state: r.state, action: r.action,
                        on: r.connectedName, onType: r.connectedTypeLabel,
                        mayAct: r.modifiable
                    };
                }));

                return { rows: rows, counts: counts, note: note(counts) };
            });
        },

        /** for tests only */
        _toRow: toRow,
        _params: params,
        _note: note,
        _connectedTask: connectedTask
    };
});
