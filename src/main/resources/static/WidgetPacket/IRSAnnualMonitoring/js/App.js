/**
 * IRS Annual Monitoring widget - start-up, routing and the UWA lifecycle.
 *
 * The same shell as IRSProjects and IRSTasks, so all three widgets start, fail
 * and refresh alike:
 *
 *   1. show a spinner in widget.body
 *   2. Credentials.init()
 *   3. find the departments this person may act for
 *   4. render the top band - department picker, page controls, credential - and
 *      open the page the router remembers
 *
 * Routes (JazzySole/Router, preference `jzAnnualRoute`, rule R6):
 *
 *   assessments                       the rounds list              (built)
 *   assessment/:id                    one round                    (not built)
 *   assessment/:id/report/:reportId   one person's G15 report      (not built)
 *   assessment/:id/matrix             the G16 skill matrix         (not built)
 *
 * Only `assessments` exists in this skeleton. The other three are registered
 * with an honest placeholder rather than left out, so a route that is
 * remembered in the preference cannot strand the widget on a blank page.
 *
 * THE DEGRADED BANNER. Until the custom REST service exists, the widget cannot
 * ask which departments the signed-in person is Head of - that is a
 * relationship traversal and OOTB search indexes objects, not links. In that
 * state DepartmentService returns every department and reports degraded = true,
 * and this file shows a visible banner. The widget never silently implies the
 * role check passed.
 */
define('IRSAnnualMonitoring/App', [
    'JazzySole/Credentials',
    'JazzySole/Router',
    'JazzySole/CredentialBar',
    'IRSAnnualMonitoring/services/DepartmentService',
    'IRSAnnualMonitoring/components/DepartmentPicker',
    'IRSAnnualMonitoring/views/AssessmentListView'
], function (Credentials, Router, CredentialBar, DepartmentService, DepartmentPicker, AssessmentListView) {
    'use strict';

    var running = null;
    var view = null;
    var page = null;
    var slot = null;
    var router = null;
    var picker = null;
    var departments = { departments: [], degraded: false, reason: '' };

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

    function freshPage() {
        closeView();
        while (page.firstChild) { page.removeChild(page.firstChild); }
        while (slot.firstChild) { slot.removeChild(slot.firstChild); }
        return page;
    }

    /** A page that is routed to but not built yet. Honest, and never blank. */
    function placeholder(target, title, detail) {
        var box = document.createElement('div');
        box.className = 'alert alert-secondary small';
        var heading = document.createElement('div');
        heading.className = 'fw-semibold mb-1';
        heading.textContent = title;
        box.appendChild(heading);
        var text = document.createElement('div');
        text.textContent = detail;
        box.appendChild(text);
        target.appendChild(box);

        var back = document.createElement('button');
        back.type = 'button';
        back.className = 'btn btn-outline-secondary btn-sm';
        back.textContent = 'Back to rounds';
        back.addEventListener('click', function () { router.go('assessments', null, { replace: true }); });
        slot.appendChild(back);
        return { redraw: function () {}, destroy: function () {} };
    }

    function ensureRouter() {
        if (router) { return router; }
        router = new Router({ defaultPath: 'assessments', prefName: 'jzAnnualRoute' });

        router.add('assessments', function () {
            var target = freshPage();
            var selected = picker ? picker.selected() : null;
            view = AssessmentListView.render(target, {
                department: selected,
                toolbar: slot,
                // Until the role check is wired, creating is offered - the
                // platform's own access is what actually decides. Once
                // DepartmentService reports the roles, this becomes a real test.
                canCreate: !!selected,
                onOpen: function (row) {
                    if (!row.id) { return; }
                    router.go('assessment/:id', { id: row.id });
                }
            });
        }, 'Assessment rounds');

        router.add('assessment/:id', function () {
            view = placeholder(freshPage(), 'Round detail is not built yet',
                'This page will show the people in the round, the connected training plans ' +
                'and the round properties. See WGT-10 design.md section 4.2.');
        }, 'Round');

        router.add('assessment/:id/report/:reportId', function () {
            view = placeholder(freshPage(), 'The person report is not built yet',
                'This is the G15 form: projects handled, trainings undergone, the domain ' +
                'ratings with the Note block, the HOD judgement and the export bar. ' +
                'See WGT-10 design.md section 4.3.');
        }, 'Report');

        router.add('assessment/:id/matrix', function () {
            view = placeholder(freshPage(), 'The skill matrix is not built yet',
                'Persons by every department domain, grade per cell, NA where there is no ' +
                'rating. See WGT-10 design.md section 4.4.');
        }, 'Skill matrix');

        return router;
    }

    function render() {
        var root = document.createElement('div');
        root.className = 'irs-annual container-fluid py-2';

        var bar = document.createElement('div');
        bar.className = 'irs-toolbar d-flex flex-wrap align-items-center gap-2 mb-2';

        picker = DepartmentPicker.render(bar, {
            departments: departments.departments,
            onChange: function () { ensureRouter().reload().catch(function () { /* shown by the page */ }); }
        });

        var divider = document.createElement('div');
        divider.className = 'vr mx-1';
        bar.appendChild(divider);

        slot = document.createElement('div');
        slot.className = 'd-flex flex-wrap align-items-center gap-2 flex-grow-1';
        bar.appendChild(slot);

        CredentialBar.render(bar, {
            onChanged: function () {
                DepartmentService.reset();
                start();
            },
            onError: function (err) { alertBox(root, err.message); }
        });
        root.appendChild(bar);

        if (departments.degraded) {
            var warn = alertBox(root, departments.reason, 'warning');
            warn.classList.add('irs-degraded');
        }

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
        root.className = 'irs-annual container-fluid py-2';
        clearBody().appendChild(root);
        alertBox(root, 'The widget could not start: ' + (err && err.message ? err.message : err));
    }

    function start() {
        if (running) { return running; }
        closeView();
        showSpinner();
        running = Credentials.init().then(function () {
            return DepartmentService.mine();
        }).then(function (result) {
            departments = result;
            return render();
        }, showError).then(function () {
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
