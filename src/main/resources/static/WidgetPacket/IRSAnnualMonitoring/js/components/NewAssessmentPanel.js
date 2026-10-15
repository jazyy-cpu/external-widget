/**
 * The "New assessment round" form.
 *
 * An inline card, deliberately NOT a Bootstrap modal: Bootstrap's JavaScript is
 * not loaded in a UWA widget (rule C3), so `new bootstrap.Modal(...)` would
 * never run. Native inputs plus Bootstrap classes only.
 *
 * What it collects is exactly the four things an IRSSkillAssessment carries -
 * year and the two dates - plus a Title.
 *
 * YEAR IS THE ONE INPUT THAT MATTERS. Changing it re-derives the From-To range
 * through Fields.rangeForYear and rewrites the title, because the April-March
 * range is a function of the year and not an independent choice. Before this
 * (2026-10-14) the three moved separately, and two rounds were created carrying
 * a year that contradicted their own dates. The dates stay editable for now
 * only so a shorter window can be tested; the agreed direction is to drop both
 * pickers and derive everything from the year, at which point this panel loses
 * two fields and gains no logic.
 *
 * A title the HOD has TYPED is never overwritten - the panel follows the year
 * only while the title is still the suggested one.
 *
 * It does NOT validate against existing rounds. "One assessment per department
 * per year" is a rule the platform has to enforce with a create
 * check trigger; a browser check would only be a courtesy, and is not written
 * here so that nobody mistakes it for the control.
 */
define('IRSAnnualMonitoring/components/NewAssessmentPanel', [
    'IRSAnnualMonitoring/config/AssessmentFields'
], function (Fields) {
    'use strict';

    function field(parent, labelText, control) {
        var col = document.createElement('div');
        col.className = 'col';
        var label = document.createElement('label');
        label.className = 'form-label small text-muted mb-1';
        label.textContent = labelText;
        col.appendChild(label);
        col.appendChild(control);
        parent.appendChild(col);
        return control;
    }

    function input(type, value) {
        var el = document.createElement('input');
        el.type = type;
        el.className = 'form-control form-control-sm';
        if (value !== undefined && value !== null) { el.value = value; }
        return el;
    }

    return {
        /**
         * @param {Element} parent
         * @param {Object} options {department, onCancel, onSubmit(data)}
         * @returns {{destroy: Function, busy: Function, error: Function}}
         */
        render: function (parent, options) {
            var opts = options || {};
            var department = opts.department || {};
            var range = Fields.defaultRange();

            var card = document.createElement('div');
            card.className = 'irs-create-panel p-3 mb-2';

            var head = document.createElement('div');
            head.className = 'd-flex align-items-center justify-content-between mb-2';
            var title = document.createElement('div');
            title.className = 'fw-semibold';
            title.textContent = 'New assessment round - ' + (department.label || '');
            head.appendChild(title);
            card.appendChild(head);

            var row = document.createElement('div');
            row.className = 'row g-2 align-items-end';

            var suggested = Fields.suggestedTitle(department.label, range.year);

            var titleInput = field(row, 'Title', input('text', suggested));
            var yearInput = field(row, 'Year', input('number', range.year));
            yearInput.min = '2000';
            yearInput.max = '2100';

            var startInput = field(row, 'From', input('date', range.start));
            var endInput = field(row, 'To', input('date', range.end));

            card.appendChild(row);

            /**
             * Year changed: re-derive the range, and the title unless it was
             * typed.
             *
             * The comparison against `suggested` is how a typed title is
             * detected - no extra flag to keep in step, and it recovers if the
             * HOD clears the field back to the suggestion. A year outside the
             * input's own 2000-2100 bounds is left alone rather than producing
             * dates nobody asked for; the Create handler still refuses it.
             */
            function followYear() {
                var next = Fields.rangeForYear(yearInput.value);
                if (!next.start) { return; }
                if ((titleInput.value || '').trim() === suggested) {
                    suggested = Fields.suggestedTitle(department.label, next.year);
                    titleInput.value = suggested;
                } else {
                    suggested = Fields.suggestedTitle(department.label, next.year);
                }
                startInput.value = next.start;
                endInput.value = next.end;
            }

            // 'input' fires on every keystroke and on the spinner; 'change'
            // catches a value pasted or committed with Enter.
            yearInput.addEventListener('input', followYear);
            yearInput.addEventListener('change', followYear);

            var hint = document.createElement('div');
            hint.className = 'form-text';
            hint.textContent = 'The year sets the April-March financial year and the ' +
                'title. There is one round per department per year; change the dates only ' +
                'to assess a shorter window. Projects and trainings are selected by ' +
                'overlap with this range.';
            card.appendChild(hint);

            var errorBox = document.createElement('div');
            errorBox.className = 'alert alert-danger small mt-2 mb-0 d-none';
            errorBox.setAttribute('role', 'alert');
            card.appendChild(errorBox);

            var actions = document.createElement('div');
            actions.className = 'd-flex gap-2 mt-3';

            var create = document.createElement('button');
            create.type = 'button';
            create.className = 'btn btn-primary btn-sm';
            create.textContent = 'Create';

            var cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'btn btn-outline-secondary btn-sm';
            cancel.textContent = 'Cancel';

            actions.appendChild(create);
            actions.appendChild(cancel);
            card.appendChild(actions);

            function showError(message) {
                errorBox.textContent = message;
                errorBox.classList.remove('d-none');
            }

            function busy(on) {
                create.disabled = !!on;
                cancel.disabled = !!on;
                create.textContent = on ? 'Creating...' : 'Create';
            }

            create.addEventListener('click', function () {
                errorBox.classList.add('d-none');
                var data = {
                    departmentId: department.id,
                    departmentCode: department.code,
                    title: (titleInput.value || '').trim(),
                    year: Number(yearInput.value),
                    startDate: startInput.value,
                    endDate: endInput.value
                };
                if (!data.title) { showError('A title is required.'); return; }
                if (!isFinite(data.year) || data.year < 2000 || data.year > 2100) {
                    showError('A year between 2000 and 2100 is required.'); return;
                }
                if (!data.startDate || !data.endDate) { showError('Both dates are required.'); return; }
                if (data.endDate < data.startDate) { showError('The end date is before the start date.'); return; }
                if (opts.onSubmit) { opts.onSubmit(data); }
            });

            cancel.addEventListener('click', function () {
                if (opts.onCancel) { opts.onCancel(); }
            });

            parent.appendChild(card);

            return {
                busy: busy,
                error: showError,
                destroy: function () {
                    if (card.parentNode) { card.parentNode.removeChild(card); }
                }
            };
        }
    };
});
