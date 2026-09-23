// Run: node src/test/js/jazzysole-credentials.test.js   (from external-widget/)
// Tests JazzySole/Credentials with fake widget, WAFData, platform services and require.
'use strict';
const assert = require('assert');
const path = require('path');
const FILE = path.join(__dirname, '../../main/resources/static/WidgetPacket/JazzySole/PlatformService/Credentials.js');

const GET_ME = {
  name: 'u1',
  collabspaces: [
    { name: 'Common Space', title: 'Common Space', couples: [
      { organization: { name: 'Company Name', title: 'Company Name' }, role: { name: 'VPLMProjectLeader', nls: 'Project Leader' } },
      { organization: { name: 'Company Name', title: 'Company Name' }, role: { name: 'VPLMAdmin', nls: 'Administrator' } }
    ] },
    { name: 'Alpha', title: 'Alpha Space', couples: [
      { organization: { name: 'Company Name', title: 'Company Name' }, role: { name: 'VPLMCreator', nls: 'Author' } }
    ] }
  ]
};

function setup(opts) {
  const prefs = {}; const defs = {};
  global.widget = {
    lang: 'en',
    getValue: k => prefs[k] !== undefined ? prefs[k].value : undefined,
    setValue: (k, v) => { (prefs[k] = prefs[k] || { name: k }).value = v; },
    getPreference: k => prefs[k],
    addPreference: p => { const old = prefs[p.name]; prefs[p.name] = Object.assign({}, p, { value: old ? old.value : p.defaultValue }); }
  };
  if (opts.stored !== undefined) { widget.setValue('xPref_CREDENTIAL', opts.stored); }
  widget.setValue('x3dPlatformId', 'OnPremise');
  const WAFData = { calls: [], authenticatedRequest(url, o) { this.calls.push(url); setImmediate(() => o.onComplete(GET_ME)); } };
  const Compass = { getPlatformServices(o) { setImmediate(() => o.onComplete([{ platformId: 'OnPremise', '3DSpace': 'https://vm/3dspace' }])); } };
  global.require = (deps, ok, fail) => {
    if (opts.ootb === 'ok') {
      setImmediate(() => ok({ addCredentialPreferenceToWidget: () => {
        widget.addPreference({ name: 'xPref_CREDENTIAL', type: 'list', options: [{ value: 'R.O.C', label: 'C ● R' }] });
        if (!widget.getValue('xPref_CREDENTIAL')) { widget.setValue('xPref_CREDENTIAL', 'R.O.C'); }
        return Promise.resolve();
      } }));
    } else if (opts.ootb === 'error') {
      setImmediate(() => fail(new Error('Script error for DS/ENOXWidgetPreferences')));
    } // 'hang': never calls back -> timeout
  };
  const define = (name, deps, f) => { defs[name] = f(WAFData, Compass); };
  // load like a browser script: AMD define/require in scope, not Node's require
  new Function('define', 'require', require('fs').readFileSync(FILE, 'utf8'))(define, global.require);
  return { C: defs['JazzySole/Credentials'], WAFData, prefs };
}

(async () => {
  // 1. OOTB module loads -> source ootb, no Get Me call of our own
  let t = setup({ ootb: 'ok' });
  let info = await t.C.init();
  assert.strictEqual(info.source, 'ootb');
  assert.strictEqual(info.value, 'R.O.C');
  assert.strictEqual(t.WAFData.calls.length, 0);
  assert.strictEqual(t.C.getSecurityContext(), 'ctx::R.O.C');

  // 2. OOTB module fails to load -> fallback, first sorted non-admin option
  t = setup({ ootb: 'error' });
  info = await t.C.init();
  assert.strictEqual(info.source, 'fallback');
  assert.ok(t.WAFData.calls[0].startsWith('https://vm/3dspace/resources/modeler/pno/person?current=true&select=collabspaces&tenant=OnPremise'));
  assert.deepStrictEqual(t.C.list().map(o => o.value), [
    'VPLMCreator.Company Name.Alpha',           // "Alpha Space ● Author"
    'VPLMProjectLeader.Company Name.Common Space', // "Common Space ● Project Leader"
    'VPLMAdmin.Company Name.Common Space'        // admin last
  ]);
  assert.strictEqual(t.C.list()[1].label, 'Common Space ● Project Leader'); // one org -> no org in label
  assert.strictEqual(info.value, 'VPLMCreator.Company Name.Alpha');

  // 3. stored value still valid -> kept
  t = setup({ ootb: 'error', stored: 'VPLMProjectLeader.Company Name.Common Space' });
  info = await t.C.init();
  assert.strictEqual(info.value, 'VPLMProjectLeader.Company Name.Common Space');
  assert.strictEqual(info.label, 'Common Space ● Project Leader');

  // 4. stored value no longer valid -> replaced by the first option
  t = setup({ ootb: 'error', stored: 'OldRole.Company Name.Gone' });
  info = await t.C.init();
  assert.strictEqual(info.value, 'VPLMCreator.Company Name.Alpha');

  // 5. set(): known value switches and notifies; unknown value rejected
  let seen = null;
  t.C.onChange((now, prev) => { seen = [now.value, prev]; });
  await t.C.set('VPLMAdmin.Company Name.Common Space');
  assert.deepStrictEqual(seen, ['VPLMAdmin.Company Name.Common Space', 'VPLMCreator.Company Name.Alpha']);
  await assert.rejects(t.C.set('not.a.credential'));

  // 6. several organizations -> organization in the label
  const opts = t.C._buildOptions({ collabspaces: [{ name: 'S', title: 'S', couples: [
    { organization: { name: 'A', title: 'Org A' }, role: { name: 'R', nls: 'Role' } },
    { organization: { name: 'B', title: 'Org B' }, role: { name: 'R', nls: 'Role' } }] }] });
  assert.strictEqual(opts[0].label, 'S ● Org A ● Role');

  // 7. OOTB module never answers -> timeout -> fallback (takes ~6 s)
  t = setup({ ootb: 'hang' });
  info = await t.C.init();
  assert.strictEqual(info.source, 'fallback');

  console.log('ALL CREDENTIALS TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
