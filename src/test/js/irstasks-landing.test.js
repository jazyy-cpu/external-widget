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
const Service = load(SERVICE, [Fields]);
const Toolbar = load(TOOLBAR, []);
const View = load(VIEW, [{}, {}, {}, () => []]);   // only _matcher is exercised
// the column module only needs Format's shape, not a DOM
const columns = load(COLUMNS, [Fields, { badge: () => ({}), date: (v) => v, empty: () => ({}) }]);

// ---- 1. the subtype registry (WP06 F1) --------------------------------

// It is empty until the custom subtypes are deployed, and while it is empty
// the grid must show everything - an allow-list that filters every row out
// would make a working widget look broken.
assert.deepStrictEqual(Object.keys(Fields.TASK_TYPES), [],
  'TASK_TYPES is expected to be empty until the subtypes exist');
assert.strictEqual(Fields.isListed('anything at all'), true,
  'with no subtypes declared, every type is listed');
assert.strictEqual(Fields.descriptor('anything at all'), null);

// an undeclared type still reads: its own name, and the unknown badge
assert.strictEqual(Fields.typeLabel('IRSTaskProposalReview'), 'IRSTaskProposalReview');
assert.strictEqual(Fields.typeBadge('IRSTaskProposalReview'), 'irs-type irs-type-unknown');
assert.strictEqual(Fields.typeLabel(''), '');
assert.strictEqual(Fields.typeLabel(undefined), '');

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

// ---- 5. the service is a deliberate stub -----------------------------

Service.list().then(result => {
  assert.deepStrictEqual(result.rows, [], 'no call is made yet, so no rows');
  assert.ok(result.note && /not deployed|not wired/.test(result.note),
    'the empty grid must say why it is empty');

  // the row shape keeps the route fields from the start, so wiring the route
  // call later changes the service and nothing in the view
  ['id', 'type', 'typeLabel', 'title', 'state', 'assignedTo', 'projectId',
   'projectName', 'department', 'route', 'routeTask', 'actionRequired', 'finish']
    .forEach(key => assert.ok(Object.prototype.hasOwnProperty.call(row, key),
      'the row shape must carry ' + key));

  // a missing field becomes '' rather than undefined, so a formatter never
  // has to guard
  Object.keys(row).forEach(key => assert.notStrictEqual(row[key], undefined,
    key + ' must default to an empty string'));

  console.log('irstasks-landing: all assertions passed');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
