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
// two panels now: documents, then the approval chain under it
const View = load(path.join(base, 'js/views/TaskDetailView.js'),
  [Detail, Context, {}, PanelStub, PanelStub, Fields,
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

/*
 * This section runs against a CAPTURED live response, and that file went
 * missing from the workspace on 2026-10-08 - the folder is empty and it is
 * nowhere on the drive. It was read successfully earlier the same day and was
 * never written to; cause unknown.
 *
 * A missing fixture used to take the WHOLE file down with it, because it is
 * read at load time - which left sections 1-3 and 5-17 unverifiable over one
 * absent input. So the read is guarded and this section alone is skipped, as
 * loudly as a console can manage.
 *
 * It is skipped, NOT replaced. Rebuilding the capture from live data to satisfy
 * the assertions that depend on it would make them pass by construction instead
 * of by evidence, which is worse than not running them.
 */
const capture = fs.existsSync(CAPTURE)
  ? JSON.parse(fs.readFileSync(CAPTURE, 'utf8')) : null;
const proposal = capture && capture.data.find(t => t.type === 'EPMPROJECT_PROPOSAL' &&
  (t.relateddata || {}).deliverables && t.relateddata.deliverables.length);

if (!capture) {
  console.warn('');
  console.warn('!! irstasks-detail SECTION 4 SKIPPED - the captured response is missing:');
  console.warn('   ' + CAPTURE);
  console.warn('   Everything else still runs. Restore the file to re-enable it.');
  console.warn('');
} else {
  assert.ok(proposal, 'the capture must contain a proposal task with a document');
}

if (proposal) {
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
}

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
/*
 * This section's subject is the two CALLS and their parameters; the task body
 * is incidental to it. So when the capture is missing (see section 4) a minimal
 * task stands in, and the call assertions still run. Nothing here reconstructs
 * the lost evidence - section 4, which actually tests the captured shape, stays
 * skipped.
 */
const taskForCalls = proposal || {
  id: 'TASK1', type: 'EPMPROJECT_PROPOSAL',
  dataelements: { title: 'T-0000001', state: 'Review' },
  relateddata: { DPMProject: [{ id: 'P1', type: 'EPMAnalysisProject',
                                dataelements: { name: 'Solize XYZ' } }] }
};
Request._bodies = {
  'resources/v1/modeler/tasks/': { data: [taskForCalls] },
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
    children: [], style: {},
    setAttribute(name, value) { this['_attr_' + name] = value; },
    hasAttribute(name) { return this['_attr_' + name] !== undefined; },
    // the panel wires click handlers and toggles `disabled`; the stub only has
    // to accept them - the suite asserts structure, not interaction
    listeners: {},
    addEventListener(name, fn) { this.listeners[name] = fn; },
    // the download hands the file over by clicking a detached anchor
    clicked: 0,
    click() { this.clicked += 1; },
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

// the long sections get a ruled heading - the label alone. The paper form's
// numerals were printed here until 2026-10-09, when the user dropped them:
// with the unbuilt sections hidden they ran I, III, V, VIII and the gaps read
// as something that had failed to load
const heads = findAll(page, 'irs-sum-head').map(n => n.textContent);
assert.ok(heads.indexOf('Need of the Project') >= 0,
  'a prose section is a ruled heading, with no numeral in front of it');
assert.ok(heads.indexOf('Risks and opportunities') >= 0);
assert.ok(!heads.some(h => /^[IVX]+\.\s/.test(h)),
  'no heading carries a section number');
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
  'assignees,deliverables,references,route',
  'deliverables, references AND route all ride in the one call the page makes');

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
  // the three parameters the OOTB Document widget sends, copied from its own
  // request on 2026-10-08. `useObjectNameForZip` is what names the zip after
  // the object when a document holds several files - one document on this
  // system holds four, and the SERVER decides, not us
  assert.deepStrictEqual(call.opts.params, {
    useDOCMParamSettings: 'true',
    useObjectNameForZip: 'true',
    lightweight: 'false'
  });
}).then(() => {
  // a multi-file document answers with `fileNames`, not `fileName`
  TicketRequest._body = { data: [{ dataelements: {
    ticketURL: 'https://host/fcs/servlet/fcs/checkout',
    fileNames: '[a.docx, b.xlsx, c.pdf, d.txt]'
  } }] };
  return Docs._ticket('MULTI').then(t => {
    assert.strictEqual(t.zipped, true, 'several files - the server zipped them');
    assert.strictEqual(t.fileName, '');
    assert.ok(t.fileNames.indexOf('a.docx') >= 0);
  });
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

// ---- how the file reaches the browser ---------------------------------
//
// THE REGRESSION. The first version called `window.open`, and measured live on
// 2026-10-08 that left the 194 KB PDF sitting in a tab on a Chrome error page
// while the 231-byte .toml downloaded cleanly - the user's "the second one is
// not opening". Both tickets were fine: each answered 200 with
// `Content-Disposition: attachment` and the right byte count, checked directly.
//
// The platform's own Document widget opens no tab at all - it clicks a detached
// element and removes it. "No tab" is the assertion that would have caught
// this, so here it is.

const ANCHOR_DOC = {
  created: [],
  body: {
    appended: [], removed: [],
    appendChild(n) { this.appended.push(n); return n; },
    removeChild(n) { this.removed.push(n); return n; }
  },
  createElement(tag) {
    const node = DOC.createElement(tag);
    ANCHOR_DOC.created.push(node);
    return node;
  }
};
const savedDoc = global.document;
const savedWindow = global.window;
global.document = ANCHOR_DOC;
let openCalls = 0;
global.window = { open: () => { openCalls += 1; } };

Docs._handToBrowser('https://host/fcs/servlet/fcs/checkout', 'config.toml');

assert.strictEqual(openCalls, 0, 'NO tab is opened - that was the bug');
const anchor = ANCHOR_DOC.created[ANCHOR_DOC.created.length - 1];
assert.strictEqual(anchor.tagName, 'A');
assert.strictEqual(anchor.clicked, 1, 'clicking the anchor is what starts the download');
assert.strictEqual(anchor.rel, 'noopener noreferrer',
  'the FCS origin must never get a handle on the dashboard window');
assert.strictEqual(anchor.style.display, 'none');
// appended and removed again: an FCS ticket is single use, so a link left in
// the page is a button that cannot work a second time
assert.strictEqual(ANCHOR_DOC.body.appended.length, 1);
assert.strictEqual(ANCHOR_DOC.body.removed.length, 1);
assert.strictEqual(ANCHOR_DOC.body.removed[0], anchor);

global.document = savedDoc;
if (savedWindow === undefined) { delete global.window; } else { global.window = savedWindow; }

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

// ---- 13. Bootstrap first, custom CSS last -----------------------------
//
// The development rule is minimal custom CSS (CLAUDE.md), and both of these
// features were first written with a block of hand-made rules. They were
// audited against the bundled Bootstrap 5.3.8 and nearly all of it turned out
// to be a utility that already exists. This locks that in: a selector that
// comes back here is a utility somebody stopped using.

const css = fs.readFileSync(path.join(base, 'css/IRSTasks.css'), 'utf8');
[
  '.irs-kv', '.irs-kv-label', '.irs-kv-value', '.irs-kv-grid',
  '.irs-sum-head', '.irs-sum-sub', '.irs-sum-text',
  '.irs-docs-sticky', '.irs-docs-toggle', '.irs-docs-header',
  '.irs-doc-head', '.irs-doc-count', '.irs-doc-title', '.irs-doc-meta',
  '.irs-doc-btn', '.irs-doc-nofile', '.irs-doc-empty', '.irs-doc-group'
].forEach(selector => {
  assert.ok(css.indexOf(selector + ' {') < 0 && css.indexOf(selector + ',') < 0,
    selector + ' has a Bootstrap utility - it must not be hand-written');
});

// the four that survive, each because 5.3.8 genuinely has no utility:
//   table-layout: fixed   `w-50` is a suggestion, not binding
//   min-width: 0          there is no `min-w-0` class in 5.3.8
//   font-size             the widget's density scale, as everywhere else here
//   max-height            `overflow-auto` exists, a viewport max-height does not
//   width                 5.3.8 has no min-w-* / w-56 scale for a fixed box
//   object-fit + height   no utility at all; img-fluid caps the WRONG axis
//   decision bar size    every Bootstrap `fs-*` is rem, and this widget scales
//                         its root - 1rem is 10px here, so `fs-6` SHRANK it
['.irs-sum-table', '.irs-min0', '.irs-docs', '.irs-docs-body',
 '.irs-step-box', '.irs-sign', '.irs-decide']
  .forEach(selector => {
    assert.ok(css.indexOf(selector + ' {') >= 0, selector + ' is still needed');
  });

// and the view must actually USE the utilities, or the rules above are simply
// missing rather than replaced
const viewSrc = fs.readFileSync(path.join(base, 'js/views/TaskDetailView.js'), 'utf8');
assert.ok(viewSrc.indexOf('sticky-top') >= 0, "Bootstrap's own sticky, not ours");
assert.ok(/col-5 fw-semibold/.test(viewSrc), 'the label column is a Bootstrap column');
const panelSrc = fs.readFileSync(path.join(base, 'js/views/TaskDocumentsPanel.js'), 'utf8');
assert.ok(/badge rounded-pill/.test(panelSrc), "Bootstrap's pill badge for the counts");
assert.ok(/text-truncate/.test(panelSrc), 'Bootstrap truncates the long file names');
assert.ok(/btn-light/.test(panelSrc),
  'btn-light brings the hover and focus ring, so the toggle needs no rule');

// ---- 14. the route, and the inbox tasks on it -------------------------
//
// Measured against 33 LIVE routes on 2026-10-08 - every route reachable from
// the 75 tasks the landing list returns:
//
//     Finished    / Approved                28
//     Not Started / Not Started              4
//     Started     / Awaiting your Approval   1
//
// Two things the POC's own documentation gets wrong on this platform, and both
// are asserted here so a future edit cannot quietly reintroduce them:
//
//   * the role is `title`. `assigneeTitle` came back "", "" and the literal
//     string "title" across one route's three steps.
//   * `revision` / `isLatestRevision` DO NOT EXIST - not on any of the 33. The
//     POC keeps only `isLatestRevision === 'TRUE'`, which here keeps nothing.

// its OWN fake, and its own module instance: section 12 learned this the hard
// way, and section 8 before it. A shared fake is clobbered while an earlier
// section's promise chain is still pending
const RouteRequest = {
  _calls: [],
  _body: null,
  get: function (p, opts) {
    RouteRequest._calls.push({ path: p, opts: opts });
    return RouteRequest._body instanceof Error
      ? Promise.reject(RouteRequest._body)
      : Promise.resolve(RouteRequest._body);
  }
};
const Routes = load(path.join(base, 'js/services/RouteService.js'),
  [RouteRequest, Log]);

// the finished route, exactly as the live system answered it
const FINISHED = {
  id: 'R1',
  name: 'Personnel and Cost Estimation approval route',
  state: 'Complete', routeStatus: 'Finished', activityState: 'Approved',
  ownerFullName: 'Sharad S Dhavalikar',
  tasks: [
    { id: 'IT1', type: 'Inbox Task', taskOrder: '1', title: 'Project Manager',
      assigneeTitle: '', taskAssignee: 'Sharad S Dhavalikar',
      taskAssigneeUsername: 'admin_platform', taskAction: 'Approve',
      approvalStatus: 'Approve', current: 'Complete',
      taskActualCompletionDate: '10/7/2026 1:07:21 PM',
      taskDueDate: '2026-10-08T07:37:08.000Z', comments: '<p>ASDFASD</p>' },
    { id: 'IT2', type: 'Inbox Task', taskOrder: '2', title: 'In-Charge / HOD',
      assigneeTitle: '', taskAssignee: 'Sachin S Awasare',
      taskAction: 'Approve', approvalStatus: 'Approve', current: 'Complete' },
    // `assigneeTitle` is the literal word "title" here - live data, not a typo
    { id: 'IT3', type: 'Inbox Task', taskOrder: '3', title: 'Division Head',
      assigneeTitle: 'title', taskAssignee: 'Dr. Asokendu Samanta',
      taskAction: 'Approve', approvalStatus: 'Approve', current: 'Complete' }
  ]
};

const finished = Routes._toRoute(FINISHED);
assert.strictEqual(finished.status, 'Finished');
assert.strictEqual(finished.finished, true);
assert.strictEqual(finished.rejected, false);
assert.strictEqual(finished.steps.length, 3);
// the role comes from `title`, NOT `assigneeTitle`
assert.deepStrictEqual(finished.steps.map(s => s.role),
  ['Project Manager', 'In-Charge / HOD', 'Division Head']);
// "Division Head" - the POC's table says "Divisional Head", so a hardcoded
// role-to-field map would drop this step. The chain is a LIST for that reason
assert.ok(finished.steps.every(s => !s.pending));
assert.ok(finished.steps.every(s => s.decision === 'Approve'));
assert.strictEqual(finished.currentStep, null, 'a finished route waits on nobody');
assert.strictEqual(finished.steps[0].order, 1, 'taskOrder is a string, made a number');
assert.strictEqual(finished.steps[0].assigneeUsername, 'admin_platform');

// ---- the case the user asked for: the task IS in approval
const IN_APPROVAL = {
  id: 'R2', name: 'Project Proposal approval route',
  state: 'In Process', routeStatus: 'Started',
  activityState: 'Awaiting your Approval',
  tasks: [
    { id: 'IT9', type: 'Inbox Task', taskOrder: '1', title: 'Project Manager',
      taskAssignee: 'Sharad S Dhavalikar', taskAction: 'Approve',
      approvalStatus: 'None', current: 'Assigned',
      taskDueDate: '2026-10-09T07:37:08.000Z' },
    // not reached yet: a Route Node has NEITHER `current` nor `approvalStatus`
    { id: 'RN1', type: 'Route Node', taskOrder: '2', title: 'In-Charge / HOD',
      taskAssignee: 'Sachin S Awasare' },
    { id: 'RN2', type: 'Route Node', taskOrder: '3', title: 'Division Head',
      taskAssignee: 'Dr. Asokendu Samanta' }
  ]
};

const active = Routes._toRoute(IN_APPROVAL);
assert.strictEqual(active.started, true);
assert.strictEqual(active.activityState, 'Awaiting your Approval');
// step 1 is a live inbox task, 2 and 3 have not been reached
assert.deepStrictEqual(active.steps.map(s => s.pending), [false, true, true]);
assert.strictEqual(active.steps[0].waiting, true, 'this is the live inbox task');
assert.strictEqual(active.steps[0].state, 'Assigned');
assert.ok(active.currentStep, 'the route sits on a step');
assert.strictEqual(active.currentStep.role, 'Project Manager');
// a pending step reports NO state and NO decision - not an empty value, no
// value: the platform sends neither field for a Route Node
assert.strictEqual(active.steps[1].state, '');
assert.strictEqual(active.steps[1].decision, '');
assert.strictEqual(active.steps[1].waiting, false,
  'a step that has not been reached is not waiting on anybody');

// ---- a rejected route is `Stopped`, and `state` cannot tell you
const rejectedRoute = Routes._toRoute({
  id: 'R3', routeStatus: 'Stopped', state: 'Complete', activityState: 'Rejected',
  tasks: [
    { type: 'Inbox Task', taskOrder: '1', title: 'Project Manager',
      approvalStatus: 'Approve', current: 'Complete' },
    { type: 'Inbox Task', taskOrder: '2', title: 'In-Charge / HOD',
      approvalStatus: 'Reject', current: 'Complete' },
    { type: 'Route Node', taskOrder: '3', title: 'Division Head' }
  ]
});
assert.strictEqual(rejectedRoute.rejected, true);
assert.strictEqual(rejectedRoute.finished, false,
  '`state` is Complete for a rejection too - only routeStatus separates them');
assert.strictEqual(rejectedRoute.steps[1].decision, 'Reject');
// the route stopped at the HOD, so the Division Head never received anything
assert.strictEqual(rejectedRoute.steps[2].pending, true);

// ---- not started: every step is still a node
const notStarted = Routes._toRoute({
  id: 'R4', routeStatus: 'Not Started', state: 'Define',
  activityState: 'Not Started',
  tasks: [{ type: 'Route Node', taskOrder: '1', title: 'Project Manager' },
          { type: 'Route Node', taskOrder: '2', title: 'In-Charge / HOD' }]
});
assert.strictEqual(notStarted.notStarted, true);
assert.ok(notStarted.steps.every(s => s.pending));
assert.strictEqual(notStarted.currentStep, null);

// ---- steps are sorted by the platform's own taskOrder, not by arrival
const shuffled = Routes._toRoute({
  id: 'R5', routeStatus: 'Finished',
  tasks: [{ type: 'Inbox Task', taskOrder: '3', title: 'C' },
          { type: 'Inbox Task', taskOrder: '1', title: 'A' },
          { type: 'Inbox Task', taskOrder: '2', title: 'B' }]
});
assert.deepStrictEqual(shuffled.steps.map(s => s.role), ['A', 'B', 'C']);

// ---- the route resource answers FLAT, but dataelements is read too
const nestedRoute = Routes._toRoute({
  id: 'R6', dataelements: { routeStatus: 'Finished', name: 'nested route' },
  tasks: []
});
assert.strictEqual(nestedRoute.status, 'Finished',
  'the POC analysis note shows these nested; live data is flat. Read both');
assert.strictEqual(nestedRoute.name, 'nested route');

// ---- the call, and what it costs
const routeChecks = Routes.forTask({ routes: [] }).then(list => {
  assert.deepStrictEqual(list, [],
    'no route is the NORMAL state of a task never sent for approval');
  assert.strictEqual(RouteRequest._calls.length, 0,
    'and it costs no call at all - 16 of the 65 captured tasks have no route');

  RouteRequest._body = { data: [FINISHED] };
  return Routes.forTask({ routes: [{ id: 'R1', name: 'route one' }] });
}).then(list => {
  assert.strictEqual(list.length, 1);
  assert.strictEqual(RouteRequest._calls.length, 1, 'ONE call per route');
  const call = RouteRequest._calls[0];
  assert.strictEqual(call.path, 'resources/v1/modeler/dsrt/routes/R1');
  // undocumented in the 2024x Routes spec - the API-labs validator rejects it -
  // but the only way to read the chain, and proven on all 33 live routes
  assert.deepStrictEqual(call.opts.params, { '$include': 'tasks' });
  assert.deepStrictEqual(list[0].steps.map(s => s.role),
    ['Project Manager', 'In-Charge / HOD', 'Division Head']);
}).then(() => {
  // two routes: a task rejected once and resent. Both are kept, because
  // `isLatestRevision` does not exist here to choose between them
  RouteRequest._calls.length = 0;
  RouteRequest._body = { data: [FINISHED] };
  return Routes.forTask({ routes: [{ id: 'R1' }, { id: 'R2' }] });
}).then(list => {
  assert.strictEqual(list.length, 2, 'both cycles are kept');
  assert.strictEqual(RouteRequest._calls.length, 2);
  assert.ok(list.every(r => r.revision === undefined),
    'isLatestRevision/revision are absent here - do not filter on them');
}).then(() => {
  // `$include` is undocumented, so a refusal may BE the parameter. The first
  // attempt is retried once without it, and that recovers the route - with its
  // header but no chain, which is still worth showing
  let n = 0;
  RouteRequest.get = function (p, opts) {
    RouteRequest._calls.push({ path: p, opts: opts });
    n += 1;
    return n === 1
      ? Promise.reject(new Error('400 unknown parameter'))
      : Promise.resolve({ data: [{ id: 'R1', routeStatus: 'Finished' }] });
  };
  RouteRequest._calls.length = 0;
  return Routes.forTask({ routes: [{ id: 'R1' }] });
}).then(list => {
  assert.strictEqual(list.length, 1, 'the retry recovers the route');
  assert.strictEqual(RouteRequest._calls.length, 2, 'exactly one retry');
  assert.deepStrictEqual(RouteRequest._calls[0].opts.params, { '$include': 'tasks' });
  assert.strictEqual(RouteRequest._calls[1].opts, undefined,
    'the retry drops the undocumented parameter');
  assert.strictEqual(list[0].status, 'Finished');
  assert.deepStrictEqual(list[0].steps, [],
    'no chain without $include - the panel then shows the status alone');
}).then(() => {
  // a route that cannot be read AT ALL must not cost the others: a task with
  // two cycles where the older one is gone should still show the current one
  RouteRequest.get = function (p, opts) {
    RouteRequest._calls.push({ path: p, opts: opts });
    return p.indexOf('BAD') >= 0
      ? Promise.reject(new Error('403'))
      : Promise.resolve({ data: [FINISHED] });
  };
  RouteRequest._calls.length = 0;
  return Routes.forTask({ routes: [{ id: 'BAD' }, { id: 'R1' }] });
}).then(list => {
  assert.strictEqual(list.length, 1, 'the readable route still shows');
  assert.strictEqual(list[0].status, 'Finished');
  assert.deepStrictEqual(list[0].steps.map(s => s.role),
    ['Project Manager', 'In-Charge / HOD', 'Division Head']);
});

// ---- 15. the chain is horizontal, below the form, and signed ---------
//
// The user moved it out of the sidebar on 2026-10-08: *"can we have route
// coming horizontally and below the form ... with the date completed ... if
// there is any due date then we put the due date ... then approved comments ...
// and also we need to show the signature"*.

const ApprovalSrc = fs.readFileSync(
  path.join(base, 'js/views/TaskApprovalPanel.js'), 'utf8');

// a horizontal SCROLLING strip: boxes keep their width (`flex-shrink-0`) and
// the strip scrolls, rather than wrapping (which dangles an arrow off the line)
// or shrinking (which squashes the signature past ~4 steps)
assert.ok(/d-flex align-items-stretch overflow-auto/.test(ApprovalSrc),
  'the steps sit in a horizontal strip that scrolls');
assert.ok(/flex-shrink-0/.test(ApprovalSrc),
  'the boxes keep their width instead of squashing');
// the STEP STRIP must not wrap - a wrapped chain leaves an arrow pointing off
// the end of a line. The decision bar's own buttons may and should wrap, so
// this is asserted on the strip's class list, not on the whole file
assert.ok(!/align-items-stretch overflow-auto[^']*flex-wrap/.test(ApprovalSrc),
  'the step strip must not wrap - the arrow would dangle');
assert.ok(/badge rounded-pill/.test(ApprovalSrc),
  "Bootstrap's pill badge for the step numbers and decisions");
assert.ok(/irs-docs/.test(ApprovalSrc),
  'it reuses the documents panel density rule rather than adding a second one');
assert.ok(!/irs-approval\s*\{/.test(
  fs.readFileSync(path.join(base, 'css/IRSTasks.css'), 'utf8')),
  'irs-approval must stay a hook with no rule behind it');
// a rem-based size utility on the decision bar is a BUG here, not a shortcut:
// the widget scales its root, so `fs-6` resolves to 10px and shrinks it
assert.ok(!/irs-decide[^']*fs-\d/.test(ApprovalSrc),
  'the bar must not carry a Bootstrap fs-* utility - they are all rem');
// no hardcoded role-to-field map: the live roles did not match the POC's
assert.ok(!/Divisional Head|route-field-pm/.test(ApprovalSrc),
  'the panel renders whatever roles the route actually has');

// the chain is appended to the page content, NOT to the sidebar column - and
// the sidebar keeps the documents panel only, so nothing is rendered twice
const detailSrc = fs.readFileSync(
  path.join(base, 'js/views/TaskDetailView.js'), 'utf8');
assert.ok(/content\.appendChild\(ApprovalPanel\.render\(task\)\)/.test(detailSrc),
  'the chain goes below the form, full width');
assert.ok(!/sticky\.appendChild\(ApprovalPanel/.test(detailSrc),
  'and is NOT also left in the sidebar - one home for it');
assert.ok(/sticky\.appendChild\(DocumentsPanel/.test(detailSrc),
  'the documents panel stays in the sidebar');

// section 12 deletes `global.document` when it is done with it, so this
// section brings its own - and keeps it for the rest of the file, because the
// signature checks below finish asynchronously. `innerHTML` is the one thing
// the shared stub cannot do, and `plainText` is built on it
const APPROVAL_DOC = {
  createElement(tag) {
    const node = DOC.createElement(tag);
    Object.defineProperty(node, 'innerHTML', {
      set(html) { this.textContent = String(html).replace(/<[^>]*>/g, ''); },
      get() { return this.textContent; }
    });
    return node;
  },
  createElementNS: (ns, tag) => DOC.createElement(tag)
};
global.document = APPROVAL_DOC;

// ---- the dates: one response, two spellings
const ApprovalView = load(path.join(base, 'js/views/TaskApprovalPanel.js'),
  [Routes, { get: () => Promise.resolve(null) }, Log]);

// `taskDueDate` is ISO, `taskActualCompletionDate` is US display - in the SAME
// response. Both must reduce to the same readable form
assert.strictEqual(ApprovalView._shortDate('2026-10-08T07:37:08.000Z'), '8 Oct 2026');
assert.strictEqual(ApprovalView._shortDate('10/7/2026 1:07:21 PM'), '7 Oct 2026');
assert.strictEqual(ApprovalView._shortDate(''), '');
// a date we cannot parse is still better shown than replaced with a dash
assert.strictEqual(ApprovalView._shortDate('whenever'), 'whenever');

// ---- the comments arrive as HTML and are shown as words
assert.strictEqual(ApprovalView._plainText('<p>ASDFASD</p>\n'), 'ASDFASD');
assert.strictEqual(ApprovalView._plainText(''), '');

// ---- the badges
assert.strictEqual(ApprovalView._stepBadge({ pending: true }).text, 'Not yet reached');
assert.strictEqual(ApprovalView._stepBadge({ decision: 'Approve' }).text, 'Approved');
assert.strictEqual(ApprovalView._stepBadge({ decision: 'Reject' }).text, 'Rejected');
// "Awaiting Approve" is not English - the common verb is named properly
assert.strictEqual(
  ApprovalView._stepBadge({ waiting: true, action: 'Approve' }).text, 'Awaiting approval');
assert.strictEqual(
  ApprovalView._stepBadge({ waiting: true, action: 'Notify' }).text, 'Awaiting Notify');

// ---- the signature service
//
// `{loginId}` is the person's platform login, and a route step already carries
// it as `taskAssigneeUsername` - so the chain needs NO person lookup. Measured
// on the finished route of T-85756263-0000134, 2026-10-08: all three approvers
// are exactly the three logins the pilot serves, each 200 image/svg+xml.
const SigRequest = {
  _calls: [],
  _body: null,
  get: function (p, opts) {
    SigRequest._calls.push({ path: p, opts: opts });
    return SigRequest._body instanceof Error
      ? Promise.reject(SigRequest._body)
      : Promise.resolve(SigRequest._body);
  }
};
global.Blob = function (parts, opts) { this.parts = parts; this.type = opts && opts.type; };
global.URL = { createObjectURL: () => 'blob:signature' };

const Sig = load(path.join(base, 'js/services/SignatureService.js'),
  [SigRequest, Log]);

SigRequest._body = '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="190"></svg>';
const sigChecks = Sig.get('admin_platform').then(url => {
  assert.strictEqual(url, 'blob:signature');
  const call = SigRequest._calls[0];
  assert.strictEqual(call.path, 'resources/v1/irs/signatures/admin_platform');
  // the response is SVG markup, not JSON - the default parser would throw
  assert.strictEqual(call.opts.type, 'text');
  // THE REGRESSION, 2026-10-08: the service produces image/svg+xml only, and
  // without this header it answered 406 Not Acceptable, so every signature came
  // back empty. The direct probe that "proved" the endpoint set Accept by hand,
  // which is exactly why it hid the bug
  assert.strictEqual(call.opts.headers['Accept'], 'image/svg+xml',
    'the service produces SVG only - without Accept it answers 406');
}).then(() => {
  // cached per login: the same person signs more than one step on a multi-cycle
  // task, and the panel re-renders whenever the page is reopened
  SigRequest._calls.length = 0;
  return Sig.get('admin_platform');
}).then(url => {
  assert.strictEqual(url, 'blob:signature');
  assert.strictEqual(SigRequest._calls.length, 0, 'the second ask costs no call');
}).then(() => {
  // a person with no signature is NORMAL - the pilot serves exactly three
  // logins and 404s everyone else. It must RESOLVE null, not reject, or every
  // caller writes the same catch and a missing signature looks like a failure
  Sig._reset();
  SigRequest._body = new Error('404');
  return Sig.get('SomeoneElse');
}).then(url => {
  assert.strictEqual(url, null, 'no signature is not an error');
}).then(() => {
  // a 3DPassport redirect arrives as an HTML login page, not an SVG. Rendering
  // that as an image would show a broken icon
  Sig._reset();
  SigRequest._body = '<!DOCTYPE html><html><body>login</body></html>';
  return Sig.get('admin_platform');
}).then(url => {
  assert.strictEqual(url, null, 'an HTML login page is not a signature');
}).then(() => {
  // the miss is cached too - a 404 must not become a 404 per step
  SigRequest._calls.length = 0;
  return Sig.get('admin_platform');
}).then(() => {
  assert.strictEqual(SigRequest._calls.length, 0, 'a miss is cached as well');
}).then(() => {
  // no signature is asked for on a step nobody has acted on: a signature
  // against an unreached step would be a claim the data does not make
  let asked = [];
  // set again HERE, not only at the top of the section: section 7's rejection
  // handler does `delete global.document` asynchronously, so by the time this
  // callback runs the stub set synchronously above is gone
  global.document = APPROVAL_DOC;
  const SpyPanel = load(path.join(base, 'js/views/TaskApprovalPanel.js'),
    [Routes, { get: (id) => { asked.push(id); return Promise.resolve(null); } }, Log]);
  SpyPanel._stepBox({ order: 2, role: 'In-Charge / HOD', pending: true,
                      assigneeUsername: 'PlmUser2' });
  assert.deepStrictEqual(asked, [], 'a pending step shows no signature');
  SpyPanel._stepBox({ order: 1, role: 'Project Manager', pending: false,
                      decision: 'Approve', assigneeUsername: 'admin_platform' });
  assert.deepStrictEqual(asked, ['admin_platform'],
    'a decided step asks for its signature, keyed by taskAssigneeUsername');
});

// ---- 16. the inbox tasks, and the connection check --------------------
//
// *"first we capture the task with inbox task and check whether the task is
// connected to our custom type and show"* (user, 2026-10-08).
//
// An inbox task carries the object being approved in `relateddata.contents`,
// so the check is `Fields.isListed(contents[0].type)` - the SAME allow-list the
// landing grid uses for tasks, asked of the connected object instead.
//
// Measured live across the 29 inbox tasks the resource returns:
//     28  connected to one of our four subtypes   -> kept
//      1  no `contents` at all                    -> dropped
//      0  connected to something else

const InboxRequest = {
  _calls: [],
  _body: null,
  get: function (p, opts) {
    InboxRequest._calls.push({ path: p, opts: opts });
    return InboxRequest._body instanceof Error
      ? Promise.reject(InboxRequest._body)
      : Promise.resolve(InboxRequest._body);
  }
};
const Inbox = load(path.join(base, 'js/services/InboxTaskService.js'),
  [InboxRequest, Fields, Log]);

/** An inbox task as the live resource sends one. */
function inboxTask(over) {
  const o = over || {};
  return {
    id: o.id || 'IT1',
    type: 'Inbox Task',
    dataelements: {
      title: o.role || 'Project Manager',
      name: o.name || 'IT-85756263-0000181',
      state: o.state || 'Assign',
      routeTaskAction: 'Approve',
      routeTaskApprovalAction: o.decision || 'None',
      routeTaskApprovalComments: o.comments || '',
      routeTaskDueDate: o.due || '2026-10-09T16:07:59.000Z',
      routeTaskInstructions: 'Review the form and approve it as Project Manager.',
      routeTaskRequiresESign: 'False',
      modifyAccess: o.modifyAccess || 'TRUE'
    },
    relateddata: {
      assignees: [{ dataelements: { name: 'admin_platform',
                                    firstname: 'Sharad S', lastname: 'Dhavalikar' } }],
      route: [{ id: 'R1', dataelements: { name: 'Project Proposal approval route' } }],
      contents: o.contents === null ? [] : (o.contents || [{
        id: 'TASK9', type: o.contentType || 'EPMPROJECT_PROPOSAL',
        dataelements: { name: 'T-85756263-0000143', title: 'T-85756263-0000143',
                        stateNLS: 'In Approval',
                        typeNLS: 'PROJECT PROPOSAL / PROFILE' }
      }])
    }
  };
}

// ---- the shaping
const inboxRow = Inbox._toRow(inboxTask());
assert.strictEqual(inboxRow.role, 'Project Manager',
  "the inbox task's own title IS the role");
assert.strictEqual(inboxRow.state, 'Assign');
assert.strictEqual(inboxRow.decided, false);
assert.strictEqual(inboxRow.action, 'Approve');
// `None` is the platform's way of saying "not decided" - it must not surface
// as a decision, or the grid would show every waiting row as decided "None"
assert.strictEqual(inboxRow.decision, '');
assert.strictEqual(inboxRow.modifiable, true, 'ENOVIA booleans are STRINGS');
assert.strictEqual(inboxRow.assignedTo, 'Sharad S Dhavalikar');
assert.strictEqual(inboxRow.routeName, 'Project Proposal approval route');

// ---- the connection: this is the check the user asked for
assert.ok(inboxRow.connected, 'the connected task is resolved');
assert.strictEqual(inboxRow.connected.id, 'TASK9');
assert.strictEqual(inboxRow.connected.type, 'EPMPROJECT_PROPOSAL');
assert.strictEqual(inboxRow.connected.ours, true, 'it IS one of our subtypes');
assert.strictEqual(inboxRow.connectedName, 'T-85756263-0000143');
assert.strictEqual(inboxRow.connectedState, 'In Approval');
// the platform's own display name for the type, not ours, when it sends one
assert.strictEqual(inboxRow.connectedTypeLabel, 'PROJECT PROPOSAL / PROFILE');

// a decided step reports its decision and loses nothing else
const done = Inbox._toRow(inboxTask({ state: 'Complete', decision: 'Approve',
                                      comments: '<p>ok</p>' }));
assert.strictEqual(done.decided, true);
assert.strictEqual(done.decision, 'Approve');

// an inbox task with NO contents has no connected task at all - `null`, not a
// half-filled shape, so the caller's test is simply `!connected`
assert.strictEqual(Inbox._connectedTask(inboxTask({ contents: null })), null);

// ---- the four subtypes are accepted, anything else is not
['EPMPROJECT_PROPOSAL', 'EPMPROJECT_PERSONNEL_COST',
 'EPMPROJECT_STAGE_VALIDATION', 'EPMPROJECT_REVIEW'].forEach(type => {
  assert.strictEqual(Inbox._toRow(inboxTask({ contentType: type })).connected.ours,
    true, type + ' is ours');
});
['Document', 'Change Action', 'Task', 'EPMTRAINING_TASK'].forEach(type => {
  assert.strictEqual(Inbox._toRow(inboxTask({ contentType: type })).connected.ours,
    false, type + ' is NOT one of the four the grid lists');
});

// ---- the call
const inboxParams = Inbox._params();
// `contents` is the whole point: it is what says which object is being approved
assert.ok(/\bcontents\b/.test(inboxParams['$include']),
  'contents must be asked for, or there is nothing to check the connection with');
// the approver's own tasks. See the service comment: on the one login that
// could be measured this made no difference to the inbox rows, but it is the
// correct intent
assert.strictEqual(inboxParams.currentTaskFilter, 'assigned');

// ---- the filter, end to end, on a mixed response
InboxRequest._body = { data: [
  // an ordinary project task - not an inbox task at all
  { id: 'T1', type: 'EPMPROJECT_PROPOSAL', dataelements: { title: 'T-1' } },
  inboxTask({ id: 'IT1', due: '2026-10-09T00:00:00.000Z' }),
  // connected to something that is not ours
  inboxTask({ id: 'IT2', contentType: 'Change Action' }),
  // connected to nothing
  inboxTask({ id: 'IT3', contents: null }),
  // already decided
  inboxTask({ id: 'IT4', state: 'Complete', decision: 'Approve' }),
  inboxTask({ id: 'IT5', due: '2026-10-01T00:00:00.000Z' })
] };

const inboxChecks = Inbox.list().then(result => {
  assert.deepStrictEqual(result.rows.map(r => r.id), ['IT5', 'IT1'],
    'only the two waiting on OUR tasks - and the soonest due leads');
  assert.strictEqual(result.counts.total, 6);
  assert.strictEqual(result.counts.inbox, 5, 'the project task is not an inbox task');
  assert.strictEqual(result.counts.notOurs, 1);
  assert.strictEqual(result.counts.noContents, 1);
  assert.strictEqual(result.counts.closed, 1);
  assert.strictEqual(result.counts.kept, 2);
  // the view says WHY it is showing two rows out of five, rather than looking
  // broken - the same reasoning as TaskService.note
  assert.ok(/2 of 5/.test(result.note), result.note);
  assert.ok(/another type/.test(result.note) && /already decided/.test(result.note),
    result.note);
}).then(() => {
  // a decided step is history; the task page's approval chain already shows it
  // with the signature. It is available on request, not by default
  return Inbox.list({ includeDecided: true });
}).then(result => {
  assert.strictEqual(result.counts.kept, 3, 'the decided one joins the list');
  assert.strictEqual(result.counts.closed, 0);
  // but a row connected to something that is not ours is NEVER shown
  assert.ok(result.rows.every(r => r.connected.ours),
    'the connection check is not optional');
});

// ---- the grid: the link opens the CONNECTED task, not the inbox task
const listSrc = fs.readFileSync(
  path.join(base, 'js/views/TaskListView.js'), 'utf8');
assert.ok(/row\.connectedId/.test(listSrc),
  'the approvals row opens the custom task it is approving');
const inboxColsSrc = fs.readFileSync(
  path.join(base, 'js/views/InboxColumns.js'), 'utf8');
assert.ok(/field: 'connectedName'[\s\S]{0,400}cellClick/.test(inboxColsSrc),
  "'On task' is the link - the role is not clickable");
// an inbox task's title IS the role, so a Title column would repeat it exactly
assert.ok(!/title: 'Title'/.test(inboxColsSrc),
  'no Title column - it would duplicate Role');

// ---- 17. approving and rejecting - the widget's FIRST WRITE -----------
//
// Checked against the 2024x Task spec rather than copied from the POC, which
// differs in three ways (all asserted below):
//   * the POC POSTs; the documented operation is PUT
//   * the POC sends `updateAction: 'MODIFY'`, absent from the body schema
//   * its own header comment describes a third thing again, and is stale

const DecideRequest = {
  _calls: [],
  _body: { success: true, statusCode: 200 },
  get: function (p, opts) {
    DecideRequest._calls.push({ path: p, opts: opts, method: 'GET' });
    return DecideRequest._getBody instanceof Error
      ? Promise.reject(DecideRequest._getBody)
      : Promise.resolve(DecideRequest._getBody);
  },
  send: function (p, opts) {
    DecideRequest._calls.push({ path: p, opts: opts, method: (opts || {}).method });
    return DecideRequest._body instanceof Error
      ? Promise.reject(DecideRequest._body)
      : Promise.resolve(DecideRequest._body);
  }
};
const Approval = load(path.join(base, 'js/services/ApprovalService.js'),
  [DecideRequest, Log]);

// `Abstain` is a real platform value, but no route here has ever used anything
// but `Approve` and its effect on a route has not been observed - so it is
// deliberately not offered
assert.deepStrictEqual(Approval.DECISIONS, ['Approve', 'Reject']);

// ---- may I act? the PLATFORM answers, not us
DecideRequest._getBody = { data: [{ id: 'IT1', dataelements: {
  modifyAccess: 'TRUE', state: 'Assign', title: 'Project Manager',
  routeTaskAction: 'Approve', routeTaskApprovalAction: 'None',
  routeTaskInstructions: 'Review the form and approve it.',
  routeTaskRequiresESign: 'False' } }] };

const decideChecks = Approval.check('IT1').then(v => {
  assert.strictEqual(v.modifiable, true, 'ENOVIA booleans are the STRINGS TRUE/FALSE');
  assert.strictEqual(v.role, 'Project Manager');
  assert.strictEqual(v.action, 'Approve');
  // `None` means "not decided" - it must never read as a decision
  assert.strictEqual(v.decision, '');
  assert.strictEqual(v.requiresESign, false);
}).then(() => {
  DecideRequest._getBody = { data: [{ id: 'IT2',
    dataelements: { modifyAccess: 'FALSE' } }] };
  return Approval.check('IT2');
}).then(v => {
  assert.strictEqual(v.modifiable, false, "someone else's step");
}).then(() => {
  // a step we cannot read is a step we must not offer to act on - and that is
  // an answer, not a crash
  DecideRequest._getBody = new Error('403');
  return Approval.check('IT3');
}).then(v => {
  assert.strictEqual(v.modifiable, false);
}).then(() => {
  assert.strictEqual((Approval.check('')).constructor, Promise);
  return Approval.check('');
}).then(v => {
  assert.strictEqual(v.modifiable, false, 'no id, no action - and no call');

  // ---- the decision itself
  DecideRequest._calls.length = 0;
  return Approval.decide('IT1', 'Approve', 'looks right');
}).then(() => {
  assert.strictEqual(DecideRequest._calls.length, 1);
  const call = DecideRequest._calls[0];
  // PUT, not the POC's POST - and a write, so Request.send attaches the CSRF
  // token and retries once on a token failure (rule R5)
  assert.strictEqual(call.method, 'PUT');
  assert.strictEqual(call.path, 'resources/v1/modeler/tasks/IT1');

  const sent = call.opts.data.data[0];
  assert.strictEqual(sent.id, 'IT1');
  assert.strictEqual(sent.dataelements.routeTaskApprovalAction, 'Approve');
  assert.strictEqual(sent.dataelements.routeTaskApprovalComments, 'looks right');
  // what actually FINISHES the step and lets the route move on. Writing the
  // decision without the state leaves the route sitting on an answered step
  assert.strictEqual(sent.dataelements.state, 'Complete');
  // absent from the documented body schema - the POC sends it anyway
  assert.strictEqual(sent.updateAction, undefined,
    'updateAction is not in the schema; it is not sent');
}).then(() => {
  // a rejection carries its reason
  DecideRequest._calls.length = 0;
  return Approval.decide('IT1', 'Reject', 'section III is wrong');
}).then(() => {
  const sent = DecideRequest._calls[0].opts.data.data[0];
  assert.strictEqual(sent.dataelements.routeTaskApprovalAction, 'Reject');
  assert.strictEqual(sent.dataelements.routeTaskApprovalComments, 'section III is wrong');
}).then(() => {
  // an approval with no comment sends an empty string, not undefined
  DecideRequest._calls.length = 0;
  return Approval.decide('IT1', 'Approve');
}).then(() => {
  assert.strictEqual(
    DecideRequest._calls[0].opts.data.data[0].dataelements.routeTaskApprovalComments, '');
}).then(() => {
  // a typo would write a value the route cannot interpret, so it never leaves
  // the client
  DecideRequest._calls.length = 0;
  return Approval.decide('IT1', 'approve').then(
    () => { throw new Error('a bad decision must be refused'); },
    err => {
      assert.ok(/must be one of/.test(err.message), err.message);
      assert.strictEqual(DecideRequest._calls.length, 0, 'and nothing is sent');
    });
}).then(() => {
  return Approval.decide('', 'Approve').then(
    () => { throw new Error('no id must be refused'); },
    err => { assert.ok(/No inbox task/.test(err.message), err.message); });
}).then(() => {
  // several DS services answer HTTP 200 with the failure inside the body
  DecideRequest._body = { statusCode: 403, message: 'not the assignee' };
  return Approval.decide('IT1', 'Approve', 'x').then(
    () => { throw new Error('a 403 in the body must be treated as a failure'); },
    err => { assert.ok(/not the assignee/.test(err.message), err.message); });
});

// ---- the decision bar
const decideSrc = fs.readFileSync(
  path.join(base, 'js/views/TaskApprovalPanel.js'), 'utf8');
// a rejection with no reason is unactionable for whoever has to fix the form
assert.ok(/required to reject/i.test(decideSrc), 'the comment rule is stated to the user');
// there is no undo, in this widget or in the Routes API, so one click arms and
// a second sends
assert.ok(/Confirm '/.test(decideSrc), 'a decision takes two clicks');
assert.ok(/cannot be undone/.test(decideSrc), 'and says so before the second one');
// the bar is only built for a step the PLATFORM says this user may modify
assert.ok(/verdict\.modifiable/.test(decideSrc),
  'the platform decides who may act, not the client');

// ---- 18. whose step is it? the regression behind the 400 --------------
//
// THE BUG. The approval bar decided who may act from `modifyAccess` on the
// inbox task. Measured live on 2026-10-08, on the route of T-85756263-0000143:
//
//     signed in              admin_platform
//     step 2 assigned to     PlmUser2  (Sachin S Awasare)
//     step 2 modifyAccess    TRUE
//
// So immediately after approving step 1, the chain reloaded correctly onto
// step 2 - someone else's step - and offered it. The submission came back
// HTTP 400. `modifyAccess` means "may you edit this object", which an
// administrator may, not "is this your approval to give".

const SessionRequest = {
  _calls: [],
  _body: { pid: 'P1', name: 'admin_platform',
           firstname: 'Sharad S', lastname: 'Dhavalikar' },
  get: function (p, opts) {
    SessionRequest._calls.push({ path: p, opts: opts });
    return SessionRequest._body instanceof Error
      ? Promise.reject(SessionRequest._body)
      : Promise.resolve(SessionRequest._body);
  }
};
const Session = load(path.join(base, 'js/services/SessionService.js'),
  [SessionRequest, Log]);

const sessionChecks = Session.me().then(me => {
  assert.strictEqual(me.login, 'admin_platform', '`name` is the login');
  assert.strictEqual(me.pid, 'P1');
  assert.strictEqual(me.fullName, 'Sharad S Dhavalikar');
  // OOTB, and already proven here - Credentials calls the same resource
  assert.strictEqual(SessionRequest._calls[0].path, 'resources/modeler/pno/person');
  assert.strictEqual(SessionRequest._calls[0].opts.params.current, 'true');
}).then(() => {
  // the signed-in person does not change inside a session, and the panel asks
  // on every task page
  SessionRequest._calls.length = 0;
  return Session.me();
}).then(() => {
  assert.strictEqual(SessionRequest._calls.length, 0, 'cached for the session');
}).then(() => {
  // THE ASSERTION THAT WOULD HAVE CAUGHT IT
  return Session.isMe('PlmUser2');
}).then(mine => {
  assert.strictEqual(mine, false,
    "PlmUser2's step is NOT admin_platform's to decide - this is the 400");
  return Session.isMe('admin_platform');
}).then(mine => {
  assert.strictEqual(mine, true);
  // ENOVIA logins are not case sensitive, and a step's spelling comes from
  // wherever the route was built
  return Session.isMe('ADMIN_PLATFORM');
}).then(mine => {
  assert.strictEqual(mine, true, 'the comparison is case-insensitive');
  return Session.isMe('');
}).then(mine => {
  assert.strictEqual(mine, false, 'an unassigned step is nobody\'s');
}).then(() => {
  // an identity that cannot be read must HIDE the controls, never show them:
  // showing the bar on a failed identity check is the one outcome that must
  // not happen, so `me()` resolves empty rather than rejecting
  Session._reset();
  SessionRequest._body = new Error('500');
  return Session.me();
}).then(me => {
  assert.strictEqual(me.login, '');
  return Session.isMe('admin_platform');
}).then(mine => {
  assert.strictEqual(mine, false, 'unknown identity grants nothing');
});

// ---- the panel must ask BOTH questions, in that order
const gateSrc = fs.readFileSync(
  path.join(base, 'js/views/TaskApprovalPanel.js'), 'utf8');
assert.ok(/SessionService\.isMe\(step\.assigneeUsername\)/.test(gateSrc),
  'the bar is gated on the step being the signed-in user\'s');
// `modifyAccess` is still checked - it catches a locked or closed object - but
// it is no longer trusted on its own
assert.ok(/isMe[\s\S]{0,900}ApprovalService\.check/.test(gateSrc),
  'the assignee check comes FIRST; modifyAccess is only a second guard');

// ---- the platform's refusal must read as something actionable
const svcSrc = fs.readFileSync(
  path.join(base, 'js/services/ApprovalService.js'), 'utf8');
// the user saw: NetworkError: URL "https://..." return ResponseCode with
// value "400" - which says nothing about what to do next
assert.ok(/assigned to/.test(svcSrc) && /already been decided/.test(svcSrc),
  'a 400/403 is explained, not passed through as a transport error');

sessionChecks.then(() => console.log('irstasks-session: all assertions passed'))
  .catch(err => { console.error(err); process.exit(1); });

decideChecks.then(() => console.log('irstasks-approval: all assertions passed'))
  .catch(err => { console.error(err); process.exit(1); });

inboxChecks.then(() => console.log('irstasks-inbox: all assertions passed'))
  .catch(err => { console.error(err); process.exit(1); });

sigChecks.then(() => console.log('irstasks-signature: all assertions passed'))
  .catch(err => { console.error(err); process.exit(1); });

// ---- the task carries the route, so finding it is free
const routedTask = Detail._toTask({
  id: 'T9', type: 'EPMPROJECT_PROPOSAL',
  dataelements: { title: 'T-9', state: 'Review' },
  relateddata: {
    route: [{ id: 'R1', type: 'Route',
              dataelements: { name: 'approval route', title: 'approval route' } }]
  }
});
assert.strictEqual(routedTask.routes.length, 1);
assert.strictEqual(routedTask.routes[0].id, 'R1');
assert.strictEqual(routedTask.routes[0].name, 'approval route');
// the old single-name field still answers, so nothing that read it breaks
assert.strictEqual(routedTask.route, 'approval route');

const unroutedTask = Detail._toTask({
  id: 'T8', dataelements: { title: 'T-8' }, relateddata: {}
});
assert.deepStrictEqual(unroutedTask.routes, []);

// `route` must be in the ONE call the page already makes, or the panel costs a
// request just to learn the id
assert.ok(/\$include['"]\s*:\s*['"][^'"]*route/.test(
  fs.readFileSync(path.join(base, 'js/services/TaskDetailService.js'), 'utf8')),
  'route rides in the task call - it is relateddata, like deliverables');

routeChecks.then(() => console.log('irstasks-route: all assertions passed'))
  .catch(err => { console.error(err); process.exit(1); });

ticketChecks.then(() => console.log('irstasks-documents: all assertions passed'))
  .catch(err => { console.error(err); process.exit(1); });

console.log('irstasks-department: all assertions passed');

// ---- 19. the cost form: R&D-PRJ-02 and the three value formats ---------
//
// Every field in this section was verified read-only in MQL on 2026-10-09, so
// the assertions below are against MEASURED values, not against the printed
// form's wording.

const costSpec = JSON.parse(fs.readFileSync(
  path.join(base, 'js/data/forms/personnel-cost.json'), 'utf8'));

// the 404 banner the page used to show: TaskFields declares this field set, and
// until today the file it names did not exist
assert.strictEqual(costSpec.taskType, 'EPMPROJECT_PERSONNEL_COST');
assert.strictEqual(costSpec.form, 'R&D-PRJ-02-Rev.00');

const costBy = {};
costSpec.fields.forEach(f => { costBy[f.label] = f; });

// ---- the ELEVEN cost attributes are all on the PROJECT, not on the task.
// This is what makes the form cost no extra call: the page already reads the
// project for the proposal form, and `$include=none` returns every EPM
// attribute in one go
// Eight of them live INSIDE the printed Cost Estimation table now (its
// `rows`, `total` and `footnoteRate`) rather than as rows of their own, so
// what matters is that each is still read SOMEWHERE - not where it sits.
const costAttrs = new Set();
costSpec.fields.forEach(f => {
  if (f.field) { costAttrs.add(f.field); }
  (f.rows || []).forEach(line => {
    if (line.amount) { costAttrs.add(line.amount); }
    if (line.description) { costAttrs.add(line.description); }
  });
  (f.columns || []).forEach(col => {
    if (col.amount) { costAttrs.add(col.amount); }
  });
  if (f.total && f.total.amount) { costAttrs.add(f.total.amount); }
  if (f.footnoteRate) { costAttrs.add(f.footnoteRate); }
});
['EPMMandaysIRS', 'EPMMandaysOutsideAgency', 'EPMTotalMandays',
 'EPMManpowerRatePerManday', 'EPMManpowerCostIRS', 'EPMManpowerCostOutsideAgency',
 'EPMOtherCost', 'EPMTotalEstimatedPrice', 'EPMManpowerCostIRSDescription',
 'EPMManpowerCostOutsideAgencyDescription', 'EPMOtherCostDescription']
  .forEach(a => assert.ok(costAttrs.has(a), a + ' is still read by the form'));

// ---- the printed Cost Estimation table (user, 2026-10-09).
// It replaced eight rows that listed the same numbers one under another -
// same data, but nothing like the form being signed.
const costTable = costSpec.fields.filter(f => f.display === 'costs')[0];
assert.ok(costTable, 'the form has a Cost Estimation table');
assert.deepStrictEqual(costTable.rows.map(r => r.no), ['01', '02', '03']);
assert.deepStrictEqual(costTable.rows.map(r => r.resource),
  ['Manpower Cost (IRS)', 'Manpower Cost (outside agency)', 'Other'],
  'the resource names are the printed form\'s, verbatim');
assert.strictEqual(costTable.total.label, 'Total Estimated Price');
assert.strictEqual(costTable.total.amount, 'EPMTotalEstimatedPrice');
// the rate is READ from the project, never written into the label: it is
// stamped per project, so an older project must keep printing its own rate
assert.strictEqual(costTable.footnoteRate, 'EPMManpowerRatePerManday');
const costTableViewSrc = fs.readFileSync(
  path.join(base, 'js/views/TaskDetailView.js'), 'utf8');
const costsBody = costTableViewSrc.match(/function costsBlock[\s\S]*?\n    \}/)[0];
assert.ok(!/15000|15,000/.test(costsBody),
  'the rate is not hard-coded in the renderer');
// and the renderer names no attribute: which one each line reads is JSON
assert.ok(!/EPM[A-Za-z]+/.test(costsBody),
  'costsBlock knows the SHAPE of the table, not which attributes fill it');
// nothing is recomputed - the five derived figures are ReadOnly in DMC and
// computed server-side; a second implementation here is how the screen and
// the database start disagreeing
assert.ok(!/attributes\[[^\]]+\]\s*[*+]/.test(costsBody),
  'no arithmetic on the attributes: the back end owns every derived figure');


// ---- the printed Estimated Man days table (user, 2026-10-09) ------------
//
// It replaced three rows listing the same figures one under another. The
// label is a section HEADING above the table, like Cost Estimation's
// (user, 2026-10-09) - it was first drawn as a left cell spanning both rows,
// the way the paper form draws it, but beside a headed cost table that read
// as a different kind of thing when it is the same kind of thing.
const mandays = costSpec.fields.filter(f => f.display === 'mandays')[0];
assert.ok(mandays, 'the form has an Estimated Man days table');
assert.strictEqual(mandays.label, 'Estimated Man days');
assert.ok(!('noHeading' in mandays),
  'the heading is drawn by main, so the table no longer suppresses it');
assert.deepStrictEqual(mandays.columns.map(c => c.label),
  ['IRS', 'Outside agency', 'Total Man days'],
  'the column names are the printed form\'s, verbatim');
assert.deepStrictEqual(mandays.columns.map(c => c.amount),
  ['EPMMandaysIRS', 'EPMMandaysOutsideAgency', 'EPMTotalMandays']);

// every block gets its heading, man days included
assert.ok(/body\.appendChild\(sectionHead\(labelOf\(row\)\)\);/
  .test(costTableViewSrc), 'a block section is drawn under its heading');
assert.ok(!/noHeading/.test(costTableViewSrc),
  'the noHeading escape hatch is gone with its one user');

// the renderer knows the SHAPE, not which attributes fill it - same rule as
// the cost table, so a fourth column stays a JSON edit
const mandaysBody = costTableViewSrc.match(
  /function mandaysBlock[\s\S]*?\n    \}/)[0];
assert.ok(!/EPM[A-Za-z]+/.test(mandaysBody),
  'mandaysBlock names no attribute');
// Total Man days is ReadOnly in DMC and computed server-side - never summed
assert.ok(!/attributes\[[^\]]+\]\s*[*+]/.test(mandaysBody),
  'no arithmetic: the back end owns the total');
// no label cell any more - the heading above the table carries the label,
// and printing it in both places would say it twice
assert.ok(!/rowSpan/.test(mandaysBody),
  'no spanning label cell: the heading carries the label');
assert.ok(!/row\.label/.test(mandaysBody),
  'mandaysBlock draws columns only; main draws the label');
// half days are real on this data (ana keys 17.5), so it formats, never rounds
assert.ok(/VALUE_FORMAT\.days/.test(mandaysBody),
  'figures go through the days format, which keeps a half day');


// ---- the two layout rules the user set on 2026-10-09 -------------------
//
// 1. No section numbers on screen. Nine of the sixteen rows are hidden, so
//    the visible numbers ran I, III, V, VI, VIII and the gaps read as
//    something that failed to load. `ref` stays in the JSON - it is how the
//    paper form is discussed - so the test is that the VIEW does not print it.
const labelOfBody = costTableViewSrc.match(
  /function labelOf\(row\) \{[\s\S]*?\n    \}/)[0];
assert.ok(!/ref/.test(labelOfBody),
  'the heading is the label alone - no roman numeral in front of it');
assert.ok(costSpec.fields.every(f => f.ref),
  'every field still records which numbered section of the form it came from');

// 2. Start Date and Planned End Date share one line. They are a pair and read
//    as one fact; before this, Change of Scope took the left half of their
//    line and pushed Planned End Date down on its own.
const startDate = costSpec.fields.filter(f => f.label === 'Start Date')[0];
const endDate = costSpec.fields.filter(f => f.label === 'Planned End Date')[0];
assert.strictEqual(startDate.newLine, true, 'Start Date starts a fresh line');
assert.ok(!endDate.newLine, 'so Planned End Date lands beside it, not below');
assert.strictEqual(
  costSpec.fields.indexOf(endDate), costSpec.fields.indexOf(startDate) + 1,
  'and nothing comes between them');
assert.ok(/if \(row\.newLine && grid\) \{/.test(costTableViewSrc),
  'the view honours newLine by breaking the run of pairs');
// a fresh grid directly under another would otherwise draw a second rule on
// top of the line above, which already has its own bottom rule
assert.ok(/function kvGrid\(continuing\)/.test(costTableViewSrc),
  'the continuing grid skips its top rule, so the dates get no double line');

// ---- the ONE attribute the task carries itself.
// The proposal form has none, so this is the first form to read `source: task`
// at all - and it is in use, TRUE on two live tasks
assert.strictEqual(costBy['Change of Scope'].source, 'task');
assert.strictEqual(costBy['Change of Scope'].field, 'EPMChangeOfScope');
assert.strictEqual(costBy['Change of Scope'].display, 'yesno',
  'EPMChangeOfScope is a BOOLEAN - ENOVIA returns the string "TRUE"');

// ---- nothing in the client may recompute what the back end owns.
// Five numbers carry DMC `User Access = ReadOnly`; a second implementation of
// the arithmetic here is how the screen and the database start disagreeing
const costViewSrc = fs.readFileSync(
  path.join(base, 'js/views/TaskDetailView.js'), 'utf8');
// CODE only. A comment may name an attribute to explain why the back end owns
// it, which is exactly what mandaysBlock's header does - banning that would
// push the reasoning out of the file that needs it.
const costViewCode = costViewSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');
assert.ok(!/EPMMandaysIRS|EPMTotalMandays|EPMTotalEstimatedPrice/.test(costViewCode),
  'the view never READS a cost attribute by name - the JSON is the only place');
assert.ok(/ReadOnly/.test(costSpec._calculated),
  'the spec records WHICH numbers the back end owns');

// ---- the rows with no source anywhere on the platform are hidden, not faked.
// Checked against the whole IRS*/EPM* attribute inventory on 2026-10-09
['Software Resource required', 'Reviewer Name',
 'Reason for revision of this form'].forEach(label => {
  assert.strictEqual(costBy[label].hidden, true, label + ' has no attribute yet');
  assert.strictEqual(costBy[label].display, 'pending');
  assert.ok(costBy[label].note.length > 20,
    label + ' says what is missing, so the gap is a decision not an omission');
});

// page 2 is a schedule view of the WBS, not a field set
assert.strictEqual(costBy['Project Planning: task break-up against the months'].display,
  'elsewhere');

// the three signatures come from the route (WGT-09), exactly as on the proposal
assert.strictEqual(
  costSpec.fields.filter(f => f.display === 'approval').length, 3);

// ---- the people table is a SERVICE section, and it must not borrow another
// section's renderer. `members` used to fall through to risksBlock, which drew
// the WRONG table under the right heading - worse than an empty section,
// because it looks like data
// the heading is just "Project Members" (user, 2026-10-09) - it still carries
// ref "I", so the page prints "I. Project Members" like every other section
assert.strictEqual(costBy['Project Members'].display, 'members');
assert.strictEqual(costBy['Project Members'].ref, 'I');
assert.ok(/row\.display === 'risks'/.test(costViewSrc),
  'risksBlock is reached by its OWN display type, not as the fallback');
assert.ok(/members/.test(costViewSrc.match(/var BLOCKS = \[[^\]]*\]/)[0]),
  'the people table is full width, not a key-value pair');

// ---- the three value formats.
// A DMC `real` arrives as `150000.0` and a boolean as the STRING `"TRUE"`;
// printing either raw on a form a customer signs reads as a defect
const fmtBody = costViewSrc.match(/var VALUE_FORMAT = \{[\s\S]*?\n    \};/)[0];
const toTextLocal = v => (v === null || v === undefined) ? '' : String(v).trim();
const VALUE_FORMAT = (function () {
  const toText = toTextLocal;
  return eval('(function(){' + fmtBody + ' return VALUE_FORMAT;})()');
}());

// the INDIAN grouping - 2,40,552 and not 240,552. These are the live totals
// measured on the three projects that carry values
assert.strictEqual(VALUE_FORMAT.money('240552.0'), 'Rs. 2,40,552', 'Solize XYZ');
assert.strictEqual(VALUE_FORMAT.money('310000.0'), 'Rs. 3,10,000', 'ana');
assert.strictEqual(VALUE_FORMAT.money('212500.0'), 'Rs. 2,12,500', 'TEST PROJECT');
assert.strictEqual(VALUE_FORMAT.money('15000.0'), 'Rs. 15,000', 'the rate');
assert.strictEqual(VALUE_FORMAT.money('552.0'), 'Rs. 552', 'under a thousand: no comma');
assert.strictEqual(VALUE_FORMAT.money('0.0'), 'Rs. 0', 'zero is a figure, not blank');
assert.strictEqual(VALUE_FORMAT.money(''), '', 'but an absent value stays absent');
assert.strictEqual(VALUE_FORMAT.money('not a number'), 'not a number',
  'a value we cannot parse is shown as it came, never as NaN');

// half man-days are real on this data (`ana` keys 17.5), so days must not round
assert.strictEqual(VALUE_FORMAT.days('16.0'), '16', 'a whole count loses the .0');
assert.strictEqual(VALUE_FORMAT.days('17.5'), '17.5', 'a half day is kept');
assert.strictEqual(VALUE_FORMAT.days('3.5'), '3.5');
assert.strictEqual(VALUE_FORMAT.days('0.0'), '0');
assert.strictEqual(VALUE_FORMAT.days(''), '');

// ENOVIA booleans are the STRINGS "TRUE"/"FALSE" - the same trap as modifyAccess
assert.strictEqual(VALUE_FORMAT.yesno('TRUE'), 'Yes');
assert.strictEqual(VALUE_FORMAT.yesno('FALSE'), 'No');
assert.strictEqual(VALUE_FORMAT.yesno('true'), 'Yes', 'case does not matter');
assert.strictEqual(VALUE_FORMAT.yesno(''), '', 'unset is not "No"');

console.log('irstasks-cost-form: all assertions passed');

// ---- 22. every AMD module is actually loaded by the page ----------------
//
// THE BUG. `BaselineService.js` was written, required by TaskDetailView, and
// never given a <script> tag in IRSTasks.html. This loader has no module
// resolution: a `define` that was never evaluated simply is not there, so the
// page asked the dashboard proxy for the module id as a path and got
//
//     GET .../WidgetPacket/IRSTasks/services/BaselineService.js  404
//
// Note the missing `js/` segment - that is the signature of this fault, and it
// is why the 404 looks like a deployment problem rather than a missing tag.
//
// Cheap to assert, and it applies to every module added from here on.
const widgetHtml = fs.readFileSync(path.join(base, 'IRSTasks.html'), 'utf8');
const tagged = (widgetHtml.match(/src="(js\/[^"]+\.js)"/g) || [])
  .map(m => m.replace(/src="|"/g, ''));

function walkJs(dir, prefix) {
  let out = [];
  fs.readdirSync(path.join(base, dir), { withFileTypes: true }).forEach(e => {
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) { out = out.concat(walkJs(rel, prefix)); }
    else if (e.name.endsWith('.js')) { out.push(rel); }
  });
  return out;
}
const onDisk = walkJs('js').sort();

onDisk.forEach(file => assert.ok(tagged.indexOf(file) >= 0,
  file + ' has no <script> tag in IRSTasks.html - it will 404 at runtime'));
tagged.forEach(file => assert.ok(onDisk.indexOf(file) >= 0,
  'IRSTasks.html loads ' + file + ', which does not exist'));

// LOAD ORDER matters too: there is no dependency resolution, so a module must
// be tagged before anything that defines against it
function at(file) { return tagged.indexOf(file); }
[['js/utils/Log.js', 'js/services/BaselineService.js'],
 ['js/services/BaselineService.js', 'js/views/TaskDetailView.js'],
 ['js/services/ProjectContextService.js', 'js/views/TaskDetailView.js'],
 ['js/views/TaskDetailView.js', 'js/App.js']].forEach(([first, second]) => {
  assert.ok(at(first) >= 0 && at(second) >= 0 && at(first) < at(second),
    first + ' must load before ' + second);
});

console.log('irstasks-modules: all ' + onDisk.length + ' modules are loaded, in order');


// ---- 20. the people table, and the attribute built to complete it ------
//
// The R&D-PRJ-02 member block wanted five columns. Four already had a source;
// Responsibility (Project Manager / Dy. Project Manager / Member) had none, so
// IRSProjectResponsibility was added to the OOTB `Member` relationship on
// 2026-10-09. Everything below is asserted against values measured live on
// Solize XYZ the same day.

const MemberRequest = {
  _calls: [],
  _body: {},
  get: function (p, opts) {
    MemberRequest._calls.push({ path: p, opts: opts });
    return MemberRequest._body instanceof Error
      ? Promise.reject(MemberRequest._body)
      : Promise.resolve(MemberRequest._body);
  }
};
const MemberContext = load(path.join(base, 'js/services/ProjectContextService.js'),
  [MemberRequest, Log]);

// ---- the form asks for the section, so the service must request it.
// A form that shows no people must NOT pay for the round trip
const costSpecForMembers = JSON.parse(fs.readFileSync(
  path.join(base, 'js/data/forms/personnel-cost.json'), 'utf8'));
const costSections = MemberContext.sectionsFor(costSpecForMembers);
assert.ok(costSections.indexOf('members') >= 0,
  'the cost form asks for $include=members');

const proposalSpec = JSON.parse(fs.readFileSync(
  path.join(base, 'js/data/forms/project-proposal.json'), 'utf8'));
assert.strictEqual(MemberContext.sectionsFor(proposalSpec).indexOf('members'), -1,
  'the proposal form shows no people and must not ask for them');

// ---- the live payload, as the JAR answers it.
// admin_platform is the owner; only PlmUser1 has a skill; PLMUser_1 has a
// designation but no skill - the sparse case a flat MQL dump cannot express
MemberRequest._body = {
  project: { name: 'Solize XYZ' },
  included: ['members'],
  members: [
    { id: 'M1', physicalId: 'P-admin', name: 'admin_platform', type: 'Person',
      isPerson: 'true', fullName: 'Sharad S Dhavalikar',
      designation: 'Sr. Principal Surveyor',
      skills: ['Computational Fluid Dynamics', 'Fluid Structure Interaction'],
      access: 'Project Owner', responsibility: 'Project Manager', driveAccess: 'No' },
    { id: 'M2', physicalId: 'P-u1', name: 'PlmUser1', type: 'Person',
      isPerson: 'true', fullName: 'Dr. Asokendu Samanta',
      designation: 'Chief Surveyor & Sr. Vice President',
      skills: [],
      access: 'Project Member', responsibility: 'Member', driveAccess: 'No' },
    { id: 'M3', physicalId: 'P-u2', name: 'PlmUser2', type: 'Person',
      isPerson: 'true', fullName: 'Sachin S Awasare',
      designation: 'Sr. Surveyor',
      // the fourth title CONTAINS a comma - this is four skills, not five
      skills: ['Computational Fluid Dynamics', 'Seakeeping Analysis',
               'Fluid Structure Interaction',
               'Environment, Energy Efficiency and New Type of Fuel'],
      access: 'Project Member', responsibility: 'Deputy Project Manager',
      driveAccess: 'Yes' },
    { id: 'M4', physicalId: 'P-u4', name: 'PLMUser_1', type: 'Person',
      isPerson: 'true', fullName: 'PLM User 1',
      designation: 'Surveyor 1', skills: [],
      access: 'Project Member', responsibility: '', driveAccess: 'Yes' },
    // Member accepts an Organization on its `to` side, so this is real
    { id: 'M5', physicalId: 'O-1', name: 'IRCLASS', type: 'Company',
      isPerson: 'false', fullName: '', designation: '', skills: [],
      access: 'Project Member', responsibility: '', driveAccess: '' }
  ],
  memberError: '',
  counts: { members: '5' }
};

const memberChecks = MemberContext.get('PRJ1', ['members']).then(ctx => {
  assert.strictEqual(MemberRequest._calls[0].opts.params['$include'], 'members');
  assert.strictEqual(ctx.members.length, 5, 'the organization is kept, not dropped');

  // ---- ORDER is the printed form's: PM, then Dy PM, then the members.
  // The form stacks three blocks; the widget draws one table, so the order has
  // to carry what the three headings carried on paper
  assert.deepStrictEqual(ctx.members.map(m => m.responsibility),
    ['Project Manager', 'Deputy Project Manager', 'Member', '', ''],
    'ordered by responsibility, unknown values last');

  // an unrecognised value must still APPEAR - dropping a member is the one
  // outcome worse than showing them in the wrong place
  assert.ok(ctx.members.some(m => m.login === 'PLMUser_1'),
    'a member with no responsibility value is still listed');

  // ---- Responsibility is a RECORD, not the platform's access rule
  const pm = ctx.members[0];
  assert.strictEqual(pm.responsibility, 'Project Manager');
  assert.strictEqual(pm.access, 'Project Owner');
  assert.notStrictEqual(pm.responsibility, pm.access,
    'the IRS record and the platform access are separate fields');

  // ---- the person detail that forced this section to exist.
  // These live on the PERSON, not on the Member connection, which is why the
  // OOTB `$include=members` (names only) was not enough
  assert.strictEqual(pm.name, 'Sharad S Dhavalikar', 'First + Last Name');
  assert.strictEqual(pm.designation, 'Sr. Principal Surveyor');

  // looked up by login, NOT by index: the list has been reordered by
  // responsibility, so an index here asserts against the sort and not the data
  const by = {};
  ctx.members.forEach(m => { by[m.login] = m; });

  // THE BUG THIS REPLACES. The reader first read skills from the OOTB
  // `hasBusinessSkill` link, which on this platform holds one seeded test
  // object. The real IRS skills come from IRSPersonDepartmentDomain, a REL2REL,
  // and the two disagree completely - PlmUser1 was the ONLY person with a
  // hasBusinessSkill link and has NO IRS skill at all, so the widget showed a
  // skill for exactly the person who has none and nothing for the two who do.
  assert.deepStrictEqual(by.PlmUser1.skills, [],
    'PlmUser1 has no IRS skill - he only had the stray hasBusinessSkill link');
  assert.deepStrictEqual(by.admin_platform.skills,
    ['Computational Fluid Dynamics', 'Fluid Structure Interaction']);
  assert.strictEqual(by.PlmUser2.skills.length, 4,
    'four skills - the fourth title merely contains a comma');
  assert.ok(by.PlmUser2.skills.indexOf(
    'Environment, Energy Efficiency and New Type of Fuel') >= 0,
    'a comma inside a title must not split it into two skills');

  // ENOVIA booleans are the STRINGS "TRUE"/"FALSE"
  assert.strictEqual(pm.isPerson, true);
  assert.strictEqual(by.IRCLASS.isPerson, false, 'the Company is not a person');

  // an organization has no First/Last Name, so it falls back to its own name
  // rather than rendering a blank cell
  assert.strictEqual(by.IRCLASS.name, 'IRCLASS');

  // the two members with no responsibility value sort after the three known
  // ones, and between themselves by name - IRCLASS before PLM User 1
  assert.deepStrictEqual(ctx.members.map(m => m.login),
    ['admin_platform', 'PlmUser2', 'PlmUser1', 'IRCLASS', 'PLMUser_1']);
}).then(() => {
  // a section that failed server-side must SAY so, not look like an empty team
  MemberRequest._calls.length = 0;
  MemberRequest._body = { project: {}, members: [], memberError: 'no such relationship' };
  return MemberContext.get('PRJ1', ['members']);
}).then(ctx => {
  assert.strictEqual(ctx.memberError, 'no such relationship');
  assert.deepStrictEqual(ctx.members, []);
}).then(() => {
  // a response from an older JAR carries no members key at all
  MemberRequest._body = { project: {}, risks: [] };
  return MemberContext.get('PRJ1', ['members']);
}).then(ctx => {
  assert.deepStrictEqual(ctx.members, [], 'an older JAR does not break the page');
  assert.strictEqual(ctx.memberError, '');
});

// ---- the renderer
const memberViewSrc = fs.readFileSync(
  path.join(base, 'js/views/TaskDetailView.js'), 'utf8');
assert.ok(/function membersBlock/.test(memberViewSrc));
// it must be reached by its OWN display type. Before this existed, `members`
// fell through to risksBlock and drew the WRONG table under the right heading
assert.ok(/row\.display === 'members'.*membersBlock/.test(memberViewSrc),
  'membersBlock is wired to display: members');
// an Organization member has neither designation nor skill, so the people
// table filters to persons
assert.ok(/member\.isPerson/.test(memberViewSrc),
  'the people table shows people');
// the five column headings the printed form uses
['Name', 'Responsibility', 'Designation', 'Skill as per records', 'Drive access']
  .forEach(label => assert.ok(
    memberViewSrc.indexOf("label: '" + label + "'") > 0,
    'the table has a ' + label + ' column'));
// editing happens on the platform's Members page, not here - this block is a
// view, and must not grow a control that writes
const blockBody = memberViewSrc.match(/function membersBlock[\s\S]*?\n    \}/)[0];
assert.ok(!/addEventListener|<select|button/i.test(blockBody),
  'the people block is read-only; both values are edited on the platform page');

// ---- the platform side: the attribute, the relationship, the table column.
// A missing piece here fails at RUNTIME as an empty or uneditable cell with no
// error anywhere, so the four files are asserted to agree
// base is .../external-widget/src/main/resources/static/WidgetPacket/IRSTasks,
// so the repo root is SEVEN levels up
const repoRoot = path.resolve(base, '..', '..', '..', '..', '..', '..', '..');
const mx = path.join(repoRoot, 'mxupdate', 'custom');
const attrCi = fs.readFileSync(
  path.join(mx, 'datamodel/attribute/ATTRIBUTE_IRSProjectResponsibility.mxu'), 'utf8');
const relCi = fs.readFileSync(
  path.join(mx, 'datamodel/relationship/RELATIONSHIP_Member.mxu'), 'utf8');
const tableCi = fs.readFileSync(
  path.join(mx, 'userinterface/table/TABLE_PMCProjectPeople.mxu'), 'utf8');
const jpo = fs.readFileSync(
  path.join(mx, 'program/jpo/IRSProjectMemberUI_mxJPO.java'), 'utf8');

// the three values the user asked for, in the form's order, defaulting to Member
assert.deepStrictEqual(
  (attrCi.match(/range = "([^"]*)"/g) || []).map(r => r.replace(/range = "|"/g, '')),
  ['Project Manager', 'Deputy Project Manager', 'Member']);
assert.ok(/default "Member"/.test(attrCi), 'an untouched member reads as Member');
// workspace rule: every new admin object gets its symbolic name AT creation
assert.ok(/symbolicname "attribute_IRSProjectResponsibility"/.test(attrCi));
// the value is a record. Nothing may start reading it as an access rule
assert.ok(/grants nothing/.test(attrCi), 'the CI records that it grants nothing');

assert.ok(/attribute "IRSProjectResponsibility"/.test(relCi),
  'declared on the Member relationship');
assert.ok(/attribute "IRSDriveAccess"/.test(relCi),
  'and IRSDriveAccess is still there');

// the column is an editable drop-down, as the user asked
const col = tableCi.match(/column \{[^}]*IRSProjectResponsibility[\s\S]*?\n    \}/)[0];
assert.ok(/setting "Editable" "true"/.test(col));
assert.ok(/setting "Input Type" "combobox"/.test(col), 'a drop-down, not free text');
// every program the column names must exist in the JPO, or the cell silently
// fails at runtime
['getResponsibilityColumn', 'getResponsibilityRange', 'updateResponsibility',
 'getResponsibilityEditable'].forEach(fn => {
  assert.ok(col.indexOf('"' + fn + '"') > 0, 'the column names ' + fn);
  assert.ok(new RegExp('@com\\.matrixone\\.apps\\.framework\\.ui\\.ProgramCallable\\s*\\n\\s*'
    + 'public \\S+ ' + fn + '\\(').test(jpo),
    fn + ' exists in the JPO and is @ProgramCallable');
});

// ---- ONE query per page for BOTH editable columns.
// The page runs parallelLoading with scrollPageSize=50 and a column program is
// handed every row at once, so a per-row read here is invisible in testing and
// crippling on a real team
const linksBody = jpo.match(/private Map readMemberLinks[\s\S]*?\n    \}/)[0];
assert.strictEqual((linksBody.match(/mqlCommand/g) || []).length, 1,
  'readMemberLinks makes exactly one query');
assert.ok(/ATTR_DRIVE_ACCESS/.test(linksBody) && /ATTR_RESPONSIBILITY/.test(linksBody),
  'and it reads BOTH attributes, so the second column is free');

// the JAR's section, for the same reason on the widget side
const readerSrc = fs.readFileSync(path.join(repoRoot, 'external-widget',
  'rest-jar/irs-project-rest/src/main/java/com/irclass/platform/rest/project/ProjectContextReader.java'),
  'utf8');
assert.ok(/S_MEMBERS = "members"/.test(readerSrc));
const readMembersBody = readerSrc.match(/private static List<Map<String, Object>> readMembers[\s\S]*?\n    \}/)[0];
assert.strictEqual((readMembersBody.match(/getRelatedObjects/g) || []).length, 1,
  'the JAR reads every member in ONE round trip - the N+1 the rules forbid');
assert.ok(/SEL_IS_PERSON/.test(readMembersBody),
  'a member may be an Organization, so that is asked and not assumed');


// ---- the whole-call failure fallback must name EVERY section ------------
//
// When the context call itself is refused, TaskDetailView substitutes an empty
// context carrying the reason, so the other rows still render. A section left
// out of that object renders as "there are none" instead of as a failure - and
// an empty list and a failed read mean entirely different things to whoever
// reads the screen. This was missed when the members section was added.
const fallback = memberViewSrc.match(
  /return \{\s*\n\s*risks: \[\][\s\S]*?\n\s*\};/)[0];
['risks', 'opportunities', 'learnings', 'learningsHere', 'learningsElsewhere',
 'members'].forEach(key => assert.ok(
  new RegExp('\\b' + key + ':').test(fallback),
  'the failure fallback carries ' + key));
['riskError', 'learningError', 'memberError'].forEach(key => assert.ok(
  new RegExp('\\b' + key + ': reason').test(fallback),
  'the failure fallback sets ' + key + ' to the reason'));

// and every `display` the service can request must have an error field, so a
// future section cannot repeat the omission
const serviceDisplays = (fs.readFileSync(
  path.join(base, 'js/services/ProjectContextService.js'), 'utf8')
  .match(/field\.display === '(\w+)'/g) || [])
  .map(m => m.replace(/field\.display === '|'/g, ''));
assert.ok(serviceDisplays.indexOf('members') >= 0,
  'members is one of the requestable sections');


// ---- the skill source must match the platform's own Members page ---------
//
// The widget and table PMCProjectPeople show the same people side by side, so
// they cannot disagree about what those people can do. Both must read
// IRSPersonDepartmentDomain with the REL2REL `.torel.to` hop - NOT the OOTB
// `hasBusinessSkill`, which this reader used at first and which gave a
// near-empty, and differently wrong, answer.
const memberUiJpo = fs.readFileSync(
  path.join(mx, 'program/jpo/IRSProjectMemberUI_mxJPO.java'), 'utf8');
const twinJpo = fs.readFileSync(
  path.join(mx, 'program/jpo/IRSProjectContext_mxJPO.java'), 'utf8');

[['IRSProjectMemberUI (the platform table)', memberUiJpo],
 ['IRSProjectContext (the twin)', twinJpo],
 ['the JAR reader', readerSrc]].forEach(([what, src]) => {
  assert.ok(/relationship_IRSPersonDepartmentDomain/.test(src),
    what + ' resolves IRSPersonDepartmentDomain by symbolic name');
  assert.ok(/\.torel\.to/.test(src),
    what + ' uses the REL2REL `.torel.to` hop');
});

// the two readers must not have kept the old link as a live select
[['the JAR reader', readerSrc], ['the twin', twinJpo]].forEach(([what, src]) => {
  assert.ok(!/SYM_REL_HAS_SKILL|REL_HAS_SKILL_FALLBACK/.test(src),
    what + ' has no hasBusinessSkill constant left');
  // it may still be NAMED in the comment that explains why it is wrong
  const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/hasBusinessSkill/.test(code),
    what + ' mentions hasBusinessSkill only in a comment, never in code');
});

// ONE SKILL PER LINE (user, 2026-10-09). No separator CHARACTER can do this:
// "Environment, Energy Efficiency and New Type of Fuel" is a single skill, so
// any punctuation that reads as a separator already occurs inside a title -
// which is why the platform's own page shows PlmUser2's four skills as five.
assert.ok(/skills\.join\('\\n'\)/.test(memberViewSrc),
  'skills are joined with a newline, one per line');
assert.ok(!/skills\.join\(', '\)|skills\.join\('  \u00b7  '\)/.test(memberViewSrc),
  'and not with any separator character a title could contain');
// a newline only renders as a line break if the cell says so, and `table()`
// coerces every value to text - so the column carries the class
assert.ok(/key: 'skills', className: 'irs-lines'/.test(memberViewSrc),
  'the skills column is marked .irs-lines');
const memberCss = fs.readFileSync(path.join(base, 'css/IRSTasks.css'), 'utf8');
assert.ok(/\.irs-tasks \.irs-lines\s*\{[^}]*white-space:\s*pre-line/.test(memberCss),
  '.irs-lines renders the newlines, and is scoped under the one root class');


// ---- 21. the task's Project Baseline, and where the form's dates come from
//
// The form's Start Date and Planned End Date used to point at the PROJECT and
// rendered "not returned". They now come from the Project Baseline captured for
// the task over IRSTaskBaseline, because R&D-PRJ-02 carries a Rev. No. and its
// dates are the ones AS APPROVED, not the live schedule (user, 2026-10-09).
// Values below were measured on T-85756263-0000139 -> B-85756263-0000116.

const BaselineRequest = {
  _calls: [],
  _body: {},
  get: function (p, opts) {
    BaselineRequest._calls.push({ path: p, opts: opts });
    return BaselineRequest._body instanceof Error
      ? Promise.reject(BaselineRequest._body)
      : Promise.resolve(BaselineRequest._body);
  }
};
const Baseline = load(path.join(base, 'js/services/BaselineService.js'),
  [BaselineRequest, Log]);

BaselineRequest._body = {
  taskId: '299036CE0000C6D46AC7888900000580',
  baseline: {
    linked: 'true',
    id: '39261.35329.11988.11022',
    physicalId: '299036CE0000C6D46AC788A5000005A6',
    name: 'B-85756263-0000116',
    type: 'Project Baseline',
    state: 'Active',
    actualStartDate: '10/8/2026 8:00:00 AM',
    actualFinishDate: '',
    estimatedStartDate: '10/7/2026 8:00:00 AM',
    estimatedFinishDate: '10/13/2026 5:00:00 PM'
  }
};

const baselineChecks = Baseline.get('TASK1').then(b => {
  // task-scoped, NOT project-scoped: the IRSTaskBaseline link starts at the
  // task, so a project with four such tasks has four different baselines
  assert.strictEqual(BaselineRequest._calls[0].path,
    'resources/v1/irsproject/tasks/TASK1/baseline');
  assert.strictEqual(b.linked, true, 'ENOVIA sends the STRING "true"');
  assert.strictEqual(b.name, 'B-85756263-0000116');
  // the prefered id is the physical one, as everywhere else in this widget
  assert.strictEqual(b.id, '299036CE0000C6D46AC788A5000005A6');

  // `attributes` deliberately has the same shape the task and project carry,
  // so a `source: "baseline"` row resolves through the SAME code path
  assert.strictEqual(b.attributes.actualStartDate, '10/8/2026 8:00:00 AM');
  assert.strictEqual(b.attributes.estimatedFinishDate, '10/13/2026 5:00:00 PM');
  // all four are carried, so which one the form prints stays a form decision
  assert.deepStrictEqual(Object.keys(b.attributes).sort(),
    ['actualFinishDate', 'actualStartDate', 'estimatedFinishDate',
     'estimatedStartDate']);
}).then(() => {
  // NOT CAPTURED is the common case - 6 of the live tasks had a baseline on
  // 2026-10-09 and the rest did not. It is a normal state, not a failure
  BaselineRequest._body = {
    taskId: 'T2',
    baseline: { linked: 'false', id: '', physicalId: '', name: '', type: '',
                state: '', actualStartDate: '', actualFinishDate: '',
                estimatedStartDate: '', estimatedFinishDate: '' }
  };
  return Baseline.get('T2');
}).then(b => {
  assert.strictEqual(b.linked, false);
  assert.strictEqual(b.attributes.actualStartDate, '');
}).then(() => {
  return Baseline.get('').then(
    () => { throw new Error('no id must be refused'); },
    err => { assert.ok(/No task id/.test(err.message), err.message); });
});

// ---- the form points both dates at the baseline
assert.strictEqual(costBy['Start Date'].source, 'baseline');
assert.strictEqual(costBy['Start Date'].field, 'actualStartDate');
assert.strictEqual(costBy['Planned End Date'].source, 'baseline');
assert.strictEqual(costBy['Planned End Date'].field, 'estimatedFinishDate');
// they were `project` + taskEstimatedStartDate, which rendered "not returned"
assert.ok(!/taskEstimatedStartDate|taskEstimatedFinishDate/.test(
  JSON.stringify(costSpec)), 'the project date fields are gone');
['Start Date', 'Planned End Date'].forEach(label =>
  assert.strictEqual(costBy[label].display, 'date',
    label + ' is formatted as a date, not printed as a US timestamp'));

// ---- the view
const baseViewSrc = fs.readFileSync(
  path.join(base, 'js/views/TaskDetailView.js'), 'utf8');

// a third value-bearing holder, resolved by the same function
assert.ok(/function resolve\(spec, task, project, baseline\)/.test(baseViewSrc));
assert.ok(/out\.source === 'baseline'.*\n?.*holder = baseline/.test(baseViewSrc) ||
          /holder = baseline/.test(baseViewSrc),
  'a `baseline` source reads from the baseline holder');

// "not captured yet" must NOT read as "the platform did not return it"
assert.ok(/notCaptured/.test(baseViewSrc), 'the unlinked case is its own state');
assert.ok(/no baseline captured yet/.test(baseViewSrc));
const missingIdx = baseViewSrc.indexOf("value: 'not returned'");
const notCapturedIdx = baseViewSrc.indexOf('no baseline captured yet');
assert.ok(missingIdx > 0 && notCapturedIdx > 0 && missingIdx !== notCapturedIdx,
  'the two states render differently - one is an error, the other is a fact');

// the second call is made ONLY by a form that asks for it
assert.ok(/field\.source === 'baseline' && !field\.hidden/.test(baseViewSrc),
  'a form with no baseline row makes no baseline call');
// and it runs alongside the project context, not after it
assert.ok(/Promise\.all\(\[\s*\n?\s*loadContext\(spec\),\s*\n?\s*loadBaseline\(spec\)/
  .test(baseViewSrc), 'the two independent calls go together');

// ---- the date format: the kernel's US spelling, not ISO
const baseFmtBody = baseViewSrc.match(/var VALUE_FORMAT = \{[\s\S]*?\n    \};/)[0];
const toTextB = v => (v === null || v === undefined) ? '' : String(v).trim();
const BASE_FORMAT = (function () {
  const toText = toTextB;
  return eval('(function(){' + baseFmtBody + ' return VALUE_FORMAT;})()');
}());
assert.strictEqual(BASE_FORMAT.date('10/8/2026 8:00:00 AM'), '8 Oct 2026');
assert.strictEqual(BASE_FORMAT.date('10/13/2026 5:00:00 PM'), '13 Oct 2026');
assert.strictEqual(BASE_FORMAT.date(''), '', 'an unset date stays blank');
assert.strictEqual(BASE_FORMAT.date('not a date'), 'not a date',
  'never the words "Invalid Date" on a form a customer signs');

// ---- the platform side: the relationship this all hangs on
const relBaseline = fs.readFileSync(
  path.join(mx, 'datamodel/relationship/RELATIONSHIP_IRSTaskBaseline.mxu'), 'utf8');
assert.ok(/EPMPROJECT_PERSONNEL_COST/.test(relBaseline),
  'the link starts at the personnel/cost task');
assert.ok(/Project Baseline/.test(relBaseline));
// one-to-one: the reader never has to choose between several baselines
assert.ok(/preventduplicates/.test(relBaseline));

// ---- the JAR and the twin must agree, as always
const twinBaseline = fs.readFileSync(
  path.join(mx, 'program/jpo/IRSProjectContext_mxJPO.java'), 'utf8');
[['the JAR reader', readerSrc], ['the twin', twinBaseline]].forEach(([what, src]) => {
  assert.ok(/relationship_IRSTaskBaseline/.test(src),
    what + ' resolves IRSTaskBaseline by symbolic name');
  assert.ok(/readTaskBaselineContext/.test(src), what + ' exposes the reader');
  // ONE round trip from the task
  const body = src.match(/private static Map<String, Object> readTaskBaseline\(/) ?
    src.slice(src.search(/private static Map<String, Object> readTaskBaseline\(/)) : '';
  const upto = body.slice(0, body.indexOf('\n    }'));
  assert.strictEqual((upto.match(/getInfo\(/g) || []).length, 1,
    what + ' reads the baseline in exactly one round trip');
});

// a bad task id must PROPAGATE so the service can answer 404 - it must not be
// swallowed into a 200 with an error string, which is what it did at first
assert.ok(!/baselineError/.test(readerSrc),
  'no per-section error field: one call means no partial result to describe');


// ---- the dates are the baseline OBJECT's, NOT its copy of the task -------
//
// A Project Baseline CONTAINS a copy of every task, the personnel/cost task
// among them. Both are reachable, both carry the same four `Task *`
// attributes, and they hold DIFFERENT values. Measured on B-85756263-0000116:
//
//   the baseline OBJECT     actual start 8 Oct, estimated finish 13 Oct
//                           -> the PROJECT's span            <-- what we read
//   its copy of T-...0139   actual start EMPTY, 12 - 13 Oct
//                           -> that one approval task's window
//
// The form asks for the project, so it is the object. Confirmed by the user on
// 2026-10-09 after this was built, which is why it is pinned here rather than
// left to a comment.
[['the JAR reader', readerSrc], ['the twin', twinBaseline]].forEach(([what, src]) => {
  const body = src.slice(src.search(/private static Map<String, Object> readTaskBaseline\(/));
  const upto = body.slice(0, body.indexOf('\n    }'));
  // the traversal stops at the far end of the link - one hop, no task list
  assert.ok(/from\[" \+ rel \+ "\]\.to\./.test(upto),
    what + ' reads the far end of IRSTaskBaseline');
  assert.ok(!/\.to\.from\[|Subtask|\.to\.to\[/.test(upto),
    what + ' does NOT walk on into the baseline\'s own task list');
});

// and the form says which it is, for whoever reads it next
assert.ok(/baseline OBJECT/.test(costSpec._source.baseline),
  'the form records that it is the object, not the task copy');
assert.ok(/12-13 Oct|12 - 13 Oct/.test(costSpec._source.baseline),
  'with the measured difference, so the distinction is checkable');

baselineChecks.then(() => console.log('irstasks-baseline: all assertions passed'))
  .catch(err => { console.error(err); process.exit(1); });

memberChecks.then(() => console.log('irstasks-members: all assertions passed'))
  .catch(err => { console.error(err); process.exit(1); });

