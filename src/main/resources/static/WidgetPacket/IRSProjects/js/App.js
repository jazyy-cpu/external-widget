/**
 * IRS Projects widget - start-up, routing and the UWA lifecycle.
 *
 * onLoad and onRefresh run the same start sequence:
 *   1. show a spinner in widget.body
 *   2. Credentials.init() - preference created / refreshed, active credential valid
 *   3. render the credential bar, then open the page the router remembers
 * Only one start runs at a time; a second call while one is running returns
 * the same promise. Nothing is rendered outside widget.body.
 *
 * Routing is JazzySole/Router (WGT-02): the current page is kept in a hidden
 * widget preference, so a browser refresh comes back to the project that was
 * open, not to the list (rule R6).
 *
 *   projects      the project list      (WGT-01)
 *   project/:id   the project detail    (WGT-04)
 *
 * Changing the credential reopens the current page: a different security
 * context can see a different set of projects, and may not see this one at all.
 *
 * Layout: one shared top row - a visible toolbar band (`.irs-toolbar`) - carries
 * the open page's own controls on the left and the credential picker at the
 * **far right** (user, 2026-09-24). A page with no toolbar leaves the left empty.
 */
define('IRSProjects/App', [
    'JazzySole/Credentials',
    'JazzySole/Router',
    'IRSProjects/components/CredentialBar',
    'IRSProjects/views/ProjectListView',
    'IRSProjects/views/ProjectDetailView'
], function (Credentials, Router, CredentialBar, ProjectListView, ProjectDetailView) {
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
        router = new Router({ defaultPath: 'projects', prefName: 'jzRoute' });

        router.add('projects', function () {
            var target = freshPage();
            view = ProjectListView.render(target, {
                toolbar: slot,
                onOpenProject: function (row) {
                    if (!row.id) { return; }
                    router.go('project/:id', { id: row.id });
                }
            });
        }, 'Projects');

        router.add('project/:id', function (params) {
            view = ProjectDetailView.render(freshPage(), {
                id: params.id,
                onBack: function () { router.go('projects', null, { replace: true }); }
            });
            // rejects when the project cannot be opened, so the router falls
            // back to the list instead of saving a page that will fail again
            return view.ready;
        }, 'Project');

        return router;
    }

    function render() {
        var root = document.createElement('div');
        // irs-projects scopes the widget's only CSS file - see css/IRSProjects.css
        root.className = 'irs-projects container-fluid py-2';

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
        root.className = 'irs-projects container-fluid py-2';
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
