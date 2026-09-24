/**
 * IRSProjects service - reads the project list (WGT-01).
 *
 * One call: GET <3DSpace>/resources/v1/modeler/projects
 *   $include=none    mandatory - the default level 0 expands the whole task tree
 *   $fields=none,... only the columns the landing page shows (no task data)
 *   state=<list>     the states the current view wants
 * tenant and SecurityContext are added by JazzySole/Request (rule R3).
 *
 * About `state`: the DS guide documents it, the OpenAPI spec does not declare
 * it, so it could not be verified through the API Labs validator (api.md
 * section 4, open item A2). The service therefore does not trust it:
 *   - it sends `state`;
 *   - if that call fails it retries ONCE without `state`;
 *   - either way it filters the rows itself, so the result is correct even when
 *     the server ignored the parameter;
 *   - it reports `serverFiltered` so the first widget test answers A2 by
 *     observation instead of guesswork.
 */
define('IRSProjects/services/ProjectService', [
    'JazzySole/Request',
    'IRSProjects/config/ProjectFields'
], function (Request, Fields) {
    'use strict';

    var PATH = 'resources/v1/modeler/projects';

    /** A field may arrive inside `dataelements` or as a sibling of it. */
    function value(item, name) {
        var de = item.dataelements || {};
        return de[name] !== undefined ? de[name] : item[name];
    }

    /**
     * One Tabulator row. Dates stay as the ISO-like strings the service returns
     * ("2026-02-15T17:00:00.000"): they sort correctly as text and the column
     * formatter does the display, so no date library is needed.
     */
    function toRow(item) {
        var type = item.type || value(item, 'type') || '';
        return {
            id: item.id || value(item, 'id') || '',
            type: type,
            category: Fields.typeLabel(type),
            projectNo: value(item, 'EPMProjectNo') || '',
            title: value(item, 'title') || '',
            state: value(item, 'state') || '',
            start: value(item, 'estimatedStartDate') || '',
            finish: value(item, 'estimatedFinishDate') || '',
            department: '',   // relationship not built yet (WGT-01 section 2)
            customer: ''
        };
    }

    function toRows(body) {
        var data = (body && Array.isArray(body.data)) ? body.data : [];
        return data.map(toRow);
    }

    function params(states) {
        var p = {
            '$include': 'none',
            '$fields': Fields.LIST_FIELDS.join(',')
        };
        if (states) { p.state = states.join(','); }
        return p;
    }

    return {
        /**
         * @param {Object} [opts]
         * @param {boolean} [opts.includeClosed]  also list Complete and Archive
         * @returns {Promise<{rows: Array, serverFiltered: boolean, note: string}>}
         */
        list: function (opts) {
            opts = opts || {};
            var states = opts.includeClosed ? Fields.ALL_STATES : Fields.OPEN_STATES;

            function keep(rows) {
                return opts.includeClosed ? rows : rows.filter(function (r) {
                    return !Fields.isClosed(r.state);
                });
            }

            return Request.get(PATH, { params: params(states) }).then(function (body) {
                return { rows: keep(toRows(body)), serverFiltered: true, note: '' };
            }, function (err) {
                // A2: the state parameter was refused - fall back to the service default
                return Request.get(PATH, { params: params(null) }).then(function (body) {
                    return {
                        rows: keep(toRows(body)),
                        serverFiltered: false,
                        note: 'The server refused the state filter, so the list was ' +
                              'filtered in the widget (' + (err.message || err) + ').'
                    };
                });
            });
        },

        /** for tests only */
        _toRow: toRow,
        _params: params
    };
});
