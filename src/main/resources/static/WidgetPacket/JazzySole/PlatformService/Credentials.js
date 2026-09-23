/**
 * JazzySole Credentials - the user's 3DSpace credential (security context) for a UWA widget.
 *
 * Stored in the widget preference "xPref_CREDENTIAL", the same key the OOTB
 * apps use (DS/ENOXWidgetPreferences). 3DDashboard keeps widget preferences
 * server-side per user and widget instance, so the choice survives a
 * refresh, a dashboard reload and a login from another browser.
 *
 * init() first tries the OOTB module DS/ENOXWidgetPreferences. A widget
 * served from an external server may not be able to load it, so after a
 * timeout or a load error it falls back to the documented DS use case
 * "Credentials with Widget App": Get Me + widget.addPreference, same key,
 * same labels and order as the OOTB module.
 *
 * Usage and API: README.md in this folder.
 */
define('JazzySole/Credentials', [
    'DS/WAFData/WAFData',
    'DS/i3DXCompassPlatformServices/i3DXCompassPlatformServices'
], function (WAFData, CompassPlatformServices) {
    'use strict';

    var VERSION = '1.0.0';
    var KEY = 'xPref_CREDENTIAL';
    var OOTB_MODULE = 'DS/ENOXWidgetPreferences/js/ENOXWidgetPreferences';
    var OOTB_TIMEOUT_MS = 6000;
    var ADMIN_ROLE_PATTERN = /(3ddrestrictedowner|vplmprojectadministrator|vplmadmin)/i;

    var state = {
        source: null,        // "ootb" | "fallback"
        spaceUrl: null,      // 3DSpace base URL
        listeners: [],
        options: null        // [{ value, label }]
    };

    function platformId() {
        return widget.getValue('x3dPlatformId') || 'OnPremise';
    }

    // ---- 3DSpace URL ---------------------------------------------------

    function get3DSpaceUrl() {
        if (state.spaceUrl) { return Promise.resolve(state.spaceUrl); }
        return new Promise(function (resolve, reject) {
            CompassPlatformServices.getPlatformServices({
                platformId: platformId(),
                onComplete: function (data) {
                    var list = Array.isArray(data) ? data : [data];
                    var match = list.filter(function (p) { return p && p.platformId === platformId(); })[0] || list[0];
                    if (match && match['3DSpace']) {
                        state.spaceUrl = match['3DSpace'];
                        resolve(state.spaceUrl);
                    } else {
                        reject(new Error('3DSpace service not found for platform "' + platformId() + '"'));
                    }
                },
                onFailure: function (err) { reject(new Error('Platform services failed: ' + err)); }
            });
        });
    }

    // ---- OOTB path -----------------------------------------------------

    function loadOotb() {
        return new Promise(function (resolve, reject) {
            var done = false;
            var timer = setTimeout(function () {
                if (!done) { done = true; reject(new Error('OOTB module not loaded within ' + OOTB_TIMEOUT_MS + ' ms')); }
            }, OOTB_TIMEOUT_MS);
            require([OOTB_MODULE], function (ENOXWidgetPreferences) {
                if (done) { return; }
                ENOXWidgetPreferences.addCredentialPreferenceToWidget().then(function () {
                    if (done) { return; }
                    done = true; clearTimeout(timer); resolve();
                }, function (err) {
                    if (done) { return; }
                    done = true; clearTimeout(timer);
                    reject(new Error((err && err.message) || 'OOTB credential preference failed'));
                });
            }, function (err) {
                if (done) { return; }
                done = true; clearTimeout(timer);
                reject(new Error('OOTB module could not be loaded: ' + ((err && err.message) || err)));
            });
        });
    }

    // ---- fallback path (DS use case "Credentials with Widget App") -----

    function getMe(spaceUrl) {
        return new Promise(function (resolve, reject) {
            var url = spaceUrl + '/resources/modeler/pno/person?current=true&select=collabspaces' +
                '&tenant=' + encodeURIComponent(platformId()) + '&timestamp=' + Date.now();
            WAFData.authenticatedRequest(url, {
                method: 'GET',
                type: 'json',
                headers: widget.lang ? { 'Accept-Language': widget.lang } : {},
                timeout: 15000,
                onComplete: resolve,
                onFailure: function (err) { reject(new Error('Get Me failed: ' + err)); },
                onTimeout: function () { reject(new Error('Get Me timed out')); }
            });
        });
    }

    /** Same values, labels and order as DS/ENOXWidgetPreferences. */
    function buildOptions(me) {
        var spaces = (me && Array.isArray(me.collabspaces)) ? me.collabspaces : [];
        var orgs = {};
        spaces.forEach(function (cs) {
            (cs.couples || []).forEach(function (c) { if (c.organization) { orgs[c.organization.name] = true; } });
        });
        var severalOrgs = Object.keys(orgs).length > 1;
        var regular = [], admin = [];
        spaces.forEach(function (cs) {
            (cs.couples || []).forEach(function (c) {
                if (!c.role || !c.organization) { return; }
                var roleLabel = c.role.nls || c.role.name;
                var orgLabel = c.organization.title || c.organization.name;
                var csLabel = cs.title || cs.name;
                var option = {
                    value: c.role.name + '.' + c.organization.name + '.' + cs.name,
                    label: severalOrgs ? csLabel + ' ● ' + orgLabel + ' ● ' + roleLabel
                                       : csLabel + ' ● ' + roleLabel
                };
                (ADMIN_ROLE_PATTERN.test(c.role.name) ? admin : regular).push(option);
            });
        });
        var byLabel = function (a, b) { return a.label.localeCompare(b.label, widget.lang || 'en', { ignorePunctuation: true }); };
        return regular.sort(byLabel).concat(admin.sort(byLabel));
    }

    function loadFallback() {
        return get3DSpaceUrl().then(getMe).then(function (me) {
            var options = buildOptions(me);
            if (!options.length) { throw new Error('No credentials assigned to the current user.'); }
            var stored = widget.getValue(KEY);
            var valid = options.some(function (o) { return o.value === stored; });
            widget.addPreference({ name: KEY, type: 'list', label: 'Credentials', options: options,
                                   defaultValue: valid ? stored : options[0].value });
            if (!valid) { widget.setValue(KEY, options[0].value); }
        });
    }

    // ---- public API ----------------------------------------------------

    function readOptions() {
        var pref = widget.getPreference(KEY);
        return (pref && Array.isArray(pref.options)) ? pref.options.map(function (o) {
            return { value: o.value, label: o.label || o.value };
        }) : [];
    }

    var Credentials = {
        VERSION: VERSION,
        KEY: KEY,

        /**
         * Create or refresh the credential preference and make sure a valid
         * credential is active. Call on every onLoad and onRefresh.
         * @returns {Promise<{source, value, label, spaceUrl}>}
         */
        init: function () {
            return get3DSpaceUrl().then(function () {
                return loadOotb().then(function () { state.source = 'ootb'; }, function (err) {
                    if (typeof console !== 'undefined') {
                        console.info('[JazzySole/Credentials] OOTB path not used, fallback: ' + err.message);
                    }
                    state.source = 'fallback';
                    return loadFallback();
                });
            }).then(function () {
                state.options = readOptions();
                if (!Credentials.get()) { throw new Error('No credential is active.'); }
                return Credentials.info();
            });
        },

        /** Raw value "role.organization.collabspace", or "" */
        get: function () { return widget.getValue(KEY) || ''; },

        /** Value for the SecurityContext header / parameter: "ctx::role.organization.collabspace" */
        getSecurityContext: function () {
            var v = Credentials.get();
            return v ? 'ctx::' + v : '';
        },

        /** Display label of the active credential */
        getLabel: function () {
            var v = Credentials.get();
            var match = (state.options || readOptions()).filter(function (o) { return o.value === v; })[0];
            return match ? match.label : v;
        },

        /** All credentials of the user: [{ value, label }] */
        list: function () { return (state.options || readOptions()).slice(); },

        /** Make another credential active. Rejects values that are not in the list. */
        set: function (value) {
            var known = Credentials.list().some(function (o) { return o.value === value; });
            if (!known) { return Promise.reject(new Error('Unknown credential: ' + value)); }
            var previous = Credentials.get();
            if (value === previous) { return Promise.resolve(Credentials.info()); }
            widget.setValue(KEY, value);
            var now = Credentials.info();
            state.listeners.slice().forEach(function (fn) { fn(now, previous); });
            return Promise.resolve(now);
        },

        /** fn(info, previousValue) after set(). Returns an unsubscribe function. */
        onChange: function (fn) {
            state.listeners.push(fn);
            return function () {
                var i = state.listeners.indexOf(fn);
                if (i >= 0) { state.listeners.splice(i, 1); }
            };
        },

        /** { source, value, label, spaceUrl } */
        info: function () {
            return { source: state.source, value: Credentials.get(), label: Credentials.getLabel(), spaceUrl: state.spaceUrl };
        },

        get3DSpaceUrl: get3DSpaceUrl,

        /** for tests only */
        _buildOptions: buildOptions
    };

    return Credentials;
});
