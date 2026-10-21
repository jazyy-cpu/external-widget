/**
 * One G17 periodic software evaluation, for the approver's page.
 *
 *     GET resources/v1/irsproject/evaluations/{evaluationId}
 *
 * ## Why the page needs a third loader
 *
 * The G17 route (`IRSPeriodicEvaluationRoute`: Evaluator, Checker, Approver -
 * worklog 2026-10-21-06..11) approves the `IRSPeriodicSoftwareEvaluation`
 * object itself, so its inbox tasks carry the evaluation as `contents[0]`. It
 * is neither a Task nor a Document, so neither `modeler/tasks` nor
 * `modeler/documents` can read it, and nothing OOTB follows the
 * `IRSEvaluation*` relationships. Our JAR answers all of it in one call (two
 * round trips on the server; worklog 2026-10-21-12).
 *
 * ## Same shape as TaskDetailService, on purpose
 *
 * `{task, project, note}`, as `StmDocumentService` does, so the form (driven
 * by `forms/pes-evaluation.json`), the approval chain and Approve / Reject work
 * with no change. There is no project: an evaluation belongs to a software
 * Document, not to a project.
 *
 * The documents panel shows the **evidence only** - the test results the
 * approver is asked to judge - in one group of its own (user, 2026-10-21). The
 * evaluated software Document is named on the form, not offered for download.
 */
define('IRSTasks/services/EvaluationService', [
    'JazzySole/Request',
    'IRSTasks/config/TaskFields',
    'IRSTasks/Log'
], function (Request, Fields, Log) {
    'use strict';

    var PATH = 'resources/v1/irsproject/evaluations/';

    /** Policy `IRSPeriodicSoftwareEvaluation` - its state names are already words. */
    var STATE_LABELS = {
        Draft: 'Draft',
        InApproval: 'In Approval',
        Active: 'Active',
        Expired: 'Expired'
    };

    /**
     * `IRSEvaluationReasons` range -> the tick-box wording of R&D-PES-Rev.01,
     * word for word.
     */
    var REASON_LABELS = {
        RequirementsChanged: 'Changes/revisions in the applicable requirements/standards/' +
                             'classification rules/guidance, etc.',
        EnvironmentChanged: 'Changes in the supporting hardware/software/operating system, etc.',
        FeedbackChanged: 'Changes made to incorporate user group feedback / ' +
                         'suggestion/errors reported, etc.',
        Other: 'Any other, please specify'
    };

    /** Same palette as a Document's own state, for the evidence rows. */
    var DOCUMENT_STATES = {
        PRIVATE: 'Private',
        IN_WORK: 'In Work',
        FROZEN: 'Frozen',
        RELEASED: 'Released',
        OBSOLETE: 'Obsolete'
    };

    function text(value) {
        return (value === null || value === undefined) ? '' : String(value).trim();
    }

    function list(value) {
        if (!value) { return []; }
        return Array.isArray(value) ? value : [value];
    }

    function extensionOf(fileName) {
        var dot = fileName.lastIndexOf('.');
        return dot > 0 ? fileName.slice(dot) : '';
    }

    /**
     * The paper's tick-box order. The platform answers in entry order
     * (PES-0000011: Feedback, Environment, Requirements); a value the paper
     * does not know goes last.
     */
    function inPaperOrder(reasons) {
        var order = Object.keys(REASON_LABELS);
        return reasons.slice().sort(function (x, y) {
            var a = order.indexOf(x);
            var b = order.indexOf(y);
            return (a < 0 ? order.length : a) - (b < 0 ? order.length : b);
        });
    }

    function fullName(person) {
        return text(person && person.fullName) || text(person && person.name);
    }

    /** One evidence Document as a documents-panel row. */
    function evidenceRow(doc) {
        var files = list(doc.files).map(text).filter(Boolean);
        var state = DOCUMENT_STATES[text(doc.state)] || text(doc.state);
        return {
            // DocumentService's download ticket answers to the physical id
            id: text(doc.physicalId) || text(doc.id),
            kind: 'evidence',
            name: text(doc.name),
            // an untitled upload is titled with its own name; the file says more
            title: (text(doc.title) && text(doc.title) !== text(doc.name))
                ? text(doc.title) : (files.length === 1 ? files[0] : text(doc.name)),
            revision: text(doc.revision),
            type: text(doc.type),
            typeName: text(doc.type),
            state: state + (files.length > 1 ? '  ·  ' + files.length + ' files' : ''),
            hasFiles: files.length > 0,
            // several files come down as one zip, named by the server
            extension: files.length === 1 ? extensionOf(files[0]) : (files.length ? '.zip' : ''),
            icon: ''
        };
    }

    /** The JAR's payload, shaped as the task page reads a task. */
    function shape(body) {
        body = body || {};
        var ev = body.evaluation || {};
        var subject = body.subject || {};
        var type = text(ev.type);
        var state = text(ev.state);
        var id = text(ev.physicalId) || text(body.evaluationId);
        var evidence = list(body.evidence).map(evidenceRow);
        var linked = text(subject.linked) === 'true';
        var reasons = list(ev.reasons).map(text).filter(Boolean);

        var task = {
            id: id,
            kind: 'evaluation',
            type: type,
            typeLabel: Fields.typeLabel(type),
            typeFromPlatform: false,
            title: text(ev.title),
            description: '',
            state: state,
            stateLabel: STATE_LABELS[state] || state,
            // an approver does not edit the evaluation from here
            editable: false,
            owner: '',
            originator: '',
            assignees: [],
            projectId: '',
            projectType: '',
            projectName: '',
            projectTitle: '',
            routes: list(body.routes).map(function (route) {
                return {
                    // dsrt/routes answers to the physical id
                    id: text(route.physicalId) || text(route.id),
                    name: text(route.name),
                    title: ''
                };
            }).filter(function (route) { return !!route.id; }),
            deliverables: [],
            attachments: [],
            evidence: evidence,
            documentGroups: [{ heading: 'Test results (evidence)', items: evidence }],
            /** what the form spec's `task` rows read - named in pes-evaluation.json */
            attributes: {
                name: text(ev.name),
                title: text(ev.title),
                softwareName: linked ? (text(subject.title) || text(subject.name)) : '',
                softwareNumber: linked
                    ? text(subject.name) + (text(subject.revision) ? '  Rev ' + text(subject.revision) : '')
                    : '',
                version: text(ev.evaluatedVersion),
                evaluationDate: text(ev.evaluationDate),
                // one line per ticked box, in the paper's wording
                reasons: inPaperOrder(reasons).map(function (r) {
                    return REASON_LABELS[r] || r;
                }).join('\n'),
                reasonDetails: text(ev.reasonDetails),
                result: text(ev.result),
                testSummary: text(ev.testSummary),
                benchmarkChanged: text(ev.benchmarkChanged),
                evaluatedBy: fullName(body.evaluator),
                checkedBy: fullName(body.checker),
                approver: fullName(body.approver),
                approvedOn: text(ev.approvedOn),
                expiresOn: text(ev.expiresOn)
            },
            raw: body
        };

        return { task: task, project: null };
    }

    /** The JAR's own error shape, `{error: {status, code, message}}`, as a message. */
    function reason(err) {
        var body = err && (err.body || err.response || err.data);
        var detail = body && body.error;
        if (detail && detail.message) { return detail.message; }
        return (err && err.message) ? err.message : String(err);
    }

    return {
        /**
         * @param {string} id the evaluation's physical id - `contents[0].id` of
         *        the inbox task
         * @returns {Promise<{task: Object, project: null, note: string}>}
         */
        get: function (id) {
            if (!id) { return Promise.reject(new Error('No evaluation id was given.')); }
            Log.info('evaluation: GET', PATH + id);

            return Request.get(PATH + encodeURIComponent(id)).then(function (body) {
                var result = shape(body);
                Log.info('evaluation ' + result.task.attributes.name + ': ' +
                         result.task.evidence.length + ' evidence document(s), ' +
                         result.task.routes.length + ' route(s)');
                result.note = result.task.attributes.softwareName ? '' :
                    'No software / computational tool is linked to this evaluation.';
                return result;
            }, function (err) {
                // the page prefixes "The evaluation could not be opened:"
                throw new Error(reason(err));
            });
        },

        /** for tests only */
        _shape: shape,
        _REASON_LABELS: REASON_LABELS
    };
});
