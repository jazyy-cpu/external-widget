/**
 * The task page: a context sidebar and the form's content.
 *
 * The page shows **the form, full width** - one row per field of the form spec.
 *
 * It had a context sidebar (task number, type, status, project, dates, owner,
 * the generated document, the route) and the user removed it the same day:
 * *"ok remove the side bar as of now"*. Nothing is lost that the page does not
 * already say - the form's own header block carries Project Name and Project
 * No., and the banner states the task's status - and the form gets the whole
 * width, which is what a 16-section form needs.
 *
 * `TaskDetailService` still shapes the sidebar's data (owner, dates, document,
 * route). That is deliberate: it is one field read per key from a response we
 * already have, it costs no call, and "as of now" says this is a layout
 * decision rather than a decision about what the page knows.
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
 *   derived    computed from what we already hold, with no further call.
 *              Section I *Project Category* is the only one: the project's own
 *              subtype answers it, under the platform's own display name
 *   service    our REST JAR, `ProjectContextService`. Sections XII and XIII -
 *              key learnings, and risks and opportunities. These are OBJECTS,
 *              not attributes, so they render as tables rather than as a value
 *   none       not a value at all: it lives in a relationship, in the WBS or in
 *              the approval route. The page prints the spec's note instead of
 *              an empty box, because an empty box reads as "nothing was
 *              entered" when the truth is "this is not kept here".
 *
 * So changing what a form shows is editing a JSON file. This module knows about
 * `source` and `display` and about no attribute name whatsoever.
 *
 * ## Bootstrap only - no Tabulator on this form
 *
 * The user's decision, 2026-10-08: *"lets use only bootstrap then, because
 * bootstrap also have table elements, and this will keep uniformity across the
 * form"*. Sixteen of the form's sections are a heading and a paragraph of
 * prose, which is the wrong shape for a grid, and a plain `table` covers the
 * two sections that really are rows. It also keeps Tabulator's UMD loader
 * workaround off this page entirely.
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
    'IRSTasks/services/ProjectContextService',
    'IRSTasks/services/ConfigService',
    'IRSTasks/config/TaskFields',
    'JazzySole/Format'
], function (TaskDetailService, ProjectContextService, ConfigService, Fields, Format) {
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

    function toText(value) {
        return (value === null || value === undefined) ? '' : String(value).trim();
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
            empty: true,
            usedFallback: false
        };

        if (out.source === 'none') { return out; }

        // a service section is a LIST, not a value: the row carries no value of
        // its own and the renderer reads `context` for the table
        if (out.source === 'service') {
            out.empty = true;
            return out;
        }

        // derived: computed from the project object itself, not from its
        // attributes. Section I is the whole of this case - the subtype answers
        // "Research or Analysis", and we already hold its display name
        if (out.source === 'derived') {
            if (!project) {
                out.missing = true;
                return out;
            }
            out.value = toText(project[spec.field]);
            out.empty = out.value.length === 0;
            return out;
        }

        var holder = out.source === 'project' ? project : task;
        if (!holder) {
            out.missing = true;
            return out;
        }

        var attributes = holder.attributes || {};

        // `fallbackField` is a second attribute to try. Project Name needs it:
        // `title` is empty on every project measured, and a dash on the form's
        // first line would read as missing data rather than as an unused field
        if (spec.fallbackField &&
                !toText(attributes[spec.field]) &&
                toText(attributes[spec.fallbackField])) {
            out.value = toText(attributes[spec.fallbackField]);
            out.empty = false;
            out.usedFallback = true;
            return out;
        }

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

    // ---- the two sections that are objects, not values -------------------

    /**
     * A Bootstrap table. `columns` is [{label, key, className}] and rows are
     * plain objects - no grid library, by decision (see the module comment).
     *
     * `table-sm` and `align-middle` keep a three-row table from dominating a
     * form whose other sections are paragraphs.
     */
    function table(columns, rows) {
        var wrap = el('div', 'table-responsive');
        var node = el('table', 'table table-sm table-bordered align-middle mb-0');

        var head = el('thead', 'table-light');
        var headRow = el('tr');
        columns.forEach(function (column) {
            var cell = el('th', column.className || '', column.label);
            cell.scope = 'col';
            headRow.appendChild(cell);
        });
        head.appendChild(headRow);
        node.appendChild(head);

        var body = el('tbody');
        rows.forEach(function (item) {
            var tr = el('tr');
            columns.forEach(function (column) {
                var value = toText(item[column.key]);
                var cell = el('td', column.className || '', value || DASH);
                if (!value) { cell.className += ' text-secondary'; }
                tr.appendChild(cell);
            });
            body.appendChild(tr);
        });
        node.appendChild(body);
        wrap.appendChild(node);
        return wrap;
    }

    /** "Nothing is linked" - said in words, never as an empty table. */
    function emptyNote(text) {
        return el('div', 'form-text fst-italic', text);
    }

    /**
     * Section XIII. Two tables under one heading, because the form asks for one
     * section and the platform keeps two object types - both arriving over the
     * same `Risk` relationship.
     */
    function risksBlock(context) {
        var wrap = el('div');
        if (!context) {
            wrap.appendChild(el('div', 'text-danger small',
                'The risks and opportunities could not be read.'));
            return wrap;
        }
        if (context.riskError) {
            wrap.appendChild(el('div', 'text-danger small',
                'The risks and opportunities could not be read: ' + context.riskError));
            return wrap;
        }

        var columns = [
            { label: 'No.', key: 'no', className: 'text-nowrap' },
            { label: 'Title', key: 'title' },
            { label: 'State', key: 'state', className: 'text-nowrap' }
        ];

        [['Risks', context.risks], ['Opportunities', context.opportunities]]
            .forEach(function (pair) {
                wrap.appendChild(el('div', 'fw-semibold small mt-2 mb-1', pair[0]));
                if (pair[1].length) {
                    wrap.appendChild(table(columns, pair[1]));
                } else {
                    wrap.appendChild(emptyNote('None linked to this project.'));
                }
            });
        return wrap;
    }

    /**
     * Section XII. One table, with a Source column - which is the whole point
     * of the section: a proposal is meant to cite lessons from EARLIER
     * projects, so where each one came from matters as much as its text.
     */
    function learningsBlock(context) {
        var wrap = el('div');
        if (!context) {
            wrap.appendChild(el('div', 'text-danger small',
                'The key learnings could not be read.'));
            return wrap;
        }
        if (context.learningError) {
            wrap.appendChild(el('div', 'text-danger small',
                'The key learnings could not be read: ' + context.learningError));
            return wrap;
        }
        if (!context.learnings.length) {
            wrap.appendChild(emptyNote('No key learning is linked to this project yet.'));
            return wrap;
        }

        wrap.appendChild(table([
            { label: 'No.', key: 'no', className: 'text-nowrap' },
            { label: 'Learning', key: 'title' },
            { label: 'Detail', key: 'learning' },
            { label: 'Source', key: 'originLabel' },
            { label: 'State', key: 'state', className: 'text-nowrap' }
        ], context.learnings));
        return wrap;
    }

    /** label + value, as one row of the form. */
    function fieldRow(row, context) {
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

        // the two object sections: a table, and the note explaining where the
        // objects live - which a reader of a controlled form needs more than a
        // value would tell them
        if (row.source === 'service') {
            wrap.appendChild(row.display === 'learnings'
                ? learningsBlock(context)
                : risksBlock(context));
            if (row.note) { wrap.appendChild(el('div', 'form-text mt-1', row.note)); }
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

    function main(spec, task, project, rows, context) {
        var card = el('div', 'card');
        var head = el('div', 'card-header py-2');
        head.appendChild(el('span', 'fw-semibold', spec.title || task.typeLabel));
        if (spec.form) {
            head.appendChild(el('span', 'text-secondary small ms-2', spec.form));
        }
        card.appendChild(head);

        var body = el('div', 'card-body py-3');
        rows.forEach(function (row) { body.appendChild(fieldRow(row, context)); });
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

                /**
                 * Sections XII and XIII, from our own JAR - and ONLY when the
                 * form definition asks for them.
                 *
                 * The spec is a local JSON file, so reading it first costs
                 * nothing worth parallelising, and it buys the rule that a
                 * subtype whose form has no object sections makes no call at
                 * all. PROJECT REVIEW and the two others have no `service` row
                 * today.
                 *
                 * A failure never reaches the caller: the other twenty-one rows
                 * are worth showing even when this one call is refused, so the
                 * error is turned into an empty context carrying the reason,
                 * and the two sections report it where they would have drawn
                 * their tables.
                 */
                function loadContext(spec) {
                    var wanted = spec && Array.isArray(spec.fields) &&
                        spec.fields.some(function (f) { return f.source === 'service'; });
                    if (!wanted) { return Promise.resolve(null); }
                    if (!project || !project.id) { return Promise.resolve(null); }

                    return ProjectContextService.get(project.id).catch(function (err) {
                        var reason = (err && err.message) ? err.message : String(err);
                        return {
                            risks: [], opportunities: [], learnings: [],
                            learningsHere: [], learningsElsewhere: [],
                            riskError: reason, learningError: reason, counts: {}
                        };
                    });
                }

                return loadSpec(task).then(function (spec) {
                    if (destroyed) { return; }
                    return loadContext(spec).then(function (context) {
                        if (destroyed) { return; }
                        return { spec: spec, context: context };
                    });
                }).then(function (loaded) {
                    if (destroyed || !loaded) { return; }
                    var spec = loaded.spec;
                    var context = loaded.context;
                    clear(content);

                    if (result.note) { banner(messages, result.note, 'warning'); }
                    banner(messages, task.editable
                        ? 'This task is ' + task.stateLabel + '. Editing is not built yet, ' +
                          'so the form is shown read-only.'
                        : 'This task is ' + task.stateLabel + ', so the form is read-only.',
                        task.editable ? 'info' : 'secondary');

                    var row = el('div', 'row g-3');
                    var right = el('div', 'col-12');
                    if (spec && Array.isArray(spec.fields)) {
                        var rows = spec.fields.map(function (f) {
                            return resolve(f, task, project);
                        });
                        right.appendChild(main(spec, task, project, rows, context));

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
