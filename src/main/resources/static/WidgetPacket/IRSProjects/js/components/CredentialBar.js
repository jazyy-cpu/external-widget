/**
 * Top bar: shows the active credential and lets the user change it (WGT-03).
 * Bootstrap classes only. A native form-select is used for "change" so no
 * Bootstrap JavaScript is needed.
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
            var bar = el('div', 'd-flex flex-wrap align-items-center gap-2 border-bottom pb-2 mb-3');
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
