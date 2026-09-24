/**
 * Bootstrap nav-tabs without Bootstrap's JavaScript (UWA rule C7: its bundle is
 * UMD and would break the dashboard's AMD loader). Showing and hiding a pane is
 * a class toggle, which is all Bootstrap's own tab plugin does.
 *
 * Panes are built lazily: a tab's content function runs the first time it is
 * opened, not when the page loads. With eight tabs coming, that is the
 * difference between one request on arrival and eight.
 */
define('IRSProjects/components/Tabs', [], function () {
    'use strict';

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    return {
        /**
         * @param {HTMLElement} parent
         * @param {Array} tabs  [{ id, label, content: function(pane), disabled, badge }]
         * @param {Object} [options]
         * @param {string}   [options.active]    id of the tab to open first (default: the first enabled one)
         * @param {Function} [options.onChange]  called with the tab id after a switch
         * @returns {{root, show: Function, getActive: Function, panes: Object}}
         */
        render: function (parent, tabs, options) {
            options = options || {};
            var root = el('div');
            var nav = el('ul', 'nav nav-tabs small');
            var body = el('div', 'pt-3');
            var links = {};
            var panes = {};
            var built = {};
            var active = null;

            function show(id) {
                var tab = tabs.filter(function (t) { return t.id === id; })[0];
                if (!tab || tab.disabled || id === active) { return; }

                Object.keys(links).forEach(function (key) {
                    links[key].className = 'nav-link' + (key === id ? ' active' : '');
                    panes[key].hidden = key !== id;
                });
                active = id;

                if (!built[id]) {
                    built[id] = true;
                    // a tab that throws must not take the whole page with it
                    try {
                        tab.content(panes[id]);
                    } catch (e) {
                        var box = el('div', 'alert alert-danger small',
                            'This tab could not be opened: ' + (e && e.message ? e.message : e));
                        panes[id].appendChild(box);
                    }
                }
                if (options.onChange) { options.onChange(id); }
            }

            tabs.forEach(function (tab) {
                var item = el('li', 'nav-item');
                var link = el('a', 'nav-link' + (tab.disabled ? ' disabled' : ''), tab.label);
                link.href = '#';
                link.setAttribute('role', 'tab');
                if (tab.badge !== undefined && tab.badge !== null) {
                    link.appendChild(document.createTextNode(' '));
                    var badge = el('span', 'badge text-bg-secondary', String(tab.badge));
                    link.appendChild(badge);
                }
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    show(tab.id);
                });
                item.appendChild(link);
                nav.appendChild(item);

                var pane = el('div');
                pane.hidden = true;
                pane.setAttribute('role', 'tabpanel');
                body.appendChild(pane);

                links[tab.id] = link;
                panes[tab.id] = pane;
            });

            root.appendChild(nav);
            root.appendChild(body);
            parent.appendChild(root);

            var first = tabs.filter(function (t) { return !t.disabled; })[0];
            show(options.active || (first && first.id));

            return {
                root: root,
                panes: panes,
                show: show,
                getActive: function () { return active; }
            };
        }
    };
});
