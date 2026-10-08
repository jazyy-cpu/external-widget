/**
 * IRSTasks - loads the widget's own JSON configuration files.
 *
 * Why this exists (user, 2026-10-03): a single form may have to hide attributes
 * depending on the **department or division** the project belongs to, and the
 * department id -> name mapping goes in a JSON file. More such files are
 * expected as requirements arrive, so they get one loader rather than a fetch
 * written into each caller.
 *
 * Rules for these files:
 *   - they are **static configuration**, served beside the widget from
 *     `js/data/<name>.json`, never platform data;
 *   - nothing secret goes in one: they are downloaded by the browser and
 *     readable by anyone who can open the widget;
 *   - each file is fetched once per widget load and cached here, including the
 *     in-flight promise, so ten callers cause one request.
 *
 * ## O-T2, observed and fixed (2026-10-08)
 *
 * The relative URL did **not** work, exactly as that open check feared:
 *
 *     GET https://<server>/3ddashboard/api/widget/js/data/forms/project-proposal.json
 *     404 Not Found
 *
 * The dashboard serves an Additional App through its own proxy, and UWA
 * **rewrites the markup's `src` and `href` attributes** to absolute URLs on the
 * widget's real host - which is why every `<script>` tag loads. It cannot
 * rewrite a URL built inside JavaScript, so a relative XHR path resolves
 * against the *proxied document* and asks the dashboard for a file only the
 * widget's own host has.
 *
 * The base is therefore resolved absolutely, in three steps:
 *
 *   1. `widget.getSettings().baseUrl` - UWA's own answer, right by
 *      construction, and what the original open item prescribed. It exists only
 *      inside a live widget runtime;
 *   2. the `src` of a script that **demonstrably loaded**. That property is an
 *      already-resolved absolute URL, so whatever host served it is a host that
 *      works. This covers a plain browser tab, and any host that is not a
 *      dashboard;
 *   3. the relative path, as before - degraded, but the widget still starts and
 *      only the configuration file fails, with the URL in the message.
 *
 * Step 1 comes first for a specific reason: if the dashboard ever serves the
 * module scripts through its proxy instead of rewriting them, step 2 would
 * derive the proxy's own base and reproduce exactly this 404.
 */
define('IRSTasks/services/ConfigService', [], function () {
    'use strict';

    /**
     * This widget's own root, absolute, with a trailing slash - or '' when it
     * cannot be determined, in which case the relative path is used and behaves
     * as before.
     *
     * Computed once, at load. Both lookups are wrapped: a widget that cannot
     * read its own script tags must still start, and then the only thing that
     * fails is the configuration file, with a message saying so.
     */
    var ROOT = (function () {
        // 1. UWA's own answer, when there is a widget runtime. It is the
        //    sanctioned one and it is right by construction, so it is tried
        //    first - but it exists only inside the dashboard
        try {
            if (typeof widget !== 'undefined' && widget &&
                    typeof widget.getSettings === 'function') {
                var settings = widget.getSettings() || {};
                var declared = settings.baseUrl || '';
                if (/^https?:\/\//i.test(declared)) {
                    return declared.replace(/\/+$/, '') + '/';
                }
            }
        } catch (ignoredUwa) { /* fall through to the script tag */ }

        // 2. a script that demonstrably loaded. Its `src` property is already
        //    resolved to an absolute URL, so whatever host served it is a host
        //    that works
        var src = '';
        try {
            if (document.currentScript && document.currentScript.src) {
                src = document.currentScript.src;
            }
        } catch (ignored) { src = ''; }

        if (!src) {
            // `currentScript` is null when a loader evals the source rather than
            // inserting a tag, so fall back to finding any of our own scripts
            try {
                var tags = document.getElementsByTagName('script');
                for (var i = tags.length - 1; i >= 0; i--) {
                    var candidate = tags[i].src || '';
                    if (candidate.indexOf('/IRSTasks/js/') >= 0) {
                        src = candidate;
                        break;
                    }
                }
            } catch (ignored2) { src = ''; }
        }

        // ".../WidgetPacket/IRSTasks/js/services/ConfigService.js" -> ".../IRSTasks/"
        // 3. nothing identifiable: keep the relative path. Degraded, but the
        //    widget still starts and only the config file fails, loudly
        var cut = src.indexOf('/js/');
        return cut > 0 ? src.slice(0, cut + 1) : '';
    }());

    var BASE = ROOT + 'js/data/';
    var cache = {};          // name -> Promise, resolved or in flight

    function load(name) {
        var url = BASE + name + '.json';
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.onload = function () {
                if (xhr.status < 200 || xhr.status >= 300) {
                    // the URL is in the message deliberately: the one failure
                    // this has actually had was a URL resolved against the
                    // wrong document, and the status alone did not show it
                    reject(new Error('Configuration ' + name + '.json could not be ' +
                                     'read (HTTP ' + xhr.status + ') from ' + url));
                    return;
                }
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    // a malformed config file is a development error, and saying
                    // which file it was is the whole value of this message
                    reject(new Error('Configuration ' + name + '.json is not valid ' +
                                     'JSON: ' + e.message));
                }
            };
            xhr.onerror = function () {
                reject(new Error('Configuration ' + name + '.json could not be ' +
                                 'reached at ' + url));
            };
            xhr.send();
        });
    }

    return {
        /**
         * @param {string} name  file name without the extension, e.g. "departments"
         * @returns {Promise<Object>}
         */
        get: function (name) {
            if (!cache[name]) {
                cache[name] = load(name).catch(function (err) {
                    // do not cache a failure: a redeploy during development
                    // should not need a dashboard reload to be picked up
                    delete cache[name];
                    throw err;
                });
            }
            return cache[name];
        },

        /**
         * The absolute base these files are read from, for diagnostics. Empty
         * means it could not be determined and the relative path is in use -
         * which is the state that produced the 404 of 2026-10-08.
         */
        baseUrl: function () { return BASE; },

        /** for tests, and for a deliberate reload after editing a file */
        _clear: function () { cache = {}; }
    };
});
