/**
 * The one file to edit when the Key Learnings register changes (WGT-11).
 *
 * Everything here is a decision recorded in WP11, not a preference: the
 * columns are the user's list of 2026-10-25, the date filtered on is the
 * learning's date originated (D3), the data comes from the search index and
 * not from the database (D4, revised 2026-10-25), a date range is required
 * before anything is read (D8), and the export formats are the ones Tabulator
 * offers with no extra library (D5).
 */
define('IRSKeyLearnings/config/LearningFields', [], function () {
    'use strict';

    // ---- what is read from the index (proven on the VM, 2026-10-25) -----

    /**
     * The 6W predicates of a learning. The ds6wg:IRS_LEARNING_* fields are our
     * searchindexcustom entries (INT-011), the spelling WP08's search columns
     * already use; the origin project comes with them through a traversal
     * select, so one search returns the learning AND its project's identity.
     */
    var LEARNING_PREDICATES = [
        'physicalid', 'ds6w:identifier', 'ds6w:label',
        // FEDERATED SEARCH NAMES THE 6W WHEN / WHAT / WHO FIELDS BY PATH
        // (`ds6w:when/ds6w:created`), not by the short name the index API
        // shows. The short names came back empty in the first dashboard run
        // (2026-10-25: Date Originated and State blank, members filled);
        // IRSAnnualMonitoring reads the path form on live data. Both forms
        // are asked, plus the native `originated` / `current`, which this
        // search does return (native `ownership` arrived).
        'ds6w:when/ds6w:created', 'ds6w:what/ds6w:status', 'ds6w:who/ds6w:responsible',
        'ds6w:created', 'ds6w:status', 'ds6w:responsible', 'originated', 'current',
        'ds6wg:IRS_LEARNING_TEXT', 'ds6wg:IRS_LEARNING_PROJECT',
        'ds6wg:IRS_LEARNING_PROJECT_NO', 'ds6wg:IRS_LEARNING_PROJECT_ID'
    ];

    /**
     * The project's index document carries its manager - `ds6w:responsible` is
     * the owner's full name (WP11 D2) - and its members: Program Central gives
     * every member a `<login>_PRJ | Multiple Ownership For Object` entry in
     * `ownership`. Compared against the Member connections of both test
     * projects on 2026-10-25: identical, 5 of 5 and 8 of 8.
     */
    var PROJECT_PREDICATES = [
        'physicalid', 'mxid', 'name', 'ds6w:label',
        'ds6w:who/ds6w:responsible', 'ds6w:responsible', 'ds6w:responsibleUid', 'owner',
        'ds6w:what/ds6w:status', 'ds6w:status', 'current', 'ds6wg:EPMProjectNo', 'ownership'
    ];

    var PERSON_PREDICATES = ['physicalid', 'name', 'ds6wg:fullname'];

    /** The policy IRSLearning: Draft -> Active -> Obsolete (WP02 doc 08 §3). */
    var STATE_BADGE = {
        'Draft': 'secondary',
        'Active': 'success',
        'Obsolete': 'dark'
    };

    // ---- the size guards (the user's concern of 2026-10-25) --------------

    /** One search page. The index serves pages; the widget asks for them in turn. */
    var PAGE_SIZE = 200;

    /**
     * The most learnings one view may hold. Past this the widget stops reading
     * and says so, asking for a shorter range, instead of loading everything
     * into the browser. A register this size is already more than a person
     * reads on one screen.
     */
    var MAX_ROWS = 2000;

    /** Ids per lookup query, so no query string grows without bound. */
    var ID_CHUNK = 50;

    /**
     * The columns the free-text search looks in - every text column the grid
     * shows, so "search" means what the user sees, as Figure-35's box does.
     */
    var SEARCH_KEYS = ['no', 'title', 'text', 'projectName', 'projectNo',
        'managerName', 'membersText', 'state'];

    /**
     * Export formats offered. CSV only: JSON and HTML are built into Tabulator
     * too but are not wanted (user, 2026-10-25). XLSX and PDF need SheetJS /
     * jsPDF vendored first - WP11 L3, WP03 doc 02 D11.
     */
    var EXPORTS = [
        { format: 'csv', label: 'CSV', extension: 'csv' }
    ];

    var FILE_BASE = 'key-learnings';

    var ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

    /** yyyy-mm-dd -> a Date at LOCAL midnight, or null. */
    function localMidnight(day) {
        if (!ISO_DAY.test(day || '')) { return null; }
        var p = day.split('-');
        var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 0, 0, 0, 0);
        // 2026-02-31 rolls over to March: refuse it rather than search March
        if (d.getFullYear() !== Number(p[0]) || d.getMonth() !== Number(p[1]) - 1 ||
                d.getDate() !== Number(p[2])) { return null; }
        return d;
    }

    /**
     * Check a From / To pair. BOTH are required (WP11 D8): an open range is
     * how a register of years of learnings would be read in one go.
     *
     * @returns {string} an error sentence, or '' when the pair is usable
     */
    function rangeError(from, to) {
        var f = (from || '').trim();
        var t = (to || '').trim();
        if (!f || !t) { return 'Choose a From and a To date to show the key learnings.'; }
        if (!localMidnight(f)) { return 'The From date is not a valid date.'; }
        if (!localMidnight(t)) { return 'The To date is not a valid date.'; }
        // ISO dates compare correctly as strings
        if (t < f) { return 'The To date is before the From date.'; }
        return '';
    }

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    /** A Date as the index stores `originated`: UTC, "yyyy/MM/dd HH:mm:ss". */
    function indexTime(date) {
        return date.getUTCFullYear() + '/' + pad(date.getUTCMonth() + 1) + '/' +
            pad(date.getUTCDate()) + ' ' + pad(date.getUTCHours()) + ':' +
            pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds());
    }

    /**
     * The user's days as the index's UTC bounds.
     *
     * The index stores `originated` in UTC (LRN-0000003: 11:04 IST in the
     * database, "2026/10/23 05:34:47" in the index). Comparing against bare
     * days would put a learning written before 05:30 IST on the previous day.
     * So the range is the user's LOCAL midnight of From up to, not including,
     * local midnight after To - measured to the second on the index.
     *
     * @returns {{start: string, end: string}} or null for an unusable pair
     */
    function indexBounds(from, to) {
        if (rangeError(from, to)) { return null; }
        var start = localMidnight(from.trim());
        var end = localMidnight(to.trim());
        end.setDate(end.getDate() + 1);
        return { start: indexTime(start), end: indexTime(end) };
    }

    /** A value inside a quoted index query term. */
    function quote(value) {
        return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }

    /** The learnings query. The bounds are built here, never typed by the user. */
    function learningQuery(bounds) {
        return 'flattenedtaxonomies:"types/IRSLearning"' +
            ' AND originated>=' + quote(bounds.start) +
            ' AND originated<' + quote(bounds.end);
    }

    /** Projects by legacy id, the form IRS_LEARNING_PROJECT_ID holds. */
    function projectQuery(ids) {
        return 'mxid:(' + ids.map(quote).join(' OR ') + ')';
    }

    /** Persons by login, the form `ownership` names them in. */
    function personQuery(logins) {
        return 'flattenedtaxonomies:"types/Person" AND name:(' + logins.map(quote).join(' OR ') + ')';
    }

    /** "-|IPLT_User29_PRJ|Multiple Ownership For Object" -> "IPLT_User29", else ''. */
    function memberLogin(ownershipEntry) {
        var m = /^-\|(.+)_PRJ\|Multiple Ownership For Object$/.exec(String(ownershipEntry || '').trim());
        return m ? m[1] : '';
    }

    /** The download file name, carrying the range so two exports differ. */
    function fileName(from, to, extension) {
        return FILE_BASE + '_' + (from || 'start') + '_to_' + (to || 'end') + '.' + extension;
    }

    return {
        LEARNING_PREDICATES: LEARNING_PREDICATES,
        PROJECT_PREDICATES: PROJECT_PREDICATES,
        PERSON_PREDICATES: PERSON_PREDICATES,
        STATE_BADGE: STATE_BADGE,
        PAGE_SIZE: PAGE_SIZE,
        MAX_ROWS: MAX_ROWS,
        ID_CHUNK: ID_CHUNK,
        SEARCH_KEYS: SEARCH_KEYS,
        EXPORTS: EXPORTS,
        rangeError: rangeError,
        indexBounds: indexBounds,
        learningQuery: learningQuery,
        projectQuery: projectQuery,
        personQuery: personQuery,
        memberLogin: memberLogin,
        fileName: fileName
    };
});
