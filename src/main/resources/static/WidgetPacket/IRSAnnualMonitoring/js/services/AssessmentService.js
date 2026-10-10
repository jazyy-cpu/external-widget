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
 *   2. search does NOT return custom attribute values, so the year, period and
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

    /** Our own REST JAR. Reserved path; not built yet. */
    var BASE = 'resources/v1/irs/annualmonitoring';

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
            period: '',
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

            return Request.get(BASE + '/assessments', {
                query: { department: opts.departmentCode || '' }
            }).then(function (body) {
                var rows = ((body && body.assessments) || []).map(function (a) {
                    return {
                        id: a.id,
                        name: a.name,
                        title: a.title,
                        state: a.state,
                        department: a.department,
                        year: a.year,
                        period: a.period,
                        startDate: a.startDate,
                        endDate: a.endDate,
                        reports: a.reports,
                        reportsComplete: a.reportsComplete
                    };
                });
                return { rows: rows, indexed: true, source: 'service' };
            }).catch(function (err) {
                // The service is not built yet. Say so rather than showing an
                // empty grid that looks like "this department has no rounds".
                var reason = err && err.message ? err.message : String(err);
                return { rows: [], indexed: false, source: 'none', reason: reason, query: query };
            });
        },

        /**
         * Create a round. Needs the REST service - see the module header.
         *
         * @param {Object} data {departmentId, departmentCode, title, year, period, startDate, endDate}
         */
        create: function (data) {
            return Request.send(BASE + '/assessments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    departmentId: data.departmentId,
                    departmentCode: data.departmentCode,
                    title: data.title,
                    year: data.year,
                    period: data.period,
                    startDate: data.startDate,
                    endDate: data.endDate
                })
            });
        }
    };
});
