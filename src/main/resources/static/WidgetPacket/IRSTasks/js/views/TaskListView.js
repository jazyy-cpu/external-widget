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
    'IRSTasks/services/InboxTaskService',
    'IRSTasks/components/TaskToolbar',
    'IRSTasks/views/TaskColumns',
    'IRSTasks/views/InboxColumns'
], function (TabulatorLoader, TaskService, InboxTaskService, TaskToolbar,
             columns, inboxColumns) {
    'use strict';

    var SHOW_CLOSED = 'xPrefTasksShowClosed';
    var MODE = 'xPrefTasksMode';
    var MIN_HEIGHT = 180;      // never collapse the grid to nothing
    var BOTTOM_GAP = 8;        // breathing room under the pager

    /** Fields the search box may look in - must match TaskToolbar.FIELDS. */
    var SEARCH_FIELDS = ['title', 'projectName', 'assignedTo'];

    /** The same, for the approvals view - must match APPROVAL_FIELDS. */
    var INBOX_SEARCH_FIELDS = ['role', 'connectedName', 'routeName'];

    /**
     * The two views, as data rather than as branches scattered through the
     * file. Each says where its rows come from, how to draw them, what the
     * search box may look in, and how to sort - and nothing else differs.
     */
    var VIEWS = {
        tasks: {
            columns: columns,
            searchFields: SEARCH_FIELDS,
            sort: 'finish',
            empty: 'No task in this view.',
            failed: 'The tasks could not be loaded: ',
            load: function (includeClosed) {
                return TaskService.list({ includeClosed: includeClosed });
            }
        },
        approvals: {
            columns: inboxColumns,
            searchFields: INBOX_SEARCH_FIELDS,
            // what is overdue matters more than what was made recently
            sort: 'dueDate',
            empty: 'Nothing is waiting for your approval.',
            failed: 'The approvals could not be loaded: ',
            load: function (includeDecided) {
                return InboxTaskService.list({ includeDecided: includeDecided });
            }
        }
    };

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
     * Which list was showing last. Unknown values fall back to `tasks`, so a
     * stale preference from an older build cannot leave the widget on a view
     * that no longer exists.
     */
    function readMode() {
        var saved = widget.getValue(MODE);
        return VIEWS[saved] ? saved : 'tasks';
    }

    function readShowClosed() {
        return String(widget.getValue(SHOW_CLOSED)) === 'true';
    }

    /**
     * Returns null when nothing is being searched for, so the caller can clear
     * the filter instead of installing a match-everything one.
     */
    function matcher(term, field, allFields) {
        var needle = String(term || '').trim().toLowerCase();
        if (!needle) { return null; }
        // "All fields" means the ACTIVE view's fields: an approval row has no
        // title and no project, so searching a task's keys would match nothing
        var keys = (!field || field === 'all') ? (allFields || SEARCH_FIELDS) : [field];
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
            // the view survives a refresh, like every other navigation state
            // on this widget (rule R6) - a user working a queue of approvals
            // should not be put back on the task list by a reload
            var mode = readMode();
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
                mode: mode,
                onRefresh: function () { load(); },
                onToggleClosed: function (checked) {
                    includeClosed = checked;
                    widget.setValue(SHOW_CLOSED, String(checked));
                    load();
                },
                onSearch: function (term, field) {
                    search = { term: term, field: field };
                    applySearch();
                },
                /*
                 * A view change REBUILDS the table rather than replacing its
                 * data: the two views have different columns, and Tabulator's
                 * `setColumns` on a live table loses the sort, the page and the
                 * frozen-column state. Destroying is both simpler and more
                 * honest about what is happening.
                 */
                onMode: function (next) {
                    mode = next;
                    widget.setValue(MODE, next);
                    search = { term: '', field: 'all' };
                    if (table) {
                        try { table.destroy(); } catch (e) { /* already gone */ }
                        table = null;
                        built = null;
                    }
                    load();
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

            /** The active view's definition - source, columns, search, sort. */
            function view() { return VIEWS[mode]; }

            function applySearch() {
                if (!ready()) { return; }
                var fn = matcher(search.term, search.field, view().searchFields);
                if (fn) { table.setFilter(fn); } else { table.clearFilter(true); }
            }

            function note(text, level) {
                var box = el('div', 'alert alert-' + (level || 'warning') + ' small py-2', text);
                box.setAttribute('role', 'alert');
                messages.appendChild(box);
            }

            /**
             * Open what the row is ABOUT.
             *
             * In the task view that is the row itself. In the approvals view it
             * is the **connected custom task** - the form, its documents and
             * its approval chain - and never the inbox task, which has nothing
             * to show that its own row does not already say.
             *
             * `InboxTaskService` drops any row without a connected task, so
             * `connectedId` is always set on a row that reaches the grid; the
             * fallback is there because a formatter is not a contract.
             */
            function openTask(row) {
                if (!options.onOpenTask) { return; }
                if (mode === 'approvals') {
                    if (!row.connectedId) { return; }
                    options.onOpenTask({ id: row.connectedId, fromInboxTask: row.id });
                    return;
                }
                options.onOpenTask(row);
            }

            function build(rows) {
                return TabulatorLoader.load().then(function (Tabulator) {
                    if (destroyed) { return null; }
                    clear(host);
                    table = new Tabulator(host, {
                        data: rows,
                        columns: view().columns(openTask),
                        // an explicit height is what pins the pager to the bottom
                        height: availableHeight(),
                        // minimum widths + fitDataFill = a horizontal scroll bar
                        // on a narrow widget instead of squeezed columns
                        layout: 'fitDataFill',
                        responsiveLayout: false,
                        index: 'id',
                        placeholder: view().empty,
                        initialSort: [{ column: view().sort, dir: 'asc' }],
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

                return view().load(includeClosed).then(function (result) {
                    if (destroyed) { return null; }
                    // how many rows the service's own filters dropped, and why
                    if (result.note) { note(result.note, 'info'); }
                    // the count on the Approvals button is only trustworthy
                    // when the approvals view itself just loaded; the task
                    // view's response says nothing about how many are waiting
                    if (mode === 'approvals') {
                        toolbar.setCount(result.counts ? result.counts.kept : result.rows.length);
                    }

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
                    note(view().failed +
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
