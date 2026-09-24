// Run: node src/test/js/jazzysole-credentials.test.js   (from external-widget/)
// Tests JazzySole/Credentials with fake widget, WAFData and platform services.
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
  opts = opts || {};
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
  const me = opts.me !== undefined ? opts.me : GET_ME;
  const WAFData = { calls: [], authenticatedRequest(url, o) { this.calls.push(url); setImmediate(() => o.onComplete(me)); } };
  const Compass = { getPlatformServices(o) { setImmediate(() => o.onComplete([{ platformId: 'OnPremise', '3DSpace': 'https://vm/3dspace' }])); } };
  const define = (name, deps, f) => { defs[name] = f(WAFData, Compass); };
  // load like a browser script: AMD define in scope, not Node's require
  new Function('define', require('fs').readFileSync(FILE, 'utf8'))(define);
  return { C: defs['JazzySole/Credentials'], WAFData, prefs };
}

(async () => {
  // 1. builds the preference from Get Me: sorted by label, admin credentials last
  let t = setup();
  let info = await t.C.init();
  assert.ok(t.WAFData.calls[0].startsWith(
    'https://vm/3dspace/resources/modeler/pno/person?current=true&select=collabspaces&tenant=OnPremise'));
  assert.deepStrictEqual(t.C.list().map(o => o.value), [
    'VPLMCreator.Company Name.Alpha',               // "Alpha Space ● Author"
    'VPLMProjectLeader.Company Name.Common Space',  // "Common Space ● Project Leader"
    'VPLMAdmin.Company Name.Common Space'           // admin last
  ]);
  assert.strictEqual(t.C.list()[1].label, 'Common Space ● Project Leader'); // one org -> no org in label
  assert.strictEqual(info.value, 'VPLMCreator.Company Name.Alpha');
  assert.strictEqual(info.spaceUrl, 'https://vm/3dspace');
  assert.strictEqual(t.C.getSecurityContext(), 'ctx::VPLMCreator.Company Name.Alpha');

  // 1b. the removed OOTB branch must not come back (UWA rule C6: a DS/<app>/...
  //     id cannot resolve from an external widget, so there is nothing to retry)
  const src = require('fs').readFileSync(FILE, 'utf8');
  assert.ok(!('source' in info), 'info() must not report a source any more');
  assert.ok(!/\brequire\s*\(/.test(src),
    'must not call require() - a DS/<app> id 404s under the dashboard proxy');
  assert.ok(!/loadOotb|OOTB_MODULE|OOTB_TIMEOUT/.test(src),
    'the OOTB branch must stay removed');

  // 2. stored value still valid -> kept
  t = setup({ stored: 'VPLMProjectLeader.Company Name.Common Space' });
  info = await t.C.init();
  assert.strictEqual(info.value, 'VPLMProjectLeader.Company Name.Common Space');
  assert.strictEqual(info.label, 'Common Space ● Project Leader');

  // 3. stored value no longer valid -> replaced by the first option
  t = setup({ stored: 'OldRole.Company Name.Gone' });
  info = await t.C.init();
  assert.strictEqual(info.value, 'VPLMCreator.Company Name.Alpha');

  // 4. set(): known value switches and notifies; unknown value rejected
  let seen = null;
  t.C.onChange((now, prev) => { seen = [now.value, prev]; });
  await t.C.set('VPLMAdmin.Company Name.Common Space');
  assert.deepStrictEqual(seen, ['VPLMAdmin.Company Name.Common Space', 'VPLMCreator.Company Name.Alpha']);
  await assert.rejects(t.C.set('not.a.credential'));

  // 5. several organizations -> organization in the label
  const opts = t.C._buildOptions({ collabspaces: [{ name: 'S', title: 'S', couples: [
    { organization: { name: 'A', title: 'Org A' }, role: { name: 'R', nls: 'Role' } },
    { organization: { name: 'B', title: 'Org B' }, role: { name: 'R', nls: 'Role' } }] }] });
  assert.strictEqual(opts[0].label, 'S ● Org A ● Role');

  // 5b. a role nobody has listed anywhere still appears and sorts normally.
  //     ADMIN_ROLE_PATTERN is an ordering rule, NOT a registration list: adding
  //     roles to the platform must never require editing Credentials.js.
  const withNewRole = {
    name: 'u3',
    collabspaces: [{ name: 'Alpha', title: 'Alpha Space', couples: [
      { organization: { name: 'Co', title: 'Co' }, role: { name: 'IRSReader',  nls: 'Reader' } },
      { organization: { name: 'Co', title: 'Co' }, role: { name: 'VPLMAdmin',  nls: 'Administrator' } },
      { organization: { name: 'Co', title: 'Co' }, role: { name: 'VPLMCreator', nls: 'Author' } }
    ] }]
  };
  t = setup({ me: withNewRole });
  info = await t.C.init();
  const values = t.C.list().map(o => o.value);
  assert.ok(values.includes('IRSReader.Co.Alpha'), 'an unknown role must still be offered');
  assert.deepStrictEqual(values, [
    'VPLMCreator.Co.Alpha',   // "Alpha Space ● Author"
    'IRSReader.Co.Alpha',     // "Alpha Space ● Reader"  - sorts by label, not special-cased
    'VPLMAdmin.Co.Alpha'      // admin still last
  ]);
  assert.strictEqual(info.value, 'VPLMCreator.Co.Alpha', 'admin must not become the default');

  // 6. user with no credential -> init rejects with a clear message
  t = setup({ me: { name: 'u2', collabspaces: [] } });
  await assert.rejects(t.C.init(), /No credentials assigned/);

  console.log('ALL CREDENTIALS TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
