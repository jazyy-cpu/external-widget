/**
 * JazzySole Credentials - the user's 3DSpace credential (security context) for a UWA widget.
 *
 * Stored in the widget preference "xPref_CREDENTIAL" - deliberately the same
 * key the OOTB apps use - and built from Get Me + widget.addPreference, the
 * documented DS use case "Credentials with Widget App". 3DDashboard keeps
 * widget preferences server-side per user and widget instance, so the choice
 * survives a refresh, a dashboard reload and a login from another browser.
 *
 * Why there is no DS/ENOXWidgetPreferences path here (removed in 1.1.0):
 * an external widget cannot load a DS/<app>/... module at all. The dashboard
 * proxies the widget, so the AMD loader's base is the widget's own package
 * root and a DS/ id is looked for inside our served directory, where it does
 * not exist. It was measured on 2026-09-24: every variant requireDs tries
 * returns 404 and the OOTB branch could never succeed. See UWA rule C6 in
 * docs/reference/uwa-rules-and-libraries.md and WGT-03 section 6.
 *
 * The OOTB preference KEY is kept on purpose: values, labels and ordering
 * match DS/ENOXWidgetPreferences, so our widget and the OOTB apps stay
 * interchangeable on the same dashboard.
 *
 * Usage and API: README.md in this folder.
 */
define('JazzySole/Credentials', [
    'DS/WAFData/WAFData',
    'DS/i3DXCompassPlatformServices/i3DXCompassPlatformServices'
], function (WAFData, CompassPlatformServices) {
    'use strict';

    var VERSION = '1.1.0';
    var KEY = 'xPref_CREDENTIAL';
    /**
     * Roles that must NOT become the default credential, listed at the bottom of
     * the picker. The first option in the list is what becomes active when the
     * user has nothing stored yet, so an administrator credential must never
     * happen to sort first.
     *
     * This is an ORDERING rule, not a registration list. A role that is not
     * matched here still appears in the picker - every credential the user holds
     * is always offered. Adding a new role to the system needs no change here;
     * add one only when it should be pushed to the bottom (a read-only role is
     * the likely next candidate, for the same reason: nobody should silently
     * default into a context where they cannot work).
     *
     * The three names below are exactly the set `DS/ENOXWidgetPreferences` uses,
     * so our order matches the OOTB apps that share this preference. Anything
     * added beyond them is our own divergence - see the README next to this file.
     * Case-insensitive because the real names are mixed case (`VPLMAdmin`).
     */
    var ADMIN_ROLE_PATTERN = /(3ddrestrictedowner|vplmprojectadministrator|vplmadmin)/i;

    var state = {
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

    // ---- building the preference ---------------------------------------

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

    function loadPreference() {
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
         * @returns {Promise<{value, label, spaceUrl}>}
         */
        init: function () {
            return loadPreference().then(function () {
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

        /** { value, label, spaceUrl } */
        info: function () {
            return { value: Credentials.get(), label: Credentials.getLabel(), spaceUrl: state.spaceUrl };
        },

        get3DSpaceUrl: get3DSpaceUrl,

        /** for tests only */
        _buildOptions: buildOptions
    };

    return Credentials;
});
