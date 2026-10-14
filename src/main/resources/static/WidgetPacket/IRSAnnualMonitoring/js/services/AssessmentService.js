/**
 * Reads and creates assessment rounds (IRSSkillAssessment).
 *
 * ## What works today, and what does not
 *
 * **Listing** is possible through OOTB 3DSearch - verified 2026-10-10 that our
 * custom types are returned with id, Title, name, type, policy and state
 * (WGT-10 api.md section 2). Two caveats, both real:
 *
 *   1. the three Annual Monitoring types have NEVER BEEN INDEXED, so search
 *      finds nothing until `update searchindex type` is run for each
 *      (WGT-10 open item O8). The list will legitimately be empty until then;
 *   2. search does NOT return custom attribute values, so the year and
 *      date range of a round cannot come from it (api.md section 3.1). The grid
 *      shows what search gives and leaves those columns blank rather than
 *      inventing them.
 *
 * **Creating** needs the custom REST service and cannot be done from the
 * browser at all: a round is an assessment plus one report per member plus one
 * rating per domain, and the rating's link to its domain is a REL2REL that OOTB
 * REST cannot write. So `create()` posts to our own endpoint and, until that
 * endpoint exists, fails with a message that says exactly that.
 *
 * That failure is the point of the skeleton: it is also the first real test of
 * whether a POST from this widget reaches a custom modeler path at all
 * (WGT-10 blocker B2).
 */
define('IRSAnnualMonitoring/services/AssessmentService', [
    'JazzySole/Request',
    'IRSAnnualMonitoring/config/AssessmentFields'
], function (Request, Fields) {
    'use strict';

    /** Our own REST JAR, irs-monitoring-rest. Live since 2026-10-14. */
    // The Annual Monitoring JAR's own application path. NOT under
    // 'resources/v1/irs' - that belongs to irs-hello-rest, and nesting one
    // JAX-RS application under another's path makes which one serves a URL
    // container-dependent (IrsMonitoringModeler, 2026-10-14).
    var BASE = 'resources/v1/irsmonitoring';

    /**
     * Map one search hit to a grid row.
     *
     * The ds6w field names are long and repeated, so they are read through one
     * helper rather than spelled out at every use.
     */
    function attr(hit, name) {
        var a = (hit && hit.attributes) || {};
        return a[name] || '';
    }

    function toRow(hit) {
        // "IRSSkillAssessment.Draft" - policy and state in one field
        var status = attr(hit, 'ds6w:what/ds6w:status');
        var state = status.indexOf('.') >= 0 ? status.split('.').pop() : status;
        return {
            id: hit.physicalId || attr(hit, 'physicalid'),
            name: attr(hit, 'name'),
            title: hit.label || attr(hit, 'ds6w:label'),
            state: state,
            department: attr(hit, 'ds6w:who/ds6w:responsible/ds6w:organizationResponsible'),
            modified: attr(hit, 'ds6w:when/ds6w:modified'),
            createdBy: attr(hit, 'ds6w:who/ds6w:responsible'),
            // Custom attributes are NOT returned by search - see the header.
            year: '',
            startDate: '',
            endDate: ''
        };
    }

    return {
        BASE: BASE,
        _toRow: toRow,

        /**
         * Rounds for one department.
         *
         * @param {Object} options
         * @param {string} options.departmentCode  the organization name, e.g. 0000000001
         * @returns {Promise<{rows: Array, indexed: boolean}>}
         */
        list: function (options) {
            var opts = options || {};
            var query = 'flattenedtaxonomies:"types/' + Fields.TYPES.assessment + '"';

            // The id is sent in preference to the code. The service accepts
            // either - it resolves a P&O name to an id before it does anything
            // else - but the id needs no lookup and cannot be ambiguous.
            // `params`, not `query`. JazzySole/Request names the query-string
            // option `params` and silently ignores anything else, so `query`
            // sent the request with NO department at all - which the service
            // correctly refused with 400. Caught in the dashboard, 2026-10-14.
            return Request.get(BASE + '/assessments', {
                params: { department: opts.departmentId || opts.departmentCode || '' }
            }).then(function (body) {
                var rows = ((body && body.assessments) || []).map(function (a) {
                    return {
                        id: a.id,
                        name: a.name,
                        title: a.title,
                        state: a.state,
                        department: a.department,
                        year: a.year,
                        startDate: a.startDate,
                        endDate: a.endDate,
                        reports: a.reports,
                        reportsComplete: a.reportsComplete
                    };
                });
                return { rows: rows, indexed: true, source: 'service' };
            }).catch(function (err) {
                // The service IS built now, so this path means a real failure -
                // the JAR is not deployed, the session expired, or the read
                // broke. Say so rather than showing an empty grid, which would
                // read as "this department has no rounds".
                var reason = err && err.message ? err.message : String(err);
                return { rows: [], indexed: false, source: 'none', reason: reason, query: query };
            });
        },

        /**
         * Create a round: the assessment, one report per department member, and
         * one rating per domain each member holds.
         *
         * The key is `department`, singular, and it carries the id - that is
         * the service's parameter name, and sending departmentId/departmentCode
         * instead silently created nothing (the service read an empty
         * department and refused).
         *
         * Dates go as ISO yyyy-MM-dd. The server converts them: a `kind date`
         * attribute rejects ISO outright, and the browser should not have to
         * know the platform's date format.
         *
         * @param {Object} data {departmentId, departmentCode, title, year, startDate, endDate}
         */
        create: function (data) {
            // `data`, not `body`, and an OBJECT rather than a string: the
            // wrapper serialises it and sets Content-Type itself. It also adds
            // the CSRF token and retries once if the token has expired, which
            // is the whole reason writes go through send().
            return Request.send(BASE + '/assessments', {
                method: 'POST',
                data: {
                    department: data.departmentId || data.departmentCode,
                    title: data.title,
                    year: data.year,
                    startDate: data.startDate,
                    endDate: data.endDate
                }
            });
        }
    };
});
