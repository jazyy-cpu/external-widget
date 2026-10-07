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

const Detail = load(path.join(base, 'js/services/TaskDetailService.js'), [Request, Fields]);
const View = load(path.join(base, 'js/views/TaskDetailView.js'),
  [Detail, {}, Fields, { date: v => v, badge: () => ({}), empty: () => ({}) }]);

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
const SOURCES = ['project', 'task', 'none'];
const DISPLAYS = ['text', 'longtext', 'pending', 'elsewhere', 'approval', 'type'];
spec.fields.forEach(f => {
  assert.ok(f.label, 'every field needs a label');
  assert.ok(SOURCES.indexOf(f.source) >= 0, f.label + ': bad source ' + f.source);
  assert.ok(DISPLAYS.indexOf(f.display) >= 0, f.label + ': bad display ' + f.display);
  if (f.source !== 'none') {
    assert.ok(f.field, f.label + ' reads a value, so it needs a field name');
  } else {
    assert.ok(f.note, f.label + ' shows no value, so it must explain why');
  }
});

// the proposal form is project data - that is why this page calls the project
const fromProject = spec.fields.filter(f => f.source === 'project').length;
const fromTask = spec.fields.filter(f => f.source === 'task').length;
assert.strictEqual(fromTask, 0,
  'EPMPROJECT_PROPOSAL carries no custom attribute of its own (measured 2026-10-07)');
assert.ok(fromProject >= 14, 'most of the form comes from the project: ' + fromProject);

// ---- 2. the field resolver --------------------------------------------

const task = { attributes: { EPMChangeOfScope: 'TRUE' } };
const project = {
  attributes: {
    title: 'Solize XYZ',
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
    data: [{ id: 'P1', type: 'EPMAnalysisProject',
             dataelements: { name: 'Solize XYZ', title: 'Solize XYZ',
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
  assert.strictEqual(header.find(h => h.field === 'title').value, 'Solize XYZ');

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
