// Run: node src/test/js/irstasks-pes.test.js   (from external-widget/)
// G17 periodic evaluation approvals in IRSTasks (worklog 2026-10-21-12): the
// G17 route approves an IRSPeriodicSoftwareEvaluation, so its inbox tasks must
// reach the Approvals list, open the evaluation page, and draw the R&D-PES form
// and the evidence from the JAR's payload. Nothing here touches the DOM or the
// platform.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '../../main/resources/static/WidgetPacket/IRSTasks');

function load(file, deps) {
  let mod;
  const define = (name, d, f) => { mod = f.apply(null, deps); };
  new Function('define', fs.readFileSync(file, 'utf8'))(define);
  return mod;
}

const Log = { on: false, info: () => {}, warn: () => {}, table: () => {} };
const Fields = load(path.join(base, 'js/config/TaskFields.js'), []);
const TYPE = 'IRSPeriodicSoftwareEvaluation';

// ---- 1. the registry: approvable, never listed --------------------------

assert.strictEqual(Fields.isApprovable(TYPE), true);
assert.strictEqual(Fields.isListed(TYPE), false, 'Approvals list only, like STM (user, 2026-10-21)');
assert.strictEqual(Fields.kindOf(TYPE), 'evaluation');
assert.strictEqual(Fields.kindOf('IRSServiceToolMethod'), 'document', 'STM unchanged');
assert.strictEqual(Fields.kindOf('EPMPROJECT_REVIEW'), 'task');
assert.strictEqual(Fields.fieldSet(TYPE), 'pes-evaluation');
assert.strictEqual(Fields.typeLabel(TYPE), 'PERIODICAL EVALUATION OF SOFTWARE');
assert.strictEqual(Fields.typeBadge(TYPE), 'irs-type irs-type-pes');
assert.ok(fs.readFileSync(path.join(base, 'css/IRSTasks.css'), 'utf8').indexOf('.irs-type-pes') > 0,
  'the badge has its colour');

// ---- 2. the inbox list keeps the G17 steps --------------------------------

const InboxRequest = { get: () => Promise.resolve({ data: [] }) };
const Inbox = load(path.join(base, 'js/services/InboxTaskService.js'), [InboxRequest, Fields, Log]);

/** An inbox task of the G17 route: titles are the role names (worklog 2026-10-21-11). */
function step(role) {
  return {
    id: 'IT-' + role, type: 'Inbox Task',
    dataelements: { title: role, state: 'Assign', routeTaskAction: 'Approve',
                    routeTaskApprovalAction: 'None', modifyAccess: 'TRUE' },
    relateddata: {
      assignees: [],
      route: [{ id: 'ROUTE-PHYS', type: 'Route', dataelements: { name: 'R-0000119' } }],
      contents: [{
        id: '2937BDD7000072246AD872BD00005DEE', type: TYPE,
        dataelements: { name: 'PES-0000010', revision: '', title: 'EXCEL COMPUE',
                        stateNLS: 'InApproval', typeNLS: TYPE }
      }]
    }
  };
}

const connected = Inbox._connectedTask(step('Evaluator'));
assert.strictEqual(connected.ours, true);
assert.strictEqual(connected.kind, 'evaluation');
assert.strictEqual(connected.typeLabel, 'PERIODICAL EVALUATION OF SOFTWARE',
  'the raw type name sent as typeNLS is not shown');
const row = Inbox._toRow(step('Checker'));
assert.strictEqual(row.connectedKind, 'evaluation');
assert.strictEqual(row.connectedId, '2937BDD7000072246AD872BD00005DEE');

// ---- 3. the JAR payload, shaped as the task page reads a task -------------

// what `exec program IRSPeriodicEvaluationContext <PES-0000010>` printed on
// 2026-10-21; reasons in the entry order PES-0000011 returned them, plus Other
const payload = {
  evaluationId: '2937BDD7000072246AD872BD00005DEE',
  evaluation: {
    id: '39261.35329.33316.49243', physicalId: '2937BDD7000072246AD872BD00005DEE',
    type: TYPE, name: 'PES-0000010', state: 'InApproval', policy: TYPE,
    title: 'EXCEL COMPUE', reasons: ['Other', 'FeedbackChanged', 'EnvironmentChanged', 'RequirementsChanged'],
    evaluationDate: '10/22/2026 12:00:00 PM', evaluatedVersion: '0',
    reasonDetails: 'any ther', result: 'NOT OK', testSummary: '',
    benchmarkChanged: 'No', approvedOn: '', expiresOn: ''
  },
  subject: { linked: 'true', id: '39261.35329.33316.46784',
             physicalId: '2937BDD7000072246AD86A5500005BD6', type: 'IRSServiceToolMethod',
             name: '2026-005', revision: '0', title: 'EXECEL TOOL' },
  evaluator: { name: 'IPLT_USER65', firstName: 'Sharad S', lastName: 'Dhavalikar',
               fullName: 'Sharad S Dhavalikar' },
  checker: { name: 'IPLT_User29', firstName: 'Ram Kumar', lastName: 'Joga',
             fullName: 'Ram Kumar Joga' },
  approver: { name: 'IPLT_User4', firstName: 'Dr. Asokendu', lastName: 'Samanta',
              fullName: 'Dr. Asokendu Samanta' },
  routes: [{ id: '39261.35329.33316.51148', physicalId: '2937BDD7000072246AD8DE4700005F84',
             name: 'R-0000119', state: 'In Process' }],
  evidence: [{ id: '39261.35329.33316.49772', physicalId: '2937BDD7000072246AD8776B00005E7E',
               type: 'Document', name: 'DOC-0000013', revision: '0', state: 'RELEASED',
               title: 'DOC-0000013', files: ['2026-005.0.zip'] }]
};

const Req = {
  _calls: [], _body: payload,
  get: function (p) {
    Req._calls.push(p);
    return Req._body instanceof Error ? Promise.reject(Req._body) : Promise.resolve(Req._body);
  }
};
const Eval = load(path.join(base, 'js/services/EvaluationService.js'), [Req, Fields, Log]);

const shaped = Eval._shape(payload);
const t = shaped.task;
assert.strictEqual(shaped.project, null, 'an evaluation has no project');
assert.strictEqual(t.kind, 'evaluation');
assert.strictEqual(t.id, '2937BDD7000072246AD872BD00005DEE');
assert.strictEqual(t.stateLabel, 'In Approval');
assert.strictEqual(t.editable, false);
assert.deepStrictEqual(t.routes, [{ id: '2937BDD7000072246AD8DE4700005F84', name: 'R-0000119', title: '' }],
  'the route by its PHYSICAL id');
assert.deepStrictEqual(t.deliverables, [], 'the software Document is not offered (user, 2026-10-21)');
assert.deepStrictEqual(t.attachments, []);
assert.strictEqual(t.documentGroups.length, 1, 'evidence only');
assert.strictEqual(t.documentGroups[0].items.length, 1);
const ev = t.documentGroups[0].items[0];
assert.strictEqual(ev.id, '2937BDD7000072246AD8776B00005E7E', 'download by physical id');
assert.strictEqual(ev.title, '2026-005.0.zip', 'an untitled upload shows its file');
assert.strictEqual(ev.extension, '.zip');
assert.strictEqual(ev.hasFiles, true);
assert.strictEqual(ev.state, 'Released');

const many = Eval._shape(Object.assign({}, payload, { evidence: [
  { physicalId: 'A', name: 'DOC-1', title: 'Benchmark run', files: ['a.pdf', 'b.xlsx'] },
  { physicalId: 'B', name: 'DOC-2', title: '', files: [] }] }));
assert.strictEqual(many.task.evidence[0].title, 'Benchmark run');
assert.strictEqual(many.task.evidence[0].extension, '.zip', 'two files come down as one zip');
assert.strictEqual(many.task.evidence[1].hasFiles, false, 'no file -> no download');

// ---- 4. the R&D-PES form, resolved against that shape ---------------------

const PanelStub = { render: () => ({ stub: true }) };
const View = load(path.join(base, 'js/views/TaskDetailView.js'),
  [{}, { sectionsFor: () => [] }, {}, {}, PanelStub, PanelStub, Fields, Log,
   { date: v => v, badge: () => ({}), empty: () => ({}) }]);

const spec = JSON.parse(fs.readFileSync(path.join(base, 'js/data/forms/pes-evaluation.json'), 'utf8'));
assert.strictEqual(spec.form, 'R&D-PES-Rev.01');
assert.strictEqual(spec.taskType, TYPE);
const shown = spec.fields.filter(f => !f.hidden);
assert.ok(shown.every(f => !/Informed/i.test(f.label)), 'no Informed Users (user, 2026-10-21)');
['Test summary', 'Evaluated by', 'Checked by', 'In-Charge / HOD', 'Approved on',
 'Evaluation expiry date'].forEach(label => assert.ok(!spec.fields.some(f => f.label === label),
  label + ' removed after the first live look (user, 2026-10-21)'));

const values = {};
shown.forEach(f => {
  const out = View._resolve(f, t, shaped.project, null);
  assert.strictEqual(out.missing, false, f.label + ' must resolve');
  values[f.label] = out.value;
});
assert.deepStrictEqual(values, {
  'Evaluation No.': 'PES-0000010',
  'Title': 'EXCEL COMPUE',
  'Software Name': 'EXECEL TOOL',
  'Version': '0',
  'Evaluation Date': '10/22/2026 12:00:00 PM',
  'Reason for evaluation (Tick as applicable)': [
    'Changes/revisions in the applicable requirements/standards/classification rules/guidance, etc.',
    'Changes in the supporting hardware/software/operating system, etc.',
    'Changes made to incorporate user group feedback / suggestion/errors reported, etc.',
    'Any other, please specify'].join('\n'),
  'Any other, please specify': 'any ther',
  'Any change in benchmark example': 'No',
  'Test Result': 'NOT OK'
});
Object.keys(Eval._REASON_LABELS).forEach(k => assert.ok(
  fs.readFileSync(path.join(__dirname, '../../../../mxupdate/custom/datamodel/attribute/ATTRIBUTE_IRSEvaluationReasons.mxu'),
                  'utf8').indexOf('range = "' + k + '"') > 0, k + ' is a real range value'));

// the page wiring: script tag, route, noun
assert.ok(fs.readFileSync(path.join(base, 'IRSTasks.html'), 'utf8')
  .indexOf('js/services/EvaluationService.js') > 0);
const app = fs.readFileSync(path.join(base, 'js/App.js'), 'utf8');
assert.ok(app.indexOf("router.add('evaluation/:id'") > 0);
assert.ok(app.indexOf('loader: EvaluationService') > 0);

// ---- 5. the call itself ----------------------------------------------------

Eval.get('2937BDD7000072246AD872BD00005DEE').then(result => {
  assert.strictEqual(Req._calls[0], 'resources/v1/irsproject/evaluations/2937BDD7000072246AD872BD00005DEE');
  assert.strictEqual(result.note, '');
  const err = new Error('HTTP 400');
  err.body = { error: { status: 400, code: 'NOT_EVALUATION',
                        message: 'The object is a Document, not a periodic software evaluation.' } };
  Req._body = err;
  return Eval.get('X').then(() => { throw new Error('should have failed'); }, e => {
    assert.ok(/not a periodic software evaluation/.test(e.message));
  });
}).then(() => Eval.get('').then(() => { throw new Error('should have failed'); }, e => {
  assert.ok(/No evaluation id/.test(e.message));
})).then(() => {
  console.log('irstasks-pes: all assertions passed');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
