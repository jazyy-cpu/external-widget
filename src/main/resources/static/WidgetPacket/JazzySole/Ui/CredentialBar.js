/**
 * JazzySole/CredentialBar 1.0.0 - the active credential, and a picker to
 * change it (WGT-03).
 *
 * A control for the widget's shared top row, sitting at the far right beside
 * whatever the open page puts on the left.
 *
 * Promoted out of IRSProjects/components/CredentialBar on 2026-10-03: the task
 * widget needs the identical control, and a second copy is exactly the kind of
 * duplication WP06 F1 is about. Bootstrap classes only - a native form-select,
 * so no Bootstrap JavaScript is needed (UWA rule C7).
 */
define('JazzySole/CredentialBar', ['JazzySole/Credentials'], function (Credentials) {
    'use strict';

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    return {
        VERSION: '1.0.0',

        /**
         * @param {HTMLElement} parent
         * @param {Object} options
         * @param {Function} options.onChanged  called after the credential changed
         * @param {Function} options.onError    called with an Error
         * @returns {HTMLElement} the bar
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
                    // put the picker back to what is actually active, or it
                    // shows a context the session is not using
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
