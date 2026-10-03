/**
 * IRSTasks config - everything about the task object that is data, not code:
 * the subtypes the widget lists, their labels and badges, the lifecycle states,
 * and the REST field list.
 *
 * This is WP06 **F1**: one descriptor per subtype, in one file. A new custom
 * task subtype is one entry in TASK_TYPES and nothing else in the widget learns
 * its name. The POC spread `XITProject_Personal` over an if-chain, three filter
 * maps and a route config, and two of its five declared subtypes ended up with
 * no form at all.
 *
 * `TASK_TYPES` is **empty on purpose**: the custom subtypes do not exist on the
 * VM yet (the user creates them). Until then `isListed()` lets everything
 * through, so the grid shows whatever comes back instead of an empty page that
 * looks broken. Once the subtypes are deployed, fill the list and the filter
 * becomes real - see `isListed`.
 */
define('IRSTasks/config/TaskFields', [], function () {
    'use strict';

    /**
     * The custom task subtypes the landing page lists.
     *
     * One entry per subtype. The keys each do one job, so nothing else in the
     * widget needs a type check:
     *
     *   label    what the Type column prints
     *   badge    the CSS class suffix, `irs-type-<badge>` in css/IRSTasks.css
     *   form     the AMD module id of its form (null = generic read-only view)
     *   fields   the field-set id its form and its PDF read (WP06 F2)
     *
     * `form` and `fields` are declared now and unused until the forms exist:
     * they are what keeps the renderer generic when five subtypes arrive.
     */
    var TASK_TYPES = {
        // Example of the shape, commented out until the real subtypes are
        // deployed - an entry here with a type name that does not exist would
        // silently filter every row out of the grid.
        //
        // IRSTaskProposalReview: {
        //     label: 'Proposal Review',
        //     badge: 'proposal',
        //     form: 'IRSTasks/views/forms/ProposalReviewForm',
        //     fields: 'proposal-review'
        // }
    };

    /**
     * OOTB `Project Task` lifecycle. **Not yet verified on this VM** - these
     * are the states the POC's grid showed (`Not Started`, `In Work`,
     * `Complete`, `Rejected`, `Withdrawn`) plus the names the project policy
     * uses, so a state arriving under either spelling still draws.
     *
     * Confirm with `print policy "Project Task" select state.name dump |;` and
     * cut this list down to what the policy really has. An unmapped state keeps
     * its own name and gets the `unknown` badge, so a wrong guess here is
     * visible rather than silent.
     */
    var OPEN_STATES = ['Create', 'Assign', 'Active', 'Review',
                       'Not Started', 'In Work'];
    var CLOSED_STATES = ['Complete', 'Completed', 'Rejected', 'Withdrawn'];

    /**
     * The platform's display name per state, same idea as the project widget:
     * the REST service returns the MQL name, the platform's own screens show
     * something else, and the two widgets must read alike.
     *
     * To confirm against the Maturity graph of a real custom task.
     */
    var STATE_LABELS = {
        Create: 'Draft',
        Assign: 'To Do',
        Active: 'In Work',
        Review: 'In Approval',
        Complete: 'Completed'
    };

    /** State -> `irs-state-<key>`, the palette in css/IRSTasks.css. */
    var STATE_CLASS = {
        Create: 'draft',
        Assign: 'todo',
        Active: 'inwork',
        'In Work': 'inwork',
        'Not Started': 'todo',
        Review: 'inapproval',
        Complete: 'completed',
        Completed: 'completed',
        Rejected: 'rejected',
        Withdrawn: 'withdrawn'
    };

    /**
     * The `$fields` list for the task list call.
     *
     * **Not yet tested against the service**, which is why `TaskService` does
     * not send it yet: an untested name in `$fields` is how a whole call starts
     * returning 400. Verify each one before the first live call (api.md).
     */
    var LIST_FIELDS = ['none', 'title', 'state', 'owner',
                       'taskEstimatedStartDate', 'taskEstimatedFinishDate'];

    return {
        TASK_TYPES: TASK_TYPES,
        OPEN_STATES: OPEN_STATES,
        CLOSED_STATES: CLOSED_STATES,
        ALL_STATES: OPEN_STATES.concat(CLOSED_STATES),
        LIST_FIELDS: LIST_FIELDS,
        STATE_LABELS: STATE_LABELS,
        STATE_CLASS: STATE_CLASS,

        /** The whole descriptor for a subtype, or null. */
        descriptor: function (type) {
            return TASK_TYPES[type] || null;
        },

        /** "IRSTaskProposalReview" -> "Proposal Review"; unknown shows its own name. */
        typeLabel: function (type) {
            var d = TASK_TYPES[type];
            return (d && d.label) || type || '';
        },

        /** The CSS class for a subtype's badge. */
        typeBadge: function (type) {
            var d = TASK_TYPES[type];
            return 'irs-type irs-type-' + ((d && d.badge) || 'unknown');
        },

        /** The platform's display name for a state: "Create" -> "Draft". */
        stateLabel: function (state) {
            return STATE_LABELS[state] || state || '';
        },

        /** The CSS class for a state's badge. */
        stateBadge: function (state) {
            return 'irs-state irs-state-' + (STATE_CLASS[state] || 'unknown');
        },

        isClosed: function (state) {
            return CLOSED_STATES.indexOf(state) >= 0;
        },

        /**
         * Does this task type belong on the landing page?
         *
         * **While TASK_TYPES is empty, everything is listed.** An empty
         * allow-list that filtered everything out would make a working widget
         * look broken for as long as the subtypes take to arrive.
         */
        isListed: function (type) {
            var names = Object.keys(TASK_TYPES);
            return names.length === 0 || names.indexOf(type) >= 0;
        }
    };
});
