// Run: node src/test/js/irsprojects-detail.test.js   (from external-widget/)
// Tests the project detail skeleton (WGT-04): the form catalogue and the
// single-project read. The catalogue is the contract between WP02 doc 05 and
// the page, so it is worth pinning down.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '../../main/resources/static/WidgetPacket/IRSProjects/js');
const FORM = path.join(DIR, 'config/ProjectForm.js');
const FIELDS = path.join(DIR, 'config/ProjectFields.js');
const SERVICE = path.join(DIR, 'services/ProjectDetailService.js');

function load(file, deps) {
  let mod;
  const define = (name, d, f) => { mod = f.apply(null, deps); };
  new Function('define', fs.readFileSync(file, 'utf8'))(define);
  return mod;
}

const Form = load(FORM, []);
const Fields = load(FIELDS, []);

// ---- the form catalogue ------------------------------------------------

// 1. the printed form's order is the page's order, I to XVI, nothing skipped
const refs = Form.SECTIONS.map(s => s.ref);
assert.deepStrictEqual(refs, [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI'
], 'every numbered section of R&D-PRJ-01 is present, in order');

// 2. the eleven attributes WP02 doc 05 recorded as created, and no others
const created = Form.attributeFields();
assert.deepStrictEqual(created, [
  'EPMProjectNo',                        // header
  'EPMNeedOfTheProject',                 // III
  'EPMProjectOverview',                  // IV
  'EPMScopeofWork',                      // V
  'EPMInput',                            // VI
  'EPMMethodology',                      // VII
  'EPMComplexity',                       // VIII
  'EPMIdentifiedStandards',              // IX
  'EPMFeedback',                         // X
  'EPMPotentialConsequencesOfFailure',   // XI
  'EPMStageValidation',                  // XIV
  'EPMDeliverables'                      // XV
], 'the 12 attributes that exist on the VM (doc 05 section 14.3)');

// 3. XIII is NOT a text attribute - doc 05 section 13.2 settled it as OOTB objects
const xiii = Form.SECTIONS.filter(s => s.ref === 'XIII')[0];
assert.strictEqual(xiii.kind, 'object');
assert.strictEqual(xiii.tab, 'risks');
assert.ok(!xiii.field, 'no EPMRisksAndOpportunities attribute - that was dropped');

// 4. XII is known to be missing, not silently absent
const xii = Form.SECTIONS.filter(s => s.ref === 'XII')[0];
assert.strictEqual(xii.kind, 'todo');
assert.strictEqual(xii.field, 'EPMLessonsLearnt');
assert.strictEqual(xii.tab, 'lessons');

// 5. Department and Customer are relationships, never attributes (doc 05 §8, §9)
const links = Form.all().filter(f => f.kind === 'rel').map(f => f.label);
assert.ok(links.some(l => /Department/.test(l)), links.join(' | '));
assert.ok(links.some(l => /Customer/.test(l)), links.join(' | '));
assert.ok(!Form.all().some(f => /^EPM(Department|Customer|Stream)/.test(f.field || '')),
  'no attribute duplicates master data that already exists as objects');

// 6. the design & development-only sections are marked, so the page can say so
assert.deepStrictEqual(Form.SECTIONS.filter(s => s.dd).map(s => s.ref),
  ['VIII', 'X', 'XI', 'XII']);

// 7. Overview draws what belongs to it; the rest carry a tab to go to
assert.ok(Form.overview().every(s => !s.tab));
assert.deepStrictEqual(Form.elsewhere().map(s => s.tab),
  ['organisation', 'lessons', 'risks', 'planning']);

// 8. every field points at a tab that the detail view actually builds or plans
const KNOWN_TABS = ['overview', 'organisation', 'risks', 'lessons',
                    'planning', 'team', 'documents', 'approvals'];
Form.all().concat(Form.PLANNED).forEach(f => {
  if (f.tab) { assert.ok(KNOWN_TABS.includes(f.tab), 'unknown tab: ' + f.tab); }
});

// 9. byField finds a planned field too, so nothing is invisible to the page
assert.strictEqual(Form.byField('EPMDHComment').kind, 'todo');
assert.strictEqual(Form.byField('EPMNeedOfTheProject').ref, 'III');
assert.strictEqual(Form.byField('nope'), undefined);

// ---- the detail read ---------------------------------------------------

function service(reply) {
  const calls = [];
  const Request = {
    get(p, opts) {
      calls.push({ path: p, params: (opts || {}).params });
      return reply.fail ? Promise.reject(reply.fail) : Promise.resolve(reply.body);
    }
  };
  return { S: load(SERVICE, [Request, Fields]), calls };
}

const ITEM = {
  id: 'B159953C6DCA4634803A88CA3FBBF26E',
  type: 'EPMAnalysisProject',
  dataelements: {
    title: 'AP project', state: 'Create', EPMProjectNo: '',
    EPMNeedOfTheProject: 'Line one\nLine two',
    estimatedStartDate: '2026-09-23T08:00:00.000'
  }
};

(async () => {
  // 10. one project by id, $include=none, and no $fields (all EPM attributes wanted)
  let t = service({ body: { data: [ITEM] } });
  let p = await t.S.get(ITEM.id);
  assert.strictEqual(t.calls[0].path, 'resources/v1/modeler/projects/' + ITEM.id);
  assert.strictEqual(t.calls[0].params['$include'], 'none');
  assert.strictEqual(t.calls[0].params['$fields'], undefined,
    'the detail call wants the whole object, so no $fields list to keep in step');

  assert.strictEqual(p.title, 'AP project');
  assert.strictEqual(p.category, 'Analysis');
  assert.strictEqual(p.projectNo, '');
  assert.strictEqual(p.data.EPMNeedOfTheProject, 'Line one\nLine two',
    'attributes are handed to the page as they came, line breaks included');

  // 11. a single object may arrive unwrapped, or as a bare object - both work
  t = service({ body: { data: ITEM } });
  assert.strictEqual((await t.S.get('x')).title, 'AP project');
  t = service({ body: ITEM });
  assert.strictEqual((await t.S.get('x')).title, 'AP project');

  // 12. nothing found is a clear error, not an empty page
  t = service({ body: { data: [] } });
  await assert.rejects(t.S.get('gone'), /was not found, or is not visible/);
  await assert.rejects(service({ body: {} }).S.get(''), /No project id given/);

  // 13. the id is encoded into the path
  t = service({ body: { data: [ITEM] } });
  await t.S.get('a b/c');
  assert.strictEqual(t.calls[0].path, 'resources/v1/modeler/projects/a%20b%2Fc');

  console.log('ALL DETAIL TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
