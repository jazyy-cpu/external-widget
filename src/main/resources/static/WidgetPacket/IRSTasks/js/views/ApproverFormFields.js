/**
 * The approver's inputs, drawn inside the decision bar: one row per field with
 * an `input` block in the form JSON (see `ApproverFormService`).
 *
 * Bootstrap only - `form-check-inline` radios, `form-control` text areas,
 * `is-invalid` / `invalid-feedback` for a problem. No CSS of our own.
 *
 * ## No radio is preselected
 *
 * An unanswered question must LOOK unanswered. The platform's own form always
 * checks the first radio of a group (`UIForm`, worklog 2026-10-24-03), which on
 * this checklist would read as "Yes" to every question nobody answered. Here a
 * group starts with nothing checked unless the task already holds an answer.
 */
define('IRSTasks/views/ApproverFormFields', [
    'IRSTasks/services/ApproverFormService'
], function (ApproverFormService) {
    'use strict';

    var sequence = 0;   // radio-group names must be unique on the page

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined && text !== null) { node.textContent = text; }
        return node;
    }

    /** One choice question: its label, then its radios on one line. */
    function choiceRow(field, value, name, onChange) {
        var row = el('div', 'mb-2');
        row.appendChild(el('div', 'fw-semibold', field.label));
        var group = el('div', '');
        var radios = [];
        (field.input.values || []).forEach(function (option, i) {
            var wrap = el('div', 'form-check form-check-inline');
            var radio = el('input', 'form-check-input');
            radio.type = 'radio';
            radio.name = name;
            radio.value = option;
            radio.id = name + '-' + i;
            radio.checked = value === option;
            radio.addEventListener('change', onChange);
            var label = el('label', 'form-check-label', option);
            label.htmlFor = radio.id;
            wrap.appendChild(radio);
            wrap.appendChild(label);
            group.appendChild(wrap);
            radios.push(radio);
        });
        row.appendChild(group);
        var feedback = el('div', 'invalid-feedback');
        row.appendChild(feedback);
        return {
            row: row,
            feedback: feedback,
            controls: radios,
            read: function () {
                var picked = radios.filter(function (r) { return r.checked; })[0];
                return picked ? picked.value : '';
            }
        };
    }

    /** One text question: its label, then a text area. */
    function textRow(field, value, name, onChange) {
        var row = el('div', 'mb-2');
        var label = el('label', 'form-label fw-semibold mb-1', field.label);
        label.htmlFor = name;
        row.appendChild(label);
        var area = el('textarea', 'form-control');
        area.id = name;
        area.rows = 3;
        area.value = value || '';
        area.addEventListener('input', onChange);
        row.appendChild(area);
        var feedback = el('div', 'invalid-feedback');
        row.appendChild(feedback);
        return {
            row: row,
            feedback: feedback,
            controls: [area],
            read: function () { return area.value; }
        };
    }

    return {
        /**
         * @param {Object[]} fields from `ApproverFormService.inputsOf`
         * @param {Object} values the task's current answers
         * @param {Function} [onChange] called after any edit
         * @returns {{element, values, showProblems, setDisabled, refreshRequired}}
         */
        render: function (fields, values, onChange) {
            sequence += 1;
            var prefix = 'irs-af' + sequence;
            var wrap = el('div', 'irs-approver-form border rounded p-2 mb-3');
            wrap.appendChild(el('div', 'fw-semibold mb-1', 'Fill in the form'));
            wrap.appendChild(el('div', 'small text-secondary mb-2',
                'Your answers are saved to the task before your decision is sent. ' +
                'Fields marked * are required to approve.'));

            var rows = {};
            function changed() { refreshRequired(); if (onChange) { onChange(); } }

            fields.forEach(function (field, i) {
                var name = prefix + '-' + i;
                var made = field.input.type === 'choice'
                    ? choiceRow(field, values[field.field], name, changed)
                    : textRow(field, values[field.field], name, changed);
                made.title = made.row.querySelector('.fw-semibold');
                made.field = field;
                rows[field.field] = made;
                wrap.appendChild(made.row);
            });

            function read() {
                var out = {};
                fields.forEach(function (f) { out[f.field] = rows[f.field].read(); });
                return out;
            }

            // the asterisk follows the answers: legal details become required
            // the moment "Applicability of legal..." is answered Yes
            function refreshRequired() {
                var now = read();
                fields.forEach(function (f) {
                    var r = rows[f.field];
                    if (r.title) {
                        r.title.textContent = f.label +
                            (ApproverFormService.isRequired(f, now) ? ' *' : '');
                    }
                });
            }
            refreshRequired();

            return {
                element: wrap,
                values: read,
                /** Mark these problems; an empty list clears every mark. */
                showProblems: function (problems) {
                    Object.keys(rows).forEach(function (k) {
                        rows[k].controls.forEach(function (c) { c.classList.remove('is-invalid'); });
                        rows[k].feedback.textContent = '';
                        rows[k].feedback.classList.remove('d-block');
                    });
                    (problems || []).forEach(function (p) {
                        var r = rows[p.field];
                        if (!r) { return; }
                        r.controls.forEach(function (c) { c.classList.add('is-invalid'); });
                        r.feedback.textContent = p.label + ': ' + p.message;
                        // radios sit in their own wrappers, so Bootstrap's
                        // sibling rule cannot reveal the feedback by itself
                        r.feedback.classList.add('d-block');
                    });
                    var firstBad = problems && problems[0] && rows[problems[0].field];
                    if (firstBad && firstBad.row.scrollIntoView) {
                        firstBad.row.scrollIntoView({ block: 'center' });
                    }
                },
                setDisabled: function (off) {
                    Object.keys(rows).forEach(function (k) {
                        rows[k].controls.forEach(function (c) { c.disabled = !!off; });
                    });
                }
            };
        }
    };
});
