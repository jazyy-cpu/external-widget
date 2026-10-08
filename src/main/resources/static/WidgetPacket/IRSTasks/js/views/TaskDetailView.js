/**
 * The task page: a context sidebar and the form's content.
 *
 * The page shows the form, with a **documents panel beside it** - one row per
 * field of the form spec, and the task's deliverables and attachments in a
 * sticky, collapsible panel on the right (`TaskDocumentsPanel`).
 *
 * The panel is the one thing on the page that is about the TASK rather than
 * the project, which is why it is beside the form instead of inside it: every
 * numbered section of R&D-PRJ-01 is project data, and a deliverable has no
 * Roman numeral to be given.
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
 * ## The Summary Report look
 *
 * The user's decision, 2026-10-08, against a screenshot of the platform's own
 * `Summary Report` page: short values pair off two to a line with the label
 * bold beside the value, long sections keep the full width under a ruled
 * heading, and **the explanatory notes are gone from the page entirely**.
 *
 * The notes are not deleted - they stay in the form JSON, which is where they
 * were always the useful thing to read. On the page they were a line of
 * guidance under every value, which on a 23-row form is 23 lines telling an
 * approver about the form rather than showing them the project.
 *
 * Bootstrap's grid does the pairing; the label column, the hairlines and the
 * section rule are the only custom CSS, because Bootstrap has no component for
 * a report's attribute block - `dl`/`row` sets its own type and spacing and
 * carries no rules at all.
 */
define('IRSTasks/views/TaskDetailView', [
    'IRSTasks/services/TaskDetailService',
    'IRSTasks/services/ProjectContextService',
    'IRSTasks/services/ConfigService',
    'IRSTasks/views/TaskDocumentsPanel',
    'IRSTasks/config/TaskFields',
    'JazzySole/Format'
], function (TaskDetailService, ProjectContextService, ConfigService,
             DocumentsPanel, Fields, Format) {
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
            // which group of learnings this section wants - see learningsBlock
            learningScope: spec.learningScope || '',
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
     * A Bootstrap table. `columns` is [{label, key, className, width}] and rows
     * are plain objects - no grid library, by decision (see the module
     * comment).
     *
     * `table-sm` and `align-middle` keep a three-row table from dominating a
     * form whose other sections are paragraphs.
     *
     * **`width` is what makes two tables line up.** The browser's automatic
     * layout sizes every column from its own table's contents, so the Risks
     * table and the Opportunities table under the same heading chose different
     * widths and their columns did not meet - which is what the user saw.
     * `table-layout: fixed` plus a declared width per column makes the two
     * identical, and a column whose content has a known maximum (a risk number
     * is never more than about twelve characters) has no business taking a
     * third of the row.
     */
    function table(columns, rows) {
        var wrap = el('div', 'table-responsive');
        var node = el('table', 'table table-sm align-middle mb-0 irs-sum-table');

        var head = el('thead');
        var headRow = el('tr');
        columns.forEach(function (column) {
            var cell = el('th', column.className || '', column.label);
            cell.scope = 'col';
            if (column.width) { cell.style.width = column.width; }
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
        return el('div', 'text-secondary fst-italic', text);
    }

    /**
     * The section's printed number, where it has one.
     *
     * The paper form numbers its sections I to XVI and an approver reads by
     * those numbers, so they stay - but as part of the heading rather than as a
     * badge beside it. `Header` and `Footer` are our own grouping words, not
     * anything printed on the form, so they are not shown at all.
     */
    function labelOf(row) {
        var ref = row.ref;
        if (!ref || ref === 'Header' || ref === 'Footer') { return row.label; }
        return ref + '. ' + row.label;
    }

    /**
     * One label-and-value cell, half a line wide on anything above phone size.
     *
     * This is the shape of the platform's own Summary Report, which the user
     * asked the form to match: a bold label, its value beside it, two pairs to
     * a line and a hairline between rows. Side by side is also simply true to
     * the content - `Project No.` is six characters and giving it a full line
     * of its own pushed the form to three screens.
     */
    function kv(label, value, className) {
        var col = el('div', 'col-12 col-md-6');
        var line = el('div', 'irs-kv');
        line.appendChild(el('div', 'irs-kv-label', label));
        var text = toText(value);
        var cell = el('div', 'irs-kv-value' + (className ? ' ' + className : ''),
                      text || DASH);
        if (!text) { cell.className += ' text-secondary'; }
        line.appendChild(cell);
        col.appendChild(line);
        return col;
    }

    function kvGrid() {
        return el('div', 'row g-0 irs-kv-grid');
    }

    /** A ruled heading, as the report puts over Attributes / Approvals / Routes. */
    function sectionHead(text) {
        return el('div', 'irs-sum-head', text);
    }

    /**
     * Which sections take the whole width.
     *
     * Prose, tables and the customer's own block of pairs cannot share a line
     * with anything; every other field is a short value and pairs off.
     */
    var BLOCKS = ['longtext', 'learnings', 'risks', 'customer'];

    function isBlock(row) {
        return BLOCKS.indexOf(row.display) >= 0;
    }

    /**
     * Section XIII. Two tables under one heading, because the form asks for one
     * section and the platform keeps two object types - both arriving over the
     * same `Risk` relationship.
     */
    function risksBlock(context) {
        var wrap = el('div');
        if (!context) {
            wrap.appendChild(el('div', 'text-danger',
                'The risks and opportunities could not be read.'));
            return wrap;
        }
        if (context.riskError) {
            wrap.appendChild(el('div', 'text-danger',
                'The risks and opportunities could not be read: ' + context.riskError));
            return wrap;
        }

        // the same three widths for both tables, so the Risks rows and the
        // Opportunities rows below them line up as one block
        var columns = [
            { label: 'No.', key: 'no', className: 'text-nowrap', width: '10rem' },
            { label: 'Title', key: 'title' },
            { label: 'State', key: 'state', className: 'text-nowrap', width: '9rem' }
        ];

        [['Risks', context.risks], ['Opportunities', context.opportunities]]
            .forEach(function (pair) {
                wrap.appendChild(el('div', 'irs-sum-sub', pair[0]));
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
    function learningsBlock(context, scope) {
        var wrap = el('div');
        if (!context) {
            wrap.appendChild(el('div', 'text-danger',
                'The key learnings could not be read.'));
            return wrap;
        }
        if (context.learningError) {
            wrap.appendChild(el('div', 'text-danger',
                'The key learnings could not be read: ' + context.learningError));
            return wrap;
        }

        // which group this form wants. A PROPOSAL cites lessons from EARLIER
        // projects, so it shows the reused ones; the completion form will show
        // what this project produced. Same objects, two questions
        var rows, nothing;
        if (scope === 'reused') {
            rows = context.learningsElsewhere;
            nothing = 'No learning from an earlier project has been cited yet.';
        } else if (scope === 'created') {
            rows = context.learningsHere;
            nothing = 'This project has not recorded a key learning yet.';
        } else {
            rows = context.learnings;
            nothing = 'No key learning is linked to this project yet.';
        }

        if (!rows.length) {
            wrap.appendChild(emptyNote(nothing));
            return wrap;
        }

        var columns = [
            { label: 'No.', key: 'no', className: 'text-nowrap', width: '10rem' },
            { label: 'Learning', key: 'title', width: '22%' },
            { label: 'Detail', key: 'learning' }
        ];
        // the Source column earns its place only when the rows can differ. On
        // the created-here list every value would read "This project", which is
        // a column of noise
        if (scope !== 'created') {
            columns.push({ label: scope === 'reused' ? 'From project' : 'Source',
                           key: 'originLabel', width: '20%' });
        }
        columns.push({ label: 'State', key: 'state',
                       className: 'text-nowrap', width: '9rem' });

        wrap.appendChild(table(columns, rows));
        return wrap;
    }

    /**
     * Section II. The customer, with the fields its KIND actually has.
     *
     * An external customer is a Company and carries an e-mail address; an
     * internal one is a Business Unit or a Department and has no such attribute
     * at all. The service decides which rows exist, so this only draws them -
     * as the same label-and-value pairs as the header, which is what the user
     * meant by *"based the customer form"*: these are several short labelled
     * values, and a Field / Value table around them was a table drawn for two
     * columns that are not data.
     *
     * The kind is no longer announced in a badge. `Customer` and `Project Type`
     * are both already rows, so the badge repeated what the block said one line
     * lower - and the page was asked to lose its decoration, not its facts.
     */
    function customerBlock(context) {
        var wrap = el('div');
        if (!context || !context.customer) {
            wrap.appendChild(el('div', 'text-danger',
                'The customer could not be read.'));
            return wrap;
        }
        var customer = context.customer;
        if (customer.error) {
            wrap.appendChild(el('div', 'text-danger',
                'The customer could not be read: ' + customer.error));
            return wrap;
        }
        if (!customer.linked) {
            wrap.appendChild(emptyNote('No customer is linked to this project.'));
            return wrap;
        }

        var grid = kvGrid();
        customer.rows.forEach(function (item) {
            grid.appendChild(kv(item.label, item.value));
        });
        wrap.appendChild(grid);
        return wrap;
    }

    /**
     * The Department row of the header, as one or two pairs rather than a block
     * of its own: it is two names, and the Business Unit is shown beside it
     * because a department name alone does not say which part of the
     * organisation it belongs to.
     */
    function departmentPairs(label, context) {
        var department = context && context.department;
        if (!department || department.error) {
            return [{ label: label, value: 'could not be read',
                      className: 'text-danger' }];
        }
        if (!department.linked) { return [{ label: label, value: '' }]; }

        var out = [{ label: label, value: department.name }];
        if (department.businessUnit.linked) {
            out.push({ label: 'Business Unit', value: department.businessUnit.name });
        }
        return out;
    }

    /**
     * The label-and-value pairs one short field contributes.
     *
     * A list, not a single pair, because Department contributes two - and
     * because a future field that expands the same way should not need the
     * caller changed.
     *
     * A field the platform did not return says so **in its own value cell**.
     * The page used to carry a red sentence under the row and a warning banner
     * at the top counting them; both were the "info lines" the user asked to
     * lose, and neither said anything the two words in the cell do not.
     */
    function compactPairs(row, context) {
        var label = labelOf(row);

        if (row.source === 'service' && row.display === 'department') {
            return departmentPairs(label, context);
        }
        if (row.missing) {
            return [{ label: label, value: 'not returned', className: 'text-danger' }];
        }
        // `none`, `pending`, `elsewhere` and `approval` all mean "no value is
        // kept here", and on this form that is an empty cell - which is exactly
        // what the printed form has at those lines, waiting for a signature or
        // pointing at the WBS
        if (row.source === 'none' || row.display === 'pending') {
            return [{ label: label, value: '' }];
        }
        return [{ label: label, value: maybeDate(row.value) }];
    }

    /** The content of a full-width section, under its heading. */
    function blockBody(row, context) {
        if (row.source === 'service') {
            if (row.display === 'learnings') {
                return learningsBlock(context, row.learningScope);
            }
            if (row.display === 'customer') { return customerBlock(context); }
            return risksBlock(context);
        }

        if (row.missing) {
            return el('div', 'text-danger',
                'The platform did not return "' + row.field + '".');
        }
        if (row.empty) { return el('div', 'text-secondary', DASH); }

        // prose keeps its line breaks. No box around it any more: the report
        // this follows sets its text plainly, and a shaded panel per section
        // made a 16-section form read as sixteen separate cards
        var box = el('div', 'irs-sum-text', row.value);
        box.style.whiteSpace = 'pre-wrap';
        return box;
    }

    /**
     * The form: short fields paired off, long ones full width under a rule.
     *
     * Consecutive short fields collect into one grid, so the pairing follows
     * the form's own order instead of a fixed two-column split - `Project Name`
     * and `Project No.` land on one line because they are next to each other on
     * the paper form, not because something sorted them there.
     */
    function main(spec, task, project, rows, context) {
        var card = el('div', 'card irs-form');
        var head = el('div', 'card-header py-2');
        head.appendChild(el('span', 'fw-semibold', spec.title || task.typeLabel));
        if (spec.form) {
            head.appendChild(el('span', 'text-secondary small ms-2', spec.form));
        }
        card.appendChild(head);

        var body = el('div', 'card-body py-3');
        var grid = null;

        rows.forEach(function (row) {
            if (isBlock(row)) {
                grid = null;                       // the run of short fields ends
                body.appendChild(sectionHead(labelOf(row)));
                body.appendChild(blockBody(row, context));
                return;
            }
            if (!grid) {
                grid = kvGrid();
                body.appendChild(grid);
            }
            compactPairs(row, context).forEach(function (pair) {
                grid.appendChild(kv(pair.label, pair.value, pair.className));
            });
        });

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
        _table: table,
        _main: main,

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
            // the form is 23 sections tall and the widget body has no height of
            // its own, so without this the dashboard simply clips it - there is
            // no page behind a widget to scroll. The grid never needed it
            // because Tabulator sizes itself
            var content = el('div', 'irs-scroll');
            root.appendChild(messages);
            root.appendChild(content);
            parent.appendChild(root);

            /**
             * Give the scrolling region the height that is actually left on
             * screen.
             *
             * Measured rather than guessed: the toolbar, the credential bar and
             * any banner above it all take space, and a fixed `calc()` would be
             * wrong the moment one of them wraps or a warning appears. The CSS
             * carries a `max-height` as the fallback for the first paint and
             * for any host where the measurement is not available.
             */
            function fit() {
                try {
                    var top = content.getBoundingClientRect().top;
                    var available = window.innerHeight - top - 8;   // 8 = bottom gutter
                    // below about 120px there is no usable viewport - the widget
                    // is collapsed or hidden - and clamping would just produce a
                    // scrollbar around nothing
                    if (available > 120) {
                        content.style.maxHeight = Math.floor(available) + 'px';
                    }
                } catch (ignored) {
                    // leave the stylesheet's max-height in charge
                }
            }

            var busy = el('div', 'd-flex justify-content-center p-4');
            busy.appendChild(el('div', 'spinner-border spinner-border-sm text-secondary'));
            content.appendChild(busy);

            if (options.toolbar && options.onBack) {
                var back = el('button', 'btn btn-sm btn-outline-secondary', 'Back to the list');
                back.type = 'button';
                back.addEventListener('click', options.onBack);
                options.toolbar.appendChild(back);
            }

            /**
             * Rows the form definition marks `"hidden": true` are left out of
             * the page entirely - not resolved, not drawn, and not counted when
             * deciding which `$include` sections to fetch.
             *
             * This is how a row is "commented out" (user, 2026-10-08: *"as of
             * now remove these column just comment the code later when required
             * we will show them"*). JSON has no comment syntax, and deleting
             * the rows would lose the field names, the notes and the printed
             * section numbers that took a day of MQL to establish. One word per
             * row brings any of them back.
             */
            function visible(spec) {
                if (!spec || !Array.isArray(spec.fields)) { return spec; }
                var kept = spec.fields.filter(function (f) { return !f.hidden; });
                if (kept.length === spec.fields.length) { return spec; }

                var out = {};
                Object.keys(spec).forEach(function (key) { out[key] = spec[key]; });
                out.fields = kept;
                return out;
            }

            /** The form spec, or null when this subtype has none declared. */
            function loadSpec(task) {
                var id = Fields.fieldSet(task.type);
                if (!id) { return Promise.resolve(null); }
                return ConfigService.get('forms/' + id).then(visible)
                    .catch(function (err) {
                    // a missing spec must not take the page down: the sidebar
                    // is still worth showing, and the message says what to fix
                        banner(messages, 'The form definition could not be read, ' +
                            'so only the task context is shown. ' + err.message,
                            'warning');
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
                    var sections = ProjectContextService.sectionsFor(spec);
                    if (!sections.length) { return Promise.resolve(null); }
                    if (!project || !project.id) { return Promise.resolve(null); }

                    return ProjectContextService.get(project.id, sections)
                        .catch(function (err) {
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

                    /*
                     * The form and the documents panel, side by side.
                     *
                     * `xl` and not `lg` is the breakpoint because the form's
                     * prose needs room: a 16-section document squeezed into two
                     * thirds of a half-width dashboard tab wraps every line to
                     * four words. Below xl the two STACK, and the panel takes
                     * `order-1` so it lands ABOVE the form - it is the
                     * frequently used thing, and pushing it under three screens
                     * of form would be the same as hiding it.
                     */
                    var row = el('div', 'row g-3');
                    var right = el('div', 'col-12 col-xl-8 order-2 order-xl-1');

                    var side = el('div', 'col-12 col-xl-4 order-1 order-xl-2');
                    // sticky, so it stays in view as the form scrolls past it -
                    // inside the one scrolling region, not a second one
                    var sticky = el('div', 'irs-docs-sticky');
                    sticky.appendChild(DocumentsPanel.render(task));
                    side.appendChild(sticky);

                    if (spec && Array.isArray(spec.fields)) {
                        var rows = spec.fields.map(function (f) {
                            return resolve(f, task, project);
                        });
                        // no "N fields were not returned" banner any more: each
                        // such field now says so in its own cell, and the form
                        // was asked to lose every line that is not the form
                        right.appendChild(main(spec, task, project, rows, context));
                    } else if (spec) {
                        right.appendChild(el('div', 'alert alert-warning small',
                            'The form definition has no "fields" list.'));
                    } else {
                        right.appendChild(el('div', 'alert alert-secondary small',
                            'No form definition is declared for ' + task.typeLabel + '.'));
                    }
                    row.appendChild(right);
                    row.appendChild(side);
                    content.appendChild(row);
                    fit();
                });
            }).catch(function (err) {
                if (destroyed) { return; }
                clear(content);
                banner(messages, 'The task could not be opened: ' +
                    (err && err.message ? err.message : err), 'danger');
            });

            return {
                // the layout is Bootstrap's, but the scrolling region's height
                // is not - it depends on how much viewport is left, which a
                // resized widget changes
                redraw: fit,
                destroy: function () { destroyed = true; }
            };
        }
    };
});
