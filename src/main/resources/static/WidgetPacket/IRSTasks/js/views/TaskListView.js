/**
 * The task list - the widget's landing page.
 *
 * Toolbar + Tabulator grid, local pagination and one search control, built to
 * the same shape as the project widget's list (user, 2026-10-03: reuse the look
 * and feel). The two traps that cost time there are already handled here:
 *
 *   1. **Tabulator is reached through JazzySole/TabulatorLoader**, never a
 *      `<script>` tag - its UMD bundle would call an anonymous `define()` and
 *      break the whole module graph.
 *   2. **Tabulator's constructor is asynchronous.** It defers `_create()` into
 *      a `setTimeout`, so right after `new Tabulator(...)` the column manager
 *      has no element. Calling `setHeight` or `setFilter` in that window throws
 *      inside Tabulator and leaves the grid half-built. Everything that touches
 *      the table waits for `tableBuilt` - see `built` and `ready()`.
 *
 * The grid gets an explicit pixel height that fills the widget frame, which is
 * what pins the pager to the bottom of the widget rather than floating it under
 * the last row. Tabulator only pins its footer when it knows its own height,
 * and `height: '100%'` would need every ancestor to have a definite height,
 * which a UWA body does not - so the height is measured here and recomputed on
 * every resize.
 *
 * The "show completed" choice is kept in the hidden preference
 * xPrefTasksShowClosed, so a widget refresh comes back to the same view
 * (rule R6).
 *
 * The grid reads live data since 2026-10-07. `TaskService` applies two filters
 * of its own - only the four IRS gateway subtypes, and no baseline or snapshot
 * copies - and reports how many rows each one dropped. That note is shown above
 * the grid, so a short list says why it is short instead of looking broken.
 */
define('IRSTasks/views/TaskListView', [
    'JazzySole/TabulatorLoader',
    'IRSTasks/services/TaskService',
    'IRSTasks/components/TaskToolbar',
    'IRSTasks/views/TaskColumns'
], function (TabulatorLoader, TaskService, TaskToolbar, columns) {
    'use strict';

    var SHOW_CLOSED = 'xPrefTasksShowClosed';
    var MIN_HEIGHT = 180;      // never collapse the grid to nothing
    var BOTTOM_GAP = 8;        // breathing room under the pager

    /** Fields the search box may look in - must match TaskToolbar.FIELDS. */
    var SEARCH_FIELDS = ['title', 'projectName', 'assignedTo'];

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

    function readShowClosed() {
        return String(widget.getValue(SHOW_CLOSED)) === 'true';
    }

    /**
     * Returns null when nothing is being searched for, so the caller can clear
     * the filter instead of installing a match-everything one.
     */
    function matcher(term, field) {
        var needle = String(term || '').trim().toLowerCase();
        if (!needle) { return null; }
        var keys = (!field || field === 'all') ? SEARCH_FIELDS : [field];
        return function (row) {
            return keys.some(function (key) {
                return String(row[key] || '').toLowerCase().indexOf(needle) >= 0;
            });
        };
    }

    return {
        /** for tests only */
        _matcher: matcher,

        /**
         * @param {HTMLElement} parent
         * @param {Object} [options]
         * @param {HTMLElement} [options.toolbar]  the shared top row's left slot;
         *        without it the toolbar sits above the grid as its own row
         * @param {Function} [options.onOpenTask]  called with the row data on a title click
         * @returns {{redraw: Function, reload: Function, destroy: Function}}
         */
        render: function (parent, options) {
            options = options || {};
            var includeClosed = readShowClosed();
            var table = null;
            var built = null;             // resolves when Tabulator says tableBuilt
            var search = { term: '', field: 'all' };
            var destroyed = false;

            var root = el('div');
            var messages = el('div');
            var host = el('div');              // Tabulator replaces this one's content
            var busy = el('div', 'd-flex justify-content-center p-4');
            busy.appendChild(el('div', 'spinner-border spinner-border-sm text-secondary'));

            var toolbar = TaskToolbar.render(options.toolbar || root, {
                includeClosed: includeClosed,
                onRefresh: function () { load(); },
                onToggleClosed: function (checked) {
                    includeClosed = checked;
                    widget.setValue(SHOW_CLOSED, String(checked));
                    load();
                },
                onSearch: function (term, field) {
                    search = { term: term, field: field };
                    applySearch();
                }
            });
            root.appendChild(messages);
            root.appendChild(host);
            parent.appendChild(root);

            /** Whatever is left of the widget frame below the toolbar. */
            function availableHeight() {
                var viewport = document.documentElement.clientHeight || window.innerHeight || 0;
                var top = host.getBoundingClientRect().top;
                return Math.max(MIN_HEIGHT, Math.round(viewport - top - BOTTOM_GAP));
            }

            /**
             * True only when the table exists AND Tabulator has finished
             * building it. `initialized` is Tabulator's own flag; its public
             * methods are unsafe before it is set.
             */
            function ready() {
                return !destroyed && !!table && table.initialized === true;
            }

            function fitHeight() {
                if (ready()) { table.setHeight(availableHeight()); }
            }

            function applySearch() {
                if (!ready()) { return; }
                var fn = matcher(search.term, search.field);
                if (fn) { table.setFilter(fn); } else { table.clearFilter(true); }
            }

            function note(text, level) {
                var box = el('div', 'alert alert-' + (level || 'warning') + ' small py-2', text);
                box.setAttribute('role', 'alert');
                messages.appendChild(box);
            }

            function openTask(row) {
                if (options.onOpenTask) { options.onOpenTask(row); }
            }

            function build(rows) {
                return TabulatorLoader.load().then(function (Tabulator) {
                    if (destroyed) { return null; }
                    clear(host);
                    table = new Tabulator(host, {
                        data: rows,
                        columns: columns(openTask),
                        // an explicit height is what pins the pager to the bottom
                        height: availableHeight(),
                        // minimum widths + fitDataFill = a horizontal scroll bar
                        // on a narrow widget instead of squeezed columns
                        layout: 'fitDataFill',
                        responsiveLayout: false,
                        index: 'id',
                        placeholder: 'No task in this view.',
                        initialSort: [{ column: 'finish', dir: 'asc' }],
                        pagination: true,
                        paginationMode: 'local',
                        paginationSize: 20,
                        paginationSizeSelector: [10, 20, 50, 100],
                        paginationCounter: 'rows'
                    });

                    // the constructor returns before the table exists
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

            function load() {
                clear(messages);
                toolbar.setBusy(true);
                if (!table) { clear(host).appendChild(busy); }

                return TaskService.list({ includeClosed: includeClosed }).then(function (result) {
                    if (destroyed) { return null; }
                    // how many rows the service's own filters dropped, and why
                    if (result.note) { note(result.note, 'info'); }

                    if (table) {
                        // a reload while the first build is still running would
                        // call replaceData on a half-built table
                        return (built || Promise.resolve()).then(function () {
                            return destroyed ? null : table.replaceData(result.rows);
                        });
                    }
                    return build(result.rows);
                }).then(function () {
                    if (destroyed) { return; }
                    toolbar.setBusy(false);
                    // a strip above the grid moves it down: re-measure
                    fitHeight();
                }).catch(function (err) {
                    // one handler for both the call and the render: a failure
                    // while building would otherwise become an unhandled
                    // rejection that leaves the spinner turning and says nothing
                    if (destroyed) { return; }
                    toolbar.setBusy(false);
                    if (!ready()) { clear(host); }
                    note('The tasks could not be loaded: ' +
                         (err && err.message ? err.message : err), 'danger');
                });
            }

            load();

            return {
                /** called from UWA onResize */
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
