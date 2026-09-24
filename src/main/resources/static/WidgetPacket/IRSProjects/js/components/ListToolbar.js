/**
 * Toolbar above the project grid (WGT-01 section 3).
 *
 *   ( ) Show completed / archived   [All fields v][ ][🔍][Clear][Refresh]  | Credential
 *
 * It renders into the left of the widget's shared top row; the credential
 * picker occupies the right of that same row. Neither a "IRS Projects" heading
 * nor a row count is shown (user, 2026-09-24): the widget's own title bar
 * already names it, and Tabulator's footer already says "Showing 1-3 of 3
 * rows". Two labels saying the same thing is one too many in a frame this
 * short.
 *
 * The search control: the user picks the field first, types, and presses the
 * magnifier or Enter. Only Project No. and Title are searchable - the other
 * columns are either badges with a handful of values or not filled yet.
 *
 * No create button: projects are created with the OOTB project widget
 * (user, 2026-09-23). Bootstrap classes only, no Bootstrap JavaScript.
 */
define('IRSProjects/components/ListToolbar', [], function () {
    'use strict';

    var SWITCH_ID = 'irsShowClosed';

    /** The searchable fields, in the order the picker offers them. */
    var FIELDS = [
        { value: 'all', label: 'All fields' },
        { value: 'projectNo', label: 'Project No.' },
        { value: 'title', label: 'Title' }
    ];

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    /**
     * A magnifier as inline SVG. No icon font is bundled, and one 200-byte
     * shape is cheaper than adding Bootstrap Icons for a single glyph.
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
        // circle + handle, Bootstrap Icons "search" outline
        path.setAttribute('d', 'M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115' +
            'l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1M12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0');
        svg.appendChild(path);
        return svg;
    }

    return {
        FIELDS: FIELDS,

        /**
         * @param {HTMLElement} parent
         * @param {Object} options
         * @param {boolean}  options.includeClosed  initial state of the switch
         * @param {Function} options.onRefresh
         * @param {Function} options.onToggleClosed  called with the new boolean
         * @param {Function} options.onSearch        called with (term, field)
         * @returns {{root: HTMLElement, setBusy: Function}}
         */
        render: function (parent, options) {
            var root = el('div', 'd-flex flex-wrap align-items-center gap-2 flex-grow-1');

            var check = el('div', 'form-check form-switch mb-0 me-auto');
            var input = el('input', 'form-check-input');
            input.type = 'checkbox';
            input.id = SWITCH_ID;
            input.checked = !!options.includeClosed;
            var label = el('label', 'form-check-label small', 'Show completed / archived');
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
            FIELDS.forEach(function (f) {
                var opt = el('option', null, f.label);
                opt.value = f.value;
                field.appendChild(opt);
            });

            var term = el('input', 'form-control');
            term.type = 'search';
            term.placeholder = 'Search…';
            term.setAttribute('aria-label', 'Search projects');

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

            return {
                root: root,
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
