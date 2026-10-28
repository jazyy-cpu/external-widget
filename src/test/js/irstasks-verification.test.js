// Run: node src/test/js/irstasks-verification.test.js   (from external-widget/)
//
// G9 VERIFICATION REPORT: the form definition, the approver's validation and
// save (ApproverFormService), and the decision bar that puts them in front of
// the Division Head (TaskApprovalPanel). The bar is driven through a stub DOM,
// because its one rule that matters - a failed save never sends the decision -
// is about the ORDER of two calls, and only the real bar can show it.
//
// Platform wording used below is the live wording, measured as IPLT_User4 on
// 2026-10-24 (worklog 2026-10-24-07).
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

// ---- a stub DOM: just enough for the bar ---------------------------------

function node(tag) {
  return {
    tagName: tag.toUpperCase(), className: '', children: [], parentNode: null,
    _text: '', style: {}, listeners: {}, disabled: false, checked: false,
    value: '', rows: 0, type: '', name: '', id: '', placeholder: '', title: '',
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); },
    set textContent(v) {
      this.children.forEach(c => { c.parentNode = null; });
      this.children = [];
      this._text = v === undefined || v === null ? '' : String(v);
    },
    appendChild(c) {
      if (c.parentNode) { c.parentNode.removeChild(c); }
      c.parentNode = this; this.children.push(c); return c;
    },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) { this.children.splice(i, 1); }
      c.parentNode = null; return c;
    },
    setAttribute(k, v) { this['_attr_' + k] = v; },
    addEventListener(k, f) { (this.listeners[k] = this.listeners[k] || []).push(f); },
    fire(k) { (this.listeners[k] || []).forEach(f => f({ target: this })); },
    get classList() {
      const self = this;
      const list = () => self.className.split(/\s+/).filter(Boolean);
      return {
        add(c) { if (!list().includes(c)) { self.className = list().concat(c).join(' '); } },
        remove(c) { self.className = list().filter(x => x !== c).join(' '); },
        contains(c) { return list().includes(c); }
      };
    },
    querySelector(sel) {
      const cls = sel.replace(/^\./, '');
      return all(this, n => n.className.split(/\s+/).includes(cls))[0] || null;
    }
  };
}
function all(root, pred) {
  const out = [];
  (function walk(n) { n.children.forEach(c => { if (pred(c)) { out.push(c); } walk(c); }); })(root);
  return out;
}
const button = (root, text) => all(root, n => n.tagName === 'BUTTON' && n.textContent === text)[0];
const radios = (root) => all(root, n => n.tagName === 'INPUT' && n.type === 'radio');
const areas = (root) => all(root, n => n.tagName === 'TEXTAREA');
const flush = async () => { for (let i = 0; i < 10; i++) { await new Promise(r => setImmediate(r)); } };

global.document = { createElement: node };

// ---- the modules -----------------------------------------------------------

const Log = { on: false, info: () => {}, warn: () => {}, table: () => {} };
const Fields = load(path.join(base, 'js/config/TaskFields.js'), []);

// the fake transport: records every call; `next` decides the answer
const Request = {
  calls: [],
  next: null,
  send(p, opts) {
    Request.calls.push({ path: p, opts: opts });
    return Request.next ? Request.next(p, opts) : Promise.resolve({ success: true });
  }
};
const Form = load(path.join(base, 'js/services/ApproverFormService.js'), [Request, Log]);
const FormFields = load(path.join(base, 'js/views/ApproverFormFields.js'), [Form]);

// the decision write, faked and ordered against the save
const order = [];
const Approval = {
  decided: [],
  decide(id, decision, comment) {
    order.push('decide');
    Approval.decided.push({ id, decision, comment });
    return Promise.resolve({});
  }
};
const origSend = Request.send;
Request.send = function (p, opts) { order.push('save'); return origSend.call(Request, p, opts); };

const Panel = load(path.join(base, 'js/views/TaskApprovalPanel.js'),
  [{}, { get: () => Promise.resolve(null) }, Approval, {}, Form, FormFields, Log]);

const spec = JSON.parse(fs.readFileSync(
  path.join(base, 'js/data/forms/verification-report.json'), 'utf8'));

// ---- 1. the form definition --------------------------------------------------

assert.strictEqual(spec.taskType, 'EPMPROJECT_VERIFICATION');
assert.strictEqual(spec.form, 'R&D-VER-Rev.00');
assert.strictEqual(Fields.fieldSet('EPMPROJECT_VERIFICATION'), 'verification-report');
assert.ok(Fields.isListed('EPMPROJECT_VERIFICATION'), 'listed on the landing grid');
assert.ok(Fields.isApprovable('EPMPROJECT_VERIFICATION'), 'listed in Approvals');
assert.strictEqual(Fields.typeLabel('EPMPROJECT_VERIFICATION'), 'VERIFICATION REPORT');

const inputs = Form.inputsOf(spec);
// the ORIGINAL PDF order - invoices are item 9, not last (worklog 2026-10-24-02)
assert.deepStrictEqual(inputs.map(f => f.field), [
  'EPMWorkScopeCompleted', 'EPMAllReviewsPerformed', 'EPMStageValidationDone',
  'EPMTechnicalReportPrepared', 'EPMDataStoredInDrive', 'EPMKeyLearningsRecorded',
  'EPMProjectOutcomeDetailed', 'EPMClientCommunicated', 'EPMInvoiceIssued',
  'EPMLegalRequirementApplicable', 'EPMLegalRequirementDetails',
  'EPMCPDEnteredInORS', 'EPMAnyOtherDetails', 'EPMVerificationRemarks']);
const choices = inputs.filter(f => f.input.type === 'choice');
assert.strictEqual(choices.length, 11, '11 Yes/No questions');
assert.ok(choices.every(f => f.input.required === true), 'every question must be answered');
// each `values` is the attribute range minus the blank (MQL, worklog 2026-10-24-02)
assert.deepStrictEqual(
  choices.find(f => f.field === 'EPMInvoiceIssued').input.values, ['Yes', 'No', 'NA']);
assert.ok(choices.filter(f => f.field !== 'EPMInvoiceIssued')
  .every(f => f.input.values.join() === 'Yes,No'));
// the header rows are read, never filled
assert.ok(spec.fields.filter(f => f.source === 'project').every(f => !f.input));

// ---- 2. validation ---------------------------------------------------------

const empty = {};
inputs.forEach(f => { empty[f.field] = ''; });
assert.strictEqual(Form.validate(inputs, empty).length, 11, 'only the 11 questions are required');

const complete = Object.assign({}, empty);
choices.forEach(f => { complete[f.field] = 'No'; });
assert.deepStrictEqual(Form.validate(inputs, complete), []);

// legal details become required exactly when legal applicability is Yes
const legal = Object.assign({}, complete, { EPMLegalRequirementApplicable: 'Yes' });
assert.deepStrictEqual(Form.validate(inputs, legal).map(p => p.field),
  ['EPMLegalRequirementDetails']);
assert.deepStrictEqual(Form.validate(inputs,
  Object.assign({}, legal, { EPMLegalRequirementDetails: 'IMO rule' })), []);
assert.deepStrictEqual(Form.validate(inputs,
  Object.assign({}, legal, { EPMLegalRequirementDetails: '   ' })).map(p => p.field),
  ['EPMLegalRequirementDetails'], 'blanks are not an answer');

// a value outside the range is named here, before the server refuses it
assert.strictEqual(Form.validate(inputs,
  Object.assign({}, complete, { EPMWorkScopeCompleted: 'Maybe' }))[0].message,
  'not one of Yes / No');
assert.deepStrictEqual(Form.validate(inputs,
  Object.assign({}, complete, { EPMInvoiceIssued: 'NA' })), [], 'NA only for invoices');

// ---- 3. the platform's words, classified -----------------------------------

assert.strictEqual(Form.classify(new Error('Error: No modify access on the specified object.')),
  'NOT_ASSIGNEE');
const transportOnly = new Error('NetworkError: URL "x" return ResponseCode with value "400"');
transportOnly.body = { success: false, statusCode: 400,
  message: 'Error: No modify access on the specified object.' };
assert.strictEqual(Form.classify(transportOnly), 'NOT_ASSIGNEE',
  'the reason may arrive only in the body');
assert.strictEqual(Form.classify(new Error('Error: Invalid attribute range specified.')),
  'BAD_VALUE');
assert.strictEqual(Form.classify(new Error('timeout')), '');
assert.strictEqual(Form.canWrite({ modifyAccess: 'TRUE' }), true);
assert.strictEqual(Form.canWrite({ modifyAccess: 'FALSE' }), false);
assert.strictEqual(Form.canWrite({}), false, 'unknown is no');
assert.deepStrictEqual(Form.currentValues(inputs.slice(0, 2), { EPMWorkScopeCompleted: 'Yes' }),
  { EPMWorkScopeCompleted: 'Yes', EPMAllReviewsPerformed: '' }, 'absent reads as unanswered');

// ---- 4. the decision bar ---------------------------------------------------

const route = { started: true };
const step = { id: 'IT-INBOX', role: 'Division Head' };
function task(modify, extra) {
  return { id: 'TASK-PHYS', attributes: Object.assign({ modifyAccess: modify }, empty, extra || {}) };
}
function answerAll(bar, value) {
  const byName = {};
  radios(bar).forEach(r => { (byName[r.name] = byName[r.name] || []).push(r); });
  Object.keys(byName).forEach(n => {
    const pick = byName[n].find(r => r.value === value) || byName[n][0];
    byName[n].forEach(r => { r.checked = r === pick; });
    pick.fire('change');
  });
}

(async function () {
  // 4a. NOT an assignee: no inputs, no Approve, a reason, Reject still open
  {
    const bar = Panel._decisionBar(route, step, () => {}, { task: task('FALSE'), spec: spec });
    assert.ok(bar.textContent.indexOf(Form.NOT_ASSIGNEE_TEXT) >= 0, 'the reason is shown');
    assert.strictEqual(radios(bar).length, 0, 'no inputs');
    assert.strictEqual(button(bar, 'Approve').disabled, true, 'Approve withheld');
    assert.strictEqual(button(bar, 'Save draft'), undefined, 'nothing to save');
    const comment = areas(bar)[0];
    comment.value = 'Please add me as an assignee and send the route again.';
    comment.fire('input');
    assert.strictEqual(button(bar, 'Reject').disabled, false, 'Reject open with a comment');
    button(bar, 'Reject').fire('click');
    button(bar, 'Confirm reject').fire('click');
    await flush();
    assert.deepStrictEqual(order, ['decide'], 'a rejection saves nothing');
    assert.strictEqual(Approval.decided[0].decision, 'Reject');
  }

  // 4b. assignee, form incomplete: Approve does NOT arm, and nothing is sent
  order.length = 0; Approval.decided.length = 0; Request.calls.length = 0;
  {
    const bar = Panel._decisionBar(route, step, () => {}, { task: task('TRUE'), spec: spec });
    assert.strictEqual(radios(bar).length, 23, '10 x Yes/No + Yes/No/NA');
    assert.ok(radios(bar).every(r => !r.checked), 'nothing preselected');
    assert.strictEqual(areas(bar).length, 4, 'three form text areas + the comment');
    button(bar, 'Approve').fire('click');
    assert.ok(button(bar, 'Approve'), 'not armed');
    assert.ok(/11 answers are missing/.test(bar.textContent));
    assert.strictEqual(all(bar, n => n.className.indexOf('is-invalid') >= 0).length, 23,
      'every radio of every unanswered question is marked');
    await flush();
    assert.deepStrictEqual(order, [], 'nothing sent');
  }

  // 4c. assignee, complete: SAVE first, then DECIDE, with the answers
  {
    let done = 0;
    const t = task('TRUE');
    const bar = Panel._decisionBar(route, step, () => { done += 1; }, { task: t, spec: spec });
    answerAll(bar, 'Yes');
    // legal = Yes now requires details
    button(bar, 'Approve').fire('click');
    assert.ok(/1 answer is missing/.test(bar.textContent), 'legal details required after Yes');
    const details = areas(bar)[0];
    details.value = 'Flag-state rules apply';
    details.fire('input');
    button(bar, 'Approve').fire('click');
    assert.ok(button(bar, 'Confirm approve'), 'armed once complete');
    button(bar, 'Confirm approve').fire('click');
    await flush();
    assert.deepStrictEqual(order, ['save', 'decide'], 'the task is written BEFORE the decision');
    const sent = Request.calls[0];
    assert.strictEqual(sent.path, 'resources/v1/modeler/tasks/TASK-PHYS', 'the TASK, not the inbox task');
    assert.strictEqual(sent.opts.method, 'PUT');
    const de = sent.opts.data.data[0].dataelements;
    assert.strictEqual(Object.keys(de).length, 14);
    assert.strictEqual(de.EPMInvoiceIssued, 'Yes');
    assert.strictEqual(de.EPMLegalRequirementDetails, 'Flag-state rules apply');
    assert.strictEqual(Approval.decided[0].id, 'IT-INBOX');
    assert.strictEqual(Approval.decided[0].decision, 'Approve');
    assert.strictEqual(t.attributes.EPMWorkScopeCompleted, 'Yes', 'the page copy follows the save');
    assert.strictEqual(done, 1, 'the chain is re-read');
  }

  // 4d. the save is REFUSED (assignment removed meanwhile): no decision,
  //     and the bar falls back to the not-an-assignee state
  order.length = 0; Approval.decided.length = 0; Request.calls.length = 0;
  {
    Request.next = () => {
      const e = new Error('NetworkError: URL "x" return ResponseCode with value "400"');
      e.body = { success: false, statusCode: 400,
                 message: 'Error: No modify access on the specified object.' };
      return Promise.reject(e);
    };
    const bar = Panel._decisionBar(route, step, () => {}, { task: task('TRUE'), spec: spec });
    answerAll(bar, 'No');
    button(bar, 'Approve').fire('click');
    button(bar, 'Confirm approve').fire('click');
    await flush();
    assert.deepStrictEqual(order, ['save'], 'a failed save never sends the decision');
    assert.ok(bar.textContent.indexOf(Form.NOT_ASSIGNEE_TEXT) >= 0);
    assert.strictEqual(radios(bar).length, 0, 'inputs withdrawn');
    assert.strictEqual(button(bar, 'Approve').disabled, true);
    assert.strictEqual(button(bar, 'Save draft'), undefined);
  }

  // 4e. Save draft: writes the answers, decides nothing, needs no completeness
  order.length = 0; Request.calls.length = 0; Request.next = null;
  {
    const bar = Panel._decisionBar(route, step, () => {}, { task: task('TRUE'), spec: spec });
    const first = radios(bar)[0];
    first.checked = true; first.fire('change');
    button(bar, 'Save draft').fire('click');
    await flush();
    assert.deepStrictEqual(order, ['save']);
    assert.ok(/Answers saved\. Nothing has been approved yet\./.test(bar.textContent));
  }

  // 4f. a form with no inputs (every other gateway) - the bar is unchanged
  {
    const bar = Panel._decisionBar(route, step, () => {},
      { task: task('FALSE'), spec: { fields: [{ source: 'task', field: 'X' }] } });
    assert.strictEqual(button(bar, 'Approve').disabled, false,
      'no form to fill, so task modifyAccess does not matter');
    assert.strictEqual(button(bar, 'Save draft'), undefined);
  }

  // ---- 5. G7 PROJECT REVIEW: the reviewer fills it at level 2 (user, 2026-10-28)
  const pr = JSON.parse(fs.readFileSync(
    path.join(base, 'js/data/forms/project-review.json'), 'utf8'));
  // the AR spec as forProfile leaves it: no Validation item, no common-drive row
  const prAr = JSON.parse(JSON.stringify(pr));
  prAr.fields = prAr.fields.filter(f => f.field !== 'EPMDataDrive');
  prAr.fields.forEach(f => { if (f.rows) { f.rows = f.rows.filter(r => r.field !== 'EPMValidation'); } });

  const prIn = Form.inputsOf(pr);
  assert.deepStrictEqual(prIn.map(f => f.field), ['EPMAdhesionToSchedule',
    'EPMStatusOfCompletion', 'EPMValidation', 'EPMTechnicalFindingObservations',
    'EPMFollow_upActionRecommended', 'EPMDataDrive', 'EPMNextReviewDate'],
    'all seven attributes, observations box items included');
  assert.strictEqual(prIn[2].label, '3) Validation', 'box items carry their number');
  assert.strictEqual(Form.inputsOf(prAr)[2].label, '3) Technical finding / Observations',
    'AR numbers Technical finding 3, as its paper');
  assert.deepStrictEqual(prIn.filter(f => !f.input.required).map(f => f.field),
    ['EPMNextReviewDate'], 'only the next review date is optional');
  assert.strictEqual(Form.inputsFor(pr, { order: 1 }).length, 0, 'level 1 (Project Member) fills nothing');
  assert.strictEqual(Form.inputsFor(pr, { order: 2 }).length, 7);
  assert.strictEqual(Form.inputsFor(spec, { order: 1 }).length, 14, 'G9: no inputAtStep, every step');

  const prBlank = {};
  prIn.forEach(f => { prBlank[f.field] = ''; });
  assert.strictEqual(Form.validate(prIn, prBlank).length, 6);
  assert.strictEqual(Form.validate(Form.inputsOf(prAr), prBlank).length, 4, 'AR: 4 required');
  assert.strictEqual(Form.validate(prIn, Object.assign({}, prBlank, { EPMValidation: 'Not Required' }))
    .find(p => p.field === 'EPMValidation').message,
    'not one of Stage / Final / Not Required / Not Applicable', 'labels, not stored values, in the message');

  const prStep1 = { id: 'IT-1', role: 'Project Member', order: 1 };
  const prStep2 = { id: 'IT-2', role: 'Project Reviewer', order: 2 };
  const prTask = (modify) => ({ id: 'G7-TASK', attributes: Object.assign({ modifyAccess: modify }, prBlank) });

  // 5a. level 1: no inputs, and not being an assignee does not matter
  {
    const bar = Panel._decisionBar(route, prStep1, () => {}, { task: prTask('FALSE'), spec: pr });
    assert.strictEqual(radios(bar).length, 0);
    assert.strictEqual(button(bar, 'Approve').disabled, false);
    assert.strictEqual(button(bar, 'Save draft'), undefined);
  }

  // 5b. level 2, reviewer not an assignee: the G9 message, Reject only
  {
    const bar = Panel._decisionBar(route, prStep2, () => {}, { task: prTask('FALSE'), spec: pr });
    assert.ok(bar.textContent.indexOf(Form.NOT_ASSIGNEE_TEXT) >= 0);
    assert.strictEqual(button(bar, 'Approve').disabled, true);
  }

  // 5c. level 2, assignee: fill, then save BEFORE the decision, stored values sent
  order.length = 0; Request.calls.length = 0; Request.next = null; Approval.decided.length = 0;
  {
    const bar = Panel._decisionBar(route, prStep2, () => {}, { task: prTask('TRUE'), spec: pr });
    assert.strictEqual(radios(bar).length, 9, 'Yes/No + 4 validation + Yes/No/NA');
    const lines = all(bar, n => n.tagName === 'INPUT' && (n.type === 'text' || n.type === 'date'));
    assert.deepStrictEqual(lines.map(n => n.type), ['text', 'date']);
    assert.strictEqual(areas(bar).length, 3, 'technical finding, follow-up, comment');
    const pick = (value) => { const r = radios(bar).find(x => x.value === value);
      radios(bar).filter(x => x.name === r.name).forEach(x => { x.checked = x === r; }); r.fire('change'); };
    pick('TRUE'); pick('NotRequired'); pick('NA');
    lines[0].value = 'All planned tasks complete'; lines[0].fire('input');
    lines[1].value = '2026-11-15'; lines[1].fire('change');
    areas(bar)[0].value = 'Reports checked'; areas(bar)[0].fire('input');
    areas(bar)[1].value = 'None'; areas(bar)[1].fire('input');
    button(bar, 'Approve').fire('click');
    button(bar, 'Confirm approve').fire('click');
    await flush();
    assert.deepStrictEqual(order, ['save', 'decide'], 'saved first, then decided');
    const sent = Request.calls[0].opts.data.data[0].dataelements;
    assert.strictEqual(sent.EPMAdhesionToSchedule, 'TRUE', 'the boolean is written as TRUE');
    assert.strictEqual(sent.EPMValidation, 'NotRequired', 'the range value, not its label');
    assert.strictEqual(sent.EPMDataDrive, 'NA');
    const day = new Date(sent.EPMNextReviewDate);
    assert.deepStrictEqual([day.getFullYear(), day.getMonth() + 1, day.getDate(), day.getHours()],
      [2026, 11, 15, 12], 'the picked day, at local noon');
    assert.strictEqual(Approval.decided[0].id, 'IT-2');
  }

  delete global.document;
  console.log('irstasks-verification: all assertions passed');
})().catch(err => { console.error(err); process.exit(1); });
