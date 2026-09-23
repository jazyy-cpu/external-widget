/**
 * JazzySole Router - page navigation for UWA widgets that survives a refresh.
 *
 * The current path and the back stack are kept in a hidden UWA widget
 * preference (widget.setValue / widget.getValue), which the platform stores
 * per widget instance. A widget refresh or a dashboard reload therefore
 * reopens the same page. Outside a dashboard (no global `widget`) the state
 * is kept in memory only.
 *
 * No dependency on UWA modules or on window.location.
 * Usage and API: README.md in this folder.
 */
define('JazzySole/Router', [], function () {
    'use strict';

    var VERSION = '1.0.0';

    // ---- storage -------------------------------------------------------

    function WidgetPreferenceStore(prefName) {
        this.prefName = prefName;
    }
    WidgetPreferenceStore.prototype.read = function () {
        var raw = widget.getValue(this.prefName);
        if (!raw) { return null; }
        try {
            var state = JSON.parse(raw);
            return (state && typeof state.path === 'string') ? state : null;
        } catch (e) {
            // an older plain-string value: treat it as a path
            return { path: String(raw), stack: [] };
        }
    };
    WidgetPreferenceStore.prototype.write = function (state) {
        widget.setValue(this.prefName, JSON.stringify(state));
    };

    function MemoryStore() {
        this.state = null;
    }
    MemoryStore.prototype.read = function () { return this.state; };
    MemoryStore.prototype.write = function (state) { this.state = state; };

    function defaultStore(prefName) {
        var hasWidget = typeof widget !== 'undefined' && widget &&
            typeof widget.getValue === 'function' && typeof widget.setValue === 'function';
        return hasWidget ? new WidgetPreferenceStore(prefName) : new MemoryStore();
    }

    // ---- paths ---------------------------------------------------------

    function normalize(path) {
        return String(path || '').replace(/^[#\/]+/, '').replace(/\/+$/, '');
    }

    function compile(pattern) {
        var keys = [];
        var source = normalize(pattern).split('/').map(function (part) {
            if (part.charAt(0) === ':') {
                var optional = part.slice(-1) === '?';
                keys.push(optional ? part.slice(1, -1) : part.slice(1));
                return optional ? '(?:/([^/]+))?' : '/([^/]+)';
            }
            return '/' + part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('');
        return { pattern: normalize(pattern), keys: keys, regex: new RegExp('^' + source + '$') };
    }

    function buildPath(pattern, params) {
        params = params || {};
        return normalize(pattern).split('/').map(function (part) {
            if (part.charAt(0) !== ':') { return part; }
            var optional = part.slice(-1) === '?';
            var key = optional ? part.slice(1, -1) : part.slice(1);
            var value = params[key];
            if (value === undefined || value === null || value === '') {
                if (optional) { return null; }
                throw new Error('Router.buildPath: missing parameter "' + key + '" for "' + pattern + '"');
            }
            return encodeURIComponent(value);
        }).filter(function (part) { return part !== null; }).join('/');
    }

    // ---- router --------------------------------------------------------

    /**
     * @param {Object} options
     * @param {string} options.defaultPath   path opened when nothing is stored or the stored path is unknown
     * @param {string} [options.prefName]    hidden preference that holds the state (default "jzRoute")
     * @param {Object} [options.store]       custom store with read() / write(state)
     * @param {number} [options.maxStack]    back-stack depth kept (default 20)
     * @param {Function} [options.onNotFound] called with (path) before falling back to defaultPath
     * @param {Function} [options.onError]  called with (error, route) when a handler throws or rejects
     */
    function Router(options) {
        options = options || {};
        if (!options.defaultPath) { throw new Error('Router: defaultPath is required'); }
        this.defaultPath = normalize(options.defaultPath);
        this.prefName = options.prefName || 'jzRoute';
        this.store = options.store || defaultStore(this.prefName);
        this.maxStack = options.maxStack || 20;
        this.onNotFound = options.onNotFound || null;
        this.onError = options.onError || null;
        this.routes = [];
        this.listeners = [];
        this.guards = [];
        this.current = null;   // { path, pattern, params, name }
        this.stack = [];       // earlier paths, most recent last
        this.navigating = false;
    }

    Router.VERSION = VERSION;
    Router.buildPath = buildPath;

    /**
     * Register a route.
     * @param {string} pattern  e.g. "projects", "project/:id", "project/:id/:section?"
     * @param {Function} handler  function (params, route) - may return a Promise
     * @param {string} [name]  label used by breadcrumbs
     */
    Router.prototype.add = function (pattern, handler, name) {
        var route = compile(pattern);
        route.handler = handler;
        route.name = name || route.pattern;
        this.routes.push(route);
        return this;
    };

    Router.prototype.match = function (path) {
        path = normalize(path);
        for (var i = 0; i < this.routes.length; i++) {
            var m = this.routes[i].regex.exec('/' + path);
            if (m) {
                var params = {};
                this.routes[i].keys.forEach(function (key, idx) {
                    if (m[idx + 1] !== undefined) { params[key] = decodeURIComponent(m[idx + 1]); }
                });
                return { path: path, pattern: this.routes[i].pattern, params: params,
                         name: this.routes[i].name, route: this.routes[i] };
            }
        }
        return null;
    };

    /** Listen to completed navigations: fn(current, previous). Returns an unsubscribe function. */
    Router.prototype.onChange = function (fn) {
        var list = this.listeners;
        list.push(fn);
        return function () { var i = list.indexOf(fn); if (i >= 0) { list.splice(i, 1); } };
    };

    /** Guard before leaving the current page: fn(to, from) returns false (or a Promise of false) to cancel. */
    Router.prototype.beforeLeave = function (fn) {
        var list = this.guards;
        list.push(fn);
        return function () { var i = list.indexOf(fn); if (i >= 0) { list.splice(i, 1); } };
    };

    /** Open the stored page, or defaultPath. Call from UWA onLoad and onRefresh. */
    Router.prototype.start = function () {
        var saved = null;
        try { saved = this.store.read(); } catch (e) { saved = null; }
        this.stack = (saved && Array.isArray(saved.stack)) ? saved.stack.slice(-this.maxStack) : [];
        this.current = null;
        var path = saved ? saved.path : this.defaultPath;
        return this._open(path, { replace: true, restoring: true });
    };

    /**
     * Navigate to a path or to a pattern + params.
     * go("project/123")  |  go("project/:id", { id: "123" })  |  go(path, null, { replace: true })
     */
    Router.prototype.go = function (pathOrPattern, params, opts) {
        var path = params ? buildPath(pathOrPattern, params) : normalize(pathOrPattern);
        return this._open(path, opts || {});
    };

    /** Go to the previous page in the stack, or defaultPath if the stack is empty. */
    Router.prototype.back = function () {
        var previous = this.stack.length ? this.stack[this.stack.length - 1] : this.defaultPath;
        return this._open(previous, { back: true });
    };

    /** Reopen the current page (for example after data changed). */
    Router.prototype.reload = function () {
        return this._open(this.current ? this.current.path : this.defaultPath, { replace: true, force: true });
    };

    /** Current page as { path, pattern, params, name } or null. */
    Router.prototype.getCurrent = function () {
        return this.current ? { path: this.current.path, pattern: this.current.pattern,
                                params: this.current.params, name: this.current.name } : null;
    };

    /**
     * Breadcrumb items for the current path: every leading part of the path
     * that matches a route, e.g. "project/1/tasks" -> [projects?], project/1, project/1/tasks.
     * The default path is always first.
     */
    Router.prototype.getBreadcrumb = function () {
        var items = [];
        var seen = {};
        var self = this;
        function push(path) {
            var m = self.match(path);
            if (m && !seen[m.path]) { seen[m.path] = true; items.push({ path: m.path, name: m.name, params: m.params }); }
        }
        push(this.defaultPath);
        if (this.current) {
            var parts = this.current.path.split('/');
            for (var i = 1; i <= parts.length; i++) { push(parts.slice(0, i).join('/')); }
        }
        return items;
    };

    Router.prototype._open = function (path, opts) {
        var self = this;
        path = normalize(path);
        if (this.navigating) {
            return Promise.reject(new Error('Router: navigation already in progress'));
        }
        if (!opts.force && this.current && this.current.path === path) {
            return Promise.resolve(this.getCurrent());
        }
        var target = this.match(path);
        if (!target) {
            if (this.onNotFound) { this.onNotFound(path); }
            if (path === this.defaultPath) {
                return Promise.reject(new Error('Router: no route for defaultPath "' + path + '"'));
            }
            return this._open(this.defaultPath, { replace: true, restoring: opts.restoring });
        }
        var from = this.getCurrent();
        this.navigating = true;

        var guardChain = opts.restoring ? Promise.resolve(true) :
            this.guards.reduce(function (p, guard) {
                return p.then(function (ok) { return ok === false ? false : guard(target, from); });
            }, Promise.resolve(true));

        return guardChain.then(function (ok) {
            if (ok === false) { return false; }
            return Promise.resolve().then(function () {
                return target.route.handler(target.params, target);
            }).then(function () {
                if (opts.back) {
                    self.stack.pop();
                } else if (!opts.replace && self.current) {
                    self.stack.push(self.current.path);
                    if (self.stack.length > self.maxStack) { self.stack.shift(); }
                }
                self.current = target;
                self._save();
                var now = self.getCurrent();
                self.listeners.slice().forEach(function (fn) { fn(now, from); });
                return true;
            });
        }).then(function (done) {
            self.navigating = false;
            return done === false ? from : self.getCurrent();
        }, function (err) {
            self.navigating = false;
            if (self.onError) { self.onError(err, target); }
            // a page that cannot be opened (deleted object, no access) is not kept as the saved page
            if (opts.restoring && path !== self.defaultPath) {
                return self._open(self.defaultPath, { replace: true, restoring: true });
            }
            throw err;
        });
    };

    Router.prototype._save = function () {
        try {
            this.store.write({ v: 1, path: this.current.path, stack: this.stack });
        } catch (e) {
            // storage is a convenience; navigation still works without it
        }
    };

    return Router;
});
