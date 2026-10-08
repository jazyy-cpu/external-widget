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
const PanelStub = { render: () => ({ stub: true }) };
const View = load(path.join(base, 'js/views/TaskDetailView.js'),
  [Detail, Context, {}, PanelStub, Fields,
   { date: v => v, badge: () => ({}), empty: () => ({}) }]);

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
                  'risks', 'learnings', 'customer', 'department'];
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
assert.strictEqual(service.length, 4, 'four service-backed sections');
assert.deepStrictEqual(service.map(f => f.ref), ['Header', 'II', 'XII', 'XIII']);
assert.deepStrictEqual(service.map(f => f.display).sort(),
  ['customer', 'department', 'learnings', 'risks']);

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

// `fallbackField`: a second attribute tried when the first is empty. Project
// Name no longer needs it - on R2024x `name` IS the field - but the mechanism
// stays, and an empty primary must fall through rather than print a dash
row = r({ label: 'Project Name', source: 'project', field: 'title',
          fallbackField: 'name', display: 'text' });
assert.strictEqual(row.value, 'Solize XYZ Ltd');
assert.strictEqual(row.usedFallback, true);
assert.strictEqual(row.empty, false);

// and a filled primary must NOT consult the fallback
row = r({ label: 'Project Name', source: 'project', field: 'name',
          fallbackField: 'title', display: 'text' });
assert.strictEqual(row.value, 'Solize XYZ Ltd');
assert.strictEqual(row.usedFallback, false);

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
  'the capture has no display name on the task item, so the registry label shows - ' +
  'and that label is now the platform\'s own name, copied from the same capture');
assert.strictEqual(shaped.typeFromPlatform, false);
assert.ok(shaped.title, 'the task number');
assert.ok(shaped.projectId, 'the project arrives with the task');
assert.ok(shaped.projectTitle, 'and its title');
assert.strictEqual(shaped.projectTypeLabel, 'Analysis Project',
  'a RELATED project carries typeNLS - the key name the platform emits there');
assert.ok(/^PPF-/.test(shaped.documentName), 'the generated form document: ' + shaped.documentName);
assert.ok(shaped.documentRevision !== '', 'and its revision');
assert.strictEqual(typeof shaped.attributes, 'object');
Object.keys(shaped).forEach(k => assert.notStrictEqual(shaped[k], undefined, k));

// `nlsType` wins where the platform sends it - the point of asking at all.
// This is the shape the live task resource actually returns, measured
// 2026-10-08: the field is `nlsType`, not `typeNLS`.
const withNLS = Detail._toTask({
  id: 'X', type: 'EPMPROJECT_PROPOSAL',
  dataelements: { nlsType: 'PROJECT PROPOSAL / PROFILE', stateNLS: 'Completed', state: 'Complete' }
});
assert.strictEqual(withNLS.typeLabel, 'PROJECT PROPOSAL / PROFILE');
assert.strictEqual(withNLS.typeFromPlatform, true);
assert.strictEqual(withNLS.stateLabel, 'Completed');

// and `typeNLS` STILL wins where it appears, because that is the key the
// platform uses on RELATED objects - both spellings are real, which is
// exactly what hid the bug
const withKeyName = Detail._toTask({
  id: 'Y', type: 'EPMPROJECT_REVIEW',
  dataelements: { typeNLS: 'PROJECT REVIEW', state: 'Complete' }
});
assert.strictEqual(withKeyName.typeLabel, 'PROJECT REVIEW');
assert.strictEqual(withKeyName.typeFromPlatform, true);

// ---- 5. the two calls -------------------------------------------------

Request._calls = [];
Request._bodies = {
  'resources/v1/modeler/tasks/': { data: [proposal] },
  'resources/v1/modeler/projects/': {
    // `title` empty and `name` filled is what the live platform returns -
    // measured on both TEST PROJECT and Solize XYZ, 2026-10-08
    data: [{ id: 'P1', type: 'EPMAnalysisProject',
             dataelements: { name: 'Solize XYZ', title: '',
                             EPMProjectNo: 'R&D-26010-HY', nlsType: 'Analysis Project' } }]
  }
};

Detail.get('TASK1').then(result => {
  assert.strictEqual(Request._calls.length, 2, 'one call for the task, one for its project');
  assert.strictEqual(Request._calls[0].path, 'resources/v1/modeler/tasks/TASK1');
  assert.strictEqual(Request._calls[0].opts.params['$fields'], 'basics,nlsType',
    'the detail call asks for the platform display name, by its REAL field name');
  assert.ok(/projects\//.test(Request._calls[1].path));
  assert.strictEqual(Request._calls[1].opts.params['$include'], 'none',
    'mandatory - the default expands the whole task tree');
  // the project call must ask for the display name too, or Project Category
  // prints the raw `EPMResearchProject`. `nlsType` ALONE is what was proved
  // live on this resource: it adds the field and still returns every EPM
  // attribute, where a narrower set risks dropping the form's own data
  assert.strictEqual(Request._calls[1].opts.params['$fields'], 'nlsType');

  assert.strictEqual(result.project.projectNo, 'R&D-26010-HY');
  assert.strictEqual(result.note, '');

  // the form now resolves against the real pair, and the header fields fill
  const header = spec.fields.filter(f => f.ref === 'Header' && f.source === 'project')
    .map(f => View._resolve(f, result.task, result.project));
  assert.strictEqual(header.find(h => h.field === 'EPMProjectNo').value, 'R&D-26010-HY');
  // Project Name reads `name`. On R2024x a project is created with a name
  // only, so Title stays empty and `name` is the field - not a fallback
  const nameRow = header.find(h => h.field === 'name');
  assert.strictEqual(nameRow.value, 'Solize XYZ');
  assert.strictEqual(nameRow.usedFallback, false);

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

// a COMMITTED fixture, not a scratch log. The first version of this test read
// the capture from `As-Is  Understanding/manual logs/`, which the user prunes -
// and it broke the same day it was pruned. The file is the real response,
// copied into the test tree where it is owned.
const CONTEXT_CAPTURE = path.join(__dirname, 'fixtures/project-context-solize.json');
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

// ---- 8. $include: the form asks only for what it shows ----------------

// section XIII wants both kinds; they share one relationship server-side, so
// asking for both costs one round trip either way
assert.deepStrictEqual(
  Context.sectionsFor({ fields: [{ source: 'service', display: 'risks' }] }),
  ['risks', 'opportunities']);

// the two learning groups answer DIFFERENT forms, and each is its own round
// trip - a proposal citing earlier work must not pay for this project's own
assert.deepStrictEqual(
  Context.sectionsFor({ fields: [{ source: 'service', display: 'learnings',
                                   learningScope: 'reused' }] }),
  ['learnings.reused']);
assert.deepStrictEqual(
  Context.sectionsFor({ fields: [{ source: 'service', display: 'learnings',
                                   learningScope: 'created' }] }),
  ['learnings.created']);
// no scope given: both groups
assert.deepStrictEqual(
  Context.sectionsFor({ fields: [{ source: 'service', display: 'learnings' }] }),
  ['learnings']);

// a form with no service row makes NO call at all
assert.deepStrictEqual(Context.sectionsFor({ fields: [{ source: 'project', field: 'x' }] }), []);
assert.deepStrictEqual(Context.sectionsFor(null), []);

// the real proposal form: risks, opportunities, and the REUSED learnings only
assert.deepStrictEqual(Context.sectionsFor(spec),
  // the order follows the FORM - XII comes before XIII - which is
  // incidental to the server but makes the parameter readable in a log
  ['department', 'customer', 'learnings.reused', 'risks', 'opportunities'],
  'R&D-PRJ-01 XII cites earlier projects, so it must not fetch this one\'s own');

// a duplicate section is asked for once
assert.deepStrictEqual(
  Context.sectionsFor({ fields: [
    { source: 'service', display: 'risks' },
    { source: 'service', display: 'risks' }
  ] }),
  ['risks', 'opportunities']);

// the parameter actually goes on the wire, and is omitted when nothing is
// asked for.
//
// This section gets its OWN module instance and its own fake, rather than
// reaching into the shared `Request`: section 5's promise chain is still
// pending at this point, and replacing a method it is using made IT count
// THESE calls. Sections of a suite must not share mutable state.
const wireCalls = [];
const wireRequest = {
  get: (p, opts) => {
    wireCalls.push({ path: p, opts: opts });
    return Promise.resolve({ risks: [], opportunities: [],
                             learnings: { createdInThisProject: [], fromOtherSources: [] } });
  }
};
const WireContext = load(path.join(base, 'js/services/ProjectContextService.js'),
  [wireRequest, Log]);

WireContext.get('P1', ['risks', 'learnings.reused']).then(() => {
  assert.strictEqual(wireCalls[0].opts.params['$include'], 'risks,learnings.reused');
  wireCalls.length = 0;
  return WireContext.get('P1');
}).then(() => {
  assert.strictEqual(wireCalls[0].opts, undefined,
    'no sections means no parameter - which an older JAR needs');

  // a response that carries only the requested section must still shape
  const partial = Context._shape({
    included: ['learnings.reused'],
    learnings: { fromOtherSources: [{ no: 'LRN-1', title: 'a', text: 'b', state: 'Active',
                                      originProject: { name: 'P', projectNo: 'R&D-1' } }],
                 error: '' }
  });
  assert.strictEqual(partial.learningsElsewhere.length, 1);
  assert.deepStrictEqual(partial.risks, [], 'an absent section is simply empty here');
  assert.strictEqual(partial.learningsHere.length, 0);
  assert.strictEqual(partial.learningsElsewhere[0].originLabel, 'P (R&D-1)');

  console.log('irstasks-include: all assertions passed');
}).catch(err => { console.error(err); process.exit(1); });

// ---- 9. the customer, and why its rows differ by kind -----------------
//
// The platform's rule, already enforced by IRSProjectUI on the AEF form:
// an EXTERNAL project's customer is a Company and carries Email Address;
// an INTERNAL one is a Business Unit or a Department, where that attribute
// does not exist on the type at all.

const external = Context._toCustomer({
  projectType: 'External_Projects', projectTypeLabel: 'External Project',
  linked: 'true', kind: 'external', name: 'Comp-0000001', type: 'Company',
  physicalId: 'C1', displayName: 'GlobalMart Retail Solutions',
  attributes: {
    'Organization Name': 'GlobalMart Retail Solutions', 'Title': 'GlobalMart Retail Solutions',
    'City': 'Chicago', 'Country': 'United States Of America', 'State/Region': '',
    'Address': '', 'Postal Code': '', 'Organization Phone Number': '+1 312 555 0101',
    'Organization Fax Number': '', 'Web Site': '', 'Organization ID': '00000001790163459665',
    'Email Address': 'contact@globalmart.example'
  },
  error: ''
});
assert.strictEqual(external.linked, true);
assert.strictEqual(external.kind, 'external');
assert.strictEqual(external.name, 'GlobalMart Retail Solutions');
let labels = external.rows.map(r => r.label);
assert.deepStrictEqual(labels,
  ['Customer', 'Project Type', 'Contact No', 'Email', 'City', 'Country'],
  'only the fields that HAVE a value, in form order');
assert.strictEqual(external.rows.find(r => r.label === 'Email').value,
  'contact@globalmart.example');

// internal: a Business Unit. No Email row - not empty, absent - and the
// display name must come from Title, because ENOVIA stores the literal word
// "Unknown" in an unset Organization Name
const internal = Context._toCustomer({
  projectType: 'Internal_Projects', projectTypeLabel: 'Internal Project',
  linked: 'true', kind: 'internal', name: 'BU-0000002', type: 'Business Unit',
  displayName: 'RDAREA',
  attributes: {
    'Organization Name': 'Unknown', 'Title': 'RDAREA', 'City': '',
    'Country': 'Unassigned', 'Address': 'Unknown', 'Postal Code': '',
    'Organization Phone Number': '', 'Organization Fax Number': '',
    'Web Site': '', 'Organization ID': 'RDAREA'
  },
  error: ''
});
assert.strictEqual(internal.kind, 'internal');
assert.strictEqual(internal.name, 'RDAREA');
labels = internal.rows.map(r => r.label);
assert.ok(labels.indexOf('Email') < 0,
  'an internal customer has no Email Address attribute at all');
// "Unassigned" and "Unknown" are the platform's placeholders, not values, and
// printing either on a form states something false
assert.ok(labels.indexOf('Country') < 0, '"Unassigned" is not a country');
assert.ok(labels.indexOf('Address') < 0, '"Unknown" is not an address');
assert.deepStrictEqual(labels, ['Customer', 'Project Type']);

// no customer linked: said in words, and never as an empty table
const none = Context._toCustomer({ projectType: '', linked: 'false', kind: '', error: '' });
assert.strictEqual(none.linked, false);
assert.deepStrictEqual(none.rows, []);

// a failed read stays distinguishable from "no customer"
const brokenCustomer = Context._toCustomer({ error: 'no such relationship' });
assert.strictEqual(brokenCustomer.error, 'no such relationship');
assert.strictEqual(brokenCustomer.linked, false);

// a response with no customer key at all must not throw
assert.strictEqual(Context._shape({}).customer.linked, false);

// and the form asks for the section
assert.deepStrictEqual(
  Context.sectionsFor({ fields: [{ source: 'service', display: 'customer' }] }),
  ['customer']);
assert.ok(Context.sectionsFor(spec).indexOf('customer') >= 0,
  'R&D-PRJ-01 II needs the customer');

console.log('irstasks-customer: all assertions passed');

// ---- 10. the department, and the Business Unit that owns it -----------

const dept = Context._toDepartment({
  linked: 'true', id: '39261.35329.25183.13796',
  physicalId: '299036CE000033A46AB12391000000AC',
  name: '0000000001', type: 'Department', state: 'Active',
  displayName: 'Hydrodynamics and Multiphysics',
  businessUnit: {
    linked: 'true', id: '39261.35329.25183.13161',
    physicalId: '299036CE000033A46AB11A1500000020',
    name: 'BU-0000001', type: 'Business Unit',
    displayName: 'Research and Development'
  },
  error: ''
});
assert.strictEqual(dept.linked, true);
assert.strictEqual(dept.name, 'Hydrodynamics and Multiphysics');
// the autonamed id is kept but never shown as the name: "0000000001" tells a
// reader nothing
assert.strictEqual(dept.code, '0000000001');
assert.strictEqual(dept.id, '299036CE000033A46AB12391000000AC', 'the physical id links out');
assert.strictEqual(dept.businessUnit.linked, true);
assert.strictEqual(dept.businessUnit.name, 'Research and Development');

// a department with no owning Business Unit reports that, rather than
// arriving as a row of empty strings
const orphan = Context._toDepartment({
  linked: 'true', name: '0000000002', displayName: 'Loose Department',
  businessUnit: { linked: 'false' }, error: ''
});
assert.strictEqual(orphan.businessUnit.linked, false);
assert.strictEqual(orphan.name, 'Loose Department');

// the platform's placeholder is not a name here either
const placeheld = Context._toDepartment({
  linked: 'true', name: 'BU-0000002', displayName: 'Unknown',
  businessUnit: { linked: 'false' }, error: ''
});
assert.strictEqual(placeheld.name, 'BU-0000002',
  '"Unknown" is a placeholder, so the code is the better answer');

const noDept = Context._toDepartment({ linked: 'false', error: '' });
assert.strictEqual(noDept.linked, false);
assert.strictEqual(Context._shape({}).department.linked, false, 'absent must not throw');

assert.deepStrictEqual(
  Context.sectionsFor({ fields: [{ source: 'service', display: 'department' }] }),
  ['department']);
assert.ok(Context.sectionsFor(spec).indexOf('department') >= 0,
  'the form header needs the department');

// ---- 11. the Summary Report layout ------------------------------------
//
// The layout the user asked for on 2026-10-08 is a DOM decision, and until now
// nothing tested the DOM at all - the suite stopped at the resolver. A stub
// `document` is enough: the questions are which element a row lands in and
// what text it carries, not how a browser paints it.

const DOC = {
  createElement: (tag) => ({
    tagName: tag.toUpperCase(), className: '', textContent: '',
    children: [], style: {}, setAttribute() {},
    // the panel wires click handlers and toggles `disabled`; the stub only has
    // to accept them - the suite asserts structure, not interaction
    listeners: {},
    addEventListener(name, fn) { this.listeners[name] = fn; },
    appendChild(child) { this.children.push(child); return child; },
    get firstChild() { return this.children[0] || null; },
    removeChild(child) {
      this.children.splice(this.children.indexOf(child), 1); return child;
    }
  })
};
global.document = DOC;

function walk(node, visit) {
  visit(node);
  node.children.forEach(child => walk(child, visit));
}

function findAll(node, className) {
  const out = [];
  walk(node, n => {
    if ((' ' + n.className + ' ').indexOf(' ' + className + ' ') >= 0) { out.push(n); }
  });
  return out;
}

function allText(node) {
  let out = '';
  walk(node, n => { out += n.textContent + '\n'; });
  return out;
}

const layoutRows = spec.fields.map(f => View._resolve(f, task, project));
const page = View._main(spec, { typeLabel: 'x' }, project, layoutRows, null);

// short fields pair off: Project Name and Project No. are adjacent on the
// paper form, so they are adjacent cells of the SAME grid
const grids = findAll(page, 'irs-kv-grid');
assert.ok(grids.length >= 1, 'the short fields collect into at least one grid');
const firstGrid = grids[0].children.map(col => allText(col).trim().split('\n')[0]);
assert.strictEqual(firstGrid[0], 'Project Name');
assert.strictEqual(firstGrid[1], 'Project No.');

// every pair is half a line wide - that is what "side by side" is made of
grids.forEach(grid => grid.children.forEach(col => {
  assert.ok(col.className.indexOf('col-md-6') >= 0, 'a pair is half a line wide');
}));

// the long sections get a ruled heading, carrying the form's own numeral
const heads = findAll(page, 'irs-sum-head').map(n => n.textContent);
assert.ok(heads.indexOf('III. Need of the Project') >= 0,
  'a prose section is a ruled heading with its printed section number');
assert.ok(heads.indexOf('XIII. Risks and opportunities') >= 0);
// `Header` and `Footer` are our grouping words, not printed on the form
assert.ok(!allText(page).match(/\bHeader\b|\bFooter\b/),
  'our own grouping words never reach the page');

// and NOT one of the notes - the user asked for the form, not guidance about it
const text = allText(page);
spec.fields.filter(f => f.note).forEach(f => {
  assert.ok(text.indexOf(f.note) < 0,
    'the note for "' + f.label + '" must not be rendered');
});

// a field the platform did not return says so in its own cell, with no banner
// and no second line under the row
const missingRow = View._resolve(
  { label: 'Nope', source: 'project', field: 'EPMNotThere' }, task, project);
assert.strictEqual(missingRow.missing, true);
const missingPage = View._main(spec, { typeLabel: 'x' }, project, [missingRow], null);
assert.ok(allText(missingPage).indexOf('not returned') >= 0);

// the two tables under one heading must come out identical, or their columns
// do not meet - which is what the user saw. Equal declared widths is the whole
// fix; `table-layout: fixed` in the CSS makes the browser honour them
const cols = [
  { label: 'No.', key: 'no', width: '10rem' },
  { label: 'Title', key: 'title' },
  { label: 'State', key: 'state', width: '9rem' }
];
const t1 = View._table(cols, [{ no: 'R-0000006', title: 'TEST RISK', state: 'Complete' }]);
const t2 = View._table(cols, [{ no: 'OPP-0000007', title: 'OPPRTUNIT!', state: 'Complete' }]);
const widths = (t) => findAll(t, 'irs-sum-table')[0]
  .children[0].children[0].children.map(th => th.style.width);
assert.deepStrictEqual(widths(t1), widths(t2),
  'Risks and Opportunities declare the same column widths');
assert.strictEqual(widths(t1)[0], '10rem',
  'a risk number is about twelve characters - it does not get a third of the row');

// the parked rows: hidden, not deleted. Every one of them is a row with no
// value to show yet, and the file still carries its field name and its note
const hidden = spec.fields.filter(f => f.hidden);
assert.strictEqual(hidden.length, 5);
hidden.forEach(f => {
  assert.ok(f.source === 'none' || f.display === 'pending',
    '"' + f.label + '" is hidden, so it must be a row that has no value yet');
  assert.ok(f.note, 'a hidden row keeps its note - that is the point of parking it');
});
assert.strictEqual(spec.fields.length, 23, 'nothing was removed from the file');

delete global.document;

// ---- 12. deliverables and attachments ---------------------------------
//
// Both come from the task call the page already makes. Measured live on
// T-85756263-0000137 (2026-10-08), which is the shape this fixture copies:
//   relateddata.deliverables -> DOC-...0021 "config.toml" .toml  hasfiles TRUE
//   relateddata.references   -> DOC-...0019 "JIWAN TEST"  .pdf   hasfiles TRUE
// `references` is the ATTACHMENTS slot. It was empty in the October capture
// only because nothing had been attached, which is why it looked unused.

const withDocs = Detail._toTask({
  id: 'T1', type: 'EPMPROJECT_PROPOSAL',
  dataelements: { state: 'Assign' },
  relateddata: {
    deliverables: [{
      id: 'D21', type: 'Document',
      dataelements: {
        name: 'DOC-85756263-0000021', title: 'config.toml', revision: '0',
        stateNLS: 'In Work', typeNLS: 'Document',
        hasfiles: 'TRUE', fileExtension: '.toml'
      }
    }],
    references: [{
      id: 'D19', type: 'Document',
      dataelements: {
        name: 'DOC-85756263-0000019', title: 'JIWAN TEST', revision: '0',
        stateNLS: 'In Work', typeNLS: 'Document',
        hasfiles: 'TRUE', fileExtension: '.pdf'
      }
    }]
  }
});

assert.strictEqual(withDocs.deliverables.length, 1);
assert.strictEqual(withDocs.attachments.length, 1);
assert.strictEqual(withDocs.deliverables[0].title, 'config.toml');
assert.strictEqual(withDocs.attachments[0].title, 'JIWAN TEST');
assert.strictEqual(withDocs.deliverables[0].kind, 'deliverable');
assert.strictEqual(withDocs.attachments[0].kind, 'attachment');
// the platform spells its booleans as the STRINGS "TRUE"/"FALSE"
assert.strictEqual(withDocs.attachments[0].hasFiles, true);
assert.strictEqual(withDocs.attachments[0].extension, '.pdf');
// the first deliverable is still exposed the old way - nothing that read it broke
assert.strictEqual(withDocs.documentId, 'D21');

// a Document with nothing checked in is NORMAL here: every deliverable in the
// October capture was one, and the panel must not offer a button for it
const noFile = Detail._toTask({
  id: 'T2', type: 'EPMPROJECT_PROPOSAL', dataelements: {},
  relateddata: { deliverables: [{ id: 'D1', dataelements: { name: 'PPF-0000004', hasfiles: 'FALSE' } }] }
});
assert.strictEqual(noFile.deliverables[0].hasFiles, false);
assert.deepStrictEqual(noFile.attachments, [], 'no references key must not throw');

// and the call asks for them. This is the whole reason the panel costs no
// round trip of its own.
//
// Its OWN Request and its OWN module instance: sections above still have
// promise chains in flight against the shared fake, and replacing its bodies
// underneath them is exactly the bug that bit section 8
const DocRequest = {
  _calls: [],
  get: function (p, opts) {
    DocRequest._calls.push({ path: p, opts: opts });
    return Promise.resolve({ data: [{ id: 'T1', dataelements: {} }] });
  }
};
const DocDetail = load(path.join(base, 'js/services/TaskDetailService.js'),
  [DocRequest, Fields, Log]);
DocDetail.get('T1');
assert.strictEqual(DocRequest._calls[0].opts.params['$include'],
  'assignees,deliverables,references',
  'deliverables AND references ride in the call the page already makes');

// ---- the download: ticket, then the browser --------------------------

const TicketRequest = {
  _calls: [],
  _body: null,
  send: function (p, opts) {
    TicketRequest._calls.push({ path: p, opts: opts });
    return TicketRequest._body instanceof Error
      ? Promise.reject(TicketRequest._body)
      : Promise.resolve(TicketRequest._body);
  }
};
const Docs = load(path.join(base, 'js/services/DocumentService.js'),
  [TicketRequest, Log]);

// the response shape is the vendor's `x-schemas/DownloadTicket`, read out of
// the OpenAPI document - the guide lists the endpoint but never prints it
TicketRequest._body = {
  data: [{ dataelements: {
    ticketURL: 'https://host/fcs/servlet/fcs/checkout?__fcs__jobTicket=ABC',
    fileName: 'config.toml'
  } }]
};

const ticketChecks = Docs._ticket('D21').then(t => {
  assert.strictEqual(t.url, 'https://host/fcs/servlet/fcs/checkout?__fcs__jobTicket=ABC');
  assert.strictEqual(t.fileName, 'config.toml');
  const call = TicketRequest._calls[0];
  assert.strictEqual(call.path, 'resources/v1/modeler/documents/D21/files/DownloadTicket');
  // PUT, so Request.send attaches the CSRF token and retries once on a token
  // failure - which is why this does not call fetch itself
  assert.strictEqual(call.opts.method, 'PUT');
}).then(() => {
  // a 200 carrying no ticket is the platform's answer, not a transport fault
  TicketRequest._body = { data: [{ dataelements: {} }] };
  return Docs._ticket('D21').then(
    () => { throw new Error('a ticketless 200 must reject'); },
    err => assert.ok(/no download ticket/i.test(err.message)));
}).then(() => {
  return Docs._ticket('').then(
    () => { throw new Error('a missing id must reject'); },
    err => assert.ok(/document id/i.test(err.message)));
});

// ---- the panel ---------------------------------------------------------

const PANEL_DOC = {
  createElement: DOC.createElement,
  createElementNS: (ns, tag) => Object.assign(DOC.createElement(tag), { ns: ns })
};
global.document = PANEL_DOC;
const Panel = load(path.join(base, 'js/views/TaskDocumentsPanel.js'), [Docs, Log]);

Panel._setCollapsed(false);
const rendered = Panel.render(withDocs);
const panelText = allText(rendered);
assert.ok(panelText.indexOf('Deliverables') >= 0 && panelText.indexOf('Attachments') >= 0,
  'two headed groups, never merged - they mean different things');
assert.ok(panelText.indexOf('config.toml') >= 0 && panelText.indexOf('JIWAN TEST') >= 0);
// the autonamed id identifies the object but describes nothing, so the TITLE
// is the line that gets scanned and the id goes underneath
assert.ok(panelText.indexOf('DOC-85756263-0000021') >= 0);
assert.strictEqual(findAll(rendered, 'irs-doc-btn').length, 2,
  'both documents have a file, so both get a download button');

// no file, no button - and it says so rather than leaving a silent gap
const bare = Panel.render(noFile);
assert.strictEqual(findAll(bare, 'irs-doc-btn').length, 0);
assert.ok(allText(bare).indexOf('no file') >= 0);
assert.ok(allText(bare).indexOf('None on this task.') >= 0,
  'an empty group still states itself, so a reader knows it was checked');

// the collapse state is module-level: it follows the user between tasks in a
// session, and a reload goes back to open because that is the frequent case
Panel._setCollapsed(true);
assert.strictEqual(Panel._isCollapsed(), true);
const shut = Panel.render(withDocs);
assert.ok(allText(shut).indexOf('Documents') >= 0 &&
          allText(shut).indexOf('2') >= 0,
  'a collapsed panel keeps its counts - otherwise it must be opened to find out');
Panel._setCollapsed(false);

global.document = DOC;

delete global.document;

ticketChecks.then(() => console.log('irstasks-documents: all assertions passed'))
  .catch(err => { console.error(err); process.exit(1); });

console.log('irstasks-department: all assertions passed');
