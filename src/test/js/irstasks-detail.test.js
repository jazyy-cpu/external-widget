// Run: node src/test/js/irstasks-detail.test.js   (from external-widget/)
//
// The task page's pure logic: the detail service's row shaping and its two
// calls, the form definition file, and the field resolver that decides what
// each row of the form shows. No DOM, no platform.
//
// The task fixture is the REAL captured response from the live system,
// `As-Is  Understanding/manual logs/ABCLogs` - 65 tasks, including the Inbox
// Tasks and the generated documents. Testing against a capture rather than
// against something hand-written is the whole point: the shapes that broke the
// POC (dataelements vs relateddata, arrays of one) are present in it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '../../main/resources/static/WidgetPacket/IRSTasks');
const CAPTURE = path.join(__dirname,
  '../../../../As-Is  Understanding/manual logs/ABCLogs');

function load(file, deps) {
  let mod;
  const define = (name, d, f) => { mod = f.apply(null, deps); };
  new Function('define', fs.readFileSync(file, 'utf8'))(define);
  return mod;
}

const Fields = load(path.join(base, 'js/config/TaskFields.js'), []);

// the fake request records its calls and answers from `_bodies` by path prefix
const Request = {
  _calls: [],
  _bodies: {},
  get: function (p, opts) {
    Request._calls.push({ path: p, opts: opts });
    const key = Object.keys(Request._bodies).find(k => p.indexOf(k) === 0);
    if (!key) { return Promise.reject(new Error('no fixture for ' + p)); }
    const body = Request._bodies[key];
    return body instanceof Error ? Promise.reject(body) : Promise.resolve(body);
  }
};

// the diagnostic log is silenced here: the suite asserts behaviour, and a
// console full of diagnostics hides a failing assertion
const Log = { on: false, info: () => {}, warn: () => {}, table: () => {} };
const Detail = load(path.join(base, 'js/services/TaskDetailService.js'),
  [Request, Fields, Log]);
const Context = load(path.join(base, 'js/services/ProjectContextService.js'),
  [Request, Log]);
const View = load(path.join(base, 'js/views/TaskDetailView.js'),
  [Detail, Context, {}, Fields, { date: v => v, badge: () => ({}), empty: () => ({}) }]);

// ---- 1. the form definition file --------------------------------------

const spec = JSON.parse(fs.readFileSync(
  path.join(base, 'js/data/forms/project-proposal.json'), 'utf8'));

assert.strictEqual(spec.taskType, 'EPMPROJECT_PROPOSAL');
assert.strictEqual(spec.form, 'R&D-PRJ-01-Rev.06');
assert.ok(Array.isArray(spec.fields) && spec.fields.length === 23,
  'the whole printed form: 3 header + 16 sections + 4 footer');

// the registry and the file must agree, or the page loads the wrong definition
assert.strictEqual(Fields.fieldSet('EPMPROJECT_PROPOSAL'), 'project-proposal');

// every field is usable by the resolver: a known source, a known display, and
// a field name whenever a value is expected
const SOURCES = ['project', 'task', 'derived', 'service', 'none'];
const DISPLAYS = ['text', 'longtext', 'pending', 'elsewhere', 'approval', 'type',
                  'risks', 'learnings'];
// a source that reads ONE value must name the field it reads; a source that
// renders a list or nothing at all must instead explain itself in a note,
// because the page prints that note where a value would have gone
const VALUE_SOURCES = ['project', 'task', 'derived'];
spec.fields.forEach(f => {
  assert.ok(f.label, 'every field needs a label');
  assert.ok(SOURCES.indexOf(f.source) >= 0, f.label + ': bad source ' + f.source);
  assert.ok(DISPLAYS.indexOf(f.display) >= 0, f.label + ': bad display ' + f.display);
  if (VALUE_SOURCES.indexOf(f.source) >= 0) {
    assert.ok(f.field, f.label + ' reads a value, so it needs a field name');
  } else {
    assert.ok(f.note, f.label + ' shows no value, so it must explain why');
  }
});

// XII and XIII are the two object sections, and they are the reason the custom
// REST JAR exists: OOTB returns the risks empty, has no Opportunity route, and
// cannot know IRSLearning at all
const service = spec.fields.filter(f => f.source === 'service');
assert.strictEqual(service.length, 2, 'exactly two service-backed sections');
assert.deepStrictEqual(service.map(f => f.ref), ['XII', 'XIII']);
assert.deepStrictEqual(service.map(f => f.display).sort(), ['learnings', 'risks']);

// EPMLessonsLearnt was CANCELLED when the IRSLearning object replaced it
// (WP02 doc 08). No row may go looking for it again.
spec.fields.forEach(f => assert.notStrictEqual(f.field, 'EPMLessonsLearnt',
  'XII comes from the Learning objects, not from a cancelled attribute'));

// the proposal form is project data - that is why this page calls the project
const fromProject = spec.fields.filter(f => f.source === 'project').length;
const fromTask = spec.fields.filter(f => f.source === 'task').length;
assert.strictEqual(fromTask, 0,
  'EPMPROJECT_PROPOSAL carries no custom attribute of its own (measured 2026-10-07)');
assert.strictEqual(fromProject, 14,
  'fourteen rows are project attributes; XII and XIII moved to the service');

// ---- 2. the field resolver --------------------------------------------

const task = { attributes: { EPMChangeOfScope: 'TRUE' } };
const project = {
  typeLabel: 'Analysis Project',
  attributes: {
    name: 'Solize XYZ Ltd',
    title: '',
    EPMProjectNo: 'R&D-26010-HY',
    EPMNeedOfTheProject: 'line one\nline two',
    EPMMethodology: ''
  }
};

const r = (s) => View._resolve(s, task, project);

// a value read from the project
let row = r({ label: 'Project No.', source: 'project', field: 'EPMProjectNo', display: 'text' });
assert.strictEqual(row.value, 'R&D-26010-HY');
assert.strictEqual(row.empty, false);
assert.strictEqual(row.missing, false);

// present but not filled in - empty, NOT missing. The two must not be confused:
// one means "nobody typed anything", the other "it is not there to type into"
row = r({ label: 'Methodology', source: 'project', field: 'EPMMethodology', display: 'longtext' });
assert.strictEqual(row.empty, true);
assert.strictEqual(row.missing, false);

// named by the spec but absent from the payload - worth saying out loud
row = r({ label: 'Ghost', source: 'project', field: 'EPMNotThere', display: 'text' });
assert.strictEqual(row.missing, true);

// a `pending` field is EXPECTED to be absent, so it is not reported as missing
row = r({ label: 'Lessons learnt', source: 'project', field: 'EPMLessonsLearnt',
          display: 'pending', note: 'not created yet' });
assert.strictEqual(row.missing, false, 'a pending field is not a surprise');

// a task-sourced field reads the task, not the project
row = r({ label: 'Change of scope', source: 'task', field: 'EPMChangeOfScope', display: 'text' });
assert.strictEqual(row.value, 'TRUE');

// source "none" never reports missing, whatever is passed
row = r({ label: 'Department', source: 'none', display: 'elsewhere', note: 'lives on a relationship' });
assert.strictEqual(row.missing, false);
assert.strictEqual(row.value, '');

// no project at all (the call failed, or the task has none): every project
// field says so rather than looking empty
row = View._resolve({ label: 'Project No.', source: 'project', field: 'EPMProjectNo' }, task, null);
assert.strictEqual(row.missing, true);

// `derived` reads the project OBJECT, not its attributes - section I is the
// whole of this case, and typeLabel is already the platform's display name
row = r({ label: 'Project Category', source: 'derived', field: 'typeLabel', display: 'type' });
assert.strictEqual(row.value, 'Analysis Project');
assert.strictEqual(row.missing, false);
row = View._resolve({ label: 'Project Category', source: 'derived', field: 'typeLabel' },
  task, null);
assert.strictEqual(row.missing, true, 'derived needs the project too');

// `fallbackField`: Project Name must not print a dash just because Title is
// empty, which it is on every project measured
row = r({ label: 'Project Name', source: 'project', field: 'title',
          fallbackField: 'name', display: 'text' });
assert.strictEqual(row.value, 'Solize XYZ Ltd');
assert.strictEqual(row.usedFallback, true);
assert.strictEqual(row.empty, false);

// a service section carries no value of its own - the renderer reads the
// context for the table - and must never be reported as missing data
row = r({ label: 'Risks and opportunities', source: 'service', display: 'risks',
          note: 'from the JAR' });
assert.strictEqual(row.missing, false);
assert.strictEqual(row.value, '');
assert.strictEqual(row.empty, true);

// ---- 3. the whole real form against a real project --------------------

// every field of the spec resolves without throwing, and nothing comes back
// undefined - the page's formatters do not guard
spec.fields.forEach(f => {
  const out = View._resolve(f, task, project);
  Object.keys(out).forEach(k => assert.notStrictEqual(out[k], undefined,
    f.label + '.' + k + ' must not be undefined'));
});

// ---- 4. the detail service, on the captured response ------------------

const capture = JSON.parse(fs.readFileSync(CAPTURE, 'utf8'));
const proposal = capture.data.find(t => t.type === 'EPMPROJECT_PROPOSAL' &&
  (t.relateddata || {}).deliverables && t.relateddata.deliverables.length);
assert.ok(proposal, 'the capture must contain a proposal task with a document');

const shaped = Detail._toTask(proposal);
assert.strictEqual(shaped.type, 'EPMPROJECT_PROPOSAL');
assert.strictEqual(shaped.typeLabel, 'PROJECT PROPOSAL / PROFILE',
  'the capture has no typeNLS on the task item, so the registry label shows - ' +
  'and that label is now the platform\'s own name, copied from the same capture');
assert.strictEqual(shaped.typeFromPlatform, false);
assert.ok(shaped.title, 'the task number');
assert.ok(shaped.projectId, 'the project arrives with the task');
assert.ok(shaped.projectTitle, 'and its title');
assert.strictEqual(shaped.projectTypeLabel, 'Analysis Project',
  'the project DOES carry typeNLS - the platform display name');
assert.ok(/^PPF-/.test(shaped.documentName), 'the generated form document: ' + shaped.documentName);
assert.ok(shaped.documentRevision !== '', 'and its revision');
assert.strictEqual(typeof shaped.attributes, 'object');
Object.keys(shaped).forEach(k => assert.notStrictEqual(shaped[k], undefined, k));

// typeNLS wins where the platform sends it - the point of using it at all
const withNLS = Detail._toTask({
  id: 'X', type: 'EPMPROJECT_PROPOSAL',
  dataelements: { typeNLS: 'PROJECT PROPOSAL / PROFILE', stateNLS: 'Completed', state: 'Complete' }
});
assert.strictEqual(withNLS.typeLabel, 'PROJECT PROPOSAL / PROFILE');
assert.strictEqual(withNLS.typeFromPlatform, true);
assert.strictEqual(withNLS.stateLabel, 'Completed');

// ---- 5. the two calls -------------------------------------------------

Request._calls = [];
Request._bodies = {
  'resources/v1/modeler/tasks/': { data: [proposal] },
  'resources/v1/modeler/projects/': {
    // `title` empty and `name` filled is what the live platform returns -
    // measured on both TEST PROJECT and Solize XYZ, 2026-10-08
    data: [{ id: 'P1', type: 'EPMAnalysisProject',
             dataelements: { name: 'Solize XYZ', title: '',
                             EPMProjectNo: 'R&D-26010-HY', typeNLS: 'Analysis Project' } }]
  }
};

Detail.get('TASK1').then(result => {
  assert.strictEqual(Request._calls.length, 2, 'one call for the task, one for its project');
  assert.strictEqual(Request._calls[0].path, 'resources/v1/modeler/tasks/TASK1');
  assert.strictEqual(Request._calls[0].opts.params['$fields'], 'basics,typeNLS,stateNLS',
    'the detail call asks for the display names too');
  assert.ok(/projects\//.test(Request._calls[1].path));
  assert.strictEqual(Request._calls[1].opts.params['$include'], 'none',
    'mandatory - the default expands the whole task tree');

  assert.strictEqual(result.project.projectNo, 'R&D-26010-HY');
  assert.strictEqual(result.note, '');

  // the form now resolves against the real pair, and the header fields fill
  const header = spec.fields.filter(f => f.ref === 'Header' && f.source === 'project')
    .map(f => View._resolve(f, result.task, result.project));
  assert.strictEqual(header.find(h => h.field === 'EPMProjectNo').value, 'R&D-26010-HY');
  // Title is empty on the real project, so the Project Name row shows `name`
  const nameRow = header.find(h => h.field === 'title');
  assert.strictEqual(nameRow.value, 'Solize XYZ');
  assert.strictEqual(nameRow.usedFallback, true, 'it came from the fallback');

  // a project that cannot be read leaves the task page usable, and says why
  Request._calls = [];
  Request._bodies['resources/v1/modeler/projects/'] = new Error('403');
  return Detail.get('TASK1');
}).then(result => {
  assert.ok(result.task, 'the task is still shaped');
  assert.strictEqual(result.project, null);
  assert.ok(/project could not be read/.test(result.note), result.note);

  // the single-task resource may refuse our parameters: one retry without them
  Request._calls = [];
  let firstCall = true;
  Request.get = function (p, opts) {
    Request._calls.push({ path: p, opts: opts });
    if (firstCall) { firstCall = false; return Promise.reject(new Error('400 bad $fields')); }
    return Promise.resolve({ data: [{ id: 'T', type: 'EPMPROJECT_PROPOSAL', dataelements: {} }] });
  };
  return Detail.get('TASK2');
}).then(result => {
  assert.strictEqual(Request._calls.length, 2, 'the retry happened');
  assert.strictEqual(Request._calls[1].opts, undefined, 'and it sent no parameters');
  assert.strictEqual(result.task.id, 'T');
  assert.ok(/not attached to a project/.test(result.note), result.note);

  console.log('irstasks-detail: all assertions passed');
}).catch(err => {
  console.error(err);
  process.exit(1);
});

// ---- 6. the project-context service, on the LIVE captured response ----
//
// `As-Is  Understanding/manual logs/data-2026108838.json` is the real body the
// deployed JAR returned in the browser for Solize XYZ on 2026-10-08. Testing
// the shaping against that rather than against something hand-written is the
// whole point: it is the only way the "empty originProject" case would have
// been noticed before it reached a screen.

const CONTEXT_CAPTURE = path.join(__dirname,
  '../../../../As-Is  Understanding/manual logs/data-2026108838.json');
const live = JSON.parse(fs.readFileSync(CONTEXT_CAPTURE, 'utf8'));
const live_shaped = Context._shape(live);

assert.strictEqual(live_shaped.risks.length, 1);
assert.strictEqual(live_shaped.risks[0].no, 'R-0000005');
assert.strictEqual(live_shaped.risks[0].title, 'RISK 1');
assert.strictEqual(live_shaped.risks[0].state, 'Complete');
// the id the table links with is the PHYSICAL one, which is what the rest of
// the widget uses
assert.strictEqual(live_shaped.risks[0].id, '299036CE0000CE606AC5E99E000004C0');

assert.strictEqual(live_shaped.opportunities.length, 1);
assert.strictEqual(live_shaped.opportunities[0].no, 'OPP-0000006');
assert.strictEqual(live_shaped.opportunities[0].type, 'Opportunity');

// one learning produced here, two reused - and the reused pair has NO origin
// project in the live data, which WP02 doc 08 says is legitimate: a proposal
// may cite work that predates the system
assert.strictEqual(live_shaped.learningsHere.length, 1);
assert.strictEqual(live_shaped.learningsElsewhere.length, 2);
assert.strictEqual(live_shaped.learnings.length, 3, 'one table, origin rows first');
assert.strictEqual(live_shaped.learnings[0].no, 'LRN-0000008');
assert.strictEqual(live_shaped.learnings[0].originLabel, 'This project');
assert.strictEqual(live_shaped.learnings[1].originLabel, 'Source not recorded',
  'an empty origin is said in words, never left blank - a blank reads as a fault');
assert.strictEqual(live_shaped.learnings[1].learning, 'key learing feature',
  'the learning text comes through, not just its title');

assert.strictEqual(live_shaped.riskError, '');
assert.strictEqual(live_shaped.learningError, '');

// a learning WITH an origin shows the project and its number, which is what
// section XII actually asks for
const cited = Context._toLearning({
  no: 'LRN-0000008', title: 'LEARNING A', text: 'x', state: 'Active',
  originProject: { name: 'Solize XYZ', projectNo: 'R&D-26010-HY' }
}, 'other');
assert.strictEqual(cited.originLabel, 'Solize XYZ (R&D-26010-HY)');
assert.strictEqual(cited.originNo, 'R&D-26010-HY');

// a failed section stays distinguishable from an empty one
const broken = Context._shape({ risks: [], opportunities: [], riskError: '500 boom',
  learnings: { createdInThisProject: [], fromOtherSources: [], error: 'no such type' } });
assert.strictEqual(broken.riskError, '500 boom');
assert.strictEqual(broken.learningError, 'no such type');
assert.strictEqual(broken.learnings.length, 0);

// a response missing whole sections must not throw - the JAR reports a failed
// section by omitting nothing, but a future version might
const sparse = Context._shape({});
assert.deepStrictEqual(sparse.risks, []);
assert.deepStrictEqual(sparse.learnings, []);

console.log('irstasks-context: all assertions passed');

// ---- 7. ConfigService resolves an ABSOLUTE base (regression, 2026-10-08) ----
//
// The widget asked the DASHBOARD for its own config file and got a 404:
//   GET https://<server>/3ddashboard/api/widget/js/data/forms/project-proposal.json
// UWA rewrites markup src/href to the widget's real host but cannot rewrite a
// URL built in JavaScript, so the relative path resolved against the proxied
// document. The base is now taken from a script tag that demonstrably loaded.

function loadConfigService(scripts, currentScript, uwaBaseUrl) {
  const saved = global.document;
  const savedWidget = global.widget;
  global.document = {
    currentScript: currentScript || null,
    getElementsByTagName: () => scripts.map(src => ({ src: src }))
  };
  if (uwaBaseUrl !== undefined) {
    global.widget = { getSettings: () => ({ baseUrl: uwaBaseUrl }) };
  }
  try {
    return load(path.join(base, 'js/services/ConfigService.js'), []);
  } finally {
    if (saved === undefined) { delete global.document; } else { global.document = saved; }
    if (savedWidget === undefined) { delete global.widget; } else { global.widget = savedWidget; }
  }
}

const REAL = 'https://widgets.example.com/WidgetPacket/IRSTasks/js/services/ConfigService.js';

// currentScript is the first choice: its src is the absolute URL UWA rewrote
let cfg = loadConfigService([], { src: REAL });
assert.strictEqual(cfg.baseUrl(),
  'https://widgets.example.com/WidgetPacket/IRSTasks/js/data/',
  'the base must be absolute and on the widget host, not the dashboard');

// a loader that evals instead of inserting a tag leaves currentScript null, so
// the scan over our own scripts has to answer instead
cfg = loadConfigService([
  'https://cdn.example.com/other/thing.js',
  'https://widgets.example.com/WidgetPacket/IRSTasks/js/App.js'
], null);
assert.strictEqual(cfg.baseUrl(),
  'https://widgets.example.com/WidgetPacket/IRSTasks/js/data/');

// nothing identifiable: fall back to the relative path, which is what it did
// before - degraded, but the widget still starts
cfg = loadConfigService(['https://cdn.example.com/other/thing.js'], null);
assert.strictEqual(cfg.baseUrl(), 'js/data/');

// UWA's own baseUrl wins when there is a widget runtime: it is the sanctioned
// answer, and it is right even if the script tags came through the proxy
cfg = loadConfigService([], { src: 'https://dashboard.example.com/3ddashboard/api/widget/js/x.js' },
  'https://widgets.example.com/WidgetPacket/IRSTasks');
assert.strictEqual(cfg.baseUrl(),
  'https://widgets.example.com/WidgetPacket/IRSTasks/js/data/',
  'UWA baseUrl must beat a script src pointing at the dashboard proxy');

// a trailing slash on baseUrl must not double up
cfg = loadConfigService([], null, 'https://widgets.example.com/WidgetPacket/IRSTasks/');
assert.strictEqual(cfg.baseUrl(),
  'https://widgets.example.com/WidgetPacket/IRSTasks/js/data/');

// a widget runtime that returns nothing usable falls through to the script tag
cfg = loadConfigService([], { src: REAL }, '');
assert.strictEqual(cfg.baseUrl(),
  'https://widgets.example.com/WidgetPacket/IRSTasks/js/data/');

// a script URL carrying a query or a cache-buster must not confuse the cut
cfg = loadConfigService([], { src: REAL + '?v=3' });
assert.strictEqual(cfg.baseUrl(),
  'https://widgets.example.com/WidgetPacket/IRSTasks/js/data/');

// no document at all (the test harness, a worker): must not throw at load
cfg = (function () {
  const saved = global.document;
  if (saved !== undefined) { delete global.document; }
  try { return load(path.join(base, 'js/services/ConfigService.js'), []); }
  finally { if (saved !== undefined) { global.document = saved; } }
}());
assert.strictEqual(cfg.baseUrl(), 'js/data/', 'no document is survivable');

// the failure message must name the URL - the status alone hid this bug
global.document = { currentScript: { src: REAL }, getElementsByTagName: () => [] };
global.XMLHttpRequest = function () {
  this.open = function () {};
  this.send = function () { this.status = 404; this.onload(); };
};
const failing = load(path.join(base, 'js/services/ConfigService.js'), []);
failing.get('forms/project-proposal').then(() => {
  console.error('expected a rejection');
  process.exit(1);
}, err => {
  assert.ok(/404/.test(err.message), err.message);
  assert.ok(/widgets\.example\.com/.test(err.message),
    'the message must say which URL was asked for: ' + err.message);
  delete global.document;
  delete global.XMLHttpRequest;
  console.log('irstasks-config: all assertions passed');
});
