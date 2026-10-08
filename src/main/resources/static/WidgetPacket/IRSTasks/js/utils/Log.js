/**
 * IRSTasks - a switchable diagnostic log.
 *
 * Added 2026-10-07 for one question: **is the task type name coming from the
 * platform (`typeNLS`) or from our own fallback table?** The grid showed the
 * fallback, the fix cannot be confirmed from the screen alone - both paths
 * produce the same string once the fallback labels were corrected - so the
 * answer has to come from the response itself.
 *
 * Turn it off with one line: `ON = false`. It is deliberately NOT a preference
 * or a config file; a diagnostic that needs configuring is one nobody switches
 * off, and this one is meant to be removed when the question is closed.
 *
 * Rules it follows:
 *   - every line is prefixed `[IRSTasks]`, so the dashboard's console can be
 *     filtered to this widget - the 3DDashboard console carries every widget on
 *     the page plus the platform's own;
 *   - it never logs a credential, a token or a whole response body;
 *   - it never throws: a console that is missing or restricted must not take
 *     the page down, which is why every call is wrapped.
 */
define('IRSTasks/Log', [], function () {
    'use strict';

    /** The single switch. Set to false when the NLS question is closed. */
    var ON = true;
    var PREFIX = '[IRSTasks]';

    function safe(fn) {
        if (!ON) { return; }
        try {
            if (typeof console === 'undefined') { return; }
            fn();
        } catch (e) {
            // a logging failure is never worth a page failure
        }
    }

    return {
        get on() { return ON; },

        info: function () {
            var args = Array.prototype.slice.call(arguments);
            safe(function () { console.log.apply(console, [PREFIX].concat(args)); });
        },

        warn: function () {
            var args = Array.prototype.slice.call(arguments);
            safe(function () { console.warn.apply(console, [PREFIX].concat(args)); });
        },

        /** A labelled table - the readable way to show "which rows, which value". */
        table: function (label, rows) {
            safe(function () {
                console.log(PREFIX + ' ' + label);
                if (console.table) { console.table(rows); } else { console.log(rows); }
            });
        }
    };
});
