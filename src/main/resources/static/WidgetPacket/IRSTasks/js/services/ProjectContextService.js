/**
 * A project's risks, opportunities and key learnings - from our own REST JAR.
 *
 *     GET resources/v1/irsproject/projects/{projectId}/context
 *
 * ## Why this is not an OOTB call
 *
 * Measured against the live platform on 2026-10-07 (worklog 2026-10-07-03/04):
 *
 *   risks          `GET /resources/v1/modeler/projects/{id}/risks` exists and
 *                  answers 200, but returned an EMPTY list for a project whose
 *                  `Risk` relationship holds four objects. The OOTB service
 *                  filters something out; the relationship itself is populated.
 *   opportunities  no OOTB route exists at all - an Opportunity id on
 *                  `/risks/{id}` returns `data: []`.
 *   key learnings  `IRSLearning` is ours, so nothing OOTB can know it.
 *
 * So form sections **XII** (Lessons learnt) and **XIII** (Risks and
 * opportunities) have exactly one source, and this is it. Verified live through
 * the browser on 2026-10-08 against `Solize XYZ`.
 *
 * ## One call, three sections
 *
 * The JAR reads all of it in four round trips server-side and returns it in one
 * response, so the page does not make three calls for one screen. The service
 * also returns the project header, which this module ignores: the page already
 * has the project from `TaskDetailService`, and two sources for one field is
 * how a screen starts contradicting itself.
 *
 * ## A missing origin project is NORMAL
 *
 * A reused learning may carry an empty `originProject`. That is legitimate, not
 * a defect: WP02 doc 08 records that `R&D-PRJ-01` XII may cite work predating
 * the system, so a learning is allowed to exist with no origin. Measured on
 * `Solize XYZ`: LRN-0000002 and LRN-0000006 both come back with an empty
 * origin. The row says "not recorded" rather than showing a blank, because a
 * blank reads as a fault.
 *
 * ## Failure is per section, not per page
 *
 * The JAR reports `riskError` and `learnings.error` while still serving the
 * rest. Those are carried through verbatim: an empty list and a failed read
 * mean different things, and a form that shows "no risks" when the read broke
 * is telling the approver something false.
 */
define('IRSTasks/services/ProjectContextService', [
    'JazzySole/Request',
    'IRSTasks/Log'
], function (Request, Log) {
    'use strict';

    var PATH = 'resources/v1/irsproject/projects/';

    function text(value) {
        return (value === null || value === undefined) ? '' : String(value).trim();
    }

    function list(value) {
        if (!value) { return []; }
        return Array.isArray(value) ? value : [value];
    }

    /** One risk or opportunity row, as the form's table shows it. */
    function toRisk(item) {
        item = item || {};
        return {
            id: text(item.physicalId) || text(item.id),
            no: text(item.no),
            title: text(item.title),
            state: text(item.state),
            type: text(item.type),
            revision: text(item.revision)
        };
    }

    /**
     * One learning row. `origin` is what section XII actually asks for - which
     * project the lesson came from - so it is resolved to a single display
     * string here rather than in the view.
     */
    function toLearning(item, source) {
        item = item || {};
        var origin = item.originProject || {};
        var originNo = text(origin.projectNo);
        var originName = text(origin.title) || text(origin.name);

        var label;
        if (source === 'this') {
            label = 'This project';
        } else if (originNo && originName) {
            label = originName + ' (' + originNo + ')';
        } else if (originNo || originName) {
            label = originNo || originName;
        } else {
            // not a fault - see the module comment
            label = 'Source not recorded';
        }

        return {
            id: text(item.physicalId) || text(item.id),
            no: text(item.no),
            title: text(item.title),
            learning: text(item.text),
            state: text(item.state),
            source: source,                 // 'this' | 'other'
            originLabel: label,
            originId: text(origin.physicalId),
            originNo: originNo
        };
    }

    /**
     * ENOVIA's own placeholders for an unset Organization field. They are real
     * strings in the database, not empty values - BU-0000002 has
     * `Organization Name` = "Unknown" and `Country` = "Unassigned" - so a
     * screen that prints "first non-empty" prints the word **Unknown** as the
     * customer's name.
     *
     * The service filters them out of its display name; everything else is
     * filtered here, where the decision is about display rather than data.
     */
    var PLACEHOLDERS = ['unknown', 'unassigned'];

    function meaningful(value) {
        var out = text(value);
        return PLACEHOLDERS.indexOf(out.toLowerCase()) >= 0 ? '' : out;
    }

    /**
     * The customer, as section II of the form shows it.
     *
     * **Which fields exist depends on what kind of customer it is**, and that
     * is the platform's rule, not a presentation choice:
     *
     *   external   the customer is a Company, which carries Email Address
     *   internal   the customer is a Business Unit or a Department. Those have
     *              no Email Address at all - the attribute is on Company only
     *
     * So the row list is built per kind, and an empty value is dropped rather
     * than printed as a dash: on a form, a labelled blank reads as "nobody
     * filled this in", when the truth for an internal customer is that the
     * field does not exist.
     */
    function toCustomer(raw) {
        raw = raw || {};
        var attributes = raw.attributes || {};
        function attr(name) { return meaningful(attributes[name]); }

        var out = {
            linked: text(raw.linked) === 'true',
            kind: text(raw.kind),
            projectTypeLabel: text(raw.projectTypeLabel),
            name: meaningful(raw.displayName) || text(raw.name),
            id: text(raw.physicalId) || text(raw.id),
            type: text(raw.type),
            error: text(raw.error),
            rows: []
        };

        if (!out.linked) { return out; }

        function row(label, value) {
            if (value) { out.rows.push({ label: label, value: value }); }
        }

        row('Customer', out.name);
        row('Project Type', out.projectTypeLabel);
        row('Contact No', attr('Organization Phone Number'));
        // Company only - absent on an internal customer, and correctly so
        if (out.kind === 'external') { row('Email', attr('Email Address')); }
        row('City', attr('City'));
        row('State / Region', attr('State/Region'));
        row('Country', attr('Country'));
        row('Address', attr('Address'));
        row('Postal Code', attr('Postal Code'));
        row('Web Site', attr('Web Site'));
        row('Fax', attr('Organization Fax Number'));
        return out;
    }

    /**
     * The department, and the Business Unit that owns it.
     *
     * Both, because the form header carries both and a department name alone
     * does not say which part of the organisation it belongs to - the Business
     * Unit is what `IRSProjectUI` calls the stream.
     */
    function toDepartment(raw) {
        raw = raw || {};
        var unit = raw.businessUnit || {};
        return {
            linked: text(raw.linked) === 'true',
            id: text(raw.physicalId) || text(raw.id),
            name: meaningful(raw.displayName) || text(raw.name),
            code: text(raw.name),
            type: text(raw.type),
            state: text(raw.state),
            error: text(raw.error),
            businessUnit: {
                linked: text(unit.linked) === 'true',
                id: text(unit.physicalId) || text(unit.id),
                name: meaningful(unit.displayName) || text(unit.name),
                code: text(unit.name),
                type: text(unit.type)
            }
        };
    }

    /**
     * The payload, flattened to what the two form sections need.
     *
     * Pure, so it can be tested against the captured response without a
     * platform - which is how the shapes that broke the POC get caught.
     */
    function shape(body) {
        body = body || {};
        var learnings = body.learnings || {};
        var here = list(learnings.createdInThisProject).map(function (item) {
            return toLearning(item, 'this');
        });
        var elsewhere = list(learnings.fromOtherSources).map(function (item) {
            return toLearning(item, 'other');
        });

        return {
            risks: list(body.risks).map(toRisk),
            opportunities: list(body.opportunities).map(toRisk),
            learnings: here.concat(elsewhere),
            learningsHere: here,
            learningsElsewhere: elsewhere,
            customer: toCustomer(body.customer),
            department: toDepartment(body.department),
            riskError: text(body.riskError),
            learningError: text(learnings.error),
            counts: body.counts || {}
        };
    }

    /**
     * The `$include` sections a form definition asks for.
     *
     * Risks and opportunities travel together because one relationship carries
     * both, so the service reads them in a single round trip either way. The
     * two learning groups do not: they are separate relationships and separate
     * round trips, and the two **answer different forms** -
     * `R&D-PRJ-01` XII cites lessons from EARLIER projects, while the
     * completion form records what this one produced.
     */
    function sectionsFor(spec) {
        var out = [];
        function add(name) { if (out.indexOf(name) < 0) { out.push(name); } }

        if (!spec || !Array.isArray(spec.fields)) { return out; }
        spec.fields.forEach(function (field) {
            if (field.source !== 'service') { return; }
            if (field.display === 'risks') {
                add('risks');
                add('opportunities');
            } else if (field.display === 'customer') {
                add('customer');
            } else if (field.display === 'department') {
                add('department');
            } else if (field.display === 'learnings') {
                var scope = field.learningScope || 'all';
                if (scope === 'created') { add('learnings.created'); }
                else if (scope === 'reused') { add('learnings.reused'); }
                else { add('learnings'); }
            }
        });
        return out;
    }

    return {
        sectionsFor: sectionsFor,

        /**
         * @param {string} projectId physical id or legacy id - the JAR resolves
         *                 either, so the id the list already holds is fine
         * @returns {Promise<Object>} the shaped sections. Rejects only when the
         *          call itself failed; a section that failed server-side comes
         *          back in `riskError` / `learningError`.
         */
        get: function (projectId, sections) {
            if (!projectId) {
                return Promise.reject(new Error('No project id was given.'));
            }

            // `$include` asks for only the sections this form actually shows.
            // Each one is its own round trip server-side, so a form that cites
            // reused learnings does not pay for the ones this project produced.
            // Omitting it means everything, which is what the first version of
            // the service did - so an older JAR simply ignores the parameter
            // and still answers correctly.
            var options;
            if (sections && sections.length) {
                options = { params: { '$include': sections.join(',') } };
            }

            return Request.get(PATH + projectId + '/context', options).then(function (body) {
                var out = shape(body);
                Log.info('project context: ' + out.risks.length + ' risk(s), ' +
                         out.opportunities.length + ' opportunity(ies), ' +
                         out.learningsHere.length + ' learning(s) from this project, ' +
                         out.learningsElsewhere.length + ' reused.');
                if (out.riskError) { Log.warn('risk section failed: ' + out.riskError); }
                if (out.learningError) { Log.warn('learning section failed: ' + out.learningError); }
                return out;
            });
        },

        /** for tests only */
        _shape: shape,
        _toLearning: toLearning,
        _toCustomer: toCustomer,
        _toDepartment: toDepartment
    };
});
