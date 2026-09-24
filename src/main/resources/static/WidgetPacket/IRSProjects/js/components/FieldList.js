/**
 * Renders the form's fields as a Bootstrap read-only form: a label and its
 * value, **two fields to a row** on a wide widget, one on a narrow one
 * (user, 2026-09-24 - "show two value side by side, this way we can show more
 * value"). Values use `form-control-plaintext`, Bootstrap's own read-only form
 * control, so the page reads as a form rather than a list of paragraphs.
 *
 * A field may ask for the full width with `wide: true` - for the long prose
 * sections, where two narrow columns would make a very tall page.
 *
 * The important part is what it does when there is nothing to show. A field can
 * be empty for four different reasons, and a blank box beside a label is a lie
 * in three of them:
 *
 *   empty        the attribute exists, nobody filled it in     -> "Not filled in"
 *   todo         the attribute is not created on the VM yet    -> amber note
 *   rel/object   it lives on another tab or another object     -> a link across
 *   route/wbs    it is not a field at all                      -> what it is instead
 *
 * All text goes in with textContent, never an HTML string.
 */
define('IRSProjects/components/FieldList', [], function () {
    'use strict';

    /** What each `kind` from IRSProjects/config/ProjectForm means on screen. */
    var NOT_A_FIELD = {
        subtype: 'Carried by the project type, not by a field.',
        rel:     'A linked object.',
        object:  'Modelled as its own objects.',
        wbs:     'The work breakdown, not a field.',
        route:   'An approval step in a route, not a field.'
    };

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    function label(field) {
        var wrap = el('label', 'form-label mb-0 d-flex align-items-baseline gap-2 flex-wrap');
        wrap.appendChild(el('span', 'irs-ref', field.ref));
        wrap.appendChild(el('span', 'fw-semibold', field.label));
        if (field.dd) {
            wrap.appendChild(el('span', 'badge text-bg-light border fw-normal',
                'design & development only'));
        }
        return wrap;
    }

    return {
        /**
         * @param {HTMLElement} parent
         * @param {Array} fields  rows from IRSProjects/config/ProjectForm
         * @param {Object} values the project's `dataelements`
         * @param {Object} [options]
         * @param {Function} [options.onGoTo]  called with a tab id when a cross-link is clicked
         */
        render: function (parent, fields, values, options) {
            options = options || {};
            var row = el('div', 'row g-3');

            fields.forEach(function (field) {
                var col = el('div', field.wide ? 'col-12' : 'col-12 col-xl-6');
                var cell = el('div', 'irs-field h-100');
                cell.appendChild(label(field));

                if (field.note) {
                    cell.appendChild(el('div', 'form-text mt-0', field.note));
                }

                if (field.kind === 'attribute' || field.kind === 'basic') {
                    var raw = values ? values[field.field] : '';
                    if (raw === undefined || raw === null || String(raw).trim() === '') {
                        cell.appendChild(el('div', 'form-control-plaintext irs-value fst-italic text-body-secondary',
                            'Not filled in'));
                    } else {
                        cell.appendChild(el('div', 'form-control-plaintext irs-value', String(raw)));
                    }

                } else if (field.kind === 'todo') {
                    cell.appendChild(el('div', 'form-control-plaintext irs-value text-warning-emphasis',
                        'The attribute ' + field.field + ' does not exist on the platform yet, ' +
                        'so this field cannot be shown or filled in.'));

                } else {
                    var line = el('div', 'form-control-plaintext irs-value text-body-secondary',
                        NOT_A_FIELD[field.kind] || '');
                    if (field.tab && options.onGoTo) {
                        var link = el('a', 'ms-1', 'Open the ' + field.tab + ' tab');
                        link.href = '#';
                        link.addEventListener('click', function (e) {
                            e.preventDefault();
                            options.onGoTo(field.tab);
                        });
                        line.appendChild(link);
                    }
                    cell.appendChild(line);
                }

                col.appendChild(cell);
                row.appendChild(col);
            });

            parent.appendChild(row);
            return row;
        },

        /** A "nothing here yet, and here is why" pane, used by the skeleton tabs. */
        placeholder: function (parent, title, lines) {
            var box = el('div', 'border rounded p-3 bg-body-tertiary');
            box.appendChild(el('h6', 'mb-2', title));
            (lines || []).forEach(function (text) {
                box.appendChild(el('p', 'text-body-secondary mb-1', text));
            });
            parent.appendChild(box);
            return box;
        }
    };
});
