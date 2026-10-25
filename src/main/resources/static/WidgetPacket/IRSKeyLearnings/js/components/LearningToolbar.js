/**
 * The register's controls, in the widget's shared top band (WGT-11 design §2).
 *
 *   From [date] To [date] [Show] | [search..][x] | Export [CSV] [Print] | Credential
 *
 * NOTHING IS READ UNTIL A RANGE IS CHOSEN (WP11 D8). Show stays disabled
 * until both dates are set, so the first thing the widget can ever ask the
 * index is a bounded question. The search box filters the rows already
 * loaded and never calls the server.
 *
 * Native inputs with Bootstrap classes only - Bootstrap's JavaScript is not
 * loaded in a UWA widget (rule C3), so there is no dropdown component; the
 * export formats are plain buttons.
 */
define('IRSKeyLearnings/components/LearningToolbar', [
    'IRSKeyLearnings/config/LearningFields'
], function (Fields) {
    'use strict';

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    function button(text, style, title) {
        var b = el('button', 'btn btn-sm ' + (style || 'btn-outline-secondary'), text);
        b.type = 'button';
        if (title) { b.title = title; }
        return b;
    }

    function dateField(parent, label, value) {
        var wrap = el('div', 'd-flex align-items-center gap-1');
        var l = el('label', 'small text-body-secondary mb-0', label);
        var input = el('input', 'form-control form-control-sm w-auto');
        input.type = 'date';
        input.value = value || '';
        input.setAttribute('aria-label', label + ' date');
        wrap.appendChild(l);
        wrap.appendChild(input);
        parent.appendChild(wrap);
        return input;
    }

    return {
        /**
         * @param {HTMLElement} parent
         * @param {Object} options
         * @param {string}   options.from, options.to, options.search   initial values
         * @param {Function} options.onShow(from, to)
         * @param {Function} options.onSearch(term)
         * @param {Function} options.onExport(format)
         * @param {Function} options.onPrint()
         * @returns {{setBusy: Function, setHasRows: Function, setRange: Function}}
         */
        render: function (parent, options) {
            var opts = options || {};
            var root = el('div', 'd-flex flex-wrap align-items-center gap-2 flex-grow-1');

            // ---- the range: required before anything is read -----------
            var range = el('div', 'd-flex flex-wrap align-items-center gap-2');
            var from = dateField(range, 'From', opts.from);
            var to = dateField(range, 'To', opts.to);
            var show = button('Show', 'btn-primary', 'Read the key learnings originated in this range');
            range.appendChild(show);
            root.appendChild(range);

            root.appendChild(el('div', 'vr'));

            // ---- search within what is loaded ---------------------------
            var group = el('div', 'input-group input-group-sm w-auto');
            var term = el('input', 'form-control');
            term.type = 'search';
            term.placeholder = 'Search the list';
            term.value = opts.search || '';
            term.setAttribute('aria-label', 'Search the key learnings shown');
            var clear = button('Clear');
            group.appendChild(term);
            group.appendChild(clear);
            root.appendChild(group);

            root.appendChild(el('div', 'vr'));

            // ---- export and print: Tabulator's own, no extra library ----
            var out = el('div', 'd-flex align-items-center gap-1');
            out.appendChild(el('span', 'small text-body-secondary', 'Export'));
            var exportButtons = Fields.EXPORTS.map(function (f) {
                var b = button(f.label, 'btn-outline-secondary', 'Download the rows shown as ' + f.label);
                b.addEventListener('click', function () { if (opts.onExport) { opts.onExport(f.format); } });
                out.appendChild(b);
                return b;
            });
            var print = button('Print', 'btn-outline-secondary', 'Print the rows shown');
            print.addEventListener('click', function () { if (opts.onPrint) { opts.onPrint(); } });
            out.appendChild(print);
            root.appendChild(out);

            function rangeOk() { return !Fields.rangeError(from.value, to.value); }
            function syncShow() {
                show.disabled = !rangeOk();
                show.title = rangeOk() ? 'Read the key learnings originated in this range'
                    : Fields.rangeError(from.value, to.value);
            }

            from.addEventListener('change', syncShow);
            from.addEventListener('input', syncShow);
            to.addEventListener('change', syncShow);
            to.addEventListener('input', syncShow);
            show.addEventListener('click', function () {
                if (rangeOk() && opts.onShow) { opts.onShow(from.value, to.value); }
            });

            function search() { if (opts.onSearch) { opts.onSearch(term.value); } }
            term.addEventListener('input', search);
            term.addEventListener('search', search);
            clear.addEventListener('click', function () { term.value = ''; search(); });

            var hasRows = false;
            var busy = false;
            function syncOut() {
                exportButtons.concat([print]).forEach(function (b) { b.disabled = busy || !hasRows; });
            }

            syncShow();
            syncOut();
            parent.appendChild(root);

            return {
                setBusy: function (on) {
                    busy = !!on;
                    show.disabled = busy || !rangeOk();
                    show.textContent = busy ? 'Reading...' : 'Show';
                    from.disabled = busy;
                    to.disabled = busy;
                    syncOut();
                },
                setHasRows: function (yes) { hasRows = !!yes; syncOut(); },
                range: function () { return { from: from.value, to: to.value }; }
            };
        }
    };
});
