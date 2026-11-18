/**
 * One R&D G10 / AR G9 Project Completion Document, for the approver's page.
 *
 *     GET resources/v1/irsproject/completions/{documentId}
 *
 * ## The publication page again, for another Document subtype
 *
 * The completion route (Project Manager, In-Charge / HOD, Division Head -
 * worklog 2026-11-03-04) approves the `IRSProjectCompletion` Document itself,
 * so its inbox tasks carry it as `contents[0]`, as the G12 route carries a
 * publication. The OOTB document resource returns none of the subtype's
 * attributes (worklog 2026-10-19-14), so this reads our JAR: one call, two
 * round trips on the server (worklog 2026-11-03-08).
 *
 * ## Same shape as PublicationDocumentService, on purpose
 *
 * `{task, project, note}`, `task.kind` 'document' (the banner says "This
 * document"), and the Document itself as the one row of the documents panel.
 * The form is `forms/project-completion.json`. Its Key learning features are
 * the project's own learnings, read by ProjectContextService from the project
 * id given here; the approval chain acts on the inbox task.
 */
define('IRSTasks/services/CompletionDocumentService', [
    'JazzySole/Request',
    'IRSTasks/config/TaskFields',
    'IRSTasks/Log'
], function (Request, Fields, Log) {
    'use strict';

    var PATH = 'resources/v1/irsproject/completions/';

    /** `Document Release`, the policy the subtype inherits. */
    var STATE_LABELS = {
        PRIVATE: 'Private',
        IN_WORK: 'In Work',
        FROZEN: 'Frozen',
        RELEASED: 'Released',
        OBSOLETE: 'Obsolete'
    };

    /** The paper's "Research / Analysis": the project's type, as the PDF maps it. */
    var CATEGORY = {
        EPMResearchProject: 'Research',
        EPMAnalysisProject: 'Analysis'
    };

    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

    /** `11/2/2026 12:00:00 PM` -> `2 Nov 2026`; anything else as it came. */
    function day(value) {
        var raw = text(value);
        var parsed = raw ? new Date(raw) : null;
        if (!parsed || isNaN(parsed.getTime())) { return raw; }
        return parsed.getDate() + ' ' + MONTHS[parsed.getMonth()] + ' ' + parsed.getFullYear();
    }

    /** The paper's one "Invoice No. & Date" box, as the PDF prints it. */
    function invoice(doc) {
        return [text(doc.invoiceNo), day(doc.invoiceDate)].filter(Boolean).join(' / ');
    }

    /** The JAR's payload, shaped as the task page reads a task and its project. */
    function shape(body) {
        body = body || {};
        var doc = body.document || {};
        var parent = body.project || {};
        var type = text(doc.type);
        var state = text(doc.state);
        var id = text(doc.physicalId) || text(body.documentId);
        var files = list(body.files).map(text).filter(Boolean);
        var managers = list(body.managers).map(function (person) {
            return text(person && person.fullName) || text(person && person.name);
        }).filter(Boolean);
        var linked = text(parent.linked) === 'true';
        var typeLabel = Fields.typeLabel(type);
        var stateLabel = STATE_LABELS[state] || state;

        var task = {
            id: id,
            kind: 'document',
            type: type,
            typeLabel: typeLabel,
            typeFromPlatform: false,
            title: text(doc.title),
            description: '',
            state: state,
            stateLabel: stateLabel,
            // an approver does not edit the Document from here
            editable: false,
            owner: '',
            originator: '',
            assignees: [],
            projectId: linked ? (text(parent.physicalId) || text(parent.id)) : '',
            projectType: text(parent.type),
            projectName: text(parent.name),
            projectTitle: text(parent.title),
            files: files,
            routes: list(body.routes).map(function (route) {
                return {
                    // dsrt/routes answers to the physical id
                    id: text(route.physicalId) || text(route.id),
                    name: text(route.name),
                    title: ''
                };
            }).filter(function (route) { return !!route.id; }),
            deliverables: [{
                id: id,
                kind: 'deliverable',
                name: text(doc.name),
                title: text(doc.title),
                revision: text(doc.revision),
                type: typeLabel,
                typeName: type,
                state: stateLabel + (files.length > 1 ? '  ·  ' + files.length + ' files' : ''),
                hasFiles: files.length > 0,
                // several files come down as one zip, named by the server
                extension: files.length === 1 ? extensionOf(files[0]) : (files.length ? '.zip' : ''),
                icon: ''
            }],
            attachments: [],
            /** what the form spec's `task` rows read - named in project-completion.json */
            attributes: {
                name: text(doc.name),
                revision: text(doc.revision),
                title: text(doc.title),
                invoice: invoice(doc),
                journalNational: text(doc.journalNational),
                journalInternational: text(doc.journalInternational),
                conferenceNational: text(doc.conferenceNational),
                conferenceInternational: text(doc.conferenceInternational),
                newServiceDeveloped: text(doc.newServiceDeveloped),
                usefulness: text(doc.usefulness),
                customerFeedbackSent: text(doc.customerFeedbackSent),
                accessExtended: text(doc.accessExtended)
            },
            raw: body
        };

        var project = linked ? {
            id: task.projectId,
            type: text(parent.type),
            typeLabel: text(parent.type),
            name: text(parent.name),
            title: text(parent.title),
            projectNo: text(parent.projectNo),
            state: '',
            stateLabel: '',
            attributes: {
                name: text(parent.name),
                title: text(parent.title),
                EPMProjectNo: text(parent.projectNo),
                category: CATEGORY[text(parent.type)] || text(parent.type),
                projectManager: managers.join(', '),
                customer: text(parent.customer),
                startDate: text(parent.startDate),
                plannedFinishDate: text(parent.plannedFinishDate),
                actualFinishDate: text(parent.actualFinishDate)
            },
            raw: parent
        } : null;

        return { task: task, project: project };
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
         * @param {string} id the Document's physical id - `contents[0].id` of
         *        the inbox task
         * @returns {Promise<{task: Object, project: Object|null, note: string}>}
         */
        get: function (id) {
            if (!id) { return Promise.reject(new Error('No document id was given.')); }
            Log.info('completion: GET', PATH + id);

            return Request.get(PATH + encodeURIComponent(id)).then(function (body) {
                var result = shape(body);
                Log.info('completion ' + result.task.attributes.name + ': ' +
                         result.task.routes.length + ' route(s), ' +
                         result.task.files.length + ' file(s), project ' +
                         (result.project ? result.project.projectNo : 'none'));
                result.note = result.project ? '' :
                    'This document is not attached to a project, so the project ' +
                    'data of the form cannot be shown.';
                return result;
            }, function (err) {
                // the page prefixes "The document could not be opened:"
                throw new Error(reason(err));
            });
        },

        /** for tests only */
        _shape: shape
    };
});
