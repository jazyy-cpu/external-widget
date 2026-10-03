/**
 * JazzySole/Format 1.0.0 - the display helpers every widget needs.
 *
 * Promoted out of IRSProjects/utils/Format on 2026-10-03, when the task widget
 * needed the same two functions. No library: Tabulator's "datetime" formatter
 * needs luxon, and one date function is cheaper than a dependency.
 *
 * IRSProjects still carries its own copy. It is a live widget with tests
 * against it, so the migration is a separate change - see the devlog entry
 * 2026-10-03-01.
 */
define('JazzySole/Format', [], function () {
    'use strict';

    return {
        VERSION: '1.0.0',

        /**
         * "2026-02-15T17:00:00.000" -> the user's locale date, time dropped:
         * a list plans in days, and the time only makes columns wide.
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
         * A badge as a DOM node - never an HTML string, so a title carrying
         * `<` can never become markup. Square, like the OOTB ENOVIA grids.
         *
         * @param {string} text
         * @param {string} style  either a Bootstrap contextual suffix
         *        ("secondary") or a ready class list of the widget's own
         *        ("irs-state irs-state-active"). Anything containing a space or
         *        starting with "irs-" is taken as classes; otherwise it is
         *        treated as a Bootstrap suffix.
         */
        badge: function (text, style) {
            var span = document.createElement('span');
            var own = /\s|^irs-/.test(style || '');
            span.className = 'badge ' + (own ? style : 'text-bg-' + style);
            span.textContent = text;
            return span;
        },

        /**
         * An em dash for an empty cell, as a text node. Tabulator accepts a
         * node from a formatter, and this keeps "no value" looking the same in
         * every column of every widget.
         */
        empty: function () {
            return document.createTextNode('—');
        }
    };
});
