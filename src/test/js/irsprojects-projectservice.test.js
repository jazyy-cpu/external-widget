// Run: node src/test/js/irsprojects-projectservice.test.js   (from external-widget/)
// Tests IRSProjects/services/ProjectService and IRSProjects/config/ProjectFields:
// the query it sends, the row mapping, and the state-filter fallback (open item A2).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '../../main/resources/static/WidgetPacket/IRSProjects/js');
const SERVICE = path.join(DIR, 'services/ProjectService.js');
const FIELDS = path.join(DIR, 'config/ProjectFields.js');

// One project exactly as the service returns it (envelope confirmed against the
// recorded response in the IRS POC: dataelements + id + type siblings).
function project(over) {
  return Object.assign({
    id: 'B159953C6DCA4634803A88CA3FBBF26E',
    type: 'EPMAnalysisProject',
    dataelements: {
      title: 'Hull analysis 2026',
      state: 'Active',
      estimatedStartDate: '2026-01-01T08:00:00.000',
      estimatedFinishDate: '2026-02-15T17:00:00.000',
      EPMProjectNo: 'PRJ-0001'
    }
  }, over);
}

/**
 * @param {Array} replies one per Request.get call: { body } or { fail: Error }
 */
function setup(replies) {
  const calls = [];   // { path, params }
  const Request = {
    get(p, opts) {
      calls.push({ path: p, params: (opts || {}).params });
      const reply = replies.shift() || { body: { data: [] } };
      return reply.fail ? Promise.reject(reply.fail) : Promise.resolve(reply.body);
    }
  };

  const mods = {};
  const load = (file, deps) => {
    const define = (name, d, f) => { mods[name] = f.apply(null, deps); };
    new Function('define', fs.readFileSync(file, 'utf8'))(define);
  };
  load(FIELDS, []);
  load(SERVICE, [Request, mods['IRSProjects/config/ProjectFields']]);
  return { S: mods['IRSProjects/services/ProjectService'],
           F: mods['IRSProjects/config/ProjectFields'], calls };
}

(async () => {
  // 1. the default view: $include=none, the tested $fields list, the six open states
  let t = setup([{ body: { data: [project()] } }]);
  let res = await t.S.list();
  assert.strictEqual(t.calls[0].path, 'resources/v1/modeler/projects');
  assert.strictEqual(t.calls[0].params['$include'], 'none',
    '$include=none is mandatory - the default expands the whole task tree');
  assert.strictEqual(t.calls[0].params['$fields'],
    'none,title,state,estimatedStartDate,estimatedFinishDate,EPMProjectNo',
    'exactly the field list that was tested on 2026-09-23');
  assert.strictEqual(t.calls[0].params.state, 'Create,Assign,Active,Review,Hold,Cancel');
  assert.ok(!/percentComplete|tasks|members/.test(JSON.stringify(t.calls[0].params)),
    'no task data on the landing page');

  // 2. the row: dataelements flattened, the subtype turned into a label
  assert.deepStrictEqual(res.rows[0], {
    id: 'B159953C6DCA4634803A88CA3FBBF26E',
    type: 'EPMAnalysisProject',
    category: 'Analysis',
    projectNo: 'PRJ-0001',
    title: 'Hull analysis 2026',
    state: 'Active',
    start: '2026-01-01T08:00:00.000',
    finish: '2026-02-15T17:00:00.000',
    department: '',      // relationship not built yet
    customer: ''
  });
  assert.strictEqual(res.serverFiltered, true);
  assert.strictEqual(res.note, '');

  // 2b. dates stay as the ISO-like strings the service sent: they sort as text
  assert.ok(res.rows[0].finish > res.rows[0].start, 'ISO text sorts chronologically');

  // 2c. an unknown subtype shows its own name instead of an empty cell
  t = setup([{ body: { data: [project({ type: 'EPMSomethingNew' })] } }]);
  res = await t.S.list();
  assert.strictEqual(res.rows[0].category, 'EPMSomethingNew');

  // 2d. a missing field is an empty string, not undefined (Tabulator would show "undefined")
  t = setup([{ body: { data: [{ id: 'x', type: 'EPMResearchProject', dataelements: {} }] } }]);
  res = await t.S.list();
  assert.deepStrictEqual(
    [res.rows[0].projectNo, res.rows[0].title, res.rows[0].start, res.rows[0].category],
    ['', '', '', 'Research']);

  // 2e. a body with no data array is an empty list, not a crash
  t = setup([{ body: { success: true } }]);
  assert.deepStrictEqual((await t.S.list()).rows, []);

  // 3. the switch: all eight states are asked for, and closed projects are kept
  t = setup([{ body: { data: [project(), project({ dataelements: Object.assign(
        project().dataelements, { state: 'Archive' }) })] } }]);
  res = await t.S.list({ includeClosed: true });
  assert.strictEqual(t.calls[0].params.state,
    'Create,Assign,Active,Review,Hold,Cancel,Complete,Archive');
  assert.strictEqual(res.rows.length, 2);

  // 4. defensive: a server that ignores `state` and returns a closed project anyway
  //    must not put it in the default view
  t = setup([{ body: { data: [project(), project({ id: 'c1', dataelements: Object.assign(
        project().dataelements, { state: 'Complete' }) })] } }]);
  res = await t.S.list();
  assert.deepStrictEqual(res.rows.map(r => r.state), ['Active'],
    'Complete is filtered in the widget too, whatever the server did');

  // 5. A2: the server refuses `state` -> ONE retry without it, filtered locally,
  //    and the result says so instead of failing
  t = setup([{ fail: new Error('Undocumented query parameter: state') },
             { body: { data: [project(), project({ id: 'c1', dataelements: Object.assign(
                 project().dataelements, { state: 'Complete' }) })] } }]);
  res = await t.S.list();
  assert.strictEqual(t.calls.length, 2);
  assert.strictEqual(t.calls[0].params.state, 'Create,Assign,Active,Review,Hold,Cancel');
  assert.strictEqual(t.calls[1].params.state, undefined, 'the retry drops the parameter');
  assert.strictEqual(t.calls[1].params['$include'], 'none', 'and keeps everything else');
  assert.strictEqual(res.serverFiltered, false);
  assert.ok(/refused the state filter/.test(res.note), res.note);
  assert.deepStrictEqual(res.rows.map(r => r.state), ['Active']);

  // 5b. if the retry fails too, the error reaches the caller - no silent empty grid
  t = setup([{ fail: new Error('state refused') }, { fail: new Error('service down') }]);
  await assert.rejects(t.S.list(), /service down/);

  // 6. ProjectFields: the lifecycle of both policies, and nothing extra
  assert.deepStrictEqual(t.F.ALL_STATES,
    ['Create', 'Assign', 'Active', 'Review', 'Hold', 'Cancel', 'Complete', 'Archive']);
  assert.strictEqual(t.F.isClosed('Complete'), true);
  assert.strictEqual(t.F.isClosed('Cancel'), false,
    'Cancel is a Hold/Cancel state, not a closed one - it stays in the default view');
  assert.strictEqual(t.F.stateBadge('Active'), 'primary');
  assert.strictEqual(t.F.stateBadge('Whatever'), 'secondary', 'an unknown state still renders');

  console.log('ALL PROJECT SERVICE TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
