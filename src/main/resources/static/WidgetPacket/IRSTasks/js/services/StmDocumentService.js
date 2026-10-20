/**
 * One Service / Tool / Method Document, for the approver's page.
 *
 *     GET resources/v1/irsproject/documents/{documentId}/stm
 *
 * ## Why the page needs a second loader at all
 *
 * The G11 route (Archiving New Service / Tool / Method, worklog 2026-10-19-12)
 * approves the `IRSServiceToolMethod` DOCUMENT itself, so its inbox tasks carry
 * a Document as `contents[0]`. `TaskDetailService` reads a TASK through
 * `modeler/tasks/{id}`, which cannot read a Document.
 *
 * Checked first (worklog 2026-10-19-14, step 0): the OOTB
 * `GET modeler/documents/{id}` answers the basics and the file list, but even
 * with `$fields=all` it returns none of the form's attributes, not the project
 * (`Reference Document`), not the researchers and not the route. So this reads
 * our own JAR, which answers all of it in one call (two round trips on the
 * server, the same selects the R&D-STM PDF prints).
 *
 * ## Same shape as TaskDetailService, on purpose
 *
 * `{task, project, note}`, with `task.attributes`, `task.routes` and
 * `task.deliverables` filled in the way the page already reads them. So the
 * form (driven by `forms/stm-archive.json`), the documents panel, the approval
 * chain with its signatures, and Approve / Reject all work with no change -
 * Approve / Reject act on the INBOX task id and never cared what it approves.
 *
 * The Document itself is the one row of the documents panel: it is what the
 * approver is approving, and its files are what they will want to open. A
 * Document with several files downloads as one zip, the server's own rule
 * (`DocumentService`).
 */
define('IRSTasks/services/StmDocumentService', [
    'JazzySole/Request',
    'IRSTasks/config/TaskFields',
    'IRSTasks/Log'
], function (Request, Fields, Log) {
    'use strict';

    var PATH = 'resources/v1/irsproject/documents/';

    /**
     * `Document Release`, the policy the subtype inherits - the platform's
     * own display names, as the Document's properties page shows them.
     */
    var STATE_LABELS = {
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

    /** The JAR's payload, shaped as the task page reads a task and its project. */
    function shape(body) {
        body = body || {};
        var doc = body.document || {};
        var parent = body.project || {};
        var type = text(doc.type);
        var state = text(doc.state);
        var id = text(doc.physicalId) || text(body.documentId);
        var files = list(body.files).map(text).filter(Boolean);
        var researchers = list(body.researchers).map(function (person) {
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
            /** the form's Involved Researcher(s) row, a `derived` list */
            researchers: researchers,
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
            /** what the form spec's `task` rows read - named in stm-archive.json */
            attributes: {
                name: text(doc.name),
                revision: text(doc.revision),
                // the PDF's own spelling: "{documentName}  Rev {documentRevision}"
                stmNumber: text(doc.name) + (text(doc.revision) ? '  Rev ' + text(doc.revision) : ''),
                title: text(doc.title),
                purposeAndApplication: text(doc.purposeAndApplication),
                sourceCode: text(doc.sourceCode),
                installation: text(doc.installation)
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
                EPMProjectNo: text(parent.projectNo)
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
            Log.info('stm document: GET', PATH + id + '/stm');

            return Request.get(PATH + encodeURIComponent(id) + '/stm').then(function (body) {
                var result = shape(body);
                Log.info('stm document ' + result.task.attributes.stmNumber + ': ' +
                         result.task.researchers.length + ' researcher(s), ' +
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
        _shape: shape,
        _STATE_LABELS: STATE_LABELS
    };
});
