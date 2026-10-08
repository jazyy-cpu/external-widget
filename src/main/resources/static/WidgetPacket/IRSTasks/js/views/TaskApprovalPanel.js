/**
 * The approval chain, horizontally, below the form.
 *
 * One box per step, left to right in the platform's own `taskOrder`, with an
 * arrow between them - the shape of the platform's own route diagram, which the
 * user showed as the thing to match (2026-10-08). Each box carries the role,
 * the approver, their **signature**, the date, and the approval comment.
 *
 * ## Why below the form and not beside it
 *
 * It began in the right sidebar under the documents (Update 10). The user moved
 * it: *"can we have route coming horizontally and below the form"*. A horizontal
 * strip wants the full page width, and the sidebar is a quarter of it - three
 * boxes in `col-xl-4` would each be about 70px wide. Below the form it gets the
 * whole width and the chain reads as a flow.
 *
 * The sidebar panel is **gone**, not duplicated: one home for the chain.
 *
 * ## The box
 *
 *     +- 1 ------------- Approved -+
 *     | Project Manager            |   the role, which is `title` on the step
 *     | Sharad S Dhavalikar        |   the approver
 *     | .......................... |
 *     |      [ signature SVG ]     |   only once the step is decided
 *     | .......................... |
 *     | Completed  8 Oct 2026      |   or "Due ..." while it waits
 *     | "approve"                  |   the approval comment
 *     +----------------------------+
 *
 * A **pending** step (`Route Node`) gets the same frame greyed, with a hollow
 * number and no signature, date or comment - it has none of them, because the
 * route has not reached it. Drawing an empty row would read as missing data;
 * drawing it muted reads as "not yet", which is what it is.
 *
 * ## Overflow: it scrolls sideways, it never wraps or shrinks
 *
 * The user's choice, and the right one: a wrapped chain puts an arrow pointing
 * off the end of a line, and a shrunk chain squashes the signature strip to
 * nothing past three or four steps. Fixed-width boxes in a scrolling strip keep
 * the left-to-right reading at any width. Two or three steps - every route on
 * this system - fit without scrolling at full width.
 *
 * ## The signature
 *
 * `SignatureService` keys off `taskAssigneeUsername`, which the step already
 * carries, so no person lookup is needed. It resolves to `null` rather than
 * rejecting when a person has no signature on file, which is the normal case
 * outside the three-login pilot - so the strip is simply left out and nothing
 * announces its absence.
 *
 * It is only shown on a step that has been **decided**. A signature against a
 * step nobody has acted on would be a claim the data does not make.
 */
define('IRSTasks/views/TaskApprovalPanel', [
    'IRSTasks/services/RouteService',
    'IRSTasks/services/SignatureService',
    'IRSTasks/services/ApprovalService',
    'IRSTasks/services/SessionService',
    'IRSTasks/Log'
], function (RouteService, SignatureService, ApprovalService, SessionService, Log) {
    'use strict';

    var DASH = '–';

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined && text !== null) { node.textContent = text; }
        return node;
    }

    /**
     * The colour of a route's status.
     *
     * `Stopped` must not be mistaken for `Finished`: both leave the route's
     * `state` at `Complete`, and only `routeStatus` separates a rejection from
     * an approval.
     */
    function statusClass(route) {
        if (route.rejected) { return 'text-bg-danger'; }
        if (route.finished) { return 'text-bg-success'; }
        if (route.started) { return 'text-bg-primary'; }
        return 'text-bg-secondary';
    }

    /** What a step's badge says, and in what colour. */
    function stepBadge(step) {
        if (step.pending) {
            return { text: 'Not yet reached', className: 'text-bg-light border text-secondary' };
        }
        if (step.decision === 'Reject') {
            return { text: 'Rejected', className: 'text-bg-danger' };
        }
        if (step.decision === 'Approve') {
            return { text: 'Approved', className: 'text-bg-success' };
        }
        if (step.waiting) {
            // the inbox task that is live right now. `taskAction` is the
            // platform's verb ("Approve", "Notify") and "Awaiting Approve" is
            // not English, so the common one is named properly
            return { text: step.action === 'Approve' ? 'Awaiting approval'
                         : (step.action ? 'Awaiting ' + step.action : 'Awaiting action'),
                     className: 'text-bg-warning' };
        }
        return { text: step.state || DASH, className: 'text-bg-secondary' };
    }

    /**
     * A date, as short as it can be without losing the year.
     *
     * The platform spells these two different ways in the SAME response -
     * `taskDueDate` is ISO (`2026-10-08T07:37:08.000Z`) and
     * `taskActualCompletionDate` is US display (`10/7/2026 1:07:21 PM`). Both
     * are reduced to `8 Oct 2026`; anything unparseable is shown as it came,
     * because a date we cannot read is still better than a dash.
     */
    function shortDate(text) {
        if (!text) { return ''; }
        var parsed = new Date(text);
        if (isNaN(parsed.getTime())) { return text; }
        return parsed.getDate() + ' ' +
               ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parsed.getMonth()] +
               ' ' + parsed.getFullYear();
    }

    /** The platform stores comments as HTML; this takes the words out of it. */
    function plainText(html) {
        if (!html) { return ''; }
        var scratch = document.createElement('div');
        scratch.innerHTML = html;
        return (scratch.textContent || '').replace(/\s+/g, ' ').trim();
    }

    /**
     * The signature strip.
     *
     * Added asynchronously and only if there is one: the element is created
     * empty and the image appended when the service answers, so a step with no
     * signature leaves no gap and no placeholder behind.
     */
    function signature(step) {
        var strip = el('div', 'irs-sign-strip border-top border-bottom my-1');

        SignatureService.get(step.assigneeUsername).then(function (url) {
            if (!url) {
                // no signature on file - normal outside the three-login pilot.
                // the empty strip is removed so the box closes up
                if (strip.parentNode) { strip.parentNode.removeChild(strip); }
                return;
            }
            var img = el('img', 'irs-sign d-block mx-auto');
            img.src = url;
            img.alt = 'Signature of ' + (step.assignee || step.assigneeUsername);
            strip.appendChild(img);
        });

        return strip;
    }

    /** One step, as a fixed-width box in the strip. */
    function stepBox(step) {
        var box = el('div', 'card irs-step-box flex-shrink-0' +
                            (step.pending ? ' opacity-75' : ''));
        if (step.waiting) { box.className += ' border-warning border-2'; }

        var body = el('div', 'card-body p-2');

        // ---- the top line: step number, and what happened
        var top = el('div', 'd-flex align-items-center gap-2 mb-1');
        top.appendChild(el('span',
            'badge rounded-pill flex-shrink-0 ' +
            (step.pending ? 'text-bg-light border text-secondary' : 'text-bg-secondary'),
            String(step.order || DASH)));
        var badge = stepBadge(step);
        top.appendChild(el('span',
            'badge rounded-pill ms-auto ' + badge.className, badge.text));
        body.appendChild(top);

        // ---- who
        body.appendChild(el('div', 'fw-semibold text-break',
                            step.role || step.name || 'Step ' + step.order));
        body.appendChild(el('div', 'small text-secondary text-break',
                            step.assignee || (step.pending ? 'not assigned yet' : '')));

        // ---- the signature, on a decided step only
        if (!step.pending && step.decision) {
            body.appendChild(signature(step));
        }

        // ---- when: the completion date, else the due date
        var when = step.completedOn
            ? 'Completed ' + shortDate(step.completedOn)
            : (step.dueDate ? 'Due ' + shortDate(step.dueDate) : '');
        if (when) {
            body.appendChild(el('div', 'small text-secondary mt-1', when));
        }

        // ---- the approval comment
        var comment = plainText(step.comments);
        if (comment) {
            body.appendChild(el('div', 'small fst-italic text-break mt-1',
                                '“' + comment + '”'));
        }

        box.appendChild(body);
        return box;
    }

    /** The arrow between two boxes. */
    function arrow() {
        var wrap = el('div', 'd-flex align-items-center flex-shrink-0 text-secondary px-1');
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('aria-hidden', 'true');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M1 7.25h10.19L8.22 4.28 9.28 3.22 14.06 8l-4.78 4.78-1.06-1.06 2.97-2.97H1z');
        svg.appendChild(path);
        wrap.appendChild(svg);
        return wrap;
    }

    /**
     * The decision bar: comment, Approve, Reject - and a confirm step.
     *
     * ## Why it is here and not on a page of its own
     *
     * The approver's question is *"is this form right"*, and the form is on
     * this page. A separate approval screen would mean reading the form, going
     * somewhere else, and deciding from memory. The bar sits directly under the
     * chain, which is where the reader already is when they see their own step
     * highlighted.
     *
     * ## Who gets it
     *
     * Only when the route has a step WAITING, and only when the platform says
     * the signed-in user may modify that step (`modifyAccess`). That verdict is
     * asked of the platform rather than worked out here - see `ApprovalService`.
     *
     * ## The comment rule
     *
     * **Required to reject, optional to approve.** A rejection sends the form
     * back to someone who then has to work out what to change; a rejection with
     * no reason is unactionable. An approval needs no justification, and
     * demanding one produces comments like "ok" - which is exactly what the
     * live data already shows ("ASDFASD", "FASDF").
     *
     * ## Two clicks, because there is no undo
     *
     * Submitting advances a live route, and neither this widget nor the Routes
     * API can reverse it. So the first click arms the decision and says what
     * will happen; the second sends it. Cancel is always available until then.
     */
    function decisionBar(route, step, onDone) {
        /*
         * The bar carries no Bootstrap size utility, and it cannot: `fs-6` and
         * friends are all `rem`, this widget scales its root, and 1rem here
         * measures **10px** - so `fs-6` made the bar SMALLER, not larger
         * (measured 2026-10-08, which is how this was caught). Its size is one
         * absolute rule in the stylesheet instead, matching the form.
         */
        var wrap = el('div', 'irs-decide border-top mt-3 pt-3');

        wrap.appendChild(el('div', 'fw-semibold fs-5 mb-1',
            'Your decision \u2013 ' + (step.role || 'this step')));
        if (step.instructions) {
            wrap.appendChild(el('div', 'text-secondary mb-2 text-break',
                                step.instructions));
        }

        // full-size, and three rows: a one-line box invites a one-word reason,
        // and the reason is the whole point of a rejection
        var comment = el('textarea', 'form-control mb-2');
        comment.rows = 3;
        comment.placeholder = 'Comment (required to reject)';
        comment.setAttribute('aria-label', 'Approval comment');
        wrap.appendChild(comment);

        var buttons = el('div', 'd-flex flex-wrap align-items-center gap-2');
        // full-size with real padding: these are the two controls on the page
        // that do something irreversible, and they were the smallest on it
        var approve = el('button', 'btn btn-success px-4', 'Approve');
        approve.type = 'button';
        var reject = el('button', 'btn btn-outline-danger px-4', 'Reject');
        reject.type = 'button';
        var message = el('div', 'ms-2');
        buttons.appendChild(approve);
        buttons.appendChild(reject);
        buttons.appendChild(message);
        wrap.appendChild(buttons);

        // a rejection with no reason is unactionable for whoever has to fix it
        function syncReject() {
            reject.disabled = !comment.value.trim();
            reject.title = reject.disabled
                ? 'A comment is required to reject' : 'Reject this task';
        }
        comment.addEventListener('input', function () {
            if (!armed) { syncReject(); }
        });

        var armed = null;     // the decision waiting for its second click
        var busy = false;

        function reset() {
            armed = null;
            approve.className = 'btn btn-success px-4';
            approve.textContent = 'Approve';
            reject.className = 'btn btn-outline-danger px-4';
            reject.textContent = 'Reject';
            message.textContent = '';
            message.className = 'ms-2';
            comment.disabled = false;
            approve.disabled = false;
            syncReject();
        }

        function arm(decision) {
            armed = decision;
            var confirming = decision === 'Approve' ? approve : reject;
            var other = decision === 'Approve' ? reject : approve;
            confirming.textContent = 'Confirm ' + decision.toLowerCase();
            confirming.className = 'btn px-4 btn-' +
                (decision === 'Approve' ? 'success' : 'danger');
            other.textContent = 'Cancel';
            other.className = 'btn btn-outline-secondary px-4';
            other.disabled = false;
            message.className = 'ms-2 text-danger';
            message.textContent = decision === 'Approve'
                ? 'This advances the route to the next approver. It cannot be undone.'
                : 'This rejects the task and stops the route. It cannot be undone.';
        }

        function submit(decision) {
            busy = true;
            approve.disabled = true;
            reject.disabled = true;
            comment.disabled = true;
            message.className = 'ms-2 text-secondary';
            message.textContent = 'Submitting\u2026';

            ApprovalService.decide(step.id, decision, comment.value.trim())
                .then(function () {
                    busy = false;
                    message.className = 'ms-2 text-success fw-semibold';
                    message.textContent = decision === 'Approve'
                        ? 'Approved.' : 'Rejected.';
                    // the chain is now out of date in every respect - who it
                    // waits on, the signatures, the route's own status - so it
                    // is re-read rather than patched in place
                    if (onDone) { onDone(); }
                }, function (err) {
                    busy = false;
                    reset();
                    message.className = 'ms-2 text-danger';
                    message.textContent = 'The decision was not accepted: ' +
                        ((err && err.message) ? err.message : String(err));
                    Log.warn('approval: ' + message.textContent);
                });
        }

        function handle(decision) {
            return function () {
                if (busy) { return; }
                if (armed === decision) { submit(decision); return; }
                if (armed) { reset(); return; }   // the other button is Cancel
                if (decision === 'Reject' && !comment.value.trim()) { return; }
                arm(decision);
            };
        }

        approve.addEventListener('click', handle('Approve'));
        reject.addEventListener('click', handle('Reject'));
        syncReject();

        return wrap;
    }

    /** One route: its status line, then its steps in a scrolling strip. */
    function routeBlock(route, index, total, onDone) {
        var wrap = el('div', 'irs-route' + (index ? ' mt-3 pt-3 border-top' : ''));

        var head = el('div', 'd-flex align-items-center gap-2 mb-2');
        // numbered only when there IS more than one - "Cycle 1" on its own
        // invites the question "where are the others"
        head.appendChild(el('span', 'fw-semibold',
                            total > 1 ? 'Cycle ' + (index + 1) : 'Route'));
        head.appendChild(el('span', 'badge rounded-pill ' + statusClass(route),
                            route.status || DASH));
        if (route.activityState && route.activityState !== route.status) {
            head.appendChild(el('span', 'small text-secondary', route.activityState));
        }
        wrap.appendChild(head);

        if (!route.steps.length) {
            wrap.appendChild(el('div', 'small fst-italic text-secondary',
                                'The route carries no steps, or they could not be read.'));
            return wrap;
        }

        // `overflow-auto` is Bootstrap's; the boxes keep their width because
        // they are `flex-shrink-0`, so the strip scrolls instead of squashing
        var strip = el('div', 'd-flex align-items-stretch overflow-auto pb-2');
        route.steps.forEach(function (step, i) {
            if (i) { strip.appendChild(arrow()); }
            strip.appendChild(stepBox(step));
        });
        wrap.appendChild(strip);

        /*
         * The decision bar, if there is a step waiting AND the platform says
         * this user may act on it.
         *
         * The check is one GET, made only when a route is actually sitting on
         * someone - never on a finished, rejected or unstarted route. It is
         * asynchronous, so the bar appears a moment after the chain; that is
         * better than holding the whole chain back for a question that only
         * matters to one reader in three.
         */
        if (route.currentStep && route.currentStep.id) {
            var step = route.currentStep;

            /*
             * TWO questions, and the first one is the one that matters.
             *
             *   1. is this step MINE?   login vs `taskAssigneeUsername`
             *   2. will the platform let me write it?   `modifyAccess`
             *
             * Only (2) was asked at first, and it was the wrong question: on
             * 2026-10-08 `admin_platform` saw `modifyAccess: TRUE` on a step
             * assigned to `PlmUser2`, so the bar appeared for somebody else's
             * approval and the submission came back **HTTP 400**. It means
             * "may you edit this object", which an administrator may, and not
             * "is this your approval to give".
             *
             * This is what the user hit immediately after approving step 1:
             * the chain reloaded correctly onto step 2 - which is theirs to
             * SEE but not to decide - and offered it anyway.
             */
            SessionService.isMe(step.assigneeUsername).then(function (mine) {
                if (!mine) {
                    // somebody else's step. The chain already names them, so
                    // nothing more needs saying here
                    return null;
                }
                return ApprovalService.check(step.id).then(function (verdict) {
                    if (!verdict.modifiable) {
                        // it IS this user's step, but the platform will not
                        // take a write on it - a locked or closed object
                        wrap.appendChild(el('div',
                            'small fst-italic text-secondary mt-3',
                            'This step is assigned to you, but the platform ' +
                            'will not accept a decision on it at the moment.'));
                        return null;
                    }
                    step.instructions = step.instructions || verdict.instructions;
                    wrap.appendChild(decisionBar(route, step, onDone));
                    return null;
                });
            });
        }

        return wrap;
    }

    return {
        /**
         * The section, for placing below the form. Renders its frame at once
         * and fills it when the route reads, so the page never waits on a call
         * that only some tasks make.
         *
         * @param {Object} task as shaped by `TaskDetailService`
         * @returns {HTMLElement} the section, ready to append
         */
        render: function (task) {
            var panel = el('div', 'card irs-docs irs-approval mt-3');

            var header = el('div', 'card-header d-flex align-items-center gap-2 py-2 px-3');
            header.appendChild(el('span', 'fw-semibold', 'Approval'));
            var headBadge = el('span', 'badge rounded-pill text-bg-light border');
            header.appendChild(headBadge);
            panel.appendChild(header);

            var body = el('div', 'card-body p-2');
            panel.appendChild(body);

            var routes = (task && task.routes) || [];

            // a task that has never been sent for approval has no route, and
            // that is the normal state of a Draft task, not a failure - 16 of
            // the 65 tasks in the October capture had none. The user asked for
            // it to SAY so rather than vanish, so the reader can tell "not sent
            // yet" from "the panel broke"
            if (!routes.length) {
                headBadge.textContent = 'none';
                body.appendChild(el('div', 'small fst-italic text-secondary',
                                    'This task has not been sent for approval, ' +
                                    'so it has no route yet.'));
                return panel;
            }

            headBadge.textContent = String(routes.length);

            /**
             * Read the route and draw it. Called again after a decision:
             * everything about the chain has changed - who it waits on, the
             * new signature, the route's own status - so it is re-read rather
             * than patched in place. One call, and only after an action.
             */
            function reload() {
                body.textContent = '';
                var busy = el('div', 'd-flex align-items-center gap-2 small text-secondary');
                busy.appendChild(el('div', 'spinner-border spinner-border-sm'));
                busy.appendChild(el('span', '', 'Reading the approval route…'));
                body.appendChild(busy);

                return RouteService.forTask(task).then(function (list) {
                    body.textContent = '';
                    if (!list.length) {
                        body.appendChild(el('div', 'alert alert-warning py-1 px-2 mb-0 small',
                                            'The approval route could not be read.'));
                        return;
                    }
                    // the badge becomes the useful fact: where it stands, not
                    // how many routes there are
                    var live = list.filter(function (r) { return r.started; })[0];
                    headBadge.textContent = live
                        ? (live.currentStep ? live.currentStep.role || 'in approval' : 'in approval')
                        : (list[list.length - 1].status || String(list.length));

                    list.forEach(function (route, index) {
                        body.appendChild(routeBlock(route, index, list.length, reload));
                    });
                }, function (err) {
                    body.textContent = '';
                    var message = (err && err.message) ? err.message : String(err);
                    Log.warn('approval panel: ' + message);
                    body.appendChild(el('div', 'alert alert-danger py-1 px-2 mb-0 small',
                                        'The approval route could not be read: ' + message));
                });
            }

            reload();
            return panel;
        },

        /** for tests only */
        _stepBadge: stepBadge,
        _statusClass: statusClass,
        _shortDate: shortDate,
        _plainText: plainText,
        _stepBox: stepBox,
        _routeBlock: routeBlock,
        _decisionBar: decisionBar
    };
});
