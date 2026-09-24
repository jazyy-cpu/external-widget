// Run: node src/test/js/irsprojects-search.test.js   (from external-widget/)
// Tests the grid's one search control: which fields it looks in, and that an
// empty term clears the filter instead of installing a match-everything one.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const VIEW = path.join(__dirname,
  '../../main/resources/static/WidgetPacket/IRSProjects/js/views/ProjectListView.js');
const TOOLBAR = path.join(__dirname,
  '../../main/resources/static/WidgetPacket/IRSProjects/js/components/ListToolbar.js');

function load(file, deps) {
  let mod;
  const define = (name, d, f) => { mod = f.apply(null, deps); };
  new Function('define', fs.readFileSync(file, 'utf8'))(define);
  return mod;
}

const View = load(VIEW, [{}, {}, {}, () => []]);   // only _matcher is exercised
const Toolbar = load(TOOLBAR, []);

const rows = [
  { projectNo: 'PRJ-0001', title: 'Hull analysis 2026', category: 'Analysis',
    department: 'Structures', customer: 'Acme', state: 'Active' },
  { projectNo: '',         title: 'Coating trial',      category: 'Research',
    department: '', customer: '', state: 'Hold' }
];
const hits = (term, field) => {
  const fn = View._matcher(term, field);
  return fn === null ? null : rows.filter(fn).map(r => r.title);
};

// 1. an empty or blank term means "no filter", not "match everything"
assert.strictEqual(View._matcher('', 'all'), null);
assert.strictEqual(View._matcher('   ', 'all'), null);
assert.strictEqual(View._matcher(undefined, undefined), null);

// 2. "All fields" searches Project No. and Title - and NOTHING else
//    (user, 2026-09-24: "search for only project no and project title")
assert.deepStrictEqual(hits('hull', 'all'), ['Hull analysis 2026']);
assert.deepStrictEqual(hits('PRJ-0001', 'all'), ['Hull analysis 2026']);
assert.deepStrictEqual(hits('Structures', 'all'), [], 'department is not searched');
assert.deepStrictEqual(hits('Acme', 'all'), [], 'customer is not searched');
assert.deepStrictEqual(hits('Active', 'all'), [], 'status is not searched');
assert.deepStrictEqual(hits('Research', 'all'), [],
  'category is not searched: no title carries the word "Research"');

// 3. case and partial matches
assert.deepStrictEqual(hits('HULL', 'all'), ['Hull analysis 2026']);
assert.deepStrictEqual(hits('  coating ', 'all'), ['Coating trial'],
  'the term is trimmed');

// 4. a single chosen field looks only there
assert.deepStrictEqual(hits('hull', 'title'), ['Hull analysis 2026']);
assert.deepStrictEqual(hits('hull', 'projectNo'), []);
assert.deepStrictEqual(hits('0001', 'projectNo'), ['Hull analysis 2026']);

// 5. an empty cell never throws and never matches
assert.deepStrictEqual(hits('PRJ', 'projectNo'), ['Hull analysis 2026'],
  'the row whose Project No. is empty is simply not a match - and does not throw');
assert.deepStrictEqual(hits('zzz', 'all'), [], 'no match is an empty list, not everything');

// 6. the picker offers exactly the fields the matcher supports
assert.deepStrictEqual(Toolbar.FIELDS.map(f => f.value), ['all', 'projectNo', 'title']);

console.log('ALL SEARCH TESTS PASSED');
