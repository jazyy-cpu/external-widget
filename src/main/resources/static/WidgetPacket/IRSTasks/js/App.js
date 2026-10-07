/**
 * IRS Tasks widget - start-up, routing and the UWA lifecycle.
 *
 * The same shell as the project widget (user, 2026-10-03: reuse its look and
 * feel), so both widgets start, fail and refresh alike:
 *
 *   1. show a spinner in widget.body
 *   2. Credentials.init() - preference created / refreshed, active credential valid
 *   3. render the credential bar, then open the page the router remembers
 *
 * Only one start runs at a time; a second call while one is running returns the
 * same promise. Nothing is rendered outside widget.body.
 *
 * Routing is JazzySole/Router (WGT-02): the current page is kept in a hidden
 * widget preference, so a browser refresh comes back to the page that was open
 * (rule R6).
 *
 *   tasks       the task list   (this file)
 *   task/:id    the task page    - IRSTasks/views/TaskDetailView: a context
 *               sidebar and the form's content, driven by the subtype's JSON
 *               form definition. Read-only; approval actions are still to come
 *
 * Changing the credential reopens the current page: a different security
 * context can see a different set of tasks, and may not see this one at all.
 *
 * Layout: one shared top row - a visible toolbar band (`.irs-toolbar`) - carries
 * the open page's own controls on the left and the credential picker at the far
 * right, exactly as in IRSProjects.
 */
define('IRSTasks/App', [
    'JazzySole/Credentials',
    'JazzySole/Router',
    'JazzySole/CredentialBar',
    'IRSTasks/views/TaskListView',
    'IRSTasks/views/TaskDetailView'
], function (Credentials, Router, CredentialBar, TaskListView, TaskDetailView) {
    'use strict';

    var running = null;
    var view = null;      // the current page, for onResize and for cleanup
    var page = null;      // the element the router renders into
    var slot = null;      // left of the shared top row: the page's own controls
    var router = null;

    function clearBody() {
        var body = widget.body;
        while (body.firstChild) { body.removeChild(body.firstChild); }
        return body;
    }

    function showSpinner() {
        var wrap = document.createElement('div');
        wrap.className = 'd-flex justify-content-center align-items-center p-5';
        var spinner = document.createElement('div');
        spinner.className = 'spinner-border text-secondary';
        spinner.setAttribute('role', 'status');
        wrap.appendChild(spinner);
        clearBody().appendChild(wrap);
    }

    function alertBox(parent, text, level) {
        var box = document.createElement('div');
        box.className = 'alert alert-' + (level || 'danger') + ' small';
        box.setAttribute('role', 'alert');
        box.textContent = text;
        parent.insertBefore(box, parent.firstChild);
        return box;
    }

    function closeView() {
        if (view && view.destroy) { view.destroy(); }
        view = null;
    }

    /** Empty the page area and the row's left slot, and close what was on them. */
    function freshPage() {
        closeView();
        while (page.firstChild) { page.removeChild(page.firstChild); }
        while (slot.firstChild) { slot.removeChild(slot.firstChild); }
        return page;
    }

    /**
     * Built once and kept: the router holds the back stack, and a new one on
     * every refresh would forget it.
     */
    function ensureRouter() {
        if (router) { return router; }
        router = new Router({ defaultPath: 'tasks', prefName: 'jzTaskRoute' });

        router.add('tasks', function () {
            var target = freshPage();
            view = TaskListView.render(target, {
                toolbar: slot,
                onOpenTask: function (row) {
                    if (!row.id) { return; }
                    router.go('task/:id', { id: row.id });
                }
            });
        }, 'Tasks');

        /**
         * The task page. It takes only the id from the route and fetches the
         * task itself, so a browser refresh on this page works - the router
         * remembers `task/:id` in a preference, and a page that depended on the
         * list's in-memory row would be broken every second time (rule R6).
         */
        router.add('task/:id', function (params) {
            var target = freshPage();
            view = TaskDetailView.render(target, {
                id: params.id,
                toolbar: slot,
                onBack: function () { router.go('tasks', null, { replace: true }); }
            });
        }, 'Task');

        return router;
    }

    function render() {
        var root = document.createElement('div');
        // irs-tasks scopes the widget's only CSS file - see css/IRSTasks.css
        root.className = 'irs-tasks container-fluid py-2';

        // the shared top row: the page's controls, then the credential, hard right
        var bar = document.createElement('div');
        bar.className = 'irs-toolbar d-flex flex-wrap align-items-center gap-2 mb-2';
        slot = document.createElement('div');
        slot.className = 'd-flex flex-wrap align-items-center gap-2 flex-grow-1';
        bar.appendChild(slot);
        CredentialBar.render(bar, {
            onChanged: function () { ensureRouter().reload().catch(function () { /* shown by the page */ }); },
            onError: function (err) { alertBox(root, err.message); }
        });
        root.appendChild(bar);

        page = document.createElement('div');
        root.appendChild(page);
        clearBody().appendChild(root);

        return ensureRouter().start().catch(function (err) {
            alertBox(root, 'The page could not be opened: ' +
                (err && err.message ? err.message : err));
        });
    }

    function showError(err) {
        closeView();
        var root = document.createElement('div');
        root.className = 'irs-tasks container-fluid py-2';
        clearBody().appendChild(root);
        alertBox(root, 'The widget could not start: ' + (err && err.message ? err.message : err));
    }

    function start() {
        if (running) { return running; }
        closeView();
        showSpinner();
        running = Credentials.init().then(render, showError).then(function () {
            running = null;
        }, function () {
            running = null;
        });
        return running;
    }

    return {
        onLoad: start,
        onRefresh: start,
        onResize: function () { if (view && view.redraw) { view.redraw(); } }
    };
});
