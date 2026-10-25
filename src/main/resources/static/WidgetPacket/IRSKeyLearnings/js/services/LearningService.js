/**
 * The Key Learnings register, assembled from the search index (WGT-11).
 *
 * Three index searches, whatever the number of rows - nothing per learning,
 * nothing per project, no database call and no code of ours on the server:
 *
 *   1. the learnings originated in the range, paged, at most MAX_ROWS. Each
 *      carries its origin project's name, number and id (our
 *      IRS_LEARNING_PROJECT* index fields);
 *   2. those projects, by id, chunked - each carries its manager
 *      (`ds6w:responsible`, the owner's full name) and its members
 *      (`ownership`, one `<login>_PRJ` entry per member);
 *   3. those members, by login, chunked - for their full names.
 *
 * Two facts the screen must not blur, because both are true of real data:
 *
 *   - a learning with NO origin project is legitimate (WP02 doc 08 §3) - its
 *     project columns stay empty;
 *   - a learning the user may read whose PROJECT they may not read is also
 *     real: the index then returns no project for that id. The row says
 *     "no access to the project" rather than leaving blanks that look like
 *     "no manager".
 *
 * The index is a copy. A change to a project reaches this register when the
 * index re-crawls it - normally on modify, but it is not the database.
 */
define('IRSKeyLearnings/services/LearningService', [
    'IRSKeyLearnings/services/IndexSearch',
    'IRSKeyLearnings/config/LearningFields'
], function (IndexSearch, Fields) {
    'use strict';

    var first = IndexSearch.first;
    var all = IndexSearch.all;

    var NO_ACCESS = 'no access to the project';

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    /** "2026-10-23T05:34:47Z" -> local {day: "2026-10-23", time: "11:04"} */
    function localWhen(iso) {
        var d = new Date(iso);
        if (!iso || isNaN(d.getTime())) { return { day: '', time: '' }; }
        return {
            day: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
            time: pad(d.getHours()) + ':' + pad(d.getMinutes())
        };
    }

    /** "IRSLearning.Active" -> "Active" */
    function stateOf(status) {
        var s = String(status || '');
        return s.indexOf('.') >= 0 ? s.slice(s.lastIndexOf('.') + 1) : s;
    }

    function distinct(list) {
        var seen = {};
        return list.filter(function (v) {
            if (!v || seen[v]) { return false; }
            seen[v] = true;
            return true;
        });
    }

    /**
     * When the learning was originated, as an ISO instant. `ds6w:created` is
     * ISO already; the native `originated` is "2026/10/23 05:34:47" in UTC
     * (measured on the index, 2026-10-25), so it is marked as UTC here.
     */
    function createdOf(hit) {
        var iso = first(hit, 'ds6w:created');
        if (iso) { return iso; }
        var m = /^(\d{4})\/(\d{2})\/(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(first(hit, 'originated'));
        return m ? m[1] + '-' + m[2] + '-' + m[3] + 'T' + (m[4] || '00') + ':' + (m[5] || '00') +
            ':' + (m[6] || '00') + 'Z' : '';
    }

    /** Policy state: the 6W status "IRSLearning.Active", else the native `current`. */
    function stateField(hit) {
        return stateOf(first(hit, 'ds6w:status')) || first(hit, 'current');
    }

    /** A learning hit -> the row's own half. */
    function learningPart(hit) {
        var when = localWhen(createdOf(hit));
        return {
            id: first(hit, 'physicalid'),
            no: first(hit, 'ds6w:identifier'),
            title: first(hit, 'ds6w:label'),
            text: first(hit, 'ds6wg:IRS_LEARNING_TEXT'),
            state: stateField(hit),
            author: first(hit, 'ds6w:responsible'),
            originatedDate: when.day,
            originatedTime: when.time,
            projectKey: first(hit, 'ds6wg:IRS_LEARNING_PROJECT_ID'),
            projectName: first(hit, 'ds6wg:IRS_LEARNING_PROJECT'),
            projectNo: first(hit, 'ds6wg:IRS_LEARNING_PROJECT_NO')
        };
    }

    /** A project hit -> {key, physicalId, manager, managerLogin, members: [logins]} */
    function projectPart(hit) {
        return {
            key: first(hit, 'mxid'),
            physicalId: first(hit, 'physicalid'),
            name: first(hit, 'name') || first(hit, 'ds6w:label'),
            projectNo: first(hit, 'ds6wg:EPMProjectNo'),
            state: stateField(hit),
            managerName: first(hit, 'ds6w:responsible'),
            managerLogin: first(hit, 'ds6w:responsibleUid') || first(hit, 'owner'),
            members: distinct(all(hit, 'ownership').map(Fields.memberLogin))
        };
    }

    /**
     * Join the three answers into flat grid rows. Pure, so the whole join is
     * unit-tested without a platform.
     *
     * Flat on purpose: Tabulator's search, sort and DOWNLOAD read row fields,
     * and a nested object or array would export as "[object Object]".
     */
    function assemble(learningHits, projectHits, personHits) {
        var projects = {};
        projectHits.map(projectPart).forEach(function (p) { if (p.key) { projects[p.key] = p; } });
        var names = {};
        personHits.forEach(function (h) {
            var login = first(h, 'name');
            if (login) { names[login] = first(h, 'ds6wg:fullname') || login; }
        });

        var rows = learningHits.map(function (hit) {
            var row = learningPart(hit);
            var p = row.projectKey ? projects[row.projectKey] : null;
            row.hasProject = !!row.projectKey;
            row.projectAccess = !row.projectKey || !!p;
            row.projectId = p ? p.physicalId : '';
            if (p) {
                // the project's own document is the fresher copy of its name
                row.projectName = p.name || row.projectName;
                row.projectNo = p.projectNo || row.projectNo;
                row.managerName = p.managerName || names[p.managerLogin] || p.managerLogin;
                var people = p.members.map(function (login) { return names[login] || login; });
                people.sort(function (a, b) { return a.localeCompare(b); });
                row.membersText = people.join(', ');
                row.memberCount = people.length;
            } else {
                row.managerName = row.hasProject ? NO_ACCESS : '';
                row.membersText = row.hasProject ? NO_ACCESS : '';
                row.memberCount = 0;
            }
            return row;
        });

        // newest first; the grid can re-sort
        rows.sort(function (a, b) {
            var x = a.originatedDate + ' ' + a.originatedTime;
            var y = b.originatedDate + ' ' + b.originatedTime;
            return x < y ? 1 : (x > y ? -1 : 0);
        });
        return rows;
    }

    return {
        NO_ACCESS: NO_ACCESS,
        _assemble: assemble,
        _projectPart: projectPart,
        _localWhen: localWhen,
        _createdOf: createdOf,

        /**
         * @param {{from: string, to: string}} range  yyyy-mm-dd, both required
         * @returns {Promise<{rows, truncated, total, searches}>}
         *   `searches` = how many index calls were made, for the devlog and
         *   the tests, not for the screen
         */
        list: function (range) {
            var r = range || {};
            var problem = Fields.rangeError(r.from, r.to);
            if (problem) { return Promise.reject(new Error(problem)); }
            var bounds = Fields.indexBounds(r.from, r.to);
            var calls = 0;
            var learnings = null;
            var projects = [];

            return IndexSearch.searchAll(Fields.learningQuery(bounds), Fields.LEARNING_PREDICATES,
                    Fields.PAGE_SIZE, Fields.MAX_ROWS).then(function (result) {
                learnings = result;
                calls += Math.max(1, Math.ceil(result.hits.length / Fields.PAGE_SIZE));
                var keys = distinct(result.hits.map(function (h) {
                    return first(h, 'ds6wg:IRS_LEARNING_PROJECT_ID');
                }));
                if (!keys.length) { return []; }
                calls += Math.ceil(keys.length / Fields.ID_CHUNK);
                return IndexSearch.lookup(keys, Fields.projectQuery, Fields.PROJECT_PREDICATES,
                    Fields.ID_CHUNK);
            }).then(function (projectHits) {
                projects = projectHits;
                var logins = [];
                projectHits.map(projectPart).forEach(function (p) {
                    Array.prototype.push.apply(logins, p.members);
                    // the manager's login too: if the 6W responsible does not
                    // come back, the full name still comes from the person
                    if (p.managerLogin) { logins.push(p.managerLogin); }
                });
                logins = distinct(logins);
                if (!logins.length) { return []; }
                calls += Math.ceil(logins.length / Fields.ID_CHUNK);
                return IndexSearch.lookup(logins, Fields.personQuery, Fields.PERSON_PREDICATES,
                    Fields.ID_CHUNK);
            }).then(function (personHits) {
                return {
                    rows: assemble(learnings.hits, projects, personHits),
                    truncated: learnings.truncated,
                    total: learnings.total,
                    searches: calls
                };
            });
        }
    };
});
