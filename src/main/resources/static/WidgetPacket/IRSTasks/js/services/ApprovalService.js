/**
 * Approving or rejecting an inbox task - the widget's **first write**.
 *
 *     GET resources/v1/modeler/tasks/{inboxTaskId}          may I act?
 *     PUT resources/v1/modeler/tasks/{inboxTaskId}          the decision
 *
 *         { data: [ { id, dataelements: {
 *               routeTaskApprovalAction:   'Approve' | 'Reject',
 *               routeTaskApprovalComments: '...',
 *               state:                     'Complete'
 *         } } ] }
 *
 * ## This is documented, and the POC's version is not
 *
 * Checked against the 2024x `Task Rest Services` spec rather than copied from
 * `Task_POC_RouteTaskForm.js`, and the two differ in three ways:
 *
 *   - the POC sends **POST**; the documented operation is **PUT**
 *     (`PUT /resources/v1/modeler/tasks/{taskId}`, "Update an existing task");
 *   - the POC adds `updateAction: 'MODIFY'`, which **does not appear anywhere
 *     in the request-body schema** - it is being ignored or merely tolerated;
 *   - the POC's own header comment claims `PUT .../tasks/{id}?action=Approve`,
 *     which matches neither its code nor the spec. It is stale.
 *
 * The three fields themselves are right, and all three are writable in the
 * schema. `routeTaskApprovalAction` is an enumeration:
 * **`Approve`, `Reject`, `Abstain`, `None`**.
 *
 * `Abstain` is NOT offered by this widget. It is a real platform value, but no
 * route on this system has ever used anything but `Approve`, and what it does
 * to a route's progress has not been observed here. Offering a control whose
 * effect we have not seen is worse than leaving it out; it can be added once
 * someone needs it and the behaviour has been watched.
 *
 * There is no approve or complete operation in the Routes API at all - this
 * resource is the sanctioned way.
 *
 * ## `state: 'Complete'` is what advances the route
 *
 * The decision fields record WHAT was decided; moving the inbox task to
 * `Complete` is what finishes the step and lets the route move to the next one.
 * Writing the decision without the state would leave the route sitting on a
 * step that has already been answered.
 *
 * ## Why `Request.send` and not `fetch`
 *
 * PUT is a write, so the CSRF token is mandatory. `JazzySole/Request` holds the
 * token, attaches it on write methods, and refetches once on a token failure
 * (rule R5). The same reason `DocumentService` routes through it.
 *
 * ## "May I act on this?" is the platform's answer, not ours
 *
 * `modifyAccess` on the inbox task is the platform's own per-user verdict, so
 * that is what the panel asks. The alternative - comparing the signed-in user's
 * login against the step's `taskAssigneeUsername` - would be re-implementing an
 * access rule in the client, and would be wrong the moment a route allows a
 * delegate or a group assignee.
 *
 * It costs one GET, made only when a route actually has a step waiting. The
 * route's own `tasks[]` payload does not carry `modifyAccess` (checked - 25
 * keys, and it is not among them), so it cannot come for free.
 *
 * ## It cannot be undone from here
 *
 * A submitted decision advances a live route. There is no un-approve in this
 * widget and none in the Routes API. The caller is expected to confirm first.
 */
define('IRSTasks/services/ApprovalService', [
    'JazzySole/Request',
    'IRSTasks/Log'
], function (Request, Log) {
    'use strict';

    var PATH = 'resources/v1/modeler/tasks/';

    /** What the platform accepts. `Abstain` is deliberately not offered. */
    var DECISIONS = ['Approve', 'Reject'];

    function value(item, name) {
        var de = (item && item.dataelements) || {};
        return de[name] !== undefined ? de[name] : (item ? item[name] : undefined);
    }

    function first(body) {
        if (!body) { return null; }
        if (Array.isArray(body.data)) { return body.data[0] || null; }
        if (body.data && typeof body.data === 'object') { return body.data; }
        return (body.id || body.dataelements) ? body : null;
    }

    return {
        DECISIONS: DECISIONS,

        /**
         * May the signed-in user act on this step, and what is being asked?
         *
         * @param {string} inboxTaskId the step's own id - a route step's `id`
         *        IS the inbox task's id (verified live, 2026-10-08)
         * @returns {Promise<{modifiable, action, decision, state, instructions}>}
         *          `modifiable: false` rather than a rejection when the answer
         *          is simply no, so the caller has one path for "cannot act"
         */
        check: function (inboxTaskId) {
            if (!inboxTaskId) {
                return Promise.resolve({ modifiable: false });
            }
            return Request.get(PATH + inboxTaskId).then(first).then(function (item) {
                if (!item) { return { modifiable: false }; }
                var decision = value(item, 'routeTaskApprovalAction') || '';
                return {
                    // ENOVIA booleans are the STRINGS "TRUE"/"FALSE"
                    modifiable: String(value(item, 'modifyAccess') || '')
                        .toUpperCase() === 'TRUE',
                    state: value(item, 'state') || '',
                    action: value(item, 'routeTaskAction') || '',
                    // `None` means "not decided" - it must not read as a decision
                    decision: decision === 'None' ? '' : decision,
                    instructions: value(item, 'routeTaskInstructions') || '',
                    role: value(item, 'title') || '',
                    requiresESign: String(value(item, 'routeTaskRequiresESign') || '')
                        .toUpperCase() === 'TRUE'
                };
            }, function (err) {
                // a step we cannot read is a step we must not offer to act on
                Log.warn('approval: could not read inbox task ' + inboxTaskId +
                         ': ' + ((err && err.message) || err));
                return { modifiable: false };
            });
        },

        /**
         * Submit the decision. **This advances a live route and cannot be
         * undone from this widget** - confirm with the user before calling it.
         *
         * @param {string} inboxTaskId
         * @param {string} decision 'Approve' or 'Reject'
         * @param {string} [comment]
         * @returns {Promise<Object>} the response body on success
         */
        decide: function (inboxTaskId, decision, comment) {
            if (!inboxTaskId) {
                return Promise.reject(new Error('No inbox task was given.'));
            }
            if (DECISIONS.indexOf(decision) < 0) {
                // a typo here would write a value the route cannot interpret
                return Promise.reject(new Error(
                    'The decision must be one of: ' + DECISIONS.join(', ') + '.'));
            }

            Log.info('approval: submitting ' + decision + ' on ' + inboxTaskId +
                     (comment ? ' with a comment' : ' with no comment'));

            return Request.send(PATH + inboxTaskId, {
                method: 'PUT',
                data: {
                    data: [{
                        id: inboxTaskId,
                        dataelements: {
                            routeTaskApprovalAction: decision,
                            routeTaskApprovalComments: comment || '',
                            // what actually finishes the step and lets the
                            // route move on - see the module comment
                            state: 'Complete'
                        }
                    }]
                }
            }).then(function (body) {
                // several DS services answer HTTP 200 with the failure inside
                // the body; `Request` catches `success === false`, but a
                // statusCode past 400 can still arrive on a "successful" call
                if (body && body.statusCode && body.statusCode >= 400) {
                    throw new Error(body.message ||
                        'The platform refused the decision (' + body.statusCode + ').');
                }
                Log.info('approval: ' + decision + ' accepted on ' + inboxTaskId);
                return body;
            }, function (err) {
                // the transport's own words are a URL and a status code - the
                // user saw `NetworkError: URL "https://..." return
                // ResponseCode with value "400"`, which says nothing about
                // what to do. A refusal here nearly always means the step is
                // not the signed-in user's to decide
                var status = (err && (err.status ||
                    (/value "(\d{3})"/.exec(err.message || '') || [])[1])) || '';
                if (String(status) === '400' || String(status) === '403') {
                    throw new Error(
                        'The platform would not accept this decision (' + status +
                        '). The usual cause is that the step is assigned to ' +
                        'someone else, or has already been decided.');
                }
                throw err;
            });
        }
    };
});
