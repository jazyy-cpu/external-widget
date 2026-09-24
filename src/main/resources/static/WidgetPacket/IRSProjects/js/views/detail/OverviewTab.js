/**
 * Overview - the project information page (WGT-04), and the first tab.
 *
 * The printed form, in the printed order: sections I to XVI of
 * `R&D-PRJ-01-Rev.06`, then the signature block. It renders straight from
 * `IRSProjects/config/ProjectForm`, so the order and the wording are the form's,
 * not the developer's, and adding a field is a row in that file.
 *
 * Sections that belong to another tab (II Customer, XII Lessons learnt,
 * XIII Risks and opportunities, XVI Planning) still appear here in their proper
 * place, saying where they went - a reader following the paper form must not
 * find a hole where section XIII should be.
 */
define('IRSProjects/views/detail/OverviewTab', [
    'IRSProjects/config/ProjectForm',
    'IRSProjects/components/FieldList'
], function (ProjectForm, FieldList) {
    'use strict';

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    return {
        /**
         * @param {HTMLElement} pane
         * @param {Object} project  from IRSProjects/services/ProjectDetailService
         * @param {Object} [options]
         * @param {Function} [options.onGoTo]  open another tab by id
         */
        render: function (pane, project, options) {
            options = options || {};

            var intro = el('div', 'text-body-secondary mb-3',
                'Form ' + ProjectForm.FORM + ', in the order the form asks for it.');
            pane.appendChild(intro);

            FieldList.render(pane, ProjectForm.SECTIONS, project.data, options);

            // ---- the signature block --------------------------------------
            pane.appendChild(el('h6', 'mt-4 mb-2', 'Signature block'));
            FieldList.render(pane, ProjectForm.FOOTER, project.data, options);

            // ---- what the to-be adds, so it is not forgotten --------------
            var planned = el('details', 'mt-4');
            var summary = document.createElement('summary');
            summary.className = 'small text-body-secondary';
            summary.textContent = 'Agreed for the to-be form but not built yet (' +
                ProjectForm.PLANNED.length + ')';
            planned.appendChild(summary);
            var inner = el('div', 'mt-2');
            FieldList.render(inner, ProjectForm.PLANNED, project.data, options);
            planned.appendChild(inner);
            pane.appendChild(planned);

            return pane;
        }
    };
});
