/**
 * The project detail page (WGT-04): header + tabs.
 *
 * Layout decided by the user 2026-09-24: "we will have tabs and sections, and
 * landing page will show the high level data of the projects" - so the header
 * carries the identity, the first tab is the project information in form order,
 * and each topic that will grow gets a tab of its own.
 *
 * Tabs built now: Overview, Organisation, Risks & opportunities, Lessons learnt.
 * Tabs planned and shown disabled, so the shape of the page is visible and
 * nobody wonders where the rest went: Planning, Team & cost, Documents,
 * Approvals. Each is one module in views/detail/ when its turn comes.
 *
 * Panes build lazily (see components/Tabs): opening the page costs one request.
 */
define('IRSProjects/views/ProjectDetailView', [
    'IRSProjects/services/ProjectDetailService',
    'IRSProjects/components/ProjectHeader',
    'IRSProjects/components/Tabs',
    'IRSProjects/views/detail/OverviewTab',
    'IRSProjects/views/detail/OrganisationTab',
    'IRSProjects/views/detail/RisksTab',
    'IRSProjects/views/detail/LessonsTab'
], function (ProjectDetailService, ProjectHeader, Tabs,
             OverviewTab, OrganisationTab, RisksTab, LessonsTab) {
    'use strict';

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

    return {
        /**
         * @param {HTMLElement} parent
         * @param {Object} options
         * @param {string}   options.id      the project's physical id
         * @param {Function} options.onBack  back to the list
         * @returns {{ready: Promise, redraw: Function, destroy: Function}}
         *          `ready` rejects when the project cannot be opened, so the
         *          router drops it as the saved page instead of reopening a
         *          deleted object on every refresh.
         */
        render: function (parent, options) {
            options = options || {};
            var destroyed = false;
            var tabs = null;

            var root = el('div');
            var busy = el('div', 'd-flex justify-content-center p-4');
            busy.appendChild(el('div', 'spinner-border spinner-border-sm text-secondary'));
            root.appendChild(busy);
            parent.appendChild(root);

            var ready = ProjectDetailService.get(options.id).then(function (project) {
                if (destroyed) { return null; }
                clear(root);

                ProjectHeader.render(root, project, {
                    onBack: options.onBack,
                    onAssignNumber: function () { showNumberNotice(); }
                });

                var notice = el('div');
                root.appendChild(notice);

                function goTo(id) { if (tabs) { tabs.show(id); } }

                tabs = Tabs.render(root, [
                    { id: 'overview', label: 'Overview',
                      content: function (pane) { OverviewTab.render(pane, project, { onGoTo: goTo }); } },
                    { id: 'organisation', label: 'Organisation',
                      content: function (pane) { OrganisationTab.render(pane, project); } },
                    { id: 'risks', label: 'Risks & opportunities',
                      content: function (pane) { RisksTab.render(pane, project); } },
                    { id: 'lessons', label: 'Lessons learnt',
                      content: function (pane) { LessonsTab.render(pane, project); } },
                    // planned - one module each in views/detail/ when built
                    { id: 'planning', label: 'Planning', disabled: true, content: function () {} },
                    { id: 'team', label: 'Team & cost', disabled: true, content: function () {} },
                    { id: 'documents', label: 'Documents', disabled: true, content: function () {} },
                    { id: 'approvals', label: 'Approvals', disabled: true, content: function () {} }
                ]);

                /**
                 * The button exists so the flow can be seen; the number itself
                 * needs the numbering scheme (R20) and a verified write call,
                 * neither of which exists. It says so rather than writing
                 * something invented to a real project.
                 */
                function showNumberNotice() {
                    clear(notice);
                    var box = el('div', 'alert alert-info small',
                        'The project number is not generated yet: the numbering scheme (R20) ' +
                        'still has to come from IRS, and EPMProjectNo is a plain writable ' +
                        'string with no generator behind it. Once the scheme exists, this ' +
                        'button writes the number, the field becomes read-only and the button ' +
                        'disappears.');
                    box.setAttribute('role', 'alert');
                    notice.appendChild(box);
                }

                return project;
            }, function (err) {
                if (destroyed) { return null; }
                clear(root);
                var back = el('button', 'btn btn-sm btn-link px-0 text-decoration-none', '‹ Projects');
                back.type = 'button';
                back.addEventListener('click', function () { options.onBack(); });
                root.appendChild(back);
                var box = el('div', 'alert alert-danger small',
                    'The project could not be opened: ' + (err && err.message ? err.message : err));
                box.setAttribute('role', 'alert');
                root.appendChild(box);
                throw err;      // the router must not keep this page as the saved one
            });

            return {
                ready: ready,
                redraw: function () { /* nothing measures itself on this page yet */ },
                destroy: function () { destroyed = true; tabs = null; }
            };
        }
    };
});
