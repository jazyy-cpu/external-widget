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
 * Open check (O-T2): the dashboard serves an Additional App through its own
 * proxy, so a relative URL is resolved against the proxied document. The module
 * scripts load this way already, which is good evidence it holds for XHR too -
 * but it has not been observed yet. If it fails, the fix is a URL built from
 * `widget.getSettings().baseUrl` rather than a relative path.
 */
define('IRSTasks/services/ConfigService', [], function () {
    'use strict';

    var BASE = 'js/data/';
    var cache = {};          // name -> Promise, resolved or in flight

    function load(name) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', BASE + name + '.json', true);
            xhr.onload = function () {
                if (xhr.status < 200 || xhr.status >= 300) {
                    reject(new Error('Configuration ' + name + '.json could not be ' +
                                     'read (HTTP ' + xhr.status + ').'));
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
                reject(new Error('Configuration ' + name + '.json could not be reached.'));
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

        /** for tests, and for a deliberate reload after editing a file */
        _clear: function () { cache = {}; }
    };
});
