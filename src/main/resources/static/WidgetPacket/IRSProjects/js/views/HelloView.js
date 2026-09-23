/**
 * Temporary first page: Hello World plus what the credential module found.
 * Replaced by the project list (WGT-01) once credentials are verified.
 */
define('IRSProjects/views/HelloView', [], function () {
    'use strict';

    function row(dl, term, value) {
        var dt = document.createElement('dt');
        dt.className = 'col-sm-4';
        dt.textContent = term;
        var dd = document.createElement('dd');
        dd.className = 'col-sm-8 text-break';
        dd.textContent = value || '-';
        dl.appendChild(dt);
        dl.appendChild(dd);
    }

    return {
        /**
         * @param {HTMLElement} parent
         * @param {Object} info  { source, value, label, spaceUrl }
         */
        render: function (parent, info) {
            var card = document.createElement('div');
            card.className = 'card';
            var body = document.createElement('div');
            body.className = 'card-body';

            var title = document.createElement('h5');
            title.className = 'card-title';
            title.textContent = 'Hello World';
            body.appendChild(title);

            var dl = document.createElement('dl');
            dl.className = 'row small mb-0';
            row(dl, 'Active credential', info.label);
            row(dl, 'Security context', info.value ? 'ctx::' + info.value : '');
            row(dl, 'Credential source', info.source === 'ootb'
                ? 'OOTB DS/ENOXWidgetPreferences'
                : 'Fallback (Get Me + widget preference)');
            row(dl, '3DSpace', info.spaceUrl);
            row(dl, 'Rendered at', new Date().toLocaleString());
            body.appendChild(dl);

            card.appendChild(body);
            parent.appendChild(card);
            return card;
        }
    };
});
