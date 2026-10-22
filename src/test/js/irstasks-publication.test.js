// Run: node src/test/js/irstasks-publication.test.js   (from external-widget/)
// G12 technical publication approvals in IRSTasks (worklog 2026-10-22-12): the
// G12 route approves an IRSTechnicalPublication Document, so its inbox tasks
// must reach the Approvals list, open the publication page, and draw the
// R&D-PRJ-03 form and the Document from the JAR's payload. Nothing here
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
const TYPE = 'IRSTechnicalPublication';

// ---- 1. the registry: approvable, never listed --------------------------

assert.strictEqual(Fields.isApprovable(TYPE), true);
assert.strictEqual(Fields.isListed(TYPE), false, 'Approvals list only, like STM');
assert.strictEqual(Fields.kindOf(TYPE), 'publication');
assert.strictEqual(Fields.kindOf('IRSServiceToolMethod'), 'document', 'STM unchanged');
assert.strictEqual(Fields.kindOf('IRSPeriodicSoftwareEvaluation'), 'evaluation', 'G17 unchanged');
assert.strictEqual(Fields.fieldSet(TYPE), 'technical-publication');
assert.strictEqual(Fields.typeLabel(TYPE), 'TECHNICAL PUBLICATION / PRESENTATION');
assert.strictEqual(Fields.typeBadge(TYPE), 'irs-type irs-type-pub');
assert.ok(fs.readFileSync(path.join(base, 'css/IRSTasks.css'), 'utf8').indexOf('.irs-type-pub') > 0,
  'the badge has its colour');

// ---- 2. the inbox list keeps the G12 steps --------------------------------

const InboxRequest = { get: () => Promise.resolve({ data: [] }) };
const Inbox = load(path.join(base, 'js/services/InboxTaskService.js'), [InboxRequest, Fields, Log]);

/** An inbox task of the G12 route (worklog 2026-10-22-11: R-0000126 / R-0000128). */
function step(role) {
  return {
    id: 'IT-' + role, type: 'Inbox Task',
    dataelements: { title: role, state: 'Assign', routeTaskAction: 'Approve',
                    routeTaskApprovalAction: 'None', modifyAccess: 'TRUE' },
    relateddata: {
      assignees: [],
      route: [{ id: '2937BDD7000030EC6ADA37C9000002EE', type: 'Route', dataelements: { name: 'R-0000128' } }],
      contents: [{
        id: '2937BDD7000030EC6ADA374C000002A2', type: TYPE,
        dataelements: { name: 'DOC-0002', revision: '0',
                        title: 'techinixal publication for data-2685900293',
                        stateNLS: 'FROZEN', typeNLS: TYPE }
      }]
    }
  };
}

const connected = Inbox._connectedTask(step('Researcher'));
assert.strictEqual(connected.ours, true);
assert.strictEqual(connected.kind, 'publication');
assert.strictEqual(connected.typeLabel, 'TECHNICAL PUBLICATION / PRESENTATION',
  'the raw type name sent as typeNLS is not shown');
const row = Inbox._toRow(step('HOD'));
assert.strictEqual(row.connectedKind, 'publication');
assert.strictEqual(row.connectedId, '2937BDD7000030EC6ADA374C000002A2');

// ---- 3. the JAR payload, shaped as the task page reads a task -------------

// what `exec program IRSPublicationDocumentContext <DOC-0002>` printed on
// 2026-10-22 (authors trimmed to two)
const payload = {
  documentId: '2937BDD7000030EC6ADA374C000002A2',
  document: {
    id: '39261.35329.57219.31704', physicalId: '2937BDD7000030EC6ADA374C000002A2',
    type: TYPE, name: 'DOC-0002', revision: '0', state: 'FROZEN', policy: 'Document Release',
    title: 'techinixal publication for data-2685900293',
    publicationName: 'jurnal and confrence', reach: 'International', medium: 'Conference',
    venue: 'hall in venie win japan', duration: '3 hours', submitCopyToLibrary: 'FALSE'
  },
  project: { linked: 'true', count: '1', id: '39261.35329.22965.46745',
             physicalId: '2937BDD7000022506AD4D19900000984', name: 'ANA PRJ 01',
             type: 'EPMAnalysisProject', title: '', projectNo: 'R&D-26001-HY' },
  authors: [
    { id: '39261.35329.32858.54859', name: 'IPLT_User24', firstName: 'Amresh', lastName: 'Negi',
      fullName: 'Amresh Negi' },
    { id: '39261.35329.32858.47461', name: 'TIVOLT_User6', firstName: 'Sachin S', lastName: 'Awasare',
      fullName: 'Sachin S Awasare' }
  ],
  routes: [{ id: '39261.35329.57219.31999', physicalId: '2937BDD7000030EC6ADA37C9000002EE',
             name: 'R-0000128', state: 'In Process' }],
  files: []
};

const Req = {
  _calls: [], _body: payload,
  get: function (p) {
    Req._calls.push(p);
    return Req._body instanceof Error ? Promise.reject(Req._body) : Promise.resolve(Req._body);
  }
};
const Pub = load(path.join(base, 'js/services/PublicationDocumentService.js'), [Req, Fields, Log]);

const shaped = Pub._shape(payload);
const t = shaped.task;
assert.strictEqual(t.kind, 'document', 'the banner says "This document"');
assert.strictEqual(t.id, '2937BDD7000030EC6ADA374C000002A2');
assert.strictEqual(t.stateLabel, 'Frozen');
assert.strictEqual(t.editable, false);
assert.deepStrictEqual(t.routes, [{ id: '2937BDD7000030EC6ADA37C9000002EE', name: 'R-0000128', title: '' }],
  'the route by its PHYSICAL id');
assert.strictEqual(t.deliverables.length, 1, 'the Document itself, as for STM');
assert.strictEqual(t.deliverables[0].hasFiles, false, 'DOC-0002 has no file yet -> no download');
assert.strictEqual(shaped.project.projectNo, 'R&D-26001-HY');

const withFile = Pub._shape(Object.assign({}, payload, { files: ['paper.pdf'] }));
assert.strictEqual(withFile.task.deliverables[0].extension, '.pdf');
const withFiles = Pub._shape(Object.assign({}, payload, { files: ['paper.pdf', 'slides.pptx'] }));
assert.strictEqual(withFiles.task.deliverables[0].extension, '.zip', 'two files come down as one zip');
const journal = Pub._shape(Object.assign({}, payload, {
  document: Object.assign({}, payload.document, { reach: 'National', medium: 'Journal', venue: '' }) }));
assert.strictEqual(journal.task.attributes.publicationType, 'National; Journal');
const loose = Pub._shape(Object.assign({}, payload, { project: { linked: 'false' } }));
assert.strictEqual(loose.project, null, 'a Document under no project');

// ---- 4. the R&D-PRJ-03 form, resolved against that shape ------------------

const PanelStub = { render: () => ({ stub: true }) };
const View = load(path.join(base, 'js/views/TaskDetailView.js'),
  [{}, { sectionsFor: () => [] }, {}, {}, PanelStub, PanelStub, Fields, Log,
   { date: v => v, badge: () => ({}), empty: () => ({}) }]);

const spec = JSON.parse(fs.readFileSync(path.join(base, 'js/data/forms/technical-publication.json'), 'utf8'));
assert.strictEqual(spec.form, 'R&D-PRJ-03-Rev.01');
assert.strictEqual(spec.taskType, TYPE);
const shown = spec.fields.filter(f => !f.hidden);
const values = {};
shown.forEach(f => {
  const out = View._resolve(f, t, shaped.project, null);
  assert.strictEqual(out.missing, false, f.label + ' must resolve');
  values[f.label] = out.value;
});
assert.deepStrictEqual(Object.keys(values), [
  'Project No.', 'Project Name', 'Paper Title', 'Author(s)', 'Name of the Journal / Conference',
  'Type of Publication', 'Conference Venue', 'Duration', 'Submit a Copy to Library'],
  "the paper's rows, in the paper's order");
assert.strictEqual(values['Project No.'], 'R&D-26001-HY');
assert.strictEqual(values['Project Name'], 'ANA PRJ 01');
assert.strictEqual(values['Paper Title'], 'techinixal publication for data-2685900293');
assert.strictEqual(values['Name of the Journal / Conference'], 'jurnal and confrence');
assert.strictEqual(values['Type of Publication'], 'International; Conference');
assert.strictEqual(values['Conference Venue'], 'hall in venie win japan');
assert.strictEqual(values['Duration'], '3 hours');
assert.strictEqual(View._format({ display: 'yesno', value: values['Submit a Copy to Library'] }), 'No');
assert.ok(String(values['Author(s)']).indexOf('Amresh Negi') >= 0 &&
          String(values['Author(s)']).indexOf('Sachin S Awasare') >= 0, 'every author');
assert.deepStrictEqual(spec.fields.filter(f => f.display === 'approval').map(f => f.label),
  ['Researcher', 'In-Charge / HOD', 'DH'], 'the three route levels, hidden');

// the type's attributes the form reads really exist on the type CI
const typeCi = fs.readFileSync(path.join(__dirname,
  '../../../../mxupdate/custom/datamodel/type/TYPE_IRSTechnicalPublication.mxu'), 'utf8');
['IRSPublicationName', 'IRSPublicationReach', 'IRSPublicationMedium', 'IRSPublicationVenue',
 'IRSPublicationDuration', 'IRSPublicationSubmitCopyToLibrary'].forEach(a =>
  assert.ok(typeCi.indexOf('attribute "' + a + '"') > 0, a + ' is on the type'));

// the page wiring: script tag, route, loader
assert.ok(fs.readFileSync(path.join(base, 'IRSTasks.html'), 'utf8')
  .indexOf('js/services/PublicationDocumentService.js') > 0);
const app = fs.readFileSync(path.join(base, 'js/App.js'), 'utf8');
assert.ok(app.indexOf("router.add('publication/:id'") > 0);
assert.ok(app.indexOf('loader: PublicationDocumentService') > 0);
assert.ok(app.indexOf("row.kind === 'publication' ? 'publication/:id'") > 0);

// ---- 5. the call itself ----------------------------------------------------

Pub.get('2937BDD7000030EC6ADA374C000002A2').then(result => {
  assert.strictEqual(Req._calls[0], 'resources/v1/irsproject/publications/2937BDD7000030EC6ADA374C000002A2');
  assert.strictEqual(result.note, '');
  const err = new Error('HTTP 400');
  err.body = { error: { status: 400, code: 'NOT_PUBLICATION',
                        message: 'The object is a IRSServiceToolMethod, not a Technical Publication / Presentation Document.' } };
  Req._body = err;
  return Pub.get('X').then(() => { throw new Error('should have failed'); }, e => {
    assert.ok(/not a Technical Publication/.test(e.message));
  });
}).then(() => Pub.get('').then(() => { throw new Error('should have failed'); }, e => {
  assert.ok(/No document id/.test(e.message));
})).then(() => {
  console.log('irstasks-publication: all assertions passed');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
