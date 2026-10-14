/**
 * Which departments the signed-in person may run an assessment for.
 *
 * ## The honest state of this module
 *
 * The real rule is: the person must hold `role_IRSHeadOfDepartment` OR
 * `role_IRSInCharge` on that Department, through relationship
 * `IRSResponsibility` and attribute `IRSResponsibilityRole`. That data exists
 * and is live on the VM - but reading it is a RELATIONSHIP TRAVERSAL, and
 * federated search indexes objects, not links (WGT-10 api.md section 3.2). OOTB
 * REST cannot answer it.
 *
 * So until the custom REST service exists, `mine()` returns every department
 * from the seeded JSON and reports `degraded: true`. The App shows a visible
 * banner while that is so. Nothing silently pretends the check passed.
 *
 * ## Replacing it is one function
 *
 * When the service is built, `fromService()` below becomes the real call and
 * `mine()` stops falling back. The shape it must return is already fixed here,
 * so no caller changes.
 */
define('IRSAnnualMonitoring/services/DepartmentService', [
    'JazzySole/Request'
], function (Request) {
    'use strict';

    /**
     * The endpoint on our own REST JAR - irs-monitoring-rest, built 2026-10-14.
     *
     * It returns {login, departments:[{id, code, label, roles, roleLabels,
     * isHod, isInCharge}]}, derived entirely from the AUTHENTICATED user: this
     * widget cannot ask on anyone else's behalf, by design.
     *
     * The path is NOT under 'resources/v1/irs' - that is the hello JAR's
     * application path, and nesting one JAX-RS application under another's
     * makes which one serves a URL container-dependent.
     */
    var ENDPOINT = 'resources/v1/irsmonitoring/departments/mine';

    var cache = null;

    /**
     * This widget's own root, absolute, with a trailing slash.
     *
     * A RELATIVE XHR path does not work inside a dashboard. UWA rewrites the
     * markup's src/href to absolute URLs on the widget's real host - which is
     * why every script tag loads - but it cannot rewrite a URL built inside
     * JavaScript, so a relative path resolves against the PROXIED document and
     * asks the dashboard for a file only our host has:
     *
     *     GET https://<server>/3ddashboard/api/widget/js/data/departments.json
     *     404 Not Found
     *
     * IRSTasks hit this on 2026-10-08 (its ConfigService carries the full note)
     * and this widget reproduced it exactly. Same three steps, same order:
     * UWA's own baseUrl first, because if the dashboard ever proxies the module
     * scripts too, step 2 would derive the proxy's base and give this 404 back.
     */
    var ROOT = (function () {
        try {
            if (typeof widget !== 'undefined' && widget &&
                    typeof widget.getSettings === 'function') {
                var declared = (widget.getSettings() || {}).baseUrl || '';
                if (/^https?:\/\//i.test(declared)) {
                    return declared.replace(/\/+$/, '') + '/';
                }
            }
        } catch (ignoredUwa) { /* fall through to the script tag */ }

        // a script that demonstrably loaded: its `src` is already resolved to
        // an absolute URL, so whatever host served it is a host that works
        var src = '';
        try {
            if (document.currentScript && document.currentScript.src) {
                src = document.currentScript.src;
            }
        } catch (ignored) { src = ''; }

        if (!src) {
            // currentScript is null when a loader evals the source instead of
            // inserting a tag
            try {
                var tags = document.getElementsByTagName('script');
                for (var i = tags.length - 1; i >= 0; i--) {
                    var candidate = tags[i].src || '';
                    if (candidate.indexOf('/IRSAnnualMonitoring/js/') >= 0) {
                        src = candidate;
                        break;
                    }
                }
            } catch (ignored2) { src = ''; }
        }

        // ".../IRSAnnualMonitoring/js/services/DepartmentService.js" -> ".../IRSAnnualMonitoring/"
        var cut = src.indexOf('/js/');
        return cut > 0 ? src.slice(0, cut + 1) : '';
    }());

    function seeded() {
        return new Promise(function (resolve, reject) {
            // the URL goes in every message: the one failure this has actually
            // had was a URL resolved against the wrong document, and the status
            // alone did not show it
            var url = ROOT + 'js/data/departments.json';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.onload = function () {
                if (xhr.status < 200 || xhr.status >= 300) {
                    reject(new Error('departments.json returned HTTP ' + xhr.status +
                        ' from ' + url));
                    return;
                }
                try {
                    var parsed = JSON.parse(xhr.responseText);
                    resolve(parsed.departments || []);
                } catch (e) {
                    reject(new Error('departments.json is not valid JSON (' + url + '): ' + e.message));
                }
            };
            xhr.onerror = function () { reject(new Error('departments.json could not be reached at ' + url)); };
            xhr.send();
        });
    }

    /**
     * The real call, for when the service exists. Kept separate so switching
     * over is a one-line change in mine().
     */
    function fromService() {
        return Request.get(ENDPOINT).then(function (body) {
            var rows = (body && body.departments) || [];
            return rows.map(function (d) {
                return {
                    id: d.id,
                    code: d.code,
                    label: d.label || d.title || d.code,
                    division: d.division || '',
                    roles: d.roles || []
                };
            });
        });
    }

    return {
        ENDPOINT: ENDPOINT,

        /** The absolute base the seeded file is read from, for diagnostics. */
        root: function () { return ROOT; },

        /**
         * @returns {Promise<{departments: Array, degraded: boolean, reason: string}>}
         *   degraded = true means the HOD / In-Charge filter was NOT applied and
         *   the caller must say so on screen.
         */
        mine: function (force) {
            if (cache && !force) { return Promise.resolve(cache); }
            return fromService().then(function (departments) {
                cache = { departments: departments, degraded: false, reason: '' };
                return cache;
            }).catch(function (err) {
                // The service is built; this path is now a REAL degradation -
                // the JAR is not deployed, the session expired, or the read
                // failed. The reason carries the error so it is diagnosable
                // from the banner instead of only from the console.
                var detail = (err && err.message) ? ' (' + err.message + ')' : '';
                return seeded().then(function (departments) {
                    cache = {
                        departments: departments,
                        degraded: true,
                        reason: 'The Head of Department / In-Charge check could not be ' +
                            'applied, so every department is listed' + detail + '.'
                    };
                    return cache;
                });
            });
        },

        /** Drop the cache, for example after a credential change. */
        reset: function () { cache = null; },

        byId: function (list, id) {
            var found = null;
            (list || []).forEach(function (d) { if (d.id === id) { found = d; } });
            return found;
        }
    };
});
