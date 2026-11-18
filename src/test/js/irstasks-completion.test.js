// Run: node src/test/js/irstasks-completion.test.js   (from external-widget/)
// R&D G10 / AR G9 project completion approvals in IRSTasks (worklog
// 2026-11-03-08): the route approves an IRSProjectCompletion Document, so its
// inbox tasks must reach the Approvals list, open the completion page, and draw
// the R&D-COM form and the Document from the JAR's payload. Nothing here
// touches the DOM or the platform.
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
const TYPE = 'IRSProjectCompletion';

// ---- 1. the registry: approvable, never listed --------------------------

assert.strictEqual(Fields.isApprovable(TYPE), true);
assert.strictEqual(Fields.isListed(TYPE), false, 'Approvals list only, like STM');
assert.strictEqual(Fields.kindOf(TYPE), 'completion');
assert.strictEqual(Fields.kindOf('IRSTechnicalPublication'), 'publication', 'G12 unchanged');
assert.strictEqual(Fields.kindOf('IRSServiceToolMethod'), 'document', 'STM unchanged');
assert.strictEqual(Fields.fieldSet(TYPE), 'project-completion');
assert.strictEqual(Fields.typeLabel(TYPE), 'PROJECT COMPLETION');
assert.strictEqual(Fields.typeBadge(TYPE), 'irs-type irs-type-com');
assert.ok(fs.readFileSync(path.join(base, 'css/IRSTasks.css'), 'utf8').indexOf('.irs-type-com') > 0,
  'the badge has its colour');

// ---- 2. the inbox list keeps the completion steps -------------------------

const InboxRequest = { get: () => Promise.resolve({ data: [] }) };
const Inbox = load(path.join(base, 'js/services/InboxTaskService.js'), [InboxRequest, Fields, Log]);

/** An inbox task of the completion route (R-0000173 on COM-0000002). */
function step(role) {
  return {
    id: 'IT-' + role, type: 'Inbox Task',
    dataelements: { title: role, state: 'Assign', routeTaskAction: 'Approve',
                    routeTaskApprovalAction: 'None', modifyAccess: 'TRUE' },
    relateddata: {
      assignees: [],
      route: [{ id: '2937BDD7000003106AE9A212000000EC', type: 'Route', dataelements: { name: 'R-0000173' } }],
      contents: [{
        id: '2937BDD7000003106AE9A1BB000000C8', type: TYPE,
        dataelements: { name: 'COM-0000002', revision: '0', title: 'COM-0000002',
                        stateNLS: 'FROZEN', typeNLS: TYPE }
      }]
    }
  };
}

const connected = Inbox._connectedTask(step('Project Manager'));
assert.strictEqual(connected.ours, true);
assert.strictEqual(connected.kind, 'completion');
assert.strictEqual(connected.typeLabel, 'PROJECT COMPLETION', 'the raw type name sent as typeNLS is not shown');
const row = Inbox._toRow(step('In-Charge / HOD'));
assert.strictEqual(row.connectedKind, 'completion');
assert.strictEqual(row.connectedId, '2937BDD7000003106AE9A1BB000000C8');

// ---- 3. the JAR payload, shaped as the task page reads a task -------------

// what `exec program IRSCompletionDocumentContext <COM-0000002 rev 0>` printed
// on 2026-11-03
const payload = {
  documentId: '39261.35329.62453.44964',
  document: {
    id: '39261.35329.62453.44964', physicalId: '2937BDD7000003106AE9A1BB000000C8',
    type: TYPE, name: 'COM-0000002', revision: '0', state: 'RELEASED', policy: 'Document Release',
    title: 'COM-0000002', invoiceNo: 'ilmovde', invoiceDate: '11/2/2026 12:00:00 PM',
    journalNational: '5', journalInternational: '5', conferenceNational: '6', conferenceInternational: '3',
    newServiceDeveloped: 'Yes', usefulness: '1. usefull nes of the outcome \n2. ration of te genrm',
    customerFeedbackSent: 'Yes', accessExtended: 'Yes'
  },
  project: { linked: 'true', count: '1', id: '39261.35329.22965.46745',
             physicalId: '2937BDD7000022506AD4D19900000984', name: 'ANA PRJ 01',
             type: 'EPMAnalysisProject', title: '', projectNo: 'R&D-26001-HY',
             customer: 'Synthetix Chemical Logistics',
             startDate: '10/19/2026 8:00:00 AM', plannedFinishDate: '10/19/2026 5:00:00 PM',
             actualFinishDate: '10/23/2026 5:00:00 PM' },
  managers: [{ id: '39261.35329.32858.47430', name: 'IPLT_USER65', fullName: 'Sharad S Dhavalikar' }],
  routes: [{ id: '39261.35329.62453.45129', physicalId: '2937BDD7000003106AE9A212000000EC',
             name: 'R-0000173', state: 'Complete' }],
  files: ['R&D-26001-HY_COM-0000002_Project-Completion.pdf']
};

const Req = {
  _calls: [], _body: payload,
  get: function (p) {
    Req._calls.push(p);
    return Req._body instanceof Error ? Promise.reject(Req._body) : Promise.resolve(Req._body);
  }
};
const Com = load(path.join(base, 'js/services/CompletionDocumentService.js'), [Req, Fields, Log]);

const shaped = Com._shape(payload);
const t = shaped.task;
assert.strictEqual(t.kind, 'document', 'the banner says "This document"');
assert.strictEqual(t.id, '2937BDD7000003106AE9A1BB000000C8');
assert.strictEqual(t.stateLabel, 'Released');
assert.strictEqual(t.editable, false);
assert.deepStrictEqual(t.routes, [{ id: '2937BDD7000003106AE9A212000000EC', name: 'R-0000173', title: '' }],
  'the route by its PHYSICAL id');
assert.strictEqual(t.deliverables.length, 1, 'the Document itself, as for STM');
assert.strictEqual(t.deliverables[0].extension, '.pdf', 'the signed form, downloadable');
assert.strictEqual(shaped.project.id, '2937BDD7000022506AD4D19900000984',
  'the project by its physical id - ProjectContextService reads the learnings with it');
assert.strictEqual(t.attributes.invoice, 'ilmovde / 2 Nov 2026', 'one box, as the paper and the PDF');
const research = Com._shape(Object.assign({}, payload, {
  project: Object.assign({}, payload.project, { type: 'EPMResearchProject' }) }));
assert.strictEqual(research.project.attributes.category, 'Research');
const twoOwners = Com._shape(Object.assign({}, payload, {
  managers: payload.managers.concat([{ name: 'X', fullName: 'Second Owner' }]) }));
assert.strictEqual(twoOwners.project.attributes.projectManager, 'Sharad S Dhavalikar, Second Owner');
const noInvoiceDate = Com._shape(Object.assign({}, payload, {
  document: Object.assign({}, payload.document, { invoiceDate: '' }) }));
assert.strictEqual(noInvoiceDate.task.attributes.invoice, 'ilmovde', 'no dangling separator');
const loose = Com._shape(Object.assign({}, payload, { project: { linked: 'false' } }));
assert.strictEqual(loose.project, null, 'a Document under no project');

// ---- 4. the R&D-COM form, resolved against that shape ---------------------

const PanelStub = { render: () => ({ stub: true }) };
const View = load(path.join(base, 'js/views/TaskDetailView.js'),
  [{}, { sectionsFor: () => [] }, {}, {}, PanelStub, PanelStub, Fields, Log,
   { date: v => v, badge: () => ({}), empty: () => ({}) }]);

const spec = JSON.parse(fs.readFileSync(path.join(base, 'js/data/forms/project-completion.json'), 'utf8'));
assert.strictEqual(spec.form, 'R&D-COM-Rev.00');
assert.deepStrictEqual(spec.formByProfile, { AR: 'RDAREA-COM-Rev.00' });
assert.strictEqual(spec.taskType, TYPE);
const shown = spec.fields.filter(f => !f.hidden);
const values = {};
shown.forEach(f => {
  const out = View._resolve(f, t, shaped.project, null);
  assert.strictEqual(out.missing, false, f.label + ' must resolve');
  values[f.label] = View._format({ display: out.display, value: out.value });
});
assert.deepStrictEqual(Object.keys(values), [
  'Project No.', 'Rev. No.', 'Project Name', 'Project Category', 'Project Manager', 'Customer Name',
  'Invoice No. & Date', 'Project Start Date', 'Planned Completion Date', 'Actual Completion Date',
  'No. of papers - Journal, National', 'No. of papers - Journal, International',
  'No. of papers - Conference, National', 'No. of papers - Conference, International',
  'New Service / New Computational Tool / New Methods : Developed', 'Key learning features',
  'Usefulness of the outcome', 'Customer Feedback: Sent',
  'Project access shall be extended for six months'],
  "the paper's rows, in the paper's order");
assert.strictEqual(values['Project No.'], 'R&D-26001-HY');
assert.strictEqual(values['Rev. No.'], '0');
assert.strictEqual(values['Project Name'], 'ANA PRJ 01');
assert.strictEqual(values['Project Category'], 'Analysis');
assert.strictEqual(values['Project Manager'], 'Sharad S Dhavalikar');
assert.strictEqual(values['Customer Name'], 'Synthetix Chemical Logistics');
assert.strictEqual(values['Project Start Date'], '19 Oct 2026');
assert.strictEqual(values['Actual Completion Date'], '23 Oct 2026');
assert.strictEqual(values['No. of papers - Conference, National'], '6');
assert.strictEqual(values['New Service / New Computational Tool / New Methods : Developed'], 'Yes');
assert.strictEqual(values['Project access shall be extended for six months'], 'Yes');
assert.deepStrictEqual(spec.fields.filter(f => f.display === 'approval').map(f => f.label),
  ['Project Manager', 'In-Charge/HOD', 'Divisional Head'], 'the three route levels, hidden');

// the key learnings come from the project context, the created-here group only
const Context = load(path.join(base, 'js/services/ProjectContextService.js'),
  [{ get: () => Promise.resolve({}) }, Log]);
const sections = Context.sectionsFor(spec);
assert.ok(sections.indexOf('learnings.created') >= 0, 'the project\'s own learnings are read');
assert.ok(sections.indexOf('learnings.reused') < 0, 'not the ones cited from elsewhere');
assert.ok(sections.indexOf('department') >= 0, 'the department, for the RDAREA form code');

// the type's attributes the form reads really exist on the type CI
const typeCi = fs.readFileSync(path.join(__dirname,
  '../../../../mxupdate/custom/datamodel/type/TYPE_IRSProjectCompletion.mxu'), 'utf8');
['IRSCompletionInvoiceNo', 'IRSCompletionInvoiceDate', 'IRSCompletionJournalNational',
 'IRSCompletionJournalInternational', 'IRSCompletionConferenceNational',
 'IRSCompletionConferenceInternational', 'IRSCompletionNewServiceDeveloped',
 'IRSCompletionUsefulness', 'IRSCompletionCustomerFeedbackSent', 'IRSCompletionAccessExtended'].forEach(a =>
  assert.ok(typeCi.indexOf('attribute "' + a + '"') > 0, a + ' is on the type'));

// the page wiring: script tag, route, loader
assert.ok(fs.readFileSync(path.join(base, 'IRSTasks.html'), 'utf8')
  .indexOf('js/services/CompletionDocumentService.js') > 0);
const app = fs.readFileSync(path.join(base, 'js/App.js'), 'utf8');
assert.ok(app.indexOf("router.add('completion/:id'") > 0);
assert.ok(app.indexOf('loader: CompletionDocumentService') > 0);
assert.ok(app.indexOf("row.kind === 'completion' ? 'completion/:id'") > 0);

// ---- 5. the call itself ----------------------------------------------------

Com.get('2937BDD7000003106AE9A1BB000000C8').then(result => {
  assert.strictEqual(Req._calls[0], 'resources/v1/irsproject/completions/2937BDD7000003106AE9A1BB000000C8');
  assert.strictEqual(result.note, '');
  const err = new Error('HTTP 400');
  err.body = { error: { status: 400, code: 'NOT_COMPLETION',
                        message: 'The object is a IRSServiceToolMethod, not a Project Completion Document.' } };
  Req._body = err;
  return Com.get('X').then(() => { throw new Error('should have failed'); }, e => {
    assert.ok(/not a Project Completion/.test(e.message));
  });
}).then(() => Com.get('').then(() => { throw new Error('should have failed'); }, e => {
  assert.ok(/No document id/.test(e.message));
})).then(() => {
  console.log('irstasks-completion: all assertions passed');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
