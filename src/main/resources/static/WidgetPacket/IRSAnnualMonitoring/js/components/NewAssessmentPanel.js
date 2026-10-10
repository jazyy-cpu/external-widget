/**
 * The "New assessment round" form.
 *
 * An inline card, deliberately NOT a Bootstrap modal: Bootstrap's JavaScript is
 * not loaded in a UWA widget (rule C3), so `new bootstrap.Modal(...)` would
 * never run. Native inputs plus Bootstrap classes only.
 *
 * What it collects is exactly the four things an IRSSkillAssessment carries -
 * year, period and the two dates - plus a Title. The date range defaults to the
 * current April-March financial year and is editable, because a department is
 * allowed two rounds in one year (doc 10 section 10.3).
 *
 * It does NOT validate against existing rounds. "One assessment per department
 * per year and period" is a rule the platform has to enforce with a create
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

            var titleInput = field(row, 'Title', input('text',
                (department.label || 'Assessment') + ' ' + range.year));
            var yearInput = field(row, 'Year', input('number', range.year));
            yearInput.min = '2000';
            yearInput.max = '2100';

            var periodSelect = document.createElement('select');
            periodSelect.className = 'form-select form-select-sm';
            Fields.PERIODS.forEach(function (p) {
                var option = document.createElement('option');
                option.value = p;
                option.textContent = p;
                periodSelect.appendChild(option);
            });
            field(row, 'Period', periodSelect);

            var startInput = field(row, 'From', input('date', range.start));
            var endInput = field(row, 'To', input('date', range.end));

            card.appendChild(row);

            var hint = document.createElement('div');
            hint.className = 'form-text';
            hint.textContent = 'Defaults to the April-March financial year. Change it to run ' +
                'two rounds in one year. Projects and trainings are selected by overlap with this range.';
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
                    period: periodSelect.value,
                    startDate: startInput.value,
                    endDate: endInput.value
                };
                if (!data.title) { showError('A title is required.'); return; }
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
