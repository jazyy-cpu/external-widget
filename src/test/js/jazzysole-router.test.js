// Run: node src/test/js/jazzysole-router.test.js   (from external-widget/)
const assert = require('assert');
const path = require('path').join(__dirname, '../../main/resources/static/WidgetPacket/JazzySole/Router/Router.js');
let Router;
global.define = (name, deps, f) => { assert.strictEqual(name, 'JazzySole/Router'); Router = f(); };
const prefs = {};
global.widget = { getValue: k => prefs[k], setValue: (k, v) => { prefs[k] = v; } };
require(path);
let log = [];
function make() {
  const r = new Router({ defaultPath: 'projects', prefName: 'irsRoute', onError: e => log.push('err:' + e.message), onNotFound: p => log.push('nf:' + p) });
  r.add('projects', () => log.push('list'), 'Projects')
   .add('project/:id', p => { if (p.id === 'gone') throw new Error('deleted'); log.push('detail:' + p.id); }, 'Project')
   .add('project/:id/:section?', p => log.push('sec:' + p.id + ':' + (p.section || '-')), 'Section');
  return r;
}
(async () => {
  let r = make();
  await r.start(); assert.deepStrictEqual(log, ['list']);
  await r.go('project/:id', { id: 'A 1' });
  assert.strictEqual(r.getCurrent().path, 'project/A%201'); assert.strictEqual(r.getCurrent().params.id, 'A 1');
  await r.go('project/A%201/tasks');
  assert.deepStrictEqual(r.getBreadcrumb().map(b => b.path), ['projects', 'project/A%201', 'project/A%201/tasks']);
  assert.deepStrictEqual(JSON.parse(prefs.irsRoute), { v: 1, path: 'project/A%201/tasks', stack: ['projects', 'project/A%201'] });
  // refresh: new instance restores same page and stack
  log = []; r = make(); await r.start();
  assert.deepStrictEqual(log, ['sec:A 1:tasks']);
  await r.back(); assert.strictEqual(r.getCurrent().path, 'project/A%201');
  await r.back(); assert.strictEqual(r.getCurrent().path, 'projects');
  await r.back(); assert.strictEqual(r.getCurrent().path, 'projects');
  // guard cancel
  const off = r.beforeLeave(() => false); await r.go('project/B'); assert.strictEqual(r.getCurrent().path, 'projects'); off();
  // failed restore falls back
  prefs.irsRoute = JSON.stringify({ v: 1, path: 'project/gone', stack: [] });
  log = []; r = make(); await r.start();
  assert.strictEqual(r.getCurrent().path, 'projects'); assert.ok(log.includes('err:deleted'));
  assert.strictEqual(JSON.parse(prefs.irsRoute).path, 'projects');
  // unknown route
  prefs.irsRoute = 'nonsense/x'; log = []; r = make(); await r.start();
  assert.ok(log.includes('nf:nonsense/x')); assert.strictEqual(r.getCurrent().path, 'projects');
  // optional param without section
  await r.go('project/:id/:section?', { id: 'C' }); 
  assert.strictEqual(r.getCurrent().path, 'project/C'); // matched by 'project/:id' first
  // buildPath missing required
  assert.throws(() => Router.buildPath('project/:id', {}));
  // memory store when no widget
  delete global.widget; r = make(); await r.start(); await r.go('project/Z'); assert.strictEqual(r.getCurrent().path, 'project/Z');
  console.log('ALL ROUTER TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
