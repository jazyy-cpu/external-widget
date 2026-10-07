/**
 * The task page: a context sidebar and the form's content.
 *
 * The user's layout, 2026-10-07: *"when we open the task we will have one side
 * bar where we will show some data and on the main page we show the content of
 * the task."*
 *
 *   sidebar  what this task IS - number, type, status, its project, its dates,
 *            who owns it, the generated form document, the route
 *   main     what the FORM says - one row per field of the form spec
 *
 * ## The form spec is a JSON file, not code
 *
 * Each subtype's entry in `TaskFields` carries a `fields` id, which names
 * `js/data/forms/<id>.json`. That file lists the fields in the printed form's
 * order and says, per field, **where the value comes from**:
 *
 *   project    the project's `dataelements` - the PROJECT PROPOSAL / PROFILE
 *              form is almost entirely project data
 *   task       the task's own `dataelements`
 *   none       not a value at all: it lives in a relationship, in its own
 *              objects, in the WBS or in the approval route. The page prints
 *              the spec's note instead of an empty box, because an empty box
 *              reads as "nothing was entered" when the truth is "this is not
 *              kept here".
 *
 * So changing what a form shows is editing a JSON file. This module knows about
 * `source` and `display` and about no attribute name whatsoever.
 *
 * ## Read-only, for now
 *
 * Nothing here edits. The rule is already in the data (`TaskFields.isEditable`,
 * `Active` = In Work), and the page states which it is, so the edit control has
 * somewhere to appear and the user can see the rule working before it does.
 *
 * Bootstrap only - one row, two columns, cards and a definition list. The
 * widget's own CSS gets nothing new (rule: minimal custom CSS).
 */
define('IRSTasks/views/TaskDetailView', [
    'IRSTasks/services/TaskDetailService',
    'IRSTasks/services/ConfigService',
    'IRSTasks/config/TaskFields',
    'JazzySole/Format'
], function (TaskDetailService, ConfigService, Fields, Format) {
    'use strict';

    var DASH = '—';

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined && text !== null) { node.textContent = text; }
        return node;
    }

    function clear(node) {
        while (node.firstChild) { node.removeChild(node.firstChild); }
        return node;
    }

    /** A date if it looks like one, the value as it came otherwise. */
    function maybeDate(value) {
        if (!value) { return ''; }
        return /^\d{4}-\d{2}-\d{2}T/.test(value) ? (Format.date(value) || value) : value;
    }

    /**
     * One form field, resolved against the two objects. Pure - the whole of
     * what the page decides per row, and therefore the part worth testing.
     *
     * `missing` and `empty` are deliberately different states:
     *   missing  the attribute is not on the object at all - either the spec
     *            names something that does not exist, or the platform did not
     *            return it. Worth saying out loud.
     *   empty    the attribute exists and nobody has filled it in. Normal.
     */
    function resolve(spec, task, project) {
        var out = {
            ref: spec.ref || '',
            label: spec.label || spec.field || '',
            display: spec.display || 'text',
            note: spec.note || '',
            source: spec.source || 'none',
            field: spec.field || '',
            value: '',
            missing: false,
            empty: true
        };

        if (out.source === 'none') { return out; }

        var holder = out.source === 'project' ? project : task;
        if (!holder) {
            out.missing = true;
            return out;
        }

        var attributes = holder.attributes || {};
        if (!spec.field || !Object.prototype.hasOwnProperty.call(attributes, spec.field)) {
            // `pending` fields are EXPECTED to be missing - the spec already
            // says they are not created on the platform yet, so the note it
            // carries is the better message and this is not a surprise
            out.missing = out.display !== 'pending';
            return out;
        }

        var raw = attributes[spec.field];
        out.value = (raw === null || raw === undefined) ? '' : String(raw);
        out.empty = out.value.length === 0;
        return out;
    }

    /** label + value, as one row of the form. */
    function fieldRow(row) {
        var wrap = el('div', 'mb-3');
        var head = el('div', 'd-flex align-items-baseline gap-2');
        if (row.ref) {
            head.appendChild(el('span', 'badge bg-light text-secondary border', row.ref));
        }
        head.appendChild(el('label', 'form-label fw-semibold mb-0', row.label));
        wrap.appendChild(head);

        if (row.source === 'none') {
            wrap.appendChild(el('div', 'form-text', row.note || 'Not kept on this form.'));
            return wrap;
        }

        if (row.missing) {
            wrap.appendChild(el('div', 'text-danger small',
                'The platform did not return "' + row.field + '" for this ' +
                row.source + '.'));
            if (row.note) { wrap.appendChild(el('div', 'form-text', row.note)); }
            return wrap;
        }

        if (row.display === 'pending') {
            wrap.appendChild(el('div', 'form-text fst-italic',
                row.note || 'Agreed, but not created on the platform yet.'));
            return wrap;
        }

        if (row.empty) {
            wrap.appendChild(el('div', 'text-secondary', DASH));
        } else if (row.display === 'longtext') {
            // prose keeps its line breaks; a border makes an empty-looking
            // paragraph distinguishable from a missing one
            var box = el('div', 'border rounded bg-light-subtle p-2 small', row.value);
            box.style.whiteSpace = 'pre-wrap';
            wrap.appendChild(box);
        } else {
            wrap.appendChild(el('div', '', maybeDate(row.value)));
        }

        if (row.note) { wrap.appendChild(el('div', 'form-text', row.note)); }
        return wrap;
    }

    /** One dt/dd pair in the sidebar; skipped entirely when there is no value. */
    function sideItem(list, label, value, node) {
        if (!node && !value) { return; }
        list.appendChild(el('dt', 'col-5 text-secondary fw-normal small', label));
        var dd = el('dd', 'col-7 small mb-2');
        if (node) { dd.appendChild(node); } else { dd.textContent = value; }
        list.appendChild(dd);
    }

    function sidebar(task, project) {
        var card = el('div', 'card');
        var body = el('div', 'card-body py-2');

        body.appendChild(el('h6', 'card-title mb-1', task.title || task.id));
        var typeLine = el('div', 'mb-2');
        typeLine.appendChild(Format.badge(task.typeLabel, Fields.typeBadge(task.type)));
        body.appendChild(typeLine);

        var list = el('dl', 'row mb-0');
        sideItem(list, 'Status', null,
            Format.badge(task.stateLabel, Fields.stateBadge(task.state)));
        sideItem(list, 'Project', project ? (project.title || project.name) : task.projectTitle);
        sideItem(list, 'Project No.', project ? project.projectNo : '');
        sideItem(list, 'Project type', project ? project.typeLabel : task.projectTypeLabel);
        sideItem(list, 'Planned start', maybeDate(task.estimatedStartDate));
        sideItem(list, 'Due', maybeDate(task.dueDate));
        sideItem(list, 'Finished', maybeDate(task.actualFinishDate));
        sideItem(list, 'Complete', task.percentComplete ? task.percentComplete + '%' : '');
        sideItem(list, 'Owner', task.owner);
        sideItem(list, 'Assigned to', task.assignees.join(', '));
        sideItem(list, 'Route', task.route);

        if (task.documentName) {
            var doc = el('div');
            doc.appendChild(el('div', '', task.documentName +
                (task.documentRevision ? '  rev ' + task.documentRevision : '')));
            if (task.documentState) {
                doc.appendChild(el('div', 'form-text', task.documentState));
            }
            sideItem(list, 'Form document', null, doc);
        }

        body.appendChild(list);
        card.appendChild(body);
        return card;
    }

    function main(spec, task, project, rows) {
        var card = el('div', 'card');
        var head = el('div', 'card-header py-2');
        head.appendChild(el('span', 'fw-semibold', spec.title || task.typeLabel));
        if (spec.form) {
            head.appendChild(el('span', 'text-secondary small ms-2', spec.form));
        }
        card.appendChild(head);

        var body = el('div', 'card-body py-3');
        rows.forEach(function (row) { body.appendChild(fieldRow(row)); });
        card.appendChild(body);
        return card;
    }

    function banner(parent, text, level) {
        var box = el('div', 'alert alert-' + level + ' small py-2', text);
        box.setAttribute('role', 'alert');
        parent.appendChild(box);
    }

    return {
        /** for tests only */
        _resolve: resolve,

        /**
         * @param {HTMLElement} parent
         * @param {Object} options
         * @param {string} options.id             the task's physical id
         * @param {HTMLElement} [options.toolbar] the shared row's left slot
         * @param {Function} [options.onBack]     called by the Back button
         * @returns {{destroy: Function, redraw: Function}}
         */
        render: function (parent, options) {
            options = options || {};
            var destroyed = false;

            var root = el('div');
            var messages = el('div');
            var content = el('div');
            root.appendChild(messages);
            root.appendChild(content);
            parent.appendChild(root);

            var busy = el('div', 'd-flex justify-content-center p-4');
            busy.appendChild(el('div', 'spinner-border spinner-border-sm text-secondary'));
            content.appendChild(busy);

            if (options.toolbar && options.onBack) {
                var back = el('button', 'btn btn-sm btn-outline-secondary', 'Back to the list');
                back.type = 'button';
                back.addEventListener('click', options.onBack);
                options.toolbar.appendChild(back);
            }

            /** The form spec, or null when this subtype has none declared. */
            function loadSpec(task) {
                var id = Fields.fieldSet(task.type);
                if (!id) { return Promise.resolve(null); }
                return ConfigService.get('forms/' + id).catch(function (err) {
                    // a missing spec must not take the page down: the sidebar
                    // is still worth showing, and the message says what to fix
                    banner(messages, 'The form definition could not be read, so ' +
                        'only the task context is shown. ' + err.message, 'warning');
                    return null;
                });
            }

            TaskDetailService.get(options.id).then(function (result) {
                if (destroyed) { return; }
                var task = result.task;
                var project = result.project;

                return loadSpec(task).then(function (spec) {
                    if (destroyed) { return; }
                    clear(content);

                    if (result.note) { banner(messages, result.note, 'warning'); }
                    banner(messages, task.editable
                        ? 'This task is ' + task.stateLabel + '. Editing is not built yet, ' +
                          'so the form is shown read-only.'
                        : 'This task is ' + task.stateLabel + ', so the form is read-only.',
                        task.editable ? 'info' : 'secondary');

                    var row = el('div', 'row g-3');
                    var left = el('div', 'col-12 col-lg-4');
                    left.appendChild(sidebar(task, project));
                    row.appendChild(left);

                    var right = el('div', 'col-12 col-lg-8');
                    if (spec && Array.isArray(spec.fields)) {
                        var rows = spec.fields.map(function (f) {
                            return resolve(f, task, project);
                        });
                        right.appendChild(main(spec, task, project, rows));

                        var absent = rows.filter(function (r) { return r.missing; }).length;
                        if (absent) {
                            banner(messages, absent + ' field(s) named by the form ' +
                                'definition were not returned by the platform - each is ' +
                                'marked below.', 'warning');
                        }
                    } else if (spec) {
                        right.appendChild(el('div', 'alert alert-warning small',
                            'The form definition has no "fields" list.'));
                    } else {
                        right.appendChild(el('div', 'alert alert-secondary small',
                            'No form definition is declared for ' + task.typeLabel + '.'));
                    }
                    row.appendChild(right);
                    content.appendChild(row);
                });
            }).catch(function (err) {
                if (destroyed) { return; }
                clear(content);
                banner(messages, 'The task could not be opened: ' +
                    (err && err.message ? err.message : err), 'danger');
            });

            return {
                redraw: function () { /* the layout is Bootstrap's - nothing to measure */ },
                destroy: function () { destroyed = true; }
            };
        }
    };
});
