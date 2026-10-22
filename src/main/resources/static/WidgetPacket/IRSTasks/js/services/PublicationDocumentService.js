/**
 * One G12 Technical Publication / Presentation Document, for the approver's
 * page.
 *
 *     GET resources/v1/irsproject/publications/{documentId}
 *
 * ## The STM page again, for another Document subtype
 *
 * The G12 route (Researcher, In-Charge / HOD, Division Head - worklog
 * 2026-10-22-10) approves the `IRSTechnicalPublication` Document itself, so
 * its inbox tasks carry it as `contents[0]`, exactly as the G11 route carries
 * an STM Document. The OOTB document resource returns none of the subtype's
 * attributes (worklog 2026-10-19-14), so this reads our JAR: one call, two
 * round trips on the server (worklog 2026-10-22-12).
 *
 * ## Same shape as StmDocumentService, on purpose
 *
 * `{task, project, note}`, `task.kind` 'document' (the banner says "This
 * document"), and the Document itself as the one row of the documents panel.
 * The form is `forms/technical-publication.json`; the approval chain and
 * Approve / Reject act on the inbox task and need nothing from here.
 */
define('IRSTasks/services/PublicationDocumentService', [
    'JazzySole/Request',
    'IRSTasks/config/TaskFields',
    'IRSTasks/Log'
], function (Request, Fields, Log) {
    'use strict';

    var PATH = 'resources/v1/irsproject/publications/';

    /** `Document Release`, the policy the subtype inherits. */
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

    /**
     * The paper's "Type of Publication: National / International; Conference /
     * Journal" - the two ticked words, in the paper's order.
     */
    function publicationType(doc) {
        return [text(doc.reach), text(doc.medium)].filter(Boolean).join('; ');
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
        var authors = list(body.authors).map(function (person) {
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
            /** the form's Author(s) row, a `derived` list */
            authors: authors,
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
            /** what the form spec's `task` rows read - named in technical-publication.json */
            attributes: {
                name: text(doc.name),
                revision: text(doc.revision),
                title: text(doc.title),
                publicationName: text(doc.publicationName),
                publicationType: publicationType(doc),
                reach: text(doc.reach),
                medium: text(doc.medium),
                venue: text(doc.venue),
                duration: text(doc.duration),
                submitCopyToLibrary: text(doc.submitCopyToLibrary)
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
            Log.info('publication: GET', PATH + id);

            return Request.get(PATH + encodeURIComponent(id)).then(function (body) {
                var result = shape(body);
                Log.info('publication ' + result.task.attributes.name + ': ' +
                         result.task.authors.length + ' author(s), ' +
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
