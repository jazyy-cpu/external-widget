/**
 * The active credential, and a picker to change it (WGT-03).
 *
 * It is a control on the widget's shared top row, sitting at the **far right**
 * (user, 2026-09-24), beside whatever the open page puts on the left. It used
 * to be a row of its own, which cost a line of height on every page for a
 * control that is changed once a session.
 *
 * Bootstrap classes only. A native form-select is used for "change" so no
 * Bootstrap JavaScript is needed (UWA rule C7).
 */
define('IRSProjects/components/CredentialBar', ['JazzySole/Credentials'], function (Credentials) {
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
         * @param {Object} options
         * @param {Function} options.onChanged  called after the credential changed
         * @param {Function} options.onError    called with an Error
         */
        render: function (parent, options) {
            var bar = el('div', 'd-flex align-items-center gap-2 flex-shrink-0');
            bar.appendChild(el('span', 'text-body-secondary small', 'Credential'));

            var select = el('select', 'form-select form-select-sm w-auto');
            select.setAttribute('aria-label', 'Active credential');
            Credentials.list().forEach(function (o) {
                var opt = el('option', null, o.label);
                opt.value = o.value;
                if (o.value === Credentials.get()) { opt.selected = true; }
                select.appendChild(opt);
            });
            select.addEventListener('change', function () {
                select.disabled = true;
                Credentials.set(select.value).then(function (info) {
                    select.disabled = false;
                    if (options && options.onChanged) { options.onChanged(info); }
                }, function (err) {
                    select.disabled = false;
                    select.value = Credentials.get();
                    if (options && options.onError) { options.onError(err); }
                });
            });
            bar.appendChild(select);
            parent.appendChild(bar);
            return bar;
        }
    };
});
