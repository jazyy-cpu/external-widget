/**
 * JazzySole TabulatorLoader - loads the Tabulator UMD bundle inside a UWA widget.
 *
 * Why a loader instead of a plain <script> tag:
 * tabulator.min.js is a UMD bundle whose second branch is
 *   typeof define === 'function' && define.amd ? define(factory) : global.Tabulator = factory()
 * A 3DDashboard widget always runs with an AMD loader present, so that branch
 * is taken and the anonymous define() raises
 *   "Mismatched anonymous define() module"
 * because the bundle was not requested through the loader. Bootstrap's JS was
 * avoided for the same reason (UWA rule C3); Tabulator cannot be avoided, so it
 * is loaded here with define.amd hidden for the duration of the load. The
 * bundle then takes its third branch and publishes window.Tabulator.
 *
 * define.amd is global, so it is hidden for as short a time as possible and
 * restored in both onload and onerror. Call load() once, early (the widget does
 * it while the credential spinner is up) and never in parallel with loading
 * another AMD module.
 *
 * Tabulator version: 6.5.3. The theme CSS (tabulator_bootstrap5.min.css) is a
 * plain <link> in the widget's HTML - CSS has no such problem.
 *
 * Usage:
 *   TabulatorLoader.load().then(function (Tabulator) { new Tabulator(el, opts); });
 */
(function () {
    'use strict';

    // Resolved while this file executes; document.currentScript is null later,
    // when the AMD factory below finally runs.
    var here = (document.currentScript && document.currentScript.src) || '';
    var base = here ? here.replace(/[^\/]*$/, '') : '../JazzySole/Tabulator/';

    define('JazzySole/TabulatorLoader', [], function () {

        var VERSION = '1.0.0';
        var TABULATOR_VERSION = '6.5.3';
        var SRC = base + 'js/tabulator.min.js';

        var pending = null;

        function hideAmd() {
            if (typeof define !== 'function' || !define.amd) { return undefined; }
            var amd = define.amd;
            try {
                delete define.amd;
            } catch (e) {
                define.amd = undefined;   // some loaders define it non-configurable
            }
            return amd;
        }

        function restoreAmd(amd) {
            if (amd === undefined || typeof define !== 'function') { return; }
            try { define.amd = amd; } catch (e) { /* nothing we can do, and nothing broken yet */ }
        }

        return {
            VERSION: VERSION,
            TABULATOR_VERSION: TABULATOR_VERSION,
            SRC: SRC,

            /** @returns {Promise<Function>} the Tabulator constructor (full build) */
            load: function () {
                if (window.Tabulator) { return Promise.resolve(window.Tabulator); }
                if (pending) { return pending; }

                pending = new Promise(function (resolve, reject) {
                    var script = document.createElement('script');
                    script.type = 'text/javascript';
                    script.async = false;
                    script.src = SRC;

                    var amd = hideAmd();

                    script.onload = function () {
                        restoreAmd(amd);
                        if (window.Tabulator) {
                            resolve(window.Tabulator);
                        } else {
                            reject(new Error('Tabulator loaded from ' + SRC +
                                ' but did not publish window.Tabulator'));
                        }
                    };
                    script.onerror = function () {
                        restoreAmd(amd);
                        pending = null;   // a network hiccup may be worth retrying
                        reject(new Error('Tabulator could not be loaded from ' + SRC));
                    };

                    document.head.appendChild(script);
                });
                return pending;
            }
        };
    });
}());
