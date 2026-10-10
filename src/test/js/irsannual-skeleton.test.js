// Run: node src/test/js/irsannual-skeleton.test.js   (from external-widget/)
//
// The Annual Monitoring widget's pure logic. Two things here are worth testing
// far more than any UI in this packet, because both are rules taken from the
// customer's forms and both are easy to get subtly wrong:
//
//   1. the points formula and the grade thresholds;
//   2. the OVERLAP test used to decide whether a project or training falls in
//      the assessment range. Its first written form - "start or end inside the
//      range" - silently dropped an item spanning the whole range, which is
//      exactly the long project a monitoring report should include.
//
// Nothing here touches the DOM or the platform.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '../../main/resources/static/WidgetPacket/IRSAnnualMonitoring');
const FIELDS = path.join(base, 'js/config/AssessmentFields.js');
const SERVICE = path.join(base, 'js/services/AssessmentService.js');
const COLUMNS = path.join(base, 'js/views/AssessmentColumns.js');

function load(file, deps) {
  let mod;
  const define = (name, d, f) => { mod = f.apply(null, deps); };
  new Function('define', fs.readFileSync(file, 'utf8'))(define);
  return mod;
}

const Fields = load(FIELDS, []);
// the service calls JazzySole/Request - a fake stands in
const Request = {
  _calls: [],
  _getResult: Promise.reject(new Error('not built')),
  get: function (p, opts) { Request._calls.push({ method: 'GET', path: p, opts }); return Request._getResult; },
  send: function (p, opts) { Request._calls.push({ path: p, opts }); return Promise.reject(new Error('not built')); }
};
const Service = load(SERVICE, [Request, Fields]);
const Columns = load(COLUMNS, [Fields]);

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  ok   ' + name); }
  catch (e) { failures++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

// ---- 1. the points formula -------------------------------------------
console.log('points');

check('zero and nonsense man-days score nothing', () => {
  assert.strictEqual(Fields.points(0), 0);
  assert.strictEqual(Fields.points(-5), 0);
  assert.strictEqual(Fields.points('abc'), 0);
  assert.strictEqual(Fields.points(null), 0);
});

check('pro rata below the cap', () => {
  // 114 man-days is half a working year
  assert.ok(Math.abs(Fields.points(114) - 5.016) < 1e-9);
});

check('a full year is CAPPED at 10, not 10.032', () => {
  // 0.044 x 228 = 10.032 - this is exactly why the min() is not optional
  assert.ok(Fields.POINTS_FACTOR * Fields.MANDAYS_PER_YEAR > Fields.POINTS_CAP);
  assert.strictEqual(Fields.points(228), 10);
  assert.strictEqual(Fields.points(10000), 10);
});

// ---- 2. the grade thresholds -----------------------------------------
console.log('grade');

check('A at 20, B at 10, C above zero, otherwise Not Assessed', () => {
  assert.strictEqual(Fields.grade(0), 'Not Assessed');
  assert.strictEqual(Fields.grade(0.5), 'C');
  assert.strictEqual(Fields.grade(9.99), 'C');
  assert.strictEqual(Fields.grade(10), 'B');
  assert.strictEqual(Fields.grade(19.99), 'B');
  assert.strictEqual(Fields.grade(20), 'A');
  assert.strictEqual(Fields.grade(50), 'A');
});

check('grades carry the meanings printed on the form', () => {
  assert.strictEqual(Fields.GRADE_MEANING.A, 'Reviewer');
  assert.strictEqual(Fields.GRADE_MEANING.B, 'Independent');
  assert.strictEqual(Fields.GRADE_MEANING.C, 'Under Supervision');
});

check('each grade has its own badge class', () => {
  const seen = ['A', 'B', 'C', 'Not Assessed'].map(Fields.gradeClass);
  assert.strictEqual(new Set(seen).size, 4);
});

// ---- 3. the financial year ------------------------------------------
console.log('financial year');

check('April to March, and a January date belongs to the year before', () => {
  const mid = Fields.defaultRange(new Date(2026, 9, 10));   // October 2026
  assert.strictEqual(mid.year, 2026);
  assert.strictEqual(mid.start, '2026-04-01');
  assert.strictEqual(mid.end, '2027-03-31');

  const jan = Fields.defaultRange(new Date(2027, 0, 15));   // January 2027
  assert.strictEqual(jan.year, 2026);
  assert.strictEqual(jan.start, '2026-04-01');
});

check('1 April starts the new year, 31 March ends the old one', () => {
  assert.strictEqual(Fields.defaultRange(new Date(2026, 3, 1)).year, 2026);
  assert.strictEqual(Fields.defaultRange(new Date(2026, 2, 31)).year, 2025);
});

// ---- 4. the overlap test - the one that was wrong first --------------
console.log('overlap');

const FROM = '2026-04-01';
const TO = '2027-03-31';

check('an item wholly inside counts', () => {
  assert.strictEqual(Fields.overlaps('2026-06-01', '2026-09-01', FROM, TO), true);
});

check('AN ITEM SPANNING THE WHOLE RANGE COUNTS', () => {
  // the regression this test exists for: started before, ends after
  assert.strictEqual(Fields.overlaps('2025-01-01', '2028-01-01', FROM, TO), true);
});

check('an open-ended item is still running and counts', () => {
  assert.strictEqual(Fields.overlaps('2025-01-01', '', FROM, TO), true);
  assert.strictEqual(Fields.overlaps('2026-06-01', null, FROM, TO), true);
});

check('items wholly before or wholly after do not count', () => {
  assert.strictEqual(Fields.overlaps('2024-01-01', '2025-01-01', FROM, TO), false);
  assert.strictEqual(Fields.overlaps('2028-01-01', '2029-01-01', FROM, TO), false);
});

check('touching either edge counts', () => {
  assert.strictEqual(Fields.overlaps('2025-01-01', FROM, FROM, TO), true);
  assert.strictEqual(Fields.overlaps(TO, '2028-01-01', FROM, TO), true);
});

check('an item with no start date cannot be placed, so it does not count', () => {
  assert.strictEqual(Fields.overlaps('', '2026-06-01', FROM, TO), false);
});

// ---- 5. the search row mapping --------------------------------------
console.log('row mapping');

check('policy.state is split, keeping only the state', () => {
  const row = Service._toRow({
    physicalId: 'ABC123',
    label: 'HY Annual Assessment 2026',
    attributes: {
      'name': 'ASM-0000001',
      'ds6w:what/ds6w:status': 'IRSSkillAssessment.In Assessment',
      'ds6w:who/ds6w:responsible/ds6w:organizationResponsible': '0000000001',
      'ds6w:when/ds6w:modified': '2026/10/10'
    }
  });
  assert.strictEqual(row.id, 'ABC123');
  assert.strictEqual(row.name, 'ASM-0000001');
  assert.strictEqual(row.title, 'HY Annual Assessment 2026');
  assert.strictEqual(row.state, 'In Assessment');      // not "IRSSkillAssessment.In Assessment"
  assert.strictEqual(row.department, '0000000001');
});

check('custom attributes are blank, because search does not return them', () => {
  const row = Service._toRow({ physicalId: 'X', attributes: {} });
  assert.strictEqual(row.year, '');
  assert.strictEqual(row.period, '');
  assert.strictEqual(row.startDate, '');
  assert.strictEqual(row.endDate, '');
});

check('a missing status does not throw', () => {
  const row = Service._toRow({ physicalId: 'X', attributes: {} });
  assert.strictEqual(row.state, '');
});

// ---- 6. the service reports failure instead of an empty list ---------
console.log('service');

const pending = Service.list({ departmentCode: '0000000001' }).then((result) => {
  check('list() reports indexed=false rather than pretending there are no rounds', () => {
    assert.strictEqual(result.indexed, false);
    assert.strictEqual(result.rows.length, 0);
    assert.ok(result.reason, 'a reason must be given to the user');
  });
  check('list() targets our own REST service', () => {
    assert.ok(Request._calls.length > 0);
    assert.ok(Request._calls[0].path.indexOf('resources/v1/irs/annualmonitoring') === 0);
  });
});

// ---- 7. the seeded file is read from an ABSOLUTE url ------------------
// The regression: a relative XHR path resolves against the PROXIED dashboard
// document, not the widget's host, and 3DDashboard answers 404. IRSTasks hit
// this on 2026-10-08; this widget reproduced it on its first run.
console.log('seeded file url');

check('the departments.json url is derived from a loaded script, not relative', () => {
  const SRC = 'https://host/widget/WidgetPacket/IRSAnnualMonitoring/js/services/DepartmentService.js';
  global.document = { currentScript: null, getElementsByTagName: () => [{ src: SRC }] };
  try {
    const Dept = load(path.join(base, 'js/services/DepartmentService.js'), [Request]);
    assert.strictEqual(Dept.root(),
      'https://host/widget/WidgetPacket/IRSAnnualMonitoring/');
  } finally { delete global.document; }
});

check('with no identifiable script it degrades to relative rather than throwing', () => {
  global.document = { currentScript: null, getElementsByTagName: () => [] };
  try {
    const Dept = load(path.join(base, 'js/services/DepartmentService.js'), [Request]);
    assert.strictEqual(Dept.root(), '');
  } finally { delete global.document; }
});

// ---- 8. the columns --------------------------------------------------
console.log('columns');

check('the grid has its final shape from the start', () => {
  const cols = Columns.build({});
  const fields = cols.map((c) => c.field);
  ['title', 'name', 'year', 'period', 'startDate', 'endDate', 'state'].forEach((f) => {
    assert.ok(fields.indexOf(f) >= 0, 'missing column: ' + f);
  });
});

pending.then(() => {
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed');
  process.exit(failures ? 1 : 0);
});
