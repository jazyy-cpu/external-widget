/**
 * The approver's part of a form: which fields they fill, whether their answers
 * are complete, and the write to the TASK that must succeed before their
 * decision is sent.
 *
 * Used by the G9 Verification Report (user, 2026-10-24): *"this time for
 * approval the division head will fill the form"*. Which fields, and their
 * rules, are data - the `input` blocks in the form JSON - so another form that
 * wants the same is a JSON edit.
 *
 * ## The write is OOTB
 *
 *     PUT resources/v1/modeler/tasks/{taskId}
 *     { data: [ { id, dataelements: { EPMWorkScopeCompleted: 'Yes', ... } } ] }
 *
 * The same resource and verb as the decision (`ApprovalService`), aimed at the
 * task instead of its inbox task. Measured 2026-10-24 (worklog 2026-10-24-07)
 * on a task In Approval: custom attributes are written, and a value outside
 * the attribute's range is refused by the SERVER - so the platform, not this
 * file, is what finally guards the value set.
 *
 * ## The one refusal that is a process problem, not a bug
 *
 * The Division Head may write the task **only when they are one of its
 * assignees**. Holding the route step gives them the inbox task, not the task:
 *
 *     DH assignee      modifyAccess TRUE    PUT 200
 *     DH not assignee  modifyAccess FALSE   PUT 400 "Error: No modify access
 *                                                     on the specified object."
 *
 * The user's decision is to explain it rather than work around it: the DH
 * rejects, the Project Manager adds them as an assignee and sends the route
 * again. `classify` turns the platform's words into a code the bar can act on.
 */
define('IRSTasks/services/ApproverFormService', [
    'JazzySole/Request',
    'IRSTasks/Log'
], function (Request, Log) {
    'use strict';

    var PATH = 'resources/v1/modeler/tasks/';

    /** What the bar says when the DH is not an assignee. One wording, two places. */
    var NOT_ASSIGNEE_TEXT =
        'You are not an assignee of this task, so you cannot fill in the form. ' +
        'Reject this step with a comment asking the Project Manager to add you ' +
        'as an assignee and send the route again.';

    function blank(v) {
        return v === undefined || v === null || String(v).trim() === '';
    }

    /** The fields of a spec that the approver fills, in form order. */
    function inputsOf(spec) {
        if (!spec || !Array.isArray(spec.fields)) { return []; }
        return spec.fields.filter(function (f) {
            return f && f.input && f.source === 'task' && f.field;
        });
    }

    /**
     * Is the field required, given the answers so far?
     * `required: true`, or `requiredWhen: {field, equals}`.
     */
    function isRequired(field, values) {
        var input = field.input || {};
        if (input.required === true) { return true; }
        var when = input.requiredWhen;
        return !!(when && when.field && values[when.field] === when.equals);
    }

    /**
     * What is wrong with these answers, as a list - empty when they may be
     * saved and approved. Pure, so the rules are tested without a page.
     *
     * @param {Object[]} fields from inputsOf
     * @param {Object} values attribute -> answer
     * @returns {Array<{field, label, message}>}
     */
    function validate(fields, values) {
        var problems = [];
        fields.forEach(function (f) {
            var v = values[f.field];
            var input = f.input || {};
            if (isRequired(f, values) && blank(v)) {
                problems.push({ field: f.field, label: f.label,
                    message: input.type === 'choice' ? 'choose an answer' : 'required' });
                return;
            }
            // a value the attribute's range does not hold would be refused by
            // the server anyway; saying so here names the field
            if (input.type === 'choice' && !blank(v) &&
                    (input.values || []).indexOf(v) < 0) {
                problems.push({ field: f.field, label: f.label,
                    message: 'not one of ' + (input.values || []).join(' / ') });
            }
        });
        return problems;
    }

    /**
     * The platform's refusal, as something the bar can act on.
     * @returns {'NOT_ASSIGNEE'|'BAD_VALUE'|''}
     */
    function classify(err) {
        var text = '';
        if (err) {
            text = (err.message || '') + ' ';
            try { text += err.body ? JSON.stringify(err.body) : ''; } catch (e) { /* cyclic */ }
        }
        if (/no modify access/i.test(text)) { return 'NOT_ASSIGNEE'; }
        if (/invalid attribute range/i.test(text)) { return 'BAD_VALUE'; }
        return '';
    }

    /** The answers as the task holds them now, '' for an unanswered one. */
    function currentValues(fields, attributes) {
        var out = {};
        fields.forEach(function (f) {
            var v = attributes ? attributes[f.field] : undefined;
            out[f.field] = blank(v) ? '' : String(v);
        });
        return out;
    }

    /** Does the platform let the signed-in user write this task? From the task call. */
    function canWrite(attributes) {
        return String((attributes && attributes.modifyAccess) || '').toUpperCase() === 'TRUE';
    }

    return {
        NOT_ASSIGNEE_TEXT: NOT_ASSIGNEE_TEXT,
        inputsOf: inputsOf,
        isRequired: isRequired,
        validate: validate,
        classify: classify,
        currentValues: currentValues,
        canWrite: canWrite,

        /**
         * Write the answers to the task. Rejects with an Error whose `code` is
         * `classify`'s verdict, so the caller never parses platform wording.
         *
         * @param {string} taskId the TASK's id, not the inbox task's
         * @param {Object} values attribute -> answer; '' clears one
         */
        save: function (taskId, values) {
            if (!taskId) { return Promise.reject(new Error('No task was given.')); }
            var names = Object.keys(values || {});
            Log.info('approver form: saving ' + names.length + ' field(s) on ' + taskId);

            return Request.send(PATH + taskId, {
                method: 'PUT',
                data: { data: [{ id: taskId, dataelements: values }] }
            }).then(function (body) {
                if (body && body.statusCode && body.statusCode >= 400) {
                    var refused = new Error(body.message ||
                        'The platform refused the form (' + body.statusCode + ').');
                    refused.body = body;
                    throw refused;
                }
                Log.info('approver form: saved on ' + taskId);
                return body;
            }).catch(function (err) {
                var code = classify(err);
                var out = new Error(
                    code === 'NOT_ASSIGNEE' ? NOT_ASSIGNEE_TEXT
                  : code === 'BAD_VALUE' ? 'The platform refused one of the answers as ' +
                        'not allowed for its field. Check the answers and save again.'
                  : 'The form was not saved: ' + ((err && err.message) || err));
                out.code = code;
                Log.warn('approver form: ' + out.message);
                throw out;
            });
        }
    };
});
