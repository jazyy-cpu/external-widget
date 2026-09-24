/**
 * Renders the form's fields: numeral, label, help text and value.
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

    function heading(field) {
        var head = el('div', 'd-flex align-items-baseline gap-2');
        head.appendChild(el('span', 'text-body-secondary small font-monospace', field.ref));
        var label = el('span', 'fw-semibold', field.label);
        head.appendChild(label);
        if (field.dd) {
            head.appendChild(el('span', 'badge text-bg-light border',
                'design & development only'));
        }
        return head;
    }

    /** A value that may be several paragraphs: keep the author's line breaks. */
    function multiline(text) {
        var box = el('div', 'mt-1 small text-break');
        box.style.whiteSpace = 'pre-wrap';
        box.textContent = text;
        return box;
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
            var list = el('div', 'd-flex flex-column gap-3');

            fields.forEach(function (field) {
                var row = el('div', 'pb-2 border-bottom');
                row.appendChild(heading(field));

                if (field.note) {
                    row.appendChild(el('div', 'text-body-secondary small', field.note));
                }

                if (field.kind === 'attribute' || field.kind === 'basic') {
                    var raw = values ? values[field.field] : '';
                    if (raw === undefined || raw === null || String(raw).trim() === '') {
                        row.appendChild(el('div', 'mt-1 small fst-italic text-body-secondary',
                            'Not filled in'));
                    } else {
                        row.appendChild(multiline(String(raw)));
                    }

                } else if (field.kind === 'todo') {
                    row.appendChild(el('div', 'mt-1 small text-warning-emphasis',
                        'The attribute ' + field.field + ' does not exist on the platform yet, ' +
                        'so this field cannot be shown or filled in.'));

                } else {
                    var what = NOT_A_FIELD[field.kind] || '';
                    var line = el('div', 'mt-1 small text-body-secondary', what);
                    if (field.tab && options.onGoTo) {
                        var link = el('a', 'ms-1', 'Open the ' + field.tab + ' tab');
                        link.href = '#';
                        link.addEventListener('click', function (e) {
                            e.preventDefault();
                            options.onGoTo(field.tab);
                        });
                        line.appendChild(link);
                    }
                    row.appendChild(line);
                }

                list.appendChild(row);
            });

            parent.appendChild(list);
            return list;
        },

        /** A "nothing here yet, and here is why" pane, used by the skeleton tabs. */
        placeholder: function (parent, title, lines) {
            var box = el('div', 'border rounded p-3 bg-body-tertiary');
            box.appendChild(el('h6', 'mb-2', title));
            (lines || []).forEach(function (text) {
                box.appendChild(el('p', 'small text-body-secondary mb-1', text));
            });
            parent.appendChild(box);
            return box;
        }
    };
});
