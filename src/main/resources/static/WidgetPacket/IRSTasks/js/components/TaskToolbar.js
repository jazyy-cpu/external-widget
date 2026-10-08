/**
 * Toolbar above the task grid.
 *
 *   ( ) Show completed   [All fields v][        ][search][Clear][Refresh]  | Credential
 *
 * Same control set and same layout as the project widget's ListToolbar
 * (user, 2026-10-03: reuse the look and feel), so the two widgets behave
 * identically: the user picks the field, types, and presses the magnifier or
 * Enter. It renders into the left of the widget's shared top row; the
 * credential picker occupies the right of that same row.
 *
 * No heading and no row count: the widget's own title bar names it and
 * Tabulator's footer already says "Showing 1-3 of 3 rows".
 *
 * No create button: tasks are created on the project, not from this grid.
 *
 * Bootstrap classes only, no Bootstrap JavaScript (UWA rule C7).
 */
define('IRSTasks/components/TaskToolbar', [], function () {
    'use strict';

    var SWITCH_ID = 'irsTasksShowClosed';

    /**
     * The searchable fields, in the order the picker offers them. Must stay in
     * step with SEARCH_FIELDS in TaskListView - that is the one coupling, and
     * it is why both lists name the row keys and not the column titles.
     */
    var FIELDS = [
        { value: 'all', label: 'All fields' },
        { value: 'title', label: 'Title' },
        { value: 'projectName', label: 'Project' },
        { value: 'assignedTo', label: 'Assigned To' }
    ];

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    /**
     * A magnifier as inline SVG - one 200-byte shape rather than an icon font
     * for a single glyph. Same path as the project widget's toolbar.
     */
    function magnifier() {
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('aria-hidden', 'true');
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', 'M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115' +
            'l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1M12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0');
        svg.appendChild(path);
        return svg;
    }

    /**
     * What the search box may look in when the APPROVALS view is showing.
     *
     * A different set because the rows are different objects: an approval has
     * no title and no project of its own, and the useful handles are the role,
     * the task it is approving and the route it belongs to.
     */
    var APPROVAL_FIELDS = [
        { value: 'all', label: 'All fields' },
        { value: 'role', label: 'Role' },
        { value: 'connectedName', label: 'On task' },
        { value: 'routeName', label: 'Route' }
    ];

    return {
        FIELDS: FIELDS,
        APPROVAL_FIELDS: APPROVAL_FIELDS,

        /**
         * @param {HTMLElement} parent
         * @param {Object} options
         * @param {boolean}  options.includeClosed  initial state of the switch
         * @param {string}   [options.mode]       'tasks' (default) or 'approvals'
         * @param {Function} options.onRefresh
         * @param {Function} options.onToggleClosed  called with the new boolean
         * @param {Function} options.onSearch        called with (term, field)
         * @param {Function} [options.onMode]        called with the new mode
         * @returns {{root, setBusy, setMode, setCount, setFields}}
         */
        render: function (parent, options) {
            var root = el('div', 'd-flex flex-wrap align-items-center gap-2 flex-grow-1');
            var mode = options.mode || 'tasks';

            /*
             * Two views, one grid.
             *
             * An inbox task is not an IRS task - the landing grid has filtered
             * them out by type since 2026-10-07 - so they get their own view
             * rather than a second kind of row in the same list. A segmented
             * control rather than a tab strip: there are exactly two, and the
             * widget frame has no room for a tab row above the toolbar.
             *
             * The count rides on the Approvals button, because "how many are
             * waiting on me" is the reason to look at all.
             */
            var modes = el('div', 'btn-group btn-group-sm');
            modes.setAttribute('role', 'group');
            modes.setAttribute('aria-label', 'Which list to show');

            var countBadge = el('span', 'badge rounded-pill text-bg-light border ms-1');

            function modeButton(value, text, withCount) {
                var button = el('button', 'btn btn-outline-secondary');
                button.type = 'button';
                button.appendChild(document.createTextNode(text));
                if (withCount) { button.appendChild(countBadge); }
                button.addEventListener('click', function () {
                    if (mode === value) { return; }
                    // everything `setMode` does, and then the callback: one
                    // function for both routes, or the label and the search
                    // fields drift out of step with the buttons
                    applyMode(value);
                    if (options.onMode) { options.onMode(value); }
                });
                modes.appendChild(button);
                return button;
            }

            var tasksButton = modeButton('tasks', 'IRS Tasks', false);
            var approvalsButton = modeButton('approvals', 'Approvals', true);

            function paintModes() {
                tasksButton.className = 'btn btn-sm btn-' +
                    (mode === 'tasks' ? 'secondary' : 'outline-secondary');
                approvalsButton.className = 'btn btn-sm btn-' +
                    (mode === 'approvals' ? 'secondary' : 'outline-secondary');
                tasksButton.setAttribute('aria-pressed', String(mode === 'tasks'));
                approvalsButton.setAttribute('aria-pressed', String(mode === 'approvals'));
            }
            paintModes();
            root.appendChild(modes);

            var check = el('div', 'form-check form-switch mb-0 me-auto');
            var input = el('input', 'form-check-input');
            input.type = 'checkbox';
            input.id = SWITCH_ID;
            input.checked = !!options.includeClosed;
            // the same switch means the same thing in both views - "also show
            // the ones that are finished with" - but the word differs: a task
            // is completed, an approval step is decided
            var label = el('label', 'form-check-label small',
                           mode === 'approvals' ? 'Show decided' : 'Show completed');
            label.setAttribute('for', SWITCH_ID);
            input.addEventListener('change', function () {
                options.onToggleClosed(input.checked);
            });
            check.appendChild(input);
            check.appendChild(label);
            root.appendChild(check);

            // ---- the one search control ----------------------------------
            var group = el('div', 'input-group input-group-sm w-auto');

            var field = el('select', 'form-select flex-grow-0 w-auto');
            field.setAttribute('aria-label', 'Field to search');

            function fillFields(list) {
                while (field.firstChild) { field.removeChild(field.firstChild); }
                list.forEach(function (f) {
                    var opt = el('option', null, f.label);
                    opt.value = f.value;
                    field.appendChild(opt);
                });
            }
            fillFields(mode === 'approvals' ? APPROVAL_FIELDS : FIELDS);

            var term = el('input', 'form-control');
            term.type = 'search';
            term.placeholder = 'Search…';
            term.setAttribute('aria-label', 'Search tasks');

            var go = el('button', 'btn btn-outline-secondary');
            go.type = 'button';
            go.title = 'Search';
            go.setAttribute('aria-label', 'Search');
            go.appendChild(magnifier());

            var clear = el('button', 'btn btn-outline-secondary', 'Clear');
            clear.type = 'button';

            var refresh = el('button', 'btn btn-outline-secondary', 'Refresh');
            refresh.type = 'button';
            refresh.addEventListener('click', function () { options.onRefresh(); });

            function apply() { options.onSearch(term.value, field.value); }

            go.addEventListener('click', apply);
            term.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); apply(); }
            });
            // a cleared box shows everything again without a second click
            term.addEventListener('search', function () { if (!term.value) { apply(); } });
            field.addEventListener('change', function () { if (term.value) { apply(); } });
            clear.addEventListener('click', function () {
                term.value = '';
                field.value = 'all';
                apply();
            });

            group.appendChild(field);
            group.appendChild(term);
            group.appendChild(go);
            group.appendChild(clear);
            group.appendChild(refresh);
            root.appendChild(group);

            parent.appendChild(root);

            /**
             * Put the toolbar into a view: the buttons, the switch's wording
             * and what the search box may look in.
             *
             * The switch means the same thing in both views - "also show the
             * ones that are finished with" - but the word differs: a task is
             * completed, an approval step is decided.
             */
            function applyMode(value) {
                mode = value;
                paintModes();
                label.textContent = value === 'approvals'
                    ? 'Show decided' : 'Show completed';
                fillFields(value === 'approvals' ? APPROVAL_FIELDS : FIELDS);
                // the box is cleared with the view: a term that matched a task
                // title means nothing against a list of roles
                term.value = '';
                field.value = 'all';
            }

            return {
                root: root,

                /** The current view, after a click on the segmented control. */
                getMode: function () { return mode; },

                /** Switch the view from outside, without firing `onMode`. */
                setMode: applyMode,

                /** Whether the switch is on, so a view change can keep it. */
                isIncludeClosed: function () { return input.checked; },
                setIncludeClosed: function (value) { input.checked = !!value; },

                /**
                 * How many approvals are waiting. Shown on the button, so the
                 * reason to switch views is visible without switching.
                 */
                setCount: function (count) {
                    countBadge.textContent = (count === null || count === undefined)
                        ? '' : String(count);
                },

                /** Disable the controls while a load is running. */
                setBusy: function (busy) {
                    refresh.disabled = busy;
                    input.disabled = busy;
                    go.disabled = busy;
                }
            };
        }
    };
});
