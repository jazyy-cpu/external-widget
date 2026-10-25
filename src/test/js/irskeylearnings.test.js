// Run: node src/test/js/irskeylearnings.test.js   (from external-widget/)
//
// The Key Learnings register widget (WGT-11). Pure logic and the widget's own
// wiring - no DOM, no platform. The fixtures are the REAL index values read on
// the VM on 2026-10-25 (search API port 19010): LRN-0000001..3, their two
// origin projects with their `ownership` entries, and the member persons.
//
// The timezone is pinned to India, because the one subtle rule here - the
// user's local day turned into the index's UTC bounds - only shows its teeth
// away from UTC.
'use strict';
process.env.TZ = 'Asia/Kolkata';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '../../main/resources/static/WidgetPacket/IRSKeyLearnings');
const file = (rel) => path.join(base, rel);

function load(f, deps) {
  let mod;
  const define = (name, d, fn) => { mod = fn.apply(null, deps); };
  new Function('define', fs.readFileSync(f, 'utf8'))(define);
  return mod;
}

global.widget = {
  lang: 'en',
  _prefs: { x3dPlatformId: 'OnPremise' },
  getValue(k) { return this._prefs[k]; },
  setValue(k, v) { this._prefs[k] = v; }
};

const Fields = load(file('js/config/LearningFields.js'), []);

// ---- a fake index behind a fake JazzySole/Request -----------------------
const Credentials = {
  get3DSpaceUrl: () => Promise.resolve('https://3dexperience2024x.solize.com/3dspace'),
  getSecurityContext: () => 'ctx::VPLMProjectLeader.Company Name.Hydrodynamics and Multiphysics'
};
const Request = {
  calls: [],
  handler: null,
  send(url, opts) { Request.calls.push({ url, opts }); return Request.handler(url, opts); }
};
const IndexSearch = load(file('js/services/IndexSearch.js'), [Request, Credentials]);
const Service = load(file('js/services/LearningService.js'), [IndexSearch, Fields]);

/** attributes the way federated search returns them: [{name, value}] */
const hit = (obj) => ({
  attributes: [].concat(...Object.keys(obj).map(k =>
    (Array.isArray(obj[k]) ? obj[k] : [obj[k]]).map(v => ({ name: k, value: v }))))
});

// --- the VM's index, 2026-10-25 -------------------------------------------
const LEARNINGS = [
  hit({ physicalid: '2937BDD700002CF46ADAF1F70000082A', 'ds6w:identifier': 'LRN-0000003',
        'ds6w:label': 'Learing -XY', 'ds6w:status': 'IRSLearning.Active',
        'ds6w:created': '2026-10-23T05:34:47Z', 'ds6w:responsible': 'Sharad S Dhavalikar',
        // the index answers custom names in lower case - the parser must not care
        'ds6wg:irs_learning_text': '1. simaltion shoud be \n2. dont do theis activy',
        'ds6wg:irs_learning_project': 'OSCP -Project',
        'ds6wg:irs_learning_project_no': 'R&D-26002-HY',
        'ds6wg:irs_learning_project_id': '39261.35329.54110.44402' }),
  hit({ physicalid: 'L1', 'ds6w:identifier': 'LRN-0000001', 'ds6w:label': 'LEARN-0001-AB',
        'ds6w:status': 'IRSLearning.Active', 'ds6w:created': '2026-10-18T17:49:50Z',
        'ds6wg:IRS_LEARNING_TEXT': 'TEST', 'ds6wg:IRS_LEARNING_PROJECT': 'ANA PRJ 01',
        'ds6wg:IRS_LEARNING_PROJECT_NO': 'R&D-26001-HY',
        'ds6wg:IRS_LEARNING_PROJECT_ID': '39261.35329.22965.46745' }),
  hit({ physicalid: 'L2', 'ds6w:identifier': 'LRN-0000002', 'ds6w:label': 'LEARNING-002-AB',
        'ds6w:status': 'IRSLearning.Active', 'ds6w:created': '2026-10-18T17:50:16Z',
        'ds6wg:IRS_LEARNING_TEXT': 'TEST', 'ds6wg:IRS_LEARNING_PROJECT': 'ANA PRJ 01',
        'ds6wg:IRS_LEARNING_PROJECT_NO': 'R&D-26001-HY',
        'ds6wg:IRS_LEARNING_PROJECT_ID': '39261.35329.22965.46745' })
];
const own = (logins) => logins.map(l => '-|' + l + '_PRJ|Multiple Ownership For Object');
const PROJECTS = [
  hit({ mxid: '39261.35329.54110.44402', physicalid: '2937BDD700002CF46ADAE88B00000564',
        name: 'OSCP -Project', 'ds6w:responsible': 'Sharad S Dhavalikar',
        'ds6w:responsibleUid': 'IPLT_USER65', 'ds6wg:EPMProjectNo': 'R&D-26002-HY',
        'ds6w:status': 'Project Space.Active',
        ownership: own(['IPLT_User29', 'TIVOLT_User6', 'IPLT_User12', 'IPLT_User13', 'IPLT_USER65']) }),
  hit({ mxid: '39261.35329.22965.46745', physicalid: '2937BDD7000022506AD4D19900000984',
        name: 'ANA PRJ 01', 'ds6w:responsible': 'Sharad S Dhavalikar',
        'ds6w:responsibleUid': 'IPLT_USER65', 'ds6wg:EPMProjectNo': 'R&D-26001-HY',
        ownership: own(['IPLT_User29', 'TIVOLT_User6', 'IPLT_User16', 'IPLT_User18',
                        'IPLT_User11', 'IPLT_User13', 'IPLT_User28', 'IPLT_USER65']) })
];
const PEOPLE = {
  IPLT_USER65: 'Sharad S Dhavalikar', IPLT_User29: 'Ram Kumar Joga', TIVOLT_User6: 'Sachin S Awasare',
  IPLT_User12: 'Rakesh Kumar Sah', IPLT_User13: 'Sowmya Sri Rapaka'
};
const PERSONS = Object.keys(PEOPLE).map(l => hit({ name: l, 'ds6wg:fullname': PEOPLE[l] }));

/** A fake federated search that answers the three kinds of query. */
function indexOf(learnings, projects, persons) {
  return (url, opts) => {
    const q = opts.data.query;
    const page = (list) => {
      const s = opts.data.start, n = opts.data.nresults;
      return Promise.resolve({ results: list.slice(s, s + n), infos: { nmatches: list.length } });
    };
    if (q.indexOf('types/IRSLearning') >= 0) { return page(learnings); }
    if (q.indexOf('mxid:') === 0) { return page(projects.filter(p => q.indexOf(IndexSearch.first(IndexSearch._flatten(p), 'mxid')) >= 0)); }
    if (q.indexOf('types/Person') >= 0) { return page(persons.filter(p => q.indexOf('"' + IndexSearch.first(IndexSearch._flatten(p), 'name') + '"') >= 0)); }
    return Promise.reject(new Error('unexpected query ' + q));
  };
}

// Checks run ONE AFTER ANOTHER: the async ones share the fake Request, so
// running them side by side would let one check's handler answer another's call.
let failures = 0;
let queue = Promise.resolve();
function check(name, fn) {
  queue = queue.then(() => fn()).then(() => console.log('  ok   ' + name),
    (e) => { failures++; console.log('  FAIL ' + name + '\n       ' + e.message); });
}
function section(title) { queue = queue.then(() => console.log(title)); }

// ---- 1. the range ----------------------------------------------------------
section('range (WP11 D8: both dates required)');

check('nothing is read without BOTH dates', () => {
  assert.ok(Fields.rangeError('', ''));
  assert.ok(Fields.rangeError('2026-10-01', ''));
  assert.ok(Fields.rangeError('', '2026-10-31'));
  assert.strictEqual(Fields.indexBounds('', '2026-10-31'), null);
});

check('malformed and impossible dates are refused', () => {
  assert.ok(/From/.test(Fields.rangeError('01/10/2026', '2026-10-31')));
  assert.ok(/From/.test(Fields.rangeError('2026-02-31', '2026-03-01')), '31 Feb must not roll into March');
});

check('To before From is refused, the same day is fine', () => {
  assert.ok(/before/.test(Fields.rangeError('2026-10-24', '2026-10-19')));
  assert.strictEqual(Fields.rangeError('2026-10-18', '2026-10-18'), '');
});

check('local days become UTC bounds - IST midnight is 18:30 the day before', () => {
  assert.deepStrictEqual(Fields.indexBounds('2026-10-19', '2026-10-24'),
    { start: '2026/10/18 18:30:00', end: '2026/10/24 18:30:00' });
});

check('the learnings query is the one proven on the index API', () => {
  const q = Fields.learningQuery(Fields.indexBounds('2026-10-19', '2026-10-24'));
  assert.strictEqual(q, 'flattenedtaxonomies:"types/IRSLearning" AND ' +
    'originated>="2026/10/18 18:30:00" AND originated<"2026/10/24 18:30:00"');
});

check('lookup queries quote every key, and escape quotes inside one', () => {
  assert.strictEqual(Fields.projectQuery(['1.2.3.4', '5.6.7.8']), 'mxid:("1.2.3.4" OR "5.6.7.8")');
  assert.strictEqual(Fields.personQuery(['a"b']), 'flattenedtaxonomies:"types/Person" AND name:("a\\"b")');
});

check('only Program Central member entries name a member', () => {
  assert.strictEqual(Fields.memberLogin('-|IPLT_User29_PRJ|Multiple Ownership For Object'), 'IPLT_User29');
  assert.strictEqual(Fields.memberLogin('Company Name|-|P&O'), '');
  assert.strictEqual(Fields.memberLogin(''), '');
});

check('the export file name carries the range', () => {
  assert.strictEqual(Fields.fileName('2026-10-01', '2026-10-31', 'csv'),
    'key-learnings_2026-10-01_to_2026-10-31.csv');
});

check('export offers CSV only - JSON and HTML not wanted (user, 2026-10-25)', () => {
  assert.deepStrictEqual(Fields.EXPORTS.map(e => e.format), ['csv']);
});

// ---- 2. the index client ---------------------------------------------------
section('index search');

check('federated search is called at the server ROOT, not under /3dspace', () => {
  assert.strictEqual(IndexSearch._searchUrl('https://h.example.com/3dspace'),
    'https://h.example.com/federated/search');
  assert.throws(() => IndexSearch._searchUrl(''));
});

check('a hit flattens case-insensitively, with multi-values kept', () => {
  const f = IndexSearch._flatten(hit({ 'ds6wg:IRS_LEARNING_TEXT': 'x', ownership: ['a', 'b'] }));
  assert.strictEqual(IndexSearch.first(f, 'ds6wg:irs_learning_text'), 'x');
  assert.deepStrictEqual(IndexSearch.all(f, 'OWNERSHIP'), ['a', 'b']);
  const g = IndexSearch._flatten({ attributes: { 'ds6w:label': ['T'] } });
  assert.strictEqual(IndexSearch.first(g, 'ds6w:label'), 'T');
});

check('the body carries the query, the predicates, the paging and the security context', () => {
  Request.calls = [];
  Request.handler = () => Promise.resolve({ results: [], infos: { nmatches: 0 } });
  return IndexSearch.page('q', ['physicalid'], 0, 10).then(() => {
    const c = Request.calls[0];
    assert.strictEqual(c.url, 'https://3dexperience2024x.solize.com/federated/search');
    assert.strictEqual(c.opts.method, 'POST');
    assert.strictEqual(c.opts.data.query, 'q');
    assert.deepStrictEqual(c.opts.data.select_predicate, ['physicalid']);
    assert.strictEqual(c.opts.data.nresults, 10);
    assert.deepStrictEqual(c.opts.data.source, ['3dspace']);
    assert.ok(/^ctx::/.test(c.opts.data.login['3dspace'].SecurityContext));
  });
});

const many = (n) => Array.from({ length: n }, (_, i) => hit({ physicalid: 'P' + i }));

check('paging: 450 hits at 200 a page is three calls, nothing truncated', () => {
  Request.calls = [];
  Request.handler = indexOf(many(450), [], []);
  return IndexSearch.searchAll('flattenedtaxonomies:"types/IRSLearning"', [], 200, 2000).then(r => {
    assert.strictEqual(r.hits.length, 450);
    assert.strictEqual(Request.calls.length, 3);
    assert.strictEqual(r.truncated, false);
  });
});

check('the ceiling: reading stops at max and says it was truncated', () => {
  Request.calls = [];
  Request.handler = indexOf(many(2500), [], []);
  return IndexSearch.searchAll('flattenedtaxonomies:"types/IRSLearning"', [], 200, 2000).then(r => {
    assert.strictEqual(r.hits.length, 2000);
    assert.strictEqual(Request.calls.length, 10);
    assert.strictEqual(r.truncated, true);
    assert.strictEqual(r.total, 2500);
  });
});

check('lookups are chunked: 120 ids at 50 a query is three queries', () => {
  Request.calls = [];
  Request.handler = () => Promise.resolve({ results: [] });
  const ids = Array.from({ length: 120 }, (_, i) => 'id' + i);
  return IndexSearch.lookup(ids, Fields.projectQuery, [], 50).then(() => {
    assert.strictEqual(Request.calls.length, 3);
    assert.ok(Request.calls[2].opts.data.query.indexOf('"id119"') > 0);
  });
});

// ---- 3. the register, on the VM's real data --------------------------------
section('register (real index data, 2026-10-25)');

check('the join gives the user\'s columns for LRN-0000003', () => {
  const rows = Service._assemble(LEARNINGS.map(IndexSearch._flatten),
    PROJECTS.map(IndexSearch._flatten), PERSONS.map(IndexSearch._flatten));
  const r = rows.filter(x => x.no === 'LRN-0000003')[0];
  assert.strictEqual(r.title, 'Learing -XY');
  assert.strictEqual(r.text, '1. simaltion shoud be \n2. dont do theis activy');
  assert.strictEqual(r.projectName, 'OSCP -Project');
  assert.strictEqual(r.projectNo, 'R&D-26002-HY');
  assert.strictEqual(r.managerName, 'Sharad S Dhavalikar');
  assert.strictEqual(r.membersText,
    'Rakesh Kumar Sah, Ram Kumar Joga, Sachin S Awasare, Sharad S Dhavalikar, Sowmya Sri Rapaka');
  assert.strictEqual(r.memberCount, 5);
  // 05:34:47Z is 11:04 IST - the same instant the database shows
  assert.strictEqual(r.originatedDate, '2026-10-23');
  assert.strictEqual(r.originatedTime, '11:04');
  assert.strictEqual(r.state, 'Active');
});

check('newest first; the two ANA PRJ 01 learnings share its 8 members', () => {
  const rows = Service._assemble(LEARNINGS.map(IndexSearch._flatten),
    PROJECTS.map(IndexSearch._flatten), PERSONS.map(IndexSearch._flatten));
  assert.deepStrictEqual(rows.map(r => r.no), ['LRN-0000003', 'LRN-0000002', 'LRN-0000001']);
  assert.strictEqual(rows[1].memberCount, 8);
  // a member the index has no person for still appears, by login
  assert.ok(rows[1].membersText.indexOf('IPLT_User16') >= 0);
});

// The first dashboard run (2026-10-25) showed Date Originated and State BLANK
// with members filled: federated search names the 6W when/what fields by
// path, and the short names never arrived. Both shapes must give the row.
check('6W fields by PATH name give the date and the state', () => {
  const h = hit({ physicalid: 'P', 'ds6w:identifier': 'LRN-0000003',
    'ds6w:when/ds6w:created': '2026-10-23T05:34:47Z', 'ds6w:what/ds6w:status': 'IRSLearning.Active' });
  const r = Service._assemble([IndexSearch._flatten(h)], [], [])[0];
  assert.strictEqual(r.originatedDate, '2026-10-23');
  assert.strictEqual(r.originatedTime, '11:04');
  assert.strictEqual(r.state, 'Active');
});

check('only the native originated / current: still the date (UTC) and the state', () => {
  const h = hit({ physicalid: 'P', 'ds6w:identifier': 'LRN-0000001',
    originated: '2026/10/18 17:49:50', current: 'Active' });
  assert.strictEqual(Service._createdOf(IndexSearch._flatten(h)), '2026-10-18T17:49:50Z');
  const r = Service._assemble([IndexSearch._flatten(h)], [], [])[0];
  // 17:49 UTC is 23:19 IST - the same instant the database shows
  assert.strictEqual(r.originatedDate, '2026-10-18');
  assert.strictEqual(r.originatedTime, '23:19');
  assert.strictEqual(r.state, 'Active');
});

check('a path-named manager is read as the manager', () => {
  const p = hit({ mxid: 'X', 'ds6w:who/ds6w:responsible': 'Sharad S Dhavalikar', owner: 'IPLT_USER65' });
  assert.strictEqual(Service._projectPart(IndexSearch._flatten(p)).managerName, 'Sharad S Dhavalikar');
});

check('a learning whose project the user cannot read says so', () => {
  const rows = Service._assemble([IndexSearch._flatten(LEARNINGS[0])], [], []);
  assert.strictEqual(rows[0].projectAccess, false);
  assert.strictEqual(rows[0].managerName, Service.NO_ACCESS);
  assert.strictEqual(rows[0].membersText, Service.NO_ACCESS);
  // the learning's own copy of the project identity is still shown
  assert.strictEqual(rows[0].projectNo, 'R&D-26002-HY');
});

check('a learning with no origin project is not "no access"', () => {
  const lone = hit({ physicalid: 'X', 'ds6w:identifier': 'LRN-9', 'ds6w:created': '2026-10-20T00:00:00Z' });
  const rows = Service._assemble([IndexSearch._flatten(lone)], [], []);
  assert.strictEqual(rows[0].hasProject, false);
  assert.strictEqual(rows[0].projectAccess, true);
  assert.strictEqual(rows[0].managerName, '');
});

check('list() refuses to read without a range, and makes no call', () => {
  Request.calls = [];
  return Service.list({ from: '', to: '' }).then(() => { throw new Error('should reject'); }, (e) => {
    assert.ok(/From and a To/.test(e.message));
    assert.strictEqual(Request.calls.length, 0);
  });
});

check('list() end to end: THREE searches for the real data, nothing per row', () => {
  Request.calls = [];
  Request.handler = indexOf(LEARNINGS, PROJECTS, PERSONS);
  return Service.list({ from: '2026-10-18', to: '2026-10-24' }).then(r => {
    assert.strictEqual(r.rows.length, 3);
    assert.strictEqual(Request.calls.length, 3);
    assert.strictEqual(r.searches, 3);
    const queries = Request.calls.map(c => c.opts.data.query);
    assert.ok(/types\/IRSLearning/.test(queries[0]));
    assert.ok(/^mxid:/.test(queries[1]));
    assert.ok(/types\/Person/.test(queries[2]));
    // each project and each person is asked for once, however many rows share it
    assert.strictEqual((queries[1].match(/ OR /g) || []).length, 1);
    assert.strictEqual(r.truncated, false);
  });
});

// ---- 4. the view's search box and the columns ------------------------------
section('view');

const View = load(file('js/views/LearningListView.js'), [{}, {}, Fields, Service, {}, {}]);
const rows = Service._assemble(LEARNINGS.map(IndexSearch._flatten),
  PROJECTS.map(IndexSearch._flatten), PERSONS.map(IndexSearch._flatten));

check('search: every word must match, in any text column, any case', () => {
  assert.strictEqual(View._matcher('   '), null);
  assert.strictEqual(rows.filter(View._matcher('rakesh')).length, 1);      // a member of OSCP only
  assert.strictEqual(rows.filter(View._matcher('SOWMYA')).length, 3);      // a member of both projects
  assert.strictEqual(rows.filter(View._matcher('r&d-26001')).length, 2);  // project no.
  assert.strictEqual(rows.filter(View._matcher('test ana')).length, 2);   // text + project
  assert.strictEqual(rows.filter(View._matcher('test oscp')).length, 0);
});

const Format = { badge: (t) => t, date: (v) => v };
const Columns = load(file('js/views/LearningColumns.js'), [Format, Fields]);

check('the columns are the user\'s list, in order, plus State', () => {
  assert.deepStrictEqual(Columns.build().map(c => c.title), ['Learning No.', 'Learning',
    'Key Learning Features', 'Origin Project', 'Origin Project No.', 'Project Manager',
    'Project Members', 'Date Originated', 'State']);
});

check('every column reads a field the row really has (export writes the field)', () => {
  Columns.build().forEach(c => assert.ok(c.field in rows[0], c.field + ' missing from the row'));
  Fields.SEARCH_KEYS.forEach(k => assert.ok(k in rows[0], 'search key ' + k + ' missing'));
});

// ---- 5. the packet's wiring -------------------------------------------------
section('packet');

const html = fs.readFileSync(file('IRSKeyLearnings.html'), 'utf8');
const modules = [];
(function walk(dir) {
  fs.readdirSync(dir).forEach(n => {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) { walk(p); } else if (/\.js$/.test(n)) { modules.push(p); }
  });
}(file('js')));

check('every module is loaded by the shell, and every script tag exists', () => {
  modules.forEach(m => {
    const rel = path.relative(base, m).replace(/\\/g, '/');
    assert.ok(html.indexOf('src="' + rel + '"') >= 0, rel + ' is not in the shell');
  });
  (html.match(/src="(js\/[^"]+)"/g) || []).forEach(s => {
    assert.ok(fs.existsSync(file(s.slice(5, -1))), s + ' does not exist');
  });
});

check('each module defines the id its path says (one AMD module per file, R4)', () => {
  modules.forEach(m => {
    const id = 'IRSKeyLearnings/' + path.relative(file('js'), m).replace(/\\/g, '/').replace(/\.js$/, '');
    const src = fs.readFileSync(m, 'utf8');
    assert.ok(src.indexOf("define('" + id + "'") >= 0, m + ' does not define ' + id);
    assert.ok(!/\brequire\(/.test(src), m + ' calls require() - UWA rule C6');
    assert.ok(src.indexOf('DS/WAFData') < 0, m + ' bypasses JazzySole/Request (R3)');
  });
});

// User, 2026-10-25: "each time we reload the widget, old search should not show".
check('a reload starts clean: no range or search is stored or restored', () => {
  assert.ok(!/xPrefLearning/.test(html), 'the shell still declares a range / search preference');
  modules.forEach(m => {
    const src = fs.readFileSync(m, 'utf8');
    assert.ok(!/widget\.(getValue|setValue)\(\s*['"]?xPrefLearning/.test(src), m + ' keeps the old search');
    assert.ok(!/Fields\.PREFS/.test(src), m + ' still reads Fields.PREFS');
  });
  const view = fs.readFileSync(file('js/views/LearningListView.js'), 'utf8');
  assert.ok(/var range = \{ from: '', to: '' \};/.test(view));
  assert.ok(/var term = '';/.test(view));
});

check('the CSS is scoped: every rule under .irs-learnings (R1)', () => {
  const css = fs.readFileSync(file('css/IRSKeyLearnings.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = css.split('}').map(b => b.split('{')[0].trim()).filter(Boolean);
  assert.ok(selectors.length > 5);
  selectors.forEach(s => s.split(',').forEach(one =>
    assert.ok(one.trim().indexOf('.irs-learnings') === 0, 'unscoped: ' + one.trim())));
});

check('no JAR, no JPO: the widget calls nothing of ours on the server', () => {
  modules.forEach(m => {
    const src = fs.readFileSync(m, 'utf8');
    assert.ok(src.indexOf('resources/v1/irsproject') < 0, m + ' still calls the removed endpoint');
  });
});

queue.then(() => {
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed');
  process.exit(failures ? 1 : 0);
});
