/**
 * The Key Learnings register - the widget's only page (WGT-11).
 *
 * Toolbar + Tabulator grid, local pagination, one search box, Tabulator's own
 * export and print. Same shape as IRSProjects' list view, so the widgets
 * behave alike: the controls go into the shared top band through
 * `options.toolbar`, and the grid fills what is left of the frame.
 *
 * Nothing is read until a From and To date are chosen (WP11 D8), and EVERY
 * start is clean: no range, no search text, no rows. The range and the search
 * are deliberately NOT kept in preferences - the user's decision of
 * 2026-10-25 ("each time we reload the widget, old search should not show"),
 * which overrides rule R6 for this widget.
 *
 * Tabulator's constructor is asynchronous (HANDOFF trap 7): everything that
 * touches the table waits for `tableBuilt` and is guarded by ready().
 */
define('IRSKeyLearnings/views/LearningListView', [
    'JazzySole/TabulatorLoader',
    'JazzySole/Notify',
    'IRSKeyLearnings/config/LearningFields',
    'IRSKeyLearnings/services/LearningService',
    'IRSKeyLearnings/components/LearningToolbar',
    'IRSKeyLearnings/views/LearningColumns'
], function (TabulatorLoader, Notify, Fields, LearningService, LearningToolbar, LearningColumns) {
    'use strict';

    var MIN_HEIGHT = 180;
    var BOTTOM_GAP = 8;

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    function clear(node) {
        while (node.firstChild) { node.removeChild(node.firstChild); }
        return node;
    }

    /**
     * The search box: every word must appear somewhere in the row's text
     * columns, case-insensitive. Returns null for an empty box, so the caller
     * clears the filter instead of installing a match-everything one.
     */
    function matcher(term) {
        var words = String(term || '').toLowerCase().split(/\s+/).filter(function (w) { return !!w; });
        if (!words.length) { return null; }
        return function (row) {
            var hay = Fields.SEARCH_KEYS.map(function (k) { return String(row[k] || ''); })
                .join(' \u0001 ').toLowerCase();
            return words.every(function (w) { return hay.indexOf(w) >= 0; });
        };
    }

    return {
        _matcher: matcher,

        /**
         * @param {HTMLElement} parent
         * @param {Object} [options] {toolbar}
         * @returns {{redraw: Function, reload: Function, destroy: Function}}
         */
        render: function (parent, options) {
            var opts = options || {};
            var destroyed = false;
            var table = null;
            var built = null;
            // a clean start every time - nothing restored (see the header)
            var range = { from: '', to: '' };
            var term = '';

            var root = el('div');
            var messages = el('div');
            var host = el('div');
            root.appendChild(messages);
            root.appendChild(host);
            parent.appendChild(root);

            var toolbar = LearningToolbar.render(opts.toolbar || root, {
                from: range.from,
                to: range.to,
                search: term,
                onShow: function (from, to) {
                    range = { from: from, to: to };
                    load();
                },
                onSearch: function (value) {
                    term = value;
                    applySearch();
                },
                onExport: exportAs,
                onPrint: function () { if (ready()) { table.print('active', true); } }
            });

            function ready() { return !destroyed && !!table && table.initialized === true; }

            function availableHeight() {
                var viewport = document.documentElement.clientHeight || window.innerHeight || 0;
                var top = host.getBoundingClientRect().top;
                return Math.max(MIN_HEIGHT, Math.round(viewport - top - BOTTOM_GAP));
            }

            function fitHeight() { if (ready()) { table.setHeight(availableHeight()); } }

            function note(text, level) {
                var box = el('div', 'alert alert-' + (level || 'secondary') + ' small py-2 mb-2', text);
                box.setAttribute('role', 'status');
                messages.appendChild(box);
            }

            function applySearch() {
                if (!ready()) { return; }
                var fn = matcher(term);
                if (fn) { table.setFilter(fn); } else { table.clearFilter(true); }
            }

            function exportAs(format) {
                if (!ready()) { return; }
                var spec = Fields.EXPORTS.filter(function (f) { return f.format === format; })[0];
                if (!spec) { return; }
                var name = Fields.fileName(range.from, range.to, spec.extension);
                // 'active' rows = what the search box currently shows; the BOM
                // is what makes Excel read the names as UTF-8
                table.download(format, name, format === 'csv' ? { bom: true } : {}, 'active');
            }

            function build(rows) {
                return TabulatorLoader.load().then(function (Tabulator) {
                    if (destroyed) { return null; }
                    clear(host);
                    table = new Tabulator(host, {
                        data: rows,
                        columns: LearningColumns.build(),
                        height: availableHeight(),
                        layout: 'fitDataFill',
                        index: 'id',
                        placeholder: 'No key learning was originated in this range.',
                        pagination: true,
                        paginationMode: 'local',
                        paginationSize: 20,
                        paginationSizeSelector: [10, 20, 50, 100],
                        paginationCounter: 'rows',
                        // Print: Tabulator's own print view of the table, with
                        // the register's title and range on top
                        printAsHtml: true,
                        printStyled: true,
                        printRowRange: 'active',
                        printHeader: function () {
                            var h = el('h3', null, 'Key Learnings - ' + range.from + ' to ' + range.to);
                            return h.outerHTML;
                        },
                        downloadRowRange: 'active'
                    });
                    built = new Promise(function (resolve) {
                        table.on('tableBuilt', function () { resolve(); });
                    });
                    return built.then(function () {
                        if (destroyed) { return null; }
                        applySearch();
                        return table;
                    });
                });
            }

            function waitForRange() {
                clear(messages);
                toolbar.setHasRows(false);
                note('Choose a From and a To date, then press Show. The key learnings ' +
                     'originated in that range are read from the search index.', 'secondary');
            }

            function load() {
                if (destroyed) { return Promise.resolve(); }
                var problem = Fields.rangeError(range.from, range.to);
                if (problem) { waitForRange(); return Promise.resolve(); }

                clear(messages);
                toolbar.setBusy(true);
                if (!table) {
                    var spin = el('div', 'd-flex justify-content-center p-4');
                    spin.appendChild(el('div', 'spinner-border spinner-border-sm text-secondary'));
                    clear(host).appendChild(spin);
                }

                return LearningService.list(range).then(function (result) {
                    if (destroyed) { return null; }
                    if (result.truncated) {
                        // a partial list must never look complete
                        note('Only the first ' + Fields.MAX_ROWS + ' key learnings of this range are ' +
                             'shown' + (result.total > 0 ? ' (the index holds ' + result.total + ')' : '') +
                             '. Choose a shorter range to see them all.', 'warning');
                    }
                    toolbar.setHasRows(result.rows.length > 0);
                    if (table) {
                        return (built || Promise.resolve()).then(function () {
                            return destroyed ? null : table.replaceData(result.rows);
                        });
                    }
                    return build(result.rows);
                }).then(function () {
                    if (destroyed) { return; }
                    toolbar.setBusy(false);
                    fitHeight();
                }).catch(function (err) {
                    if (destroyed) { return; }
                    toolbar.setBusy(false);
                    if (!ready()) { clear(host); }
                    var why = err && err.message ? err.message : String(err);
                    note('The key learnings could not be read: ' + why, 'danger');
                    Notify.error('The key learnings could not be read.');
                });
            }

            load();

            return {
                redraw: function () {
                    if (!ready()) { return; }
                    table.setHeight(availableHeight());
                    table.redraw(true);
                },
                reload: load,
                destroy: function () {
                    destroyed = true;
                    if (table) { try { table.destroy(); } catch (e) { /* already gone */ } }
                    table = null;
                    built = null;
                }
            };
        }
    };
});
