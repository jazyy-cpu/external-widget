/**
 * IRS Projects widget - start-up and UWA lifecycle.
 *
 * onLoad and onRefresh run the same start sequence:
 *   1. show a spinner in widget.body
 *   2. Credentials.init() - preference created / refreshed, active credential valid
 *   3. render the page
 * Only one start runs at a time; a second call while one is running returns
 * the same promise. Nothing is rendered outside widget.body.
 */
define('IRSProjects/App', [
    'JazzySole/Credentials',
    'IRSProjects/components/CredentialBar',
    'IRSProjects/views/HelloView'
], function (Credentials, CredentialBar, HelloView) {
    'use strict';

    var running = null;

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

    function render(info) {
        var root = document.createElement('div');
        root.className = 'container-fluid py-2';
        CredentialBar.render(root, {
            onChanged: function (newInfo) { renderPage(newInfo); },
            onError: function (err) { alertBox(root, err.message); }
        });
        var page = document.createElement('div');
        root.appendChild(page);
        clearBody().appendChild(root);
        renderPage(info, page);

        function renderPage(pageInfo, target) {
            target = target || page;
            while (target.firstChild) { target.removeChild(target.firstChild); }
            HelloView.render(target, pageInfo);
        }
    }

    function showError(err) {
        var root = document.createElement('div');
        root.className = 'container-fluid py-2';
        clearBody().appendChild(root);
        alertBox(root, 'The widget could not start: ' + (err && err.message ? err.message : err));
    }

    function start() {
        if (running) { return running; }
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
        onResize: function () { /* grid redraw goes here with WGT-01 */ }
    };
});
