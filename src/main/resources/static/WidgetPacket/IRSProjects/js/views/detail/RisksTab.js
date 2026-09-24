/**
 * Risks and opportunities - form section XIII (WGT-04).
 *
 * This is deliberately **not** a text box. WP02 doc 05 section 13.2 settled it:
 * `Risk` and `Opportunity` are OOTB objects deriving from `Risk Management`, in
 * the same package as the projects, already connected to the project by the
 * `Risk` relationship, and each already carries its own RPN scoring object.
 * A proposed attribute `EPMRisksAndOpportunities` was dropped as a result.
 *
 * Skeleton: the grid is laid out and the columns are decided, but the data is
 * not wired. The project web service does not document a way to return the
 * `Risk` relationship - `$include` accepts members and tasks, not risks - so
 * the call has to be found before this can show anything real. Rather than
 * guess at an endpoint, the tab says what it needs.
 */
define('IRSProjects/views/detail/RisksTab', [
    'IRSProjects/components/FieldList'
], function (FieldList) {
    'use strict';

    /** Decided here so the search for the API knows what it has to return. */
    var COLUMNS = [
        { title: 'Type', note: 'Risk or Opportunity - the same relationship carries both' },
        { title: 'Name', note: 'R-0000001 / OPP-0000003' },
        { title: 'Title', note: 'what it is' },
        { title: 'State', note: 'Create, ...' },
        { title: 'RPN', note: 'from the linked Risk RPN / Opportunity RPN object' },
        { title: 'Owner', note: '' }
    ];

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    return {
        render: function (pane) {
            pane.appendChild(el('div', 'text-body-secondary mb-3',
                'Form section XIII. Risks and opportunities are platform objects with their ' +
                'own scoring, not a paragraph of text on the project.'));

            FieldList.placeholder(pane, 'Not wired to the platform yet', [
                'The objects exist and are already linked: the test project carries ' +
                'Risk R-0000001 and Opportunity OPP-0000003, both through the Risk ' +
                'relationship, each with its own RPN object.',
                'What is missing is the read call. The project web service documents ' +
                '$include for members and tasks, not for risks, so the service that returns ' +
                'a project’s risks has to be found before this tab can list them.'
            ]);

            var plan = el('div', 'mt-3');
            plan.appendChild(el('h6', 'mb-2', 'The columns this grid will show'));
            var list = el('ul', 'small text-body-secondary mb-0');
            COLUMNS.forEach(function (c) {
                var li = el('li', null, c.title);
                if (c.note) {
                    li.appendChild(el('span', 'text-body-tertiary', ' – ' + c.note));
                }
                list.appendChild(li);
            });
            plan.appendChild(list);
            pane.appendChild(plan);

            return pane;
        },

        COLUMNS: COLUMNS
    };
});
