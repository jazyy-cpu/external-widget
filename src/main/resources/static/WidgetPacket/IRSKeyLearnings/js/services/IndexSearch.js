/**
 * The 3DSpace search index, read through the platform's federated search
 * (WGT-11 api.md section 2).
 *
 *   POST <server root>/federated/search?tenant=...
 *
 * The index - not the database - answers every read of this widget (WP11 D4,
 * revised 2026-10-25): it is built for exactly this kind of filtered,
 * paged listing, so a wide date range costs the search server a query and not
 * the 3DSpace kernel a join per row.
 *
 * Three things to know:
 *
 *   - federated search lives at the SERVER ROOT, not under /3dspace
 *     (technical note 2026-09-26 section 6). The root is derived from the
 *     3DSpace URL the credential library already resolved;
 *   - it applies the caller's security, so a user lists only what their
 *     SecurityContext may read. The context goes in the body (`login`) as
 *     well as in the query string JazzySole/Request adds;
 *   - it pages. `searchAll` asks page after page and stops at a ceiling, so
 *     no call can pull an unbounded result into the browser.
 *
 * All calls go through JazzySole/Request (rule R3). It is a POST, so Request
 * holds a CSRF token for it; the search does not need one, and carrying it is
 * harmless.
 */
define('IRSKeyLearnings/services/IndexSearch', [
    'JazzySole/Request',
    'JazzySole/Credentials'
], function (Request, Credentials) {
    'use strict';

    /** "https://host/3dspace" -> "https://host/federated/search" */
    function searchUrl(spaceUrl) {
        var m = /^(https?:\/\/[^\/]+)/i.exec(String(spaceUrl || ''));
        if (!m) { throw new Error('The 3DSpace address is not known, so the index cannot be searched.'); }
        return m[1] + '/federated/search';
    }

    /**
     * One hit -> {predicate: [values]}, keys LOWER-CASED.
     *
     * The index reports custom field names in lower case
     * (`irs_learning_text`) while the request spells them as configured
     * (`IRS_LEARNING_TEXT`), so lookups are made case-insensitive here, once.
     * A multi-valued field (`ownership`) may come as repeated entries or as an
     * array value; both end up as one list.
     */
    function flatten(result) {
        var out = {};
        function put(key, value) {
            if (!out[key]) { out[key] = []; }
            (Array.isArray(value) ? value : [value]).forEach(function (v) {
                if (v !== undefined && v !== null && String(v) !== '') { out[key].push(String(v)); }
            });
        }
        function add(name, value) {
            if (!name) { return; }
            var key = String(name).toLowerCase();
            put(key, value);
            // "ds6w:when/ds6w:created" is also filed as "ds6w:created", so a
            // reader asks for one name whichever form the server used - unless
            // the short form came back on its own, which then wins
            var slash = key.lastIndexOf('/');
            if (slash >= 0 && !(key.slice(slash + 1) in out)) { put(key.slice(slash + 1), value); }
        }
        var attrs = (result && result.attributes) || [];
        if (Array.isArray(attrs)) {
            attrs.forEach(function (a) { if (a) { add(a.name, a.value); } });
        } else {
            Object.keys(attrs).forEach(function (k) { add(k, attrs[k]); });
        }
        return out;
    }

    /** First value of a flattened field, or ''. */
    function first(hit, name) {
        var list = hit[String(name).toLowerCase()];
        return list && list.length ? list[0] : '';
    }

    /** Every value of a flattened field. */
    function all(hit, name) {
        return (hit[String(name).toLowerCase()] || []).slice();
    }

    /** The total the server reports, under whichever name this release uses. */
    function total(body) {
        var infos = (body && body.infos) || {};
        var n = Number(infos.nmatches !== undefined ? infos.nmatches :
            (infos.nhits !== undefined ? infos.nhits : infos.nresults));
        return isFinite(n) ? n : -1;
    }

    function body(query, predicates, start, size) {
        var ctx = Credentials.getSecurityContext();
        return {
            query: query,
            select_predicate: predicates,
            start: start,
            nresults: size,
            // label order is the one this payload is verified with (JBM
            // collection); paging needs A stable order, not a meaningful one -
            // the grid sorts for display
            order_field: 'ds6w:label',
            order_by: 'asc',
            source: ['3dspace'],
            tenant: widget.getValue('x3dPlatformId') || 'OnPremise',
            login: { '3dspace': { SecurityContext: ctx } },
            locale: widget.lang || 'en',
            with_indexing_date: false,
            with_synthesis: false,
            with_nls: false,
            label: 'IRSKeyLearnings'
        };
    }

    var IndexSearch = {
        _flatten: flatten,
        _searchUrl: searchUrl,
        _total: total,
        first: first,
        all: all,

        /**
         * One page.
         * @returns {Promise<{hits: Array, total: number}>}
         */
        page: function (query, predicates, start, size) {
            return Credentials.get3DSpaceUrl().then(function (spaceUrl) {
                return Request.send(searchUrl(spaceUrl), {
                    method: 'POST',
                    data: body(query, predicates, start, size),
                    timeout: 60000
                });
            }).then(function (response) {
                var results = (response && response.results) || [];
                return { hits: results.map(flatten), total: total(response) };
            });
        },

        /**
         * Every page, up to `max` hits.
         *
         * Stops when a page comes back short, when the server's total is
         * reached, or at `max` - whichever is first. `truncated` says the
         * last one happened, so the caller can tell the user instead of
         * showing a partial list as if it were complete.
         *
         * @returns {Promise<{hits: Array, total: number, truncated: boolean}>}
         */
        searchAll: function (query, predicates, pageSize, max) {
            var hits = [];
            var known = -1;
            function next(start) {
                var size = Math.min(pageSize, max - hits.length);
                return IndexSearch.page(query, predicates, start, size).then(function (p) {
                    if (p.total >= 0) { known = p.total; }
                    Array.prototype.push.apply(hits, p.hits);
                    var more = p.hits.length === size && (known < 0 || hits.length < known);
                    if (more && hits.length < max) { return next(start + p.hits.length); }
                    return {
                        hits: hits,
                        total: known,
                        truncated: hits.length >= max && (known < 0 ? p.hits.length === size : known > hits.length)
                    };
                });
            }
            return next(0);
        },

        /**
         * A lookup by a list of keys, in chunks of `chunk`, one query per
         * chunk, one after the other. Used for projects and persons: their
         * number is bounded by the learnings already read, never by the
         * database.
         *
         * @param {Array<string>} keys    distinct ids or logins
         * @param {Function} toQuery      keys -> query string
         * @returns {Promise<Array>} every hit of every chunk
         */
        lookup: function (keys, toQuery, predicates, chunk) {
            var out = [];
            var groups = [];
            for (var i = 0; i < keys.length; i += chunk) { groups.push(keys.slice(i, i + chunk)); }
            return groups.reduce(function (done, group) {
                return done.then(function () {
                    return IndexSearch.page(toQuery(group), predicates, 0, group.length * 2)
                        .then(function (p) { Array.prototype.push.apply(out, p.hits); });
                });
            }, Promise.resolve()).then(function () { return out; });
        }
    };

    return IndexSearch;
});
