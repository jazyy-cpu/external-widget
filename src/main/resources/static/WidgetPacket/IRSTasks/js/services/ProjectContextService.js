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
            riskError: text(body.riskError),
            learningError: text(learnings.error),
            counts: body.counts || {}
        };
    }

    return {
        /**
         * @param {string} projectId physical id or legacy id - the JAR resolves
         *                 either, so the id the list already holds is fine
         * @returns {Promise<Object>} the shaped sections. Rejects only when the
         *          call itself failed; a section that failed server-side comes
         *          back in `riskError` / `learningError`.
         */
        get: function (projectId) {
            if (!projectId) {
                return Promise.reject(new Error('No project id was given.'));
            }
            return Request.get(PATH + projectId + '/context').then(function (body) {
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
        _toLearning: toLearning
    };
});
