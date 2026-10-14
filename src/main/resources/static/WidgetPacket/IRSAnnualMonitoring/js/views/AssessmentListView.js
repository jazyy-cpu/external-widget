/**
 * The landing page: assessment rounds for the chosen department.
 *
 * Same shape as IRSProjects' and IRSTasks' list views, so all three widgets
 * behave alike: the page's own controls go into the shared top band through
 * `options.toolbar`, and the grid fills what is left.
 *
 * The view owns the create panel as well, because creating a round is an action
 * ON this list and the result belongs in this grid.
 */
define('IRSAnnualMonitoring/views/AssessmentListView', [
    'JazzySole/TabulatorLoader',
    'JazzySole/Notify',
    'IRSAnnualMonitoring/services/AssessmentService',
    'IRSAnnualMonitoring/views/AssessmentColumns',
    'IRSAnnualMonitoring/components/NewAssessmentPanel'
], function (TabulatorLoader, Notify, AssessmentService, AssessmentColumns, NewAssessmentPanel) {
    'use strict';

    /**
     * The message the server sent, when it sent one.
     *
     * Our REST services answer every failure with
     * {error: {status, code, message}}, and JazzySole/Request hangs the parsed
     * body off the Error as `err.body`. That message is written for a person;
     * `err.message` is often only the transport's wording ("...returned
     * ResponseCode with value '400'"), which tells the reader nothing about
     * what to change.
     */
    function serverMessage(err) {
        try {
            var body = err && err.body;
            if (body && body.error && body.error.message) {
                return body.error.message;
            }
        } catch (ignored) { /* fall through below */ }

        // No body. The transport's own sentence is a URL and a response code -
        // true, and useless to the person reading it. Say what we actually
        // know, and keep the technical text out of their way.
        //
        // This is the fallback, NOT the normal path: the service sends its
        // refusals as 200 + success:false precisely so the sentence above
        // arrives. Reaching here means something else failed.
        var status = 0;
        try {
            var match = /ResponseCode with value "?(\d{3})/.exec((err && err.message) || '');
            if (match) { status = parseInt(match[1], 10); }
        } catch (ignored2) { status = 0; }

        if (status === 401) { return 'Your session has expired. Reload the page and sign in again.'; }
        if (status === 403) { return 'You are not allowed to do this for this department.'; }
        if (status === 404) { return 'The Annual Monitoring service did not answer at that address.'; }
        if (status >= 500)  { return 'The server could not complete this. Nothing was changed.'; }
        return (err && err.message) ? err.message : String(err);
    }

    /** Leave room for the top band; the grid takes the rest of the widget. */
    function availableHeight() {
        var height = (widget.body && widget.body.clientHeight) || 420;
        var usable = height - 96;
        return (usable < 220 ? 220 : usable) + 'px';
    }

    return {
        /**
         * @param {Element} target
         * @param {Object} options {department, toolbar, canCreate, onOpen}
         * @returns {{redraw: Function, reload: Function, destroy: Function}}
         */
        render: function (target, options) {
            var opts = options || {};
            var department = opts.department || null;
            var destroyed = false;
            var table = null;
            var panel = null;

            var messages = document.createElement('div');
            target.appendChild(messages);

            var panelHost = document.createElement('div');
            target.appendChild(panelHost);

            var host = document.createElement('div');
            target.appendChild(host);

            function ready() { return table && !destroyed; }

            function note(text, level) {
                var box = document.createElement('div');
                box.className = 'alert alert-' + (level || 'secondary') + ' small py-2';
                box.setAttribute('role', 'status');
                box.textContent = text;
                messages.appendChild(box);
            }

            function clearMessages() {
                while (messages.firstChild) { messages.removeChild(messages.firstChild); }
            }

            function closePanel() {
                if (panel) { panel.destroy(); panel = null; }
            }

            function load() {
                if (destroyed || !department) { return Promise.resolve(); }
                clearMessages();
                return AssessmentService.list({
                    departmentCode: department.code,
                    departmentId: department.id
                }).then(function (result) {
                    if (destroyed) { return; }
                    if (table) { table.setData(result.rows); }
                    if (!result.indexed) {
                        // Be explicit. An empty grid otherwise reads as "this
                        // department has no rounds", which is a different and
                        // much more reassuring statement than the truth.
                        // The service is live, so this is a REAL failure now -
                        // not "the feature is missing". Saying the wrong one
                        // sends the reader to the wrong place.
                        note('The rounds could not be read, so this list is not showing ' +
                             'what the department has. ' + (result.reason || ''),
                             'warning');
                    } else if (!result.rows.length) {
                        note('This department has no assessment rounds yet.', 'secondary');
                    }
                });
            }

            function startCreate() {
                if (panel || !department) { return; }
                closePanel();
                panel = NewAssessmentPanel.render(panelHost, {
                    department: department,
                    onCancel: closePanel,
                    onSubmit: function (data) {
                        panel.busy(true);
                        AssessmentService.create(data).then(function () {
                            closePanel();
                            Notify.success('Assessment round created.');
                            return load();
                        }).catch(function (err) {
                            panel.busy(false);
                            // SHOW THE SERVER'S OWN WORDS. Every refusal this
                            // endpoint makes is one the head can act on - a
                            // duplicate round, a department with no domains or
                            // no members, a department they do not run - and
                            // the service words each of them for a person. The
                            // first version of this printed a fixed sentence
                            // instead, so a duplicate round read as "the REST
                            // service is not built yet", which was both wrong
                            // and useless (seen in the dashboard, 2026-10-14).
                            // A NOTIFICATION, not only the inline box: the user
                            // asked for it, and it is the right shape - the
                            // refusal is about the whole action, and the form is
                            // still open and still valid to correct.
                            //
                            // warning, not error: "this year already has a
                            // round" is a fact about the data, not a fault. An
                            // error toast never auto-dismisses, which is for
                            // things that are broken.
                            var why = serverMessage(err);
                            Notify.warning(why);
                            panel.error(why);
                        });
                    }
                });
            }

            // the page's own controls, in the shared band
            if (opts.toolbar) {
                var createBtn = document.createElement('button');
                createBtn.type = 'button';
                createBtn.className = 'btn btn-primary btn-sm';
                createBtn.textContent = 'New assessment';
                createBtn.disabled = !opts.canCreate || !department;
                if (!opts.canCreate) {
                    createBtn.title = 'Only a Head of Department or In-Charge may create a round.';
                }
                createBtn.addEventListener('click', startCreate);
                opts.toolbar.appendChild(createBtn);

                var refreshBtn = document.createElement('button');
                refreshBtn.type = 'button';
                refreshBtn.className = 'btn btn-outline-secondary btn-sm';
                refreshBtn.textContent = 'Refresh';
                refreshBtn.addEventListener('click', function () { load(); });
                opts.toolbar.appendChild(refreshBtn);
            }

            var loading = TabulatorLoader.load().then(function (Tabulator) {
                if (destroyed) { return; }
                table = new Tabulator(host, {
                    height: availableHeight(),
                    layout: 'fitColumns',
                    placeholder: 'No assessment rounds',
                    columns: AssessmentColumns.build({ onOpen: opts.onOpen }),
                    data: []
                });
                return load();
            }).catch(function (err) {
                if (destroyed) { return; }
                note('The grid could not be built: ' + (err && err.message ? err.message : err), 'danger');
            });

            return {
                redraw: function () {
                    if (!ready()) { return; }
                    table.setHeight(availableHeight());
                    table.redraw(true);
                },
                reload: load,
                destroy: function () {
                    destroyed = true;
                    closePanel();
                    if (table) { try { table.destroy(); } catch (e) { /* already gone */ } }
                    table = null;
                },
                _loading: loading
            };
        }
    };
});
