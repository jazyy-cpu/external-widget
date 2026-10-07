/**
 * IRSTasks config - everything about the task object that is data, not code:
 * the subtypes the widget lists, their labels and badges, the lifecycle states,
 * which states may be edited, and the REST field list.
 *
 * This is WP06 **F1**: one descriptor per subtype, in one file. A new custom
 * task subtype is one entry in TASK_TYPES and nothing else in the widget learns
 * its name. The POC spread `XITProject_Personal` over an if-chain, three filter
 * maps and a route config, and two of its five declared subtypes ended up with
 * no form at all.
 *
 * ## Filled with the real subtypes, 2026-10-07
 *
 * The four gateway subtypes are deployed and carry live data, so `TASK_TYPES`
 * is no longer empty and `isListed()` is now a **real allow-list** - the user's
 * instruction of 2026-10-07: "we will show only our custom task that we have
 * created". Every OOTB `Task`, `Gate`, `Milestone` and `Inbox Task` the service
 * returns is dropped by it.
 *
 * `EPMTRAINING_TASK` is ours too and is deliberately **not** here: it belongs to
 * the training flow (WGT-08), not to the gateway approvals this widget is for.
 * Adding it later is one entry.
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
     *   form     the AMD module id of its form (null = the generic JSON-driven
     *            view, which is what all four use)
     *   fields   the id of its field set - `js/data/forms/<fields>.json`, the
     *            file that says which attributes the task view shows (F2)
     *
     * ## The labels are the PLATFORM's own names, and they are only a fallback
     *
     * `label` is what the type is called in DMC, copied from a live response
     * (`typeNLS`, measured 2026-10-07). They were our own shortened names until
     * the user pointed out the grid was not showing the platform's label.
     *
     * They remain only a **fallback**: both services read `typeNLS` from the
     * response and use it when it arrives, so the name shown comes from DMC and
     * renaming a type there changes the widget with no code change. These
     * entries are what shows when the field is absent - which it was in the one
     * captured response we have.
     *
     * Keeping them in step with DMC is therefore a nicety, not a dependency:
     * being wrong here is visible, not silent.
     */
    var TASK_TYPES = {
        EPMPROJECT_PROPOSAL: {
            label: 'PROJECT PROPOSAL / PROFILE',
            badge: 'proposal',
            form: null,
            fields: 'project-proposal'
        },
        EPMPROJECT_PERSONNEL_COST: {
            label: 'PROJECT PERSONNEL / COST ESTIMATION',
            badge: 'cost',
            form: null,
            fields: 'personnel-cost'
        },
        EPMPROJECT_STAGE_VALIDATION: {
            label: 'STAGE-VALIDATION REPORT',
            badge: 'validation',
            form: null,
            fields: 'stage-validation'
        },
        EPMPROJECT_REVIEW: {
            label: 'PROJECT REVIEW',
            badge: 'review',
            form: null,
            fields: 'project-review'
        }
    };

    /**
     * Project types whose tasks are **copies** and must never be listed.
     *
     * Found on live data, 2026-10-07, and the POC could not have found it
     * because it had no baselines: a task name such as `T-0000103` exists five
     * times with five different ids. Four of them are inside Project Baselines.
     * Measured:
     *
     *     T-0000103 / 231791096408193 -> to[Subtask].from = EPMAnalysisProject "ana"
     *     T-0000103 / 871791203537541 -> to[Subtask].from = Project Baseline "B-...0106"
     *
     * **Copying a project copies its whole WBS**, so every baseline, snapshot
     * and experiment multiplies the task list. Without this filter a project
     * with four baselines shows every task five times.
     *
     * A DENY list, not an allow list, on purpose: a task on a project type we
     * have not thought of should still appear - being shown something
     * unexpected is recoverable, silently hiding a real task is not.
     */
    var COPY_PROJECT_TYPES = ['Project Baseline', 'Project Snapshot', 'Experiment'];

    /**
     * OOTB `Project Task` lifecycle - **verified on this VM, 2026-10-07**
     * (`print policy "Project Task" select state.name` -> Create, Assign,
     * Active, Review, Complete), and every live custom task was confirmed to
     * carry that policy, not the `Software Task` one its type also names. That
     * closes open item O-T5.
     *
     * The POC's spellings (`Not Started`, `In Work`) are gone from these lists
     * because the policy does not have them - but they are kept in STATE_CLASS,
     * so if one ever arrives it still draws instead of falling to `unknown`.
     */
    var OPEN_STATES = ['Create', 'Assign', 'Active', 'Review'];
    var CLOSED_STATES = ['Complete'];

    /**
     * States in which a task's data may be **edited** in this widget.
     *
     * The user's rule, 2026-10-07: "based on the task state we can give edit
     * option for some task not all task if task in inwork". `Active` is the
     * state the platform shows as **In Work** (see STATE_LABELS), so it is the
     * one editable state.
     *
     * Deliberately a list and not a boolean test: if `Assign` turns out to need
     * editing too, that is one entry here and nothing else changes. The view
     * asks `isEditable(state)` and never names a state itself.
     *
     * This governs what the widget OFFERS. It is not a security control - the
     * platform's own policy access decides what the save is actually allowed to
     * do, and a widget cannot be the thing that enforces it.
     */
    var EDITABLE_STATES = ['Active'];

    /**
     * The platform's display name per state, same idea as the project widget:
     * the REST service returns the MQL name, the platform's own screens show
     * something else, and the two widgets must read alike.
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
     * The `$fields` list for a **detail** call on one task.
     *
     * The list call does not use it: it sends `$fields=basics`, which is what
     * the POC used against this same resource and is therefore the one spelling
     * known to work here. An untested name in an explicit `$fields` list is how
     * a whole call starts returning 400, so the explicit list waits until there
     * is a reason to narrow the payload.
     */
    var DETAIL_FIELDS = ['none', 'title', 'state', 'owner',
                         'taskEstimatedStartDate', 'taskEstimatedFinishDate'];

    return {
        TASK_TYPES: TASK_TYPES,
        COPY_PROJECT_TYPES: COPY_PROJECT_TYPES,
        OPEN_STATES: OPEN_STATES,
        CLOSED_STATES: CLOSED_STATES,
        ALL_STATES: OPEN_STATES.concat(CLOSED_STATES),
        EDITABLE_STATES: EDITABLE_STATES,
        DETAIL_FIELDS: DETAIL_FIELDS,
        STATE_LABELS: STATE_LABELS,
        STATE_CLASS: STATE_CLASS,

        /** The whole descriptor for a subtype, or null. */
        descriptor: function (type) {
            return TASK_TYPES[type] || null;
        },

        /** "EPMPROJECT_REVIEW" -> "Project Review"; unknown shows its own name. */
        typeLabel: function (type) {
            var d = TASK_TYPES[type];
            return (d && d.label) || type || '';
        },

        /** The CSS class for a subtype's badge. */
        typeBadge: function (type) {
            var d = TASK_TYPES[type];
            return 'irs-type irs-type-' + ((d && d.badge) || 'unknown');
        },

        /** The field-set id whose JSON file drives the task view (F2). */
        fieldSet: function (type) {
            var d = TASK_TYPES[type];
            return (d && d.fields) || '';
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

        /** May this widget offer an edit control for a task in this state? */
        isEditable: function (state) {
            return EDITABLE_STATES.indexOf(state) >= 0;
        },

        /**
         * Does this task type belong on the landing page?
         *
         * A real allow-list since 2026-10-07: only the four gateway subtypes.
         * The resource returns every task the user can see, including OOTB
         * tasks and the Inbox Tasks of routes, and none of those belong here.
         */
        isListed: function (type) {
            return Object.prototype.hasOwnProperty.call(TASK_TYPES, type);
        },

        /**
         * Is this task a copy living inside a baseline or a snapshot?
         * @param {string} projectType the type of the task's own project
         */
        isCopy: function (projectType) {
            return COPY_PROJECT_TYPES.indexOf(projectType) >= 0;
        }
    };
});
