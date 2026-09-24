/**
 * Lessons learnt from failures - form section XII (WGT-04).
 *
 * On the printed form this is one free-text box, applicable only to design and
 * development of a new product or service. The attribute `EPMLessonsLearnt` is
 * agreed but is the one section of R&D-PRJ-01 **not yet created on the VM**
 * (WP02 doc 05 section 12), so there is nothing to read or write yet.
 *
 * The user asked for it as a topic of its own rather than a paragraph buried in
 * the overview, which raises a question worth settling before the attribute is
 * built: one text box per project, or a list of dated entries that people add
 * to as the project runs? A single attribute cannot become a list later without
 * a migration, so the choice is cheaper to make now than after data exists.
 */
define('IRSProjects/views/detail/LessonsTab', [
    'IRSProjects/components/FieldList'
], function (FieldList) {
    'use strict';

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    return {
        render: function (pane) {
            pane.appendChild(el('div', 'text-body-secondary small mb-3',
                'Form section XII, for design and development of a new product or service.'));

            FieldList.placeholder(pane, 'The field does not exist yet', [
                'EPMLessonsLearnt is the only section of R&D-PRJ-01 with no attribute on the ' +
                'platform. It has to be created before this tab can show or capture anything.'
            ]);

            var choice = el('div', 'mt-3 alert alert-secondary small mb-0');
            choice.appendChild(el('div', 'fw-semibold', 'To decide before it is built'));
            var options = el('ul', 'mb-0 mt-1');
            options.appendChild(el('li', null,
                'One multiline attribute on the project, like the other eleven sections - ' +
                'faithful to the paper form, quick to build.'));
            options.appendChild(el('li', null,
                'A list of dated entries (what happened, what was learnt, who recorded it) - ' +
                'more useful while a project runs, and searchable across projects, but it ' +
                'needs its own object or a table.'));
            choice.appendChild(options);
            choice.appendChild(el('div', 'mt-1',
                'An attribute cannot become a list later without migrating the data, so this ' +
                'is worth settling first.'));
            pane.appendChild(choice);

            return pane;
        }
    };
});
