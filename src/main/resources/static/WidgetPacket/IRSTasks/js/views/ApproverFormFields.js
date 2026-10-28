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
            // a stored value that is not what the paper says - a boolean's
            // TRUE, a range's NotRequired - comes as {value, label}
            var stored = (option && typeof option === 'object') ? option.value : option;
            var shown = (option && typeof option === 'object') ? (option.label || stored) : option;
            var wrap = el('div', 'form-check form-check-inline');
            var radio = el('input', 'form-check-input');
            radio.type = 'radio';
            radio.name = name;
            radio.value = stored;
            radio.id = name + '-' + i;
            radio.checked = value === stored;
            radio.addEventListener('change', onChange);
            var label = el('label', 'form-check-label', shown);
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

    /**
     * A `date` answer: the task holds a timestamp (`2026-10-21T06:30:00.000Z`),
     * the picker a calendar day. The day is read in local time and written
     * back at local noon, so it cannot slip to the next or previous day in any
     * time zone - the way the platform's own date fields store a day.
     */
    function toDay(iso) {
        var d = iso ? new Date(iso) : null;
        if (!d || isNaN(d.getTime())) { return ''; }
        function two(n) { return (n < 10 ? '0' : '') + n; }
        return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
    }

    function fromDay(day) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
        if (!m) { return ''; }
        return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0).toISOString();
    }

    /** One one-line text or date question: its label, then the input. */
    function lineRow(field, value, name, onChange) {
        var isDate = field.input.type === 'date';
        var row = el('div', 'mb-2');
        var label = el('label', 'form-label fw-semibold mb-1', field.label);
        label.htmlFor = name;
        row.appendChild(label);
        var box = el('input', 'form-control' + (isDate ? ' w-auto' : ''));
        box.id = name;
        box.type = isDate ? 'date' : 'text';
        box.value = isDate ? toDay(value) : (value || '');
        box.addEventListener('input', onChange);
        box.addEventListener('change', onChange);
        row.appendChild(box);
        var feedback = el('div', 'invalid-feedback');
        row.appendChild(feedback);
        return {
            row: row,
            feedback: feedback,
            controls: [box],
            read: function () { return isDate ? fromDay(box.value) : box.value; }
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
                var type = field.input.type;
                var made = type === 'choice'
                    ? choiceRow(field, values[field.field], name, changed)
                    : (type === 'text' || type === 'date')
                        ? lineRow(field, values[field.field], name, changed)
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
