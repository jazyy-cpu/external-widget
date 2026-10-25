/**
 * IRS Key Learnings widget - start-up and the UWA lifecycle (WGT-11).
 *
 * The same shell as IRSProjects, IRSTasks and IRSAnnualMonitoring, so the
 * widgets start, fail and refresh alike:
 *
 *   1. a spinner in widget.body
 *   2. Credentials.init()
 *   3. the top band - register controls on the left, credential on the right -
 *      and the register below it
 *
 * One page, so no router, and NO kept state: every load and refresh starts
 * with an empty range, an empty search and no rows (user, 2026-10-25 -
 * overrides rule R6 for this widget).
 */
define('IRSKeyLearnings/App', [
    'JazzySole/Credentials',
    'JazzySole/CredentialBar',
    'IRSKeyLearnings/views/LearningListView'
], function (Credentials, CredentialBar, LearningListView) {
    'use strict';

    var running = null;
    var view = null;

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

    function alertBox(parent, text) {
        var box = document.createElement('div');
        box.className = 'alert alert-danger small';
        box.setAttribute('role', 'alert');
        box.textContent = text;
        parent.insertBefore(box, parent.firstChild);
    }

    function closeView() {
        if (view && view.destroy) { view.destroy(); }
        view = null;
    }

    function render() {
        var root = document.createElement('div');
        root.className = 'irs-learnings container-fluid py-2';

        var bar = document.createElement('div');
        bar.className = 'irs-toolbar d-flex flex-wrap align-items-center gap-2 mb-2';
        var slot = document.createElement('div');
        slot.className = 'd-flex flex-wrap align-items-center gap-2 flex-grow-1';
        bar.appendChild(slot);
        CredentialBar.render(bar, {
            // a new credential is a new SecurityContext: what the index lets
            // the user see changes with it, so read everything again
            onChanged: function () { start(); },
            onError: function (err) { alertBox(root, err.message); }
        });
        root.appendChild(bar);

        var page = document.createElement('div');
        root.appendChild(page);
        clearBody().appendChild(root);

        view = LearningListView.render(page, { toolbar: slot });
    }

    function showError(err) {
        closeView();
        var root = document.createElement('div');
        root.className = 'irs-learnings container-fluid py-2';
        clearBody().appendChild(root);
        alertBox(root, 'The widget could not start: ' + (err && err.message ? err.message : err));
    }

    function start() {
        if (running) { return running; }
        closeView();
        showSpinner();
        running = Credentials.init().then(render).then(function () {
            running = null;
        }, function (err) {
            running = null;
            showError(err);
        });
        return running;
    }

    return {
        onLoad: start,
        onRefresh: start,
        onResize: function () { if (view && view.redraw) { view.redraw(); } }
    };
});
