/**
 * JazzySole Notify - sliding notifications for UWA widgets.
 *
 * How long a message stays is decided by **its type**, in the one table below,
 * and a caller may override the time for a single message. That is the whole
 * policy, and it lives in one place on purpose: when someone later decides that
 * warnings should last eight seconds, they change one number here and every
 * widget follows.
 *
 *   critical / error   stay until the user closes them (timeout 0)
 *   warning / success / info   slide away by themselves after 5 seconds
 *
 * A message that cannot time out is always given a close button, whatever the
 * caller asked for - otherwise it would be permanent.
 *
 * Why the stack hangs off `document.body` and not `widget.body`: the widget
 * clears `widget.body` whenever it re-renders a page, which would silently wipe
 * a notification the user has not read yet. The stack is a fixed overlay in the
 * widget's own iframe document, so it survives that and never leaves the frame.
 *
 * No Bootstrap JavaScript (UWA rule C7 - its bundle is UMD and breaks the AMD
 * loader). The look is Bootstrap's `alert`; only the sliding and the placement
 * are ours, in Notify.css.
 *
 * Usage and API: README.md in this folder.
 */
define('JazzySole/Notify', [], function () {
    'use strict';

    var VERSION = '1.0.0';

    /**
     * The policy table. `timeout` is milliseconds; **0 means the user must
     * close it**. `style` is the Bootstrap contextual suffix, `live` the ARIA
     * politeness: assertive interrupts a screen reader, polite waits.
     */
    var TYPES = {
        critical: { style: 'danger',  label: 'Critical', timeout: 0,    live: 'assertive' },
        error:    { style: 'danger',  label: 'Error',    timeout: 0,    live: 'assertive' },
        warning:  { style: 'warning', label: 'Warning',  timeout: 5000, live: 'polite' },
        success:  { style: 'success', label: 'Done',     timeout: 5000, live: 'polite' },
        info:     { style: 'info',    label: '',         timeout: 5000, live: 'polite' }
    };

    var DEFAULT_TYPE = 'info';
    var ANIMATION_MS = 250;     // keep in step with the transition in Notify.css

    var config = {
        max: 4,                 // beyond this the oldest closable message goes
        position: 'top-end'     // top-end | top-start | bottom-end | bottom-start
    };

    var stack = null;           // the container element
    var open = [];              // handles, oldest first

    // ---- policy (pure, so it can be tested without a browser) -----------

    /**
     * Turn what a caller passed into the settings one notification will use.
     * @param {string|Object} input  a message, or { type, message, title, timeout, dismissible }
     */
    function resolve(input) {
        var opts = (typeof input === 'string') ? { message: input } : (input || {});
        var name = TYPES[opts.type] ? opts.type : DEFAULT_TYPE;
        var type = TYPES[name];

        // an explicit timeout wins over the type's own, including an explicit 0
        var timeout = type.timeout;
        if (opts.timeout !== undefined && opts.timeout !== null && opts.timeout !== '') {
            var asked = Number(opts.timeout);
            if (!isNaN(asked) && asked >= 0) { timeout = asked; }
        }

        var sticky = timeout === 0;
        return {
            type: name,
            style: type.style,
            title: opts.title !== undefined ? opts.title : type.label,
            message: opts.message === undefined ? '' : String(opts.message),
            timeout: timeout,
            sticky: sticky,
            // a message that never times out must always be closable
            dismissible: sticky ? true
                : (opts.dismissible === undefined ? true : !!opts.dismissible),
            live: type.live
        };
    }

    // ---- DOM -------------------------------------------------------------

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    function positionClass() {
        return 'jz-notify-' + String(config.position).replace(/[^a-z-]/g, '');
    }

    function container() {
        if (stack && stack.parentNode) {
            stack.className = 'jz-notify-stack ' + positionClass();
            return stack;
        }
        stack = el('div', 'jz-notify-stack ' + positionClass());
        stack.setAttribute('aria-live', 'polite');
        document.body.appendChild(stack);
        return stack;
    }

    function build(settings, handle) {
        var box = el('div', 'jz-notify-item alert alert-' + settings.style +
                            (settings.dismissible ? ' alert-dismissible' : '') + ' shadow-sm mb-0');
        box.setAttribute('role', settings.live === 'assertive' ? 'alert' : 'status');
        box.setAttribute('aria-live', settings.live);

        if (settings.title) {
            box.appendChild(el('div', 'jz-notify-title', settings.title));
        }
        box.appendChild(el('div', 'jz-notify-message', settings.message));

        if (settings.dismissible) {
            var close = el('button', 'btn-close');
            close.type = 'button';
            close.setAttribute('aria-label', 'Close');
            close.addEventListener('click', function () { handle.close(); });
            box.appendChild(close);
        }
        return box;
    }

    /** Keep the stack short: drop the oldest message the user may lose. */
    function trim() {
        while (open.length > config.max) {
            var victim = null;
            for (var i = 0; i < open.length; i++) {
                if (!open[i].settings.sticky) { victim = open[i]; break; }
            }
            // everything on screen is sticky - take the oldest rather than grow
            (victim || open[0]).close();
        }
    }

    // ---- public API ------------------------------------------------------

    var Notify = {
        VERSION: VERSION,

        /**
         * Show one notification.
         * @param {string|Object} input  a message, or:
         *        {string} [type]        critical | error | warning | success | info
         *        {string} message
         *        {string} [title]       defaults to the type's label
         *        {number} [timeout]     ms; **0 keeps it until the user closes it**.
         *                               Overrides the type's own time
         *        {boolean}[dismissible] ignored when the message never times out
         * @returns {{close: Function, element: HTMLElement, settings: Object}}
         */
        show: function (input) {
            var settings = resolve(input);
            var timer = null;
            var remaining = settings.timeout;
            var startedAt = 0;
            var closed = false;

            var handle = {
                settings: settings,
                element: null,
                close: function () {
                    if (closed) { return; }
                    closed = true;
                    if (timer) { clearTimeout(timer); timer = null; }
                    var i = open.indexOf(handle);
                    if (i >= 0) { open.splice(i, 1); }
                    var node = handle.element;
                    if (!node || !node.parentNode) { return; }
                    node.classList.remove('jz-notify-in');
                    node.classList.add('jz-notify-out');
                    setTimeout(function () {
                        if (node.parentNode) { node.parentNode.removeChild(node); }
                        if (stack && !stack.childNodes.length && stack.parentNode) {
                            stack.parentNode.removeChild(stack);
                            stack = null;
                        }
                    }, ANIMATION_MS);
                }
            };

            var box = build(settings, handle);
            handle.element = box;
            container().appendChild(box);
            open.push(handle);

            function startTimer() {
                if (settings.sticky || closed || remaining <= 0) { return; }
                startedAt = Date.now();
                timer = setTimeout(function () { handle.close(); }, remaining);
            }
            function pauseTimer() {
                if (!timer) { return; }
                clearTimeout(timer);
                timer = null;
                remaining -= (Date.now() - startedAt);
            }
            if (!settings.sticky) {
                // reading takes as long as it takes: hovering stops the clock
                box.addEventListener('mouseenter', pauseTimer);
                box.addEventListener('mouseleave', startTimer);
            }

            // one frame later, so the browser animates from the off-screen start
            if (window.requestAnimationFrame) {
                window.requestAnimationFrame(function () { box.classList.add('jz-notify-in'); });
            } else {
                box.classList.add('jz-notify-in');
            }
            startTimer();
            trim();
            return handle;
        },

        /** Shorthands. Each takes (message, options) and returns the handle. */
        critical: function (m, o) { return Notify.show(withType('critical', m, o)); },
        error:    function (m, o) { return Notify.show(withType('error', m, o)); },
        warning:  function (m, o) { return Notify.show(withType('warning', m, o)); },
        success:  function (m, o) { return Notify.show(withType('success', m, o)); },
        info:     function (m, o) { return Notify.show(withType('info', m, o)); },

        /** Close everything currently on screen. */
        dismissAll: function () {
            open.slice().forEach(function (h) { h.close(); });
        },

        /** How many are on screen. */
        count: function () { return open.length; },

        /**
         * Change the policy once, for the whole application.
         * @param {Object} options
         *        {Object} [types]     merged into the table, e.g. { warning: { timeout: 8000 } }
         *        {number} [max]
         *        {string} [position]  top-end | top-start | bottom-end | bottom-start
         */
        configure: function (options) {
            options = options || {};
            if (options.types) {
                Object.keys(options.types).forEach(function (name) {
                    TYPES[name] = TYPES[name] || { style: 'info', label: '', timeout: 5000, live: 'polite' };
                    var patch = options.types[name];
                    Object.keys(patch).forEach(function (key) { TYPES[name][key] = patch[key]; });
                });
            }
            if (typeof options.max === 'number' && options.max > 0) { config.max = options.max; }
            if (options.position) { config.position = options.position; }
            return Notify;
        },

        /** The policy in force, for tests and for a settings screen later. */
        types: function () {
            var copy = {};
            Object.keys(TYPES).forEach(function (k) {
                copy[k] = { style: TYPES[k].style, label: TYPES[k].label,
                            timeout: TYPES[k].timeout, live: TYPES[k].live };
            });
            return copy;
        },

        /** for tests only - the policy without a browser */
        _resolve: resolve
    };

    function withType(type, message, options) {
        var opts = {};
        Object.keys(options || {}).forEach(function (k) { opts[k] = options[k]; });
        opts.type = type;
        if (message !== undefined) { opts.message = message; }
        return opts;
    }

    return Notify;
});
