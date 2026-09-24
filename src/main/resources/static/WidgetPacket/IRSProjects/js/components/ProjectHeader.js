/**
 * The identity block at the top of the project detail page - the printed form's
 * header: Project Name, Project No., Department, Category, plus the state and
 * the planned dates.
 *
 * The Project No. control is **user interface only** (user, 2026-09-24: "as of
 * now lets build the ui part, later we build the schema and mechanism for it").
 * The behaviour it will have is already decided and is implemented here:
 *
 *   no number yet  -> the "Assign project number" button is shown
 *   number present -> the number is plain text and the button is gone
 *
 * What is deliberately NOT here: generating a number and writing it. The
 * numbering scheme is open item R20 and has to come from IRS, and `EPMProjectNo`
 * is still a plain writable string with no generator behind it. Clicking says
 * so instead of inventing a value, because an invented number written to a real
 * project is very hard to take back.
 */
define('IRSProjects/components/ProjectHeader', [
    'IRSProjects/config/ProjectFields',
    'IRSProjects/utils/Format'
], function (Fields, Format) {
    'use strict';

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    function pair(parent, label, node) {
        var wrap = el('div', 'me-4');
        wrap.appendChild(el('div', 'text-body-secondary small', label));  // the label may stay small
        wrap.appendChild(node);
        parent.appendChild(wrap);
        return wrap;
    }

    return {
        /**
         * @param {HTMLElement} parent
         * @param {Object} project  from IRSProjects/services/ProjectDetailService
         * @param {Object} options
         * @param {Function} options.onBack    back to the project list
         * @param {Function} options.onAssignNumber  called when the button is pressed
         * @returns {{root: HTMLElement}}
         */
        render: function (parent, project, options) {
            options = options || {};
            var root = el('div', 'pb-2 mb-2 border-bottom');

            // ---- line 1: back, title, badges ------------------------------
            var top = el('div', 'd-flex flex-wrap align-items-center gap-2');

            var back = el('button', 'btn btn-sm btn-link px-0 text-decoration-none', '‹ Projects');
            back.type = 'button';
            back.addEventListener('click', function () { options.onBack(); });
            top.appendChild(back);

            top.appendChild(el('h5', 'mb-0 ms-2', project.title || '(no title)'));
            if (project.category) {
                top.appendChild(Format.badge(project.category, 'secondary'));
            }
            if (project.state) {
                top.appendChild(Format.badge(project.state, Fields.stateBadge(project.state)));
            }
            root.appendChild(top);

            // ---- line 2: the header fields --------------------------------
            var facts = el('div', 'd-flex flex-wrap align-items-end mt-2');

            var numberCell;
            if (project.projectNo) {
                numberCell = el('div', 'fw-semibold', project.projectNo);
            } else {
                numberCell = el('div');
                var assign = el('button', 'btn btn-sm btn-outline-primary', 'Assign project number');
                assign.type = 'button';
                assign.addEventListener('click', function () { options.onAssignNumber(); });
                numberCell.appendChild(assign);
            }
            pair(facts, 'Project No.', numberCell);

            // the relationship does not exist on the platform yet (WP02 doc 05 section 8)
            pair(facts, 'Department',
                 el('div', 'fst-italic text-body-secondary', 'Not linked yet'));
            pair(facts, 'Customer',
                 el('div', 'fst-italic text-body-secondary', 'Not linked yet'));
            pair(facts, 'Start', el('div', null, Format.date(project.start) || '—'));
            pair(facts, 'Planned end', el('div', null, Format.date(project.finish) || '—'));

            root.appendChild(facts);
            parent.appendChild(root);
            return { root: root };
        }
    };
});
