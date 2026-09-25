/**
 * IRSProjects small display helpers. No library: Tabulator's "datetime"
 * formatter needs luxon, and one date function is cheaper than a dependency.
 */
define('IRSProjects/utils/Format', [], function () {
    'use strict';

    return {
        /**
         * "2026-02-15T17:00:00.000" -> the user's locale date, time dropped:
         * the landing page plans in days, and the time only makes columns wide.
         * Anything unparseable is returned unchanged rather than hidden.
         */
        date: function (value) {
            if (!value) { return ''; }
            var parsed = new Date(value);
            if (isNaN(parsed.getTime())) { return String(value); }
            return parsed.toLocaleDateString(widget.lang || undefined,
                { year: 'numeric', month: 'short', day: '2-digit' });
        },

        /**
         * A badge as a DOM node - never an HTML string (no injection). Square,
         * like the OOTB ENOVIA grids; `rounded-pill` was dropped on 2026-09-24.
         *
         * @param {string} text
         * @param {string} style  either a Bootstrap contextual suffix ("secondary")
         *        or a ready class list of ours ("irs-state irs-state-active").
         *        Anything containing a space or starting with "irs-" is taken as
         *        classes; otherwise it is treated as a Bootstrap suffix.
         */
        badge: function (text, style) {
            var span = document.createElement('span');
            var own = /\s|^irs-/.test(style || '');
            span.className = 'badge ' + (own ? style : 'text-bg-' + style);
            span.textContent = text;
            return span;
        }
    };
});
