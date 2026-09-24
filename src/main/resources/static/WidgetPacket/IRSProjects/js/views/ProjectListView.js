/**
 * The project list - the widget's landing page (WGT-01).
 *
 * Toolbar + Tabulator grid, local pagination and one search control.
 * Tabulator is reached through JazzySole/TabulatorLoader, never a <script> tag
 * (UMD / AMD clash - see that file).
 *
 * The grid is given an explicit pixel height that fills the widget frame, so
 * the pager sits at the **bottom of the widget** rather than directly under the
 * last row (user, 2026-09-24). Tabulator only pins its footer when it knows its
 * own height; `height: '100%'` would need every ancestor to have a definite
 * height, which a UWA body does not, so the height is measured and set here and
 * recomputed on every resize.
 *
 * The "show completed / archived" choice is kept in the hidden preference
 * xPrefShowClosed, so a widget refresh comes back to the same view (rule R6).
 */
define('IRSProjects/views/ProjectListView', [
    'JazzySole/TabulatorLoader',
    'IRSProjects/services/ProjectService',
    'IRSProjects/components/ListToolbar',
    'IRSProjects/views/ProjectColumns'
], function (TabulatorLoader, ProjectService, ListToolbar, columns) {
    'use strict';

    var SHOW_CLOSED = 'xPrefShowClosed';
    var MIN_HEIGHT = 180;      // never collapse the grid to nothing
    var BOTTOM_GAP = 8;        // breathing room under the pager

    /** Fields the search box may look in - must match ListToolbar.FIELDS. */
    var SEARCH_FIELDS = ['projectNo', 'title'];

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
     * Search: Project No. and Title only (user, 2026-09-24), or the single field
     * the user picked. Returns null when nothing is being searched for, so the
     * caller can clear the filter instead of installing a match-everything one.
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
         * @param {HTMLElement} [options.toolbar]     the shared top row's left slot;
         *        without it the toolbar sits above the grid as its own row
         * @param {Function} [options.onOpenProject]  called with the row data on a title click
         * @returns {{redraw: Function, reload: Function, destroy: Function}}
         */
        render: function (parent, options) {
            options = options || {};
            var includeClosed = readShowClosed();
            var table = null;
            var search = { term: '', field: 'all' };
            var destroyed = false;

            var root = el('div');
            var messages = el('div');
            var host = el('div');              // Tabulator replaces the content of this one
            var busy = el('div', 'd-flex justify-content-center p-4');
            busy.appendChild(el('div', 'spinner-border spinner-border-sm text-secondary'));

            // the credential picker holds the right of that same row (WGT-03)
            var toolbar = ListToolbar.render(options.toolbar || root, {
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

            function applySearch() {
                if (!table) { return; }
                var fn = matcher(search.term, search.field);
                if (fn) { table.setFilter(fn); } else { table.clearFilter(true); }
            }

            function note(text, level) {
                var box = el('div', 'alert alert-' + (level || 'warning') + ' small py-2', text);
                box.setAttribute('role', 'alert');
                messages.appendChild(box);
            }

            function openProject(row) {
                if (options.onOpenProject) { options.onOpenProject(row); }
            }

            function build(rows) {
                return TabulatorLoader.load().then(function (Tabulator) {
                    if (destroyed) { return null; }
                    clear(host);
                    table = new Tabulator(host, {
                        data: rows,
                        columns: columns(openProject),
                        // an explicit height is what pins the pager to the bottom
                        height: availableHeight(),
                        // minimum widths + fitDataFill = horizontal scroll bar on a
                        // narrow widget instead of squeezed or collapsed columns
                        layout: 'fitDataFill',
                        responsiveLayout: false,
                        index: 'id',
                        placeholder: 'No project in this view.',
                        initialSort: [{ column: 'finish', dir: 'asc' }],
                        pagination: true,
                        paginationMode: 'local',
                        paginationSize: 20,
                        paginationSizeSelector: [10, 20, 50, 100],
                        paginationCounter: 'rows'
                    });
                    applySearch();
                    return table;
                });
            }

            function load() {
                clear(messages);
                toolbar.setBusy(true);
                if (!table) { clear(host).appendChild(busy); }

                return ProjectService.list({ includeClosed: includeClosed }).then(function (result) {
                    if (destroyed) { return null; }
                    // the row count is Tabulator's footer's job - no second label
                    // A2: says in the UI whether the server honoured the state filter
                    if (!result.serverFiltered) { note(result.note); }

                    if (table) {
                        return table.replaceData(result.rows);
                    }
                    return build(result.rows);
                }).then(function () {
                    toolbar.setBusy(false);
                    // a warning strip above the grid moves it down: re-measure
                    if (table) { table.setHeight(availableHeight()); }
                }, function (err) {
                    if (destroyed) { return; }
                    toolbar.setBusy(false);
                    clear(host);
                    note('The projects could not be loaded: ' +
                         (err && err.message ? err.message : err), 'danger');
                });
            }

            load();

            return {
                /** called from UWA onResize */
                redraw: function () {
                    if (!table) { return; }
                    table.setHeight(availableHeight());
                    table.redraw(true);
                },
                reload: load,
                destroy: function () {
                    destroyed = true;
                    if (table) { try { table.destroy(); } catch (e) { /* already gone */ } }
                    table = null;
                }
            };
        }
    };
});
