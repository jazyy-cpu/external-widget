/**
 * The department selector in the top band.
 *
 * A person may be Head of more than one department, so the widget cannot assume
 * one (WGT-10 check A2). When there is exactly one the control renders as plain
 * text instead of a select - a drop-down with a single option is noise.
 *
 * The choice is kept in a widget preference, not in the route: it is a
 * user-level setting like the credential, and it should survive moving between
 * pages as well as a refresh.
 *
 * A native <select> with Bootstrap classes, never a Bootstrap JS component:
 * Bootstrap's JavaScript is not loaded in a UWA widget (rule C3).
 */
define('IRSAnnualMonitoring/components/DepartmentPicker', [], function () {
    'use strict';

    var PREF = 'xPrefAnnualDepartment';

    function readPref() {
        try { return widget.getValue(PREF) || ''; } catch (e) { return ''; }
    }

    function writePref(value) {
        try { widget.setValue(PREF, value || ''); } catch (e) { /* preference not available */ }
    }

    return {
        PREF: PREF,

        /**
         * @param {Element} parent
         * @param {Object} options {departments, onChange}
         * @returns {{selected: Function}} the chosen department object, or null
         */
        render: function (parent, options) {
            var opts = options || {};
            var departments = opts.departments || [];

            var wrap = document.createElement('div');
            wrap.className = 'd-flex align-items-center gap-2';

            var label = document.createElement('span');
            label.className = 'small text-muted';
            label.textContent = 'Department';
            wrap.appendChild(label);

            var chosen = readPref();
            var valid = departments.some(function (d) { return d.id === chosen; });
            if (!valid) {
                chosen = departments.length ? departments[0].id : '';
                writePref(chosen);
            }

            function current() {
                var found = null;
                departments.forEach(function (d) { if (d.id === chosen) { found = d; } });
                return found;
            }

            if (departments.length === 0) {
                var none = document.createElement('span');
                none.className = 'small text-danger';
                none.textContent = 'none available';
                wrap.appendChild(none);
            } else if (departments.length === 1) {
                var only = document.createElement('span');
                only.className = 'small fw-semibold';
                only.textContent = departments[0].label;
                wrap.appendChild(only);
            } else {
                var select = document.createElement('select');
                select.className = 'form-select form-select-sm';
                select.style.width = 'auto';
                departments.forEach(function (d) {
                    var option = document.createElement('option');
                    option.value = d.id;
                    option.textContent = d.label;
                    if (d.id === chosen) { option.selected = true; }
                    select.appendChild(option);
                });
                select.addEventListener('change', function () {
                    chosen = select.value;
                    writePref(chosen);
                    if (opts.onChange) { opts.onChange(current()); }
                });
                wrap.appendChild(select);
            }

            parent.appendChild(wrap);
            return { selected: current };
        }
    };
});
