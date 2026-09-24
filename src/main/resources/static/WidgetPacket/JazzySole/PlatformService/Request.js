/**
 * JazzySole Request - the ONE request wrapper for 3DSpace REST calls (rule R3).
 *
 * No service module calls DS/WAFData directly. This wrapper:
 *   1. resolves a relative path against the 3DSpace root from JazzySole/Credentials;
 *   2. appends tenant=<x3dPlatformId> and SecurityContext=ctx::<credential>;
 *   3. sends Accept-Language from widget.lang;
 *   4. tracks the CSRF token and renews it once on a failed write (rule R5);
 *   5. resolves with the parsed response body, rejects with an Error carrying
 *      .status and .body when they could be determined.
 *
 * The CSRF token is needed for PUT / PATCH / POST / DELETE only, so a widget
 * that reads never fetches one. It is never logged and never written to a
 * preference (WGT-03: only paths and ids go into preferences).
 *
 * Usage and API: README.md in this folder.
 */
define('JazzySole/Request', [
    'DS/WAFData/WAFData',
    'JazzySole/Credentials'
], function (WAFData, Credentials) {
    'use strict';

    var VERSION = '1.0.0';

    /** Verbs that need the CSRF token (api.md WGT-01 section 5). */
    var WRITE_METHODS = /^(PUT|PATCH|POST|DELETE)$/;
    var CSRF_HEADER = 'ENO_CSRF_TOKEN';
    var CSRF_PATH = 'resources/v1/application/CSRF';
    var DEFAULT_TIMEOUT = 30000;

    var state = {
        csrf: null,      // the current token value - never logged
        csrfCall: null   // in-flight fetch, so parallel writes share one call
    };

    function platformId() {
        return widget.getValue('x3dPlatformId') || 'OnPremise';
    }

    // ---- URL building ---------------------------------------------------

    function isAbsolute(path) {
        return /^https?:\/\//i.test(path);
    }

    /** "<3DSpace>/<path>?<params>&tenant=...&SecurityContext=ctx::..." */
    function buildUrl(path, params, noContext) {
        var absolute = isAbsolute(path)
            ? Promise.resolve(path)
            : Credentials.get3DSpaceUrl().then(function (root) {
                return root.replace(/\/+$/, '') + '/' + String(path).replace(/^\/+/, '');
            });

        return absolute.then(function (url) {
            var query = [];
            Object.keys(params || {}).forEach(function (key) {
                var value = params[key];
                if (value === undefined || value === null || value === '') { return; }
                query.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
            });
            query.push('tenant=' + encodeURIComponent(platformId()));
            if (!noContext) {
                var ctx = Credentials.getSecurityContext();
                if (ctx) { query.push('SecurityContext=' + encodeURIComponent(ctx)); }
            }
            return url + (url.indexOf('?') >= 0 ? '&' : '?') + query.join('&');
        });
    }

    // ---- CSRF ----------------------------------------------------------

    /**
     * Any response may carry a fresh token: the project GET returns a `csrf`
     * object in its body, other services send the X-DS-CSRFTOKEN header. Both
     * are accepted so the token stays current without an extra round trip.
     */
    function captureToken(body, transport) {
        if (body && body.csrf && body.csrf.value) {
            state.csrf = body.csrf.value;
            return;
        }
        try {
            if (transport && typeof transport.getResponseHeader === 'function') {
                var header = transport.getResponseHeader('X-DS-CSRFTOKEN');
                if (header) { state.csrf = header; }
            }
        } catch (e) {
            // headers are not always reachable through WAFData - not fatal
        }
    }

    function fetchToken() {
        if (state.csrfCall) { return state.csrfCall; }
        state.csrfCall = call(CSRF_PATH, { method: 'GET' }, null).then(function (body) {
            state.csrfCall = null;
            var value = body && body.csrf && body.csrf.value;
            if (!value) { throw new Error('No CSRF token in the response of ' + CSRF_PATH); }
            state.csrf = value;
            return value;
        }, function (err) {
            state.csrfCall = null;
            throw err;
        });
        return state.csrfCall;
    }

    function token(force) {
        if (force) { state.csrf = null; }
        return state.csrf ? Promise.resolve(state.csrf) : fetchToken();
    }

    /** A rejected write that looks like a stale or missing token. */
    function isCsrfFailure(err) {
        if (!err) { return false; }
        if (err.status === 403) { return true; }
        return /csrf|forbidden/i.test(err.message || '');
    }

    // ---- the call ------------------------------------------------------

    function toError(reason, transport) {
        var err;
        if (reason instanceof Error) {
            err = reason;
        } else if (reason && typeof reason === 'object') {
            var message = reason.message || reason.error ||
                (reason.errorMessage) || JSON.stringify(reason).slice(0, 300);
            err = new Error(message);
            err.body = reason;
            if (reason.status) { err.status = reason.status; }
        } else {
            err = new Error(String(reason || 'request failed'));
        }
        try {
            if (!err.status && transport && transport.status) { err.status = transport.status; }
        } catch (e) { /* transport not readable */ }
        return err;
    }

    function call(path, opts, csrfValue) {
        var method = (opts.method || 'GET').toUpperCase();
        return buildUrl(path, opts.params, opts.noContext).then(function (url) {
            return new Promise(function (resolve, reject) {
                var headers = {};
                if (widget.lang) { headers['Accept-Language'] = widget.lang; }
                if (csrfValue) { headers[CSRF_HEADER] = csrfValue; }
                Object.keys(opts.headers || {}).forEach(function (k) { headers[k] = opts.headers[k]; });

                var options = {
                    method: method,
                    type: opts.type || 'json',
                    headers: headers,
                    timeout: opts.timeout || DEFAULT_TIMEOUT,
                    onComplete: function (body, transport) {
                        captureToken(body, transport);
                        // several DS services answer HTTP 200 with an error in the body
                        if (body && body.success === false) {
                            reject(toError(body, transport));
                            return;
                        }
                        resolve(body);
                    },
                    onFailure: function (reason, transport) {
                        captureToken(null, transport);
                        reject(toError(reason, transport));
                    },
                    onTimeout: function () {
                        reject(new Error(method + ' ' + path + ' timed out after ' +
                            (opts.timeout || DEFAULT_TIMEOUT) + ' ms'));
                    }
                };
                if (opts.data !== undefined) {
                    options.data = (typeof opts.data === 'string') ? opts.data : JSON.stringify(opts.data);
                    if (!headers['Content-Type']) { headers['Content-Type'] = 'application/json'; }
                }
                WAFData.authenticatedRequest(url, options);
            });
        });
    }

    // ---- public API ----------------------------------------------------

    var Request = {
        VERSION: VERSION,

        /**
         * @param {string} path      relative to the 3DSpace root, or absolute
         * @param {Object} [opts]    { method, params, data, headers, type, timeout, noContext }
         * @returns {Promise<Object>} the parsed response body
         */
        send: function (path, opts) {
            opts = opts || {};
            var method = (opts.method || 'GET').toUpperCase();
            if (!WRITE_METHODS.test(method)) { return call(path, opts, null); }

            // rule R5: send the token, and on a token failure fetch a new one and retry ONCE
            return token().then(function (value) {
                return call(path, opts, value);
            }).catch(function (err) {
                if (!isCsrfFailure(err)) { throw err; }
                return token(true).then(function (value) {
                    return call(path, opts, value);
                });
            });
        },

        /** GET. @param {Object} [opts] as send(), without method */
        get: function (path, opts) {
            var merged = { method: 'GET' };
            Object.keys(opts || {}).forEach(function (k) { merged[k] = opts[k]; });
            merged.method = 'GET';
            return Request.send(path, merged);
        },

        /** True when a CSRF token is currently held. The value is never exposed. */
        hasCsrfToken: function () { return !!state.csrf; },

        /** Drop the token, for example after a new 3DSpace login. */
        resetCsrfToken: function () { state.csrf = null; },

        /** for tests only */
        _buildUrl: buildUrl,
        _isCsrfFailure: isCsrfFailure
    };

    return Request;
});
