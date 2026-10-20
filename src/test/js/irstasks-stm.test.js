// Run: node src/test/js/irstasks-stm.test.js   (from external-widget/)
// STM Document approvals in IRSTasks (worklog 2026-10-19-14): the G11 route
// approves an IRSServiceToolMethod DOCUMENT, so its inbox tasks must reach the
// Approvals list, open the document page, and draw the R&D-STM form from the
// JAR's payload. Nothing here touches the DOM or the platform.
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

// ---- 1. the registry: approvable, never listed --------------------------

assert.strictEqual(Fields.isApprovable('IRSServiceToolMethod'), true);
assert.strictEqual(Fields.isListed('IRSServiceToolMethod'), false,
  'STM Documents appear only in the Approvals list, never in the task grid (user, 2026-10-19)');
assert.strictEqual(Fields.isApprovable('EPMPROJECT_PROPOSAL'), true, 'the four task subtypes still are');
assert.strictEqual(Fields.isApprovable('Document'), false, 'a plain Document is not ours');
assert.strictEqual(Fields.kindOf('IRSServiceToolMethod'), 'document');
assert.strictEqual(Fields.kindOf('EPMPROJECT_REVIEW'), 'task');
assert.strictEqual(Fields.fieldSet('IRSServiceToolMethod'), 'stm-archive');
assert.strictEqual(Fields.typeBadge('IRSServiceToolMethod'), 'irs-type irs-type-stm');
assert.ok(fs.readFileSync(path.join(base, 'css/IRSTasks.css'), 'utf8').indexOf('.irs-type-stm') > 0,
  'the badge has its colour');
assert.deepStrictEqual(Object.keys(Fields.TASK_TYPES).length, 4, 'the task allow-list is unchanged');

// ---- 2. the inbox list keeps the STM steps --------------------------------

const InboxRequest = {
  _body: { data: [] },
  get: function () { return Promise.resolve(InboxRequest._body); }
};
const Inbox = load(path.join(base, 'js/services/InboxTaskService.js'), [InboxRequest, Fields, Log]);

/** An inbox task as measured on route R-0000105, 2026-10-19 (step 0). */
function stmStep(role, state) {
  return {
    id: 'IT-' + role, type: 'Inbox Task',
    dataelements: { title: role, state: state || 'Assign', routeTaskAction: 'Approve',
                    routeTaskApprovalAction: 'None', modifyAccess: 'TRUE',
                    routeTaskDueDate: '2026-10-20T16:00:00.000Z' },
    relateddata: {
      assignees: [],
      route: [{ id: '2937BDD700004DA06AD654AE00000350', type: 'Route',
                dataelements: { name: 'R-0000105' } }],
      contents: [{
        id: '2937BDD700004DA06AD64E3E00000294', type: 'IRSServiceToolMethod',
        // the platform sends the RAW name as typeNLS - no NLS is defined
        dataelements: { name: '2026-002', revision: '0', title: 'FORTAN COMPUTE',
                        stateNLS: 'Frozen', typeNLS: 'IRSServiceToolMethod', hasfiles: 'TRUE' }
      }]
    }
  };
}

const connected = Inbox._connectedTask(stmStep('Project Manager'));
assert.strictEqual(connected.ours, true);
assert.strictEqual(connected.kind, 'document');
assert.strictEqual(connected.typeLabel, Fields.typeLabel('IRSServiceToolMethod'),
  'a typeNLS equal to the raw name is not a display name - ours is shown');
assert.notStrictEqual(connected.typeLabel, 'IRSServiceToolMethod');

const row = Inbox._toRow(stmStep('In-Charge / HOD'));
assert.strictEqual(row.connectedKind, 'document');
assert.strictEqual(row.connectedId, '2937BDD700004DA06AD64E3E00000294');
assert.strictEqual(row.routeId, '2937BDD700004DA06AD654AE00000350');

// a real NLS name still wins on a task subtype
const proposal = stmStep('Project Manager');
proposal.relateddata.contents[0].type = 'EPMPROJECT_PROPOSAL';
proposal.relateddata.contents[0].dataelements.typeNLS = 'PROJECT PROPOSAL / PROFILE (DMC)';
assert.strictEqual(Inbox._connectedTask(proposal).typeLabel, 'PROJECT PROPOSAL / PROFILE (DMC)');
assert.strictEqual(Inbox._connectedTask(proposal).kind, 'task');

// ---- 3. the JAR payload, shaped as the task page reads a task -------------

// what `exec program IRSStmDocumentContext 2026-002` printed on 2026-10-19
const payload = {
  documentId: '2937BDD700004DA06AD64E3E00000294',
  document: { id: '39261.35329.34140.45436', physicalId: '2937BDD700004DA06AD64E3E00000294',
              type: 'IRSServiceToolMethod', name: '2026-002', revision: '0', state: 'FROZEN',
              policy: 'Document Release', title: 'FORTAN COMPUTE',
              purposeAndApplication: 'Line one\nLine two', sourceCode: 'Yes', installation: 'No' },
  project: { linked: 'true', count: '1', id: '39261.35329.22965.46745',
             physicalId: '2937BDD7000022506AD4D19900000984', name: 'ANA PRJ 01',
             type: 'EPMAnalysisProject', title: '', projectNo: 'R&D-26001-HY' },
  researchers: [
    { id: 'P1', name: 'IPLT_User12', firstName: 'Rakesh Kumar', lastName: 'Sah', fullName: 'Rakesh Kumar Sah' },
    { id: 'P2', name: 'IPLT_User17', firstName: 'Kale Teni', lastName: 'Vijaya', fullName: 'Kale Teni Vijaya' }
  ],
  routes: [{ id: '39261.35329.34140.46366', physicalId: '2937BDD700004DA06AD654AE00000350',
             name: 'R-0000105', state: 'In Process' }],
  files: ['DOC-85756263-0000022.0 (2).zip', 'pnoexport.txt', 'FRAME_BODY_COMP (1).pdf',
          'R&D-26001-HY_2026-002_STM-Archive.pdf']
};

const StmRequest = {
  _calls: [],
  _body: payload,
  get: function (p) {
    StmRequest._calls.push(p);
    return StmRequest._body instanceof Error ? Promise.reject(StmRequest._body)
                                             : Promise.resolve(StmRequest._body);
  }
};
const Stm = load(path.join(base, 'js/services/StmDocumentService.js'), [StmRequest, Fields, Log]);

const shaped = Stm._shape(payload);
const t = shaped.task;
assert.strictEqual(t.kind, 'document');
assert.strictEqual(t.id, '2937BDD700004DA06AD64E3E00000294', 'the physical id, as REST uses');
assert.strictEqual(t.stateLabel, 'Frozen');
assert.strictEqual(t.editable, false, 'an approver does not edit the Document here');
assert.deepStrictEqual(t.routes, [{ id: '2937BDD700004DA06AD654AE00000350', name: 'R-0000105', title: '' }],
  'the route by its PHYSICAL id - dsrt/routes answers to that');
assert.deepStrictEqual(t.researchers, ['Rakesh Kumar Sah', 'Kale Teni Vijaya']);
assert.strictEqual(t.attributes.stmNumber, '2026-002  Rev 0', 'the PDF\'s own spelling');
assert.strictEqual(t.deliverables.length, 1, 'the Document itself is the one row');
assert.strictEqual(t.deliverables[0].hasFiles, true);
assert.strictEqual(t.deliverables[0].extension, '.zip', 'four files come down as one zip');
assert.ok(/4 files/.test(t.deliverables[0].state));
assert.deepStrictEqual(t.attachments, []);
assert.strictEqual(shaped.project.attributes.EPMProjectNo, 'R&D-26001-HY');
assert.strictEqual(shaped.project.id, '2937BDD7000022506AD4D19900000984');

const single = Stm._shape(Object.assign({}, payload, { files: ['a.pdf'] }));
assert.strictEqual(single.task.deliverables[0].extension, '.pdf');
const none = Stm._shape(Object.assign({}, payload, { files: [] }));
assert.strictEqual(none.task.deliverables[0].hasFiles, false, 'no file -> no download offered');

const orphan = Stm._shape(Object.assign({}, payload, { project: { linked: 'false' } }));
assert.strictEqual(orphan.project, null);
assert.strictEqual(orphan.task.projectId, '');

// ---- 4. the R&D-STM form, resolved against that shape ---------------------

const PanelStub = { render: () => ({ stub: true }) };
const View = load(path.join(base, 'js/views/TaskDetailView.js'),
  [{}, { sectionsFor: () => [] }, {}, {}, PanelStub, PanelStub, Fields, Log,
   { date: v => v, badge: () => ({}), empty: () => ({}) }]);

const spec = JSON.parse(fs.readFileSync(path.join(base, 'js/data/forms/stm-archive.json'), 'utf8'));
assert.strictEqual(spec.form, 'R&D-STM Rev.00');
assert.strictEqual(spec.title,
  'Form for the Archiving New Service / New Computational Tool / New Method in R&D Division');

const shown = spec.fields.filter(f => !f.hidden);
const labels = shown.map(f => f.label);
assert.deepStrictEqual(labels, [
  'Project Number', 'STM Number', 'Project Name', 'Service / Tool / Method Name',
  'Involved Researcher(s)', 'Purpose and Application of Service / Tool / Method',
  'Provided: 1) Source Code', 'Provided: 2) Installation'
], 'the paper form\'s labels, in its order');
assert.ok(spec.fields.every(f => !/Category/i.test(f.label)), 'Category is not shown (user, 2026-10-19)');
assert.strictEqual(spec.fields.find(f => f.label === 'Date').hidden, true, 'Date is not shown (user, 2026-10-19)');

const values = {};
shown.forEach(f => {
  const out = View._resolve(f, t, shaped.project, null);
  assert.strictEqual(out.missing, false, f.label + ' must resolve');
  values[f.label] = out.value;
});
assert.deepStrictEqual(values, {
  'Project Number': 'R&D-26001-HY',
  'STM Number': '2026-002  Rev 0',
  'Project Name': 'ANA PRJ 01',
  'Service / Tool / Method Name': 'FORTAN COMPUTE',
  'Involved Researcher(s)': 'Rakesh Kumar Sah, Kale Teni Vijaya',
  'Purpose and Application of Service / Tool / Method': 'Line one\nLine two',
  'Provided: 1) Source Code': 'Yes',
  'Provided: 2) Installation': 'No'
});

// the script tag is in the page, or the module never loads in the dashboard
assert.ok(fs.readFileSync(path.join(base, 'IRSTasks.html'), 'utf8')
  .indexOf('js/services/StmDocumentService.js') > 0);

// ---- 5. the call itself ----------------------------------------------------

Stm.get('2937BDD700004DA06AD64E3E00000294').then(result => {
  assert.strictEqual(StmRequest._calls[0],
    'resources/v1/irsproject/documents/2937BDD700004DA06AD64E3E00000294/stm');
  assert.strictEqual(result.note, '');
  // the JAR's own error shape reaches the page as its message
  const err = new Error('HTTP 400');
  err.body = { error: { status: 400, code: 'NOT_STM_DOCUMENT',
                        message: 'The object is a EPMAnalysisProject, not a Service / Tool / Method Document.' } };
  StmRequest._body = err;
  return Stm.get('X').then(() => { throw new Error('should have failed'); }, e => {
    assert.ok(/not a Service \/ Tool \/ Method Document/.test(e.message));
  });
}).then(() => Stm.get('').then(() => { throw new Error('should have failed'); }, e => {
  assert.ok(/No document id/.test(e.message));
})).then(() => {
  console.log('irstasks-stm: all assertions passed');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
