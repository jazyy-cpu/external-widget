// Run: node src/test/js/irstasks-landing.test.js   (from external-widget/)
// The task landing page's pure logic: the subtype descriptor registry, the
// search control, the column set, and the stub service's row shape.
// Nothing here touches the DOM or the platform.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '../../main/resources/static/WidgetPacket/IRSTasks');
const FIELDS = path.join(base, 'js/config/TaskFields.js');
const SERVICE = path.join(base, 'js/services/TaskService.js');
const COLUMNS = path.join(base, 'js/views/TaskColumns.js');
const VIEW = path.join(base, 'js/views/TaskListView.js');
const TOOLBAR = path.join(base, 'js/components/TaskToolbar.js');

function load(file, deps) {
  let mod;
  const define = (name, d, f) => { mod = f.apply(null, deps); };
  new Function('define', fs.readFileSync(file, 'utf8'))(define);
  return mod;
}

const Fields = load(FIELDS, []);
// the service calls JazzySole/Request - a fake stands in, so the test stays
// free of the DOM and the platform while exercising the real filters
const Request = {
  _body: { data: [] },
  _calls: [],
  get: function (path, opts) {
    Request._calls.push({ path: path, opts: opts });
    return Promise.resolve(Request._body);
  }
};
// the diagnostic log is silenced here: the suite asserts behaviour, and a
// console full of diagnostics hides a failing assertion
const Log = { on: false, info: () => {}, warn: () => {}, table: () => {} };
const Service = load(SERVICE, [Request, Fields, Log]);
const Toolbar = load(TOOLBAR, []);
const View = load(VIEW, [{}, {}, {}, () => []]);   // only _matcher is exercised
// the column module only needs Format's shape, not a DOM
const columns = load(COLUMNS, [Fields, { badge: () => ({}), date: (v) => v, empty: () => ({}) }]);

// ---- 1. the subtype registry (WP06 F1) --------------------------------

// Filled with the four gateway subtypes on 2026-10-07, so the allow-list is a
// real one now: the resource returns every task the user can see, and only
// ours belong on this page (user: "we will show only our custom task").
assert.deepStrictEqual(Object.keys(Fields.TASK_TYPES).sort(), [
  'EPMPROJECT_PERSONNEL_COST', 'EPMPROJECT_PROPOSAL',
  'EPMPROJECT_REVIEW', 'EPMPROJECT_STAGE_VALIDATION'
], 'the four gateway subtypes, and nothing else');

assert.strictEqual(Fields.isListed('EPMPROJECT_REVIEW'), true);
assert.strictEqual(Fields.isListed('Task'), false, 'an OOTB task is not listed');
assert.strictEqual(Fields.isListed('Inbox Task'), false, 'a route task is not listed');
assert.strictEqual(Fields.isListed('EPMTRAINING_TASK'), false,
  'the training task is ours but belongs to WGT-08, not to this widget');
assert.strictEqual(Fields.isListed(''), false);
assert.strictEqual(Fields.isListed(undefined), false);

// the labels are the platform's own names, copied from a live response - they
// are the fallback for when the response does not carry nlsType
assert.strictEqual(Fields.typeLabel('EPMPROJECT_PROPOSAL'), 'PROJECT PROPOSAL / PROFILE');
assert.strictEqual(Fields.typeLabel('EPMPROJECT_PERSONNEL_COST'),
  'PROJECT PERSONNEL / COST ESTIMATION');
assert.strictEqual(Fields.typeLabel('EPMPROJECT_STAGE_VALIDATION'), 'STAGE-VALIDATION REPORT');
assert.strictEqual(Fields.typeLabel('EPMPROJECT_REVIEW'), 'PROJECT REVIEW');

// every descriptor must be complete: a missing `fields` id would leave its
// view with no JSON to read, which is F2's whole mechanism
Object.keys(Fields.TASK_TYPES).forEach(type => {
  const d = Fields.descriptor(type);
  assert.ok(d.label && d.label.length, type + ' needs a label');
  assert.ok(d.badge && d.badge.length, type + ' needs a badge');
  assert.ok(d.fields && d.fields.length, type + ' needs a field-set id');
  assert.strictEqual(Fields.typeLabel(type), d.label);
  assert.strictEqual(Fields.typeBadge(type), 'irs-type irs-type-' + d.badge);
  assert.strictEqual(Fields.fieldSet(type), d.fields);
});

// an undeclared type still reads: its own name, and the unknown badge
assert.strictEqual(Fields.typeLabel('Gate'), 'Gate');
assert.strictEqual(Fields.typeBadge('Gate'), 'irs-type irs-type-unknown');
assert.strictEqual(Fields.typeLabel(''), '');
assert.strictEqual(Fields.typeLabel(undefined), '');

// baseline and snapshot copies are not tasks of their own (live finding,
// 2026-10-07: one task name existed five times, four of them in baselines)
assert.strictEqual(Fields.isCopy('Project Baseline'), true);
assert.strictEqual(Fields.isCopy('Project Snapshot'), true);
assert.strictEqual(Fields.isCopy('EPMAnalysisProject'), false);
assert.strictEqual(Fields.isCopy(''), false);

// edit is offered in exactly one state - the one the platform shows as In Work
assert.strictEqual(Fields.isEditable('Active'), true);
['Create', 'Assign', 'Review', 'Complete', '', undefined].forEach(st =>
  assert.strictEqual(Fields.isEditable(st), false,
    'edit must not be offered in state "' + st + '"'));
assert.strictEqual(Fields.stateLabel('Active'), 'In Work',
  'the editable state must be the one the user calls In Work');

// ---- 2. states --------------------------------------------------------

assert.strictEqual(Fields.stateLabel('Create'), 'Draft');
assert.strictEqual(Fields.stateBadge('Create'), 'irs-state irs-state-draft');
// the POC's spellings draw too, since it is not yet known which the policy uses
assert.strictEqual(Fields.stateBadge('In Work'), 'irs-state irs-state-inwork');
assert.strictEqual(Fields.stateBadge('Not Started'), 'irs-state irs-state-todo');
// an unmapped state is visible as unmapped rather than blank or crashing
assert.strictEqual(Fields.stateLabel('Something Else'), 'Something Else');
assert.strictEqual(Fields.stateBadge('Something Else'), 'irs-state irs-state-unknown');
assert.strictEqual(Fields.isClosed('Complete'), true);
assert.strictEqual(Fields.isClosed('Active'), false);

// ---- 3. the search control -------------------------------------------

const rows = [
  { title: 'Proposal review for hull study', projectName: 'Hull analysis 2026',
    assignedTo: 'Sharad S Dhavalikar', state: 'Active', department: 'Structures' },
  { title: 'Coating approval', projectName: 'Coating trial',
    assignedTo: 'Sachin S Awasare', state: 'Review', department: '' }
];
const hits = (term, field) => {
  const fn = View._matcher(term, field);
  return fn === null ? null : rows.filter(fn).map(r => r.title);
};

// an empty or blank term means "no filter", not "match everything"
assert.strictEqual(View._matcher('', 'all'), null);
assert.strictEqual(View._matcher('   ', 'all'), null);
assert.strictEqual(View._matcher(undefined, undefined), null);

// "All fields" searches exactly Title, Project and Assigned To
assert.deepStrictEqual(hits('hull', 'all'), ['Proposal review for hull study'],
  'matched through both the title and the project name of the same row');
assert.deepStrictEqual(hits('awasare', 'all'), ['Coating approval']);
assert.deepStrictEqual(hits('Structures', 'all'), [], 'department is not searched');
assert.deepStrictEqual(hits('Review', 'all'), ['Proposal review for hull study'],
  'the word matches a title, not the state column');

// one named field searches only that field
assert.deepStrictEqual(hits('coating', 'projectName'), ['Coating approval']);
assert.deepStrictEqual(hits('coating', 'assignedTo'), []);

// case and partial
assert.deepStrictEqual(hits('HULL', 'title'), ['Proposal review for hull study']);

// the toolbar's picker and the view's field list must not drift apart:
// every option the user can pick has to be a key the matcher knows
const pickable = Toolbar.FIELDS.map(f => f.value).filter(v => v !== 'all');
pickable.forEach(field => {
  assert.notStrictEqual(View._matcher('x', field), null,
    'the toolbar offers "' + field + '" - the matcher must accept it');
  assert.ok(Object.prototype.hasOwnProperty.call(rows[0], field),
    'the toolbar offers "' + field + '" - the row shape must carry it');
});

// ---- 4. the column set -----------------------------------------------

const cols = columns(() => {});
const titles = cols.map(c => c.title);
assert.deepStrictEqual(titles, [
  '#', 'Title', 'Task Type', 'Status', 'Assigned To', 'Project',
  'Department', 'Route', 'Route Task', 'Action Required', 'Est. Finish'
], 'the column set taken from the POC grid, minus Needs Review and Actions');

// every data column must name a field that the service's row shape carries,
// or the grid silently shows an empty column
const row = Service._toRow({ id: 'X', type: 'T', dataelements: {} });
cols.filter(c => c.field).forEach(c => {
  assert.ok(Object.prototype.hasOwnProperty.call(row, c.field),
    'column "' + c.title + '" reads row.' + c.field + ', which the row shape lacks');
});

// no header filters anywhere: there is one search control instead
cols.forEach(c => assert.strictEqual(c.headerFilter, undefined,
  'column "' + c.title + '" must not carry a header filter'));

// no column may shrink below its minimum, or a narrow widget squeezes them
// instead of scrolling
cols.forEach(c => assert.ok(typeof c.minWidth === 'number',
  'column "' + c.title + '" needs a minWidth'));

// the title is the one clickable target
const title = cols.find(c => c.field === 'title');
assert.strictEqual(typeof title.cellClick, 'function');
assert.strictEqual(title.frozen, true);
assert.strictEqual(cols.filter(c => typeof c.cellClick === 'function').length, 1,
  'exactly one clickable column');

// ---- 5. the service: one call, two filters ---------------------------

// A response shaped like the real one (POC Task_POC.js:279 and its transform):
// task fields in `dataelements`, project / route / assignees in `relateddata`.
function task(id, type, state, projectType, projectName) {
  return {
    id: id,
    type: type,
    dataelements: {
      title: 'Task ' + id,
      state: state,
      taskEstimatedFinishDate: '2026-02-15T17:00:00.000'
    },
    relateddata: {
      assignees: [{ dataelements: { firstname: 'Jiwan', lastname: 'Dhiman' } }],
      DPMProject: [{
        id: 'P' + id,
        type: projectType,
        dataelements: { name: projectName, title: projectName + ' title' }
      }],
      route: [{ id: 'R' + id, dataelements: { name: 'Route ' + id } }]
    }
  };
}

Request._body = {
  data: [
    task('1', 'EPMPROJECT_REVIEW', 'Active', 'EPMAnalysisProject', 'ana'),
    task('2', 'EPMPROJECT_PROPOSAL', 'Complete', 'EPMResearchProject', 'res'),
    // the same task copied into a baseline - must never be listed
    task('3', 'EPMPROJECT_PROPOSAL', 'Active', 'Project Baseline', 'B-0000106'),
    // an OOTB task and a route task, both of which the resource returns
    task('4', 'Task', 'Active', 'EPMAnalysisProject', 'ana'),
    task('5', 'Inbox Task', 'Active', 'EPMAnalysisProject', 'ana')
  ]
};

Service.list().then(result => {
  // the call itself: the parameters the resource needs, and no $fields list
  const call = Request._calls[0];
  assert.strictEqual(call.path, 'resources/v1/modeler/tasks');
  assert.strictEqual(call.opts.params.showProjectTasks, 'true');
  assert.strictEqual(call.opts.params.currentTaskFilter, 'all',
    'all tasks, not only the ones assigned to the current user (user, 2026-10-07)');
  // `nlsType` is the REQUESTABLE field name; `typeNLS` is only the key the
  // platform emits on related objects. Asking for `typeNLS` asks for
  // nothing, which is why the grid showed our own labels for days
  assert.strictEqual(call.opts.params['$fields'], 'basics,nlsType',
    'the set plus the platform\'s own display names - without them the grid shows ours');
  assert.ok(/assignees/.test(call.opts.params['$include']),
    'assignees must be included, or Assigned To is always empty');

  // open tasks of our subtypes, on real projects, and nothing else
  assert.deepStrictEqual(result.rows.map(r => r.id), ['1'],
    'the completed one, the baseline copy, the OOTB task and the route task all drop');
  assert.deepStrictEqual(result.counts,
    { total: 5, otherType: 2, copies: 1, closed: 1, kept: 1, nlsNames: 0 });
  assert.ok(/1 of 5/.test(result.note),
    'the note must say how many were dropped: ' + result.note);

  // the project arrives with the task - no second call for the Project column
  const r = result.rows[0];
  assert.strictEqual(r.projectName, 'ana');
  assert.strictEqual(r.projectTitle, 'ana title');
  assert.strictEqual(r.projectType, 'EPMAnalysisProject');
  assert.strictEqual(r.assignedTo, 'Jiwan Dhiman');
  assert.strictEqual(r.route, 'Route 1');
  assert.strictEqual(r.typeLabel, 'PROJECT REVIEW',
    'no nlsType in this fixture, so the registry label shows - and it is now the DMC name');
  assert.strictEqual(r.fromPlatform, false);
  assert.strictEqual(r.stateLabel, 'In Work', 'Active reads as In Work');
  assert.strictEqual(r.editable, true, 'an Active task may be edited');

  return Service.list({ includeClosed: true });
}).then(result => {
  assert.deepStrictEqual(result.rows.map(r => r.id), ['1', '2'],
    'with closed tasks included, the completed one is listed too');
  assert.strictEqual(result.rows[1].editable, false,
    'a completed task is listed but not editable');

  // the row shape carries every key the grid and the task view read, and a
  // missing value is '' rather than undefined so no formatter has to guard
  const row = Service._toRow({ id: 'X', type: 'T', dataelements: {} });
  ['id', 'type', 'typeLabel', 'stateLabel', 'fromPlatform', 'title', 'state',
   'editable', 'assignedTo', 'projectId', 'projectType', 'projectName',
   'projectTitle', 'department', 'route', 'routeId', 'routeTask',
   'actionRequired', 'finish', 'start']
    .forEach(key => assert.ok(Object.prototype.hasOwnProperty.call(row, key),
      'the row shape must carry ' + key));
  Object.keys(row).forEach(key => assert.notStrictEqual(row[key], undefined,
    key + ' must default to an empty string'));

  // ---- the platform's own names win where they arrive ----------------
  Request._body = {
    data: [{
      id: '9', type: 'EPMPROJECT_PROPOSAL',
      dataelements: {
        title: 'T-9', state: 'Active',
        nlsType: 'PROJECT PROPOSAL / PROFILE', stateNLS: 'In Work'
      },
      relateddata: {
        DPMProject: [{ id: 'P9', type: 'EPMAnalysisProject',
                       dataelements: { name: 'ana', title: 'ana' } }]
      }
    }]
  };
  Request._calls = [];
  return Service.list();
}).then(result => {
  const row = result.rows[0];
  assert.strictEqual(row.typeLabel, 'PROJECT PROPOSAL / PROFILE');
  assert.strictEqual(row.stateLabel, 'In Work');
  assert.strictEqual(row.fromPlatform, true, 'the name came from the platform');
  assert.strictEqual(result.counts.nlsNames, 1,
    'counted, so the first live run says whether the field arrives at all');

  // ---- the named fields may be refused: one retry with the plain set ----
  Request._calls = [];
  let first = true;
  const realGet = Request.get;
  Request.get = function (p, opts) {
    Request._calls.push({ path: p, opts: opts });
    if (first) { first = false; return Promise.reject(new Error('400 bad $fields')); }
    return Promise.resolve({ data: [] });
  };
  return Service.list().then(r2 => {
    assert.strictEqual(Request._calls.length, 2, 'it retried');
    assert.strictEqual(Request._calls[1].opts.params['$fields'], 'basics',
      'the retry drops the named fields, so the page still draws');
    assert.deepStrictEqual(r2.rows, []);
    Request.get = realGet;
  });
}).then(() => {
  // an empty response says so, and says what to check first
  Request._body = { data: [] };
  return Service.list();
}).then(result => {
  assert.deepStrictEqual(result.rows, []);
  assert.ok(/no task at all/.test(result.note));
  console.log('irstasks-landing: all assertions passed');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
