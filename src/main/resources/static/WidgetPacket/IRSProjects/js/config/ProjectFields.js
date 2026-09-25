/**
 * IRSProjects config - everything about the project object that is data, not code:
 * lifecycle states, the REST field list, type labels and badge colours.
 *
 * Kept in one module so a new project subtype or a policy change is a one-line
 * edit here and nowhere else (WGT-01 section 1 and 2).
 */
define('IRSProjects/config/ProjectFields', [], function () {
    'use strict';

    /**
     * MQL policies (verified on the VM 2026-09-23):
     *   Project Space             Create, Assign, Active, Review, Complete, Archive
     *   Project Space Hold Cancel Hold, Cancel
     * Default view = everything except Complete and Archive (user, 2026-09-23).
     */
    var OPEN_STATES = ['Create', 'Assign', 'Active', 'Review', 'Hold', 'Cancel'];
    var CLOSED_STATES = ['Complete', 'Archive'];

    /**
     * Exactly the $fields list that was tested on 2026-09-23 (api.md section 1).
     * `id` and `type` are siblings of `dataelements` and come back regardless,
     * so they are deliberately NOT listed - adding untested names to $fields is
     * how a whole call starts returning 400.
     */
    var LIST_FIELDS = ['none', 'title', 'state', 'estimatedStartDate',
                       'estimatedFinishDate', 'EPMProjectNo'];

    /**
     * The project types the landing page lists (user, 2026-09-24: "we will only
     * show research and analysis project in the widget, in future if required we
     * will show the more project types here").
     *
     * Exact type names, not "anything deriving from EPMRandD": the REST response
     * carries the type name and nothing about its parent, so derivation cannot be
     * judged in the widget. Adding a subtype later is one line here - and that is
     * the only change needed, because the filter and the Category label both read
     * from this file.
     *
     * The detail page does NOT use this list: a project opened by id is shown
     * whatever its type, so a link from elsewhere never lands on a blank page.
     */
    var LIST_TYPES = ['EPMAnalysisProject', 'EPMResearchProject'];

    /**
     * The REST `type` is the subtype name; the label is not returned (api.md
     * section 2). The labels are **the platform's own**, exactly as the OOTB
     * project grids print them in their Type column (user, 2026-09-24: match the
     * OOTB screen) - so the same project reads the same in both widgets.
     */
    var TYPE_LABELS = {
        EPMAnalysisProject: 'Analysis Project',
        EPMResearchProject: 'Research Project',
        EPMRandD: 'R&D Project',
        'Project Space': 'Project Space'
    };

    /**
     * The platform's **display name** for each state. The REST service returns
     * the MQL name (`Create`), the platform's own screens show something else
     * (`Draft`), and until 2026-09-25 our grid showed the MQL name - so the same
     * project read differently in the two widgets.
     *
     * Source: the Maturity graph of `Reaseach Project`, shared by the user
     * 2026-09-25:
     *
     *     Draft -> To Do -> In Work -> In Approval -> Completed -> Archived
     *
     * `Create` -> `Draft` and `Active` -> `In Work` are **confirmed by
     * observation**: the same two projects show those names in the OOTB grid and
     * these MQL names in ours. The other four are **inferred from the order** of
     * the graph against the order of the `Project Space` policy, which matches
     * one for one.
     *
     * `Hold` and `Cancel` belong to the second policy, `Project Space Hold
     * Cancel`, and do not appear on that graph. Their display names have not
     * been seen, so they are left as their MQL names rather than guessed - a
     * wrong label is worse than a blunt one. Confirm and correct here.
     *
     * Nothing else uses these: the query parameter, the closed-state test and
     * the row data all carry the MQL name. This is presentation only.
     */
    var STATE_LABELS = {
        Create:   'Draft',
        Assign:   'To Do',
        Active:   'In Work',
        Review:   'In Approval',
        Complete: 'Completed',
        Archive:  'Archived',
        Hold:     'Hold',      // display name not confirmed
        Cancel:   'Cancel'     // display name not confirmed
    };

    /**
     * Maturity colours, taken from the same graph and the OOTB grid badges
     * (user, 2026-09-25). A state maps to a CSS class of ours,
     * `irs-state-<key>`, defined in css/IRSProjects.css - Bootstrap has no
     * contextual colour near any of them.
     *
     *   Draft        purple    To Do       crimson
     *   In Work      teal      In Approval light green
     *   Completed    grey      Archived    grey
     */
    var STATE_CLASS = {
        Create:   'draft',
        Assign:   'todo',
        Active:   'inwork',
        Review:   'inapproval',
        Complete: 'completed',
        Archive:  'archived',
        Hold:     'hold',
        Cancel:   'cancel'
    };

    return {
        LIST_TYPES: LIST_TYPES,
        OPEN_STATES: OPEN_STATES,
        CLOSED_STATES: CLOSED_STATES,
        ALL_STATES: OPEN_STATES.concat(CLOSED_STATES),
        LIST_FIELDS: LIST_FIELDS,
        TYPE_LABELS: TYPE_LABELS,
        STATE_LABELS: STATE_LABELS,
        STATE_CLASS: STATE_CLASS,

        /** "EPMAnalysisProject" -> "Analysis"; an unknown subtype shows its own name. */
        typeLabel: function (type) {
            return TYPE_LABELS[type] || type || '';
        },

        /**
         * The platform's display name for a state: "Create" -> "Draft".
         * An unmapped state shows its own name rather than nothing.
         */
        stateLabel: function (state) {
            return STATE_LABELS[state] || state || '';
        },

        /** The CSS class for a state's badge: "irs-state irs-state-draft". */
        stateBadge: function (state) {
            return 'irs-state irs-state-' + (STATE_CLASS[state] || 'unknown');
        },

        isClosed: function (state) {
            return CLOSED_STATES.indexOf(state) >= 0;
        },

        /** Does this project type belong on the landing page? */
        isListed: function (type) {
            return LIST_TYPES.indexOf(type) >= 0;
        }
    };
});
