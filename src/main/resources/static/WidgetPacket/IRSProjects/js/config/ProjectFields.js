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

    /** The REST `type` is the subtype name; the label is not returned (api.md section 2). */
    var TYPE_LABELS = {
        EPMAnalysisProject: 'Analysis',
        EPMResearchProject: 'Research',
        EPMRandD: 'R&D',
        'Project Space': 'Project'
    };

    /** Bootstrap contextual suffix per state, for `badge text-bg-<suffix>`. */
    var STATE_BADGE = {
        Create: 'secondary',
        Assign: 'secondary',
        Active: 'primary',
        Review: 'info',
        Hold: 'warning',
        Cancel: 'dark',
        Complete: 'success',
        Archive: 'light'
    };

    return {
        OPEN_STATES: OPEN_STATES,
        CLOSED_STATES: CLOSED_STATES,
        ALL_STATES: OPEN_STATES.concat(CLOSED_STATES),
        LIST_FIELDS: LIST_FIELDS,
        TYPE_LABELS: TYPE_LABELS,
        STATE_BADGE: STATE_BADGE,

        /** "EPMAnalysisProject" -> "Analysis"; an unknown subtype shows its own name. */
        typeLabel: function (type) {
            return TYPE_LABELS[type] || type || '';
        },

        stateBadge: function (state) {
            return STATE_BADGE[state] || 'secondary';
        },

        isClosed: function (state) {
            return CLOSED_STATES.indexOf(state) >= 0;
        }
    };
});
