// Run: node src/test/js/jazzysole-notify.test.js   (from external-widget/)
// Tests JazzySole/Notify's POLICY - which type stays how long, and what an
// override does. That is the part that must not drift; the sliding and the
// placement are checked in a browser.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname,
  '../../main/resources/static/WidgetPacket/JazzySole/Notify/Notify.js');

function load() {
  let mod;
  const define = (name, deps, f) => {
    assert.strictEqual(name, 'JazzySole/Notify');
    mod = f();
  };
  // load like a browser script; only _resolve and configure are exercised,
  // so no document is needed
  new Function('define', fs.readFileSync(FILE, 'utf8'))(define);
  return mod;
}

let Notify = load();
const r = input => Notify._resolve(input);

// 1. the policy the user asked for: critical waits for a click, the rest go by
//    themselves after 5 seconds
assert.strictEqual(r({ type: 'critical', message: 'x' }).timeout, 0);
assert.strictEqual(r({ type: 'critical', message: 'x' }).sticky, true);
assert.strictEqual(r({ type: 'error', message: 'x' }).sticky, true);
assert.strictEqual(r({ type: 'warning', message: 'x' }).timeout, 5000);
assert.strictEqual(r({ type: 'success', message: 'x' }).timeout, 5000);
assert.strictEqual(r({ type: 'info', message: 'x' }).timeout, 5000);
assert.strictEqual(r({ type: 'warning', message: 'x' }).sticky, false);

// 2. a message that never times out is ALWAYS closable, even if the caller
//    asked for no close button - otherwise it would be permanent
assert.strictEqual(r({ type: 'critical', message: 'x', dismissible: false }).dismissible, true);
assert.strictEqual(r({ type: 'info', message: 'x', dismissible: false }).dismissible, false);

// 3. an explicit timeout overrides the type's own, in both directions
assert.strictEqual(r({ type: 'info', message: 'x', timeout: 1500 }).timeout, 1500);
assert.strictEqual(r({ type: 'critical', message: 'x', timeout: 3000 }).timeout, 3000,
  'even a critical can be given a time');
assert.strictEqual(r({ type: 'critical', message: 'x', timeout: 3000 }).sticky, false);
assert.strictEqual(r({ type: 'info', message: 'x', timeout: 0 }).sticky, true,
  '0 is the way to say "wait for the user"');
assert.strictEqual(r({ type: 'info', message: 'x', timeout: 0 }).dismissible, true);

// 4. nonsense in the override falls back to the type's own time, it does not
//    produce a notification that never appears or never leaves
[undefined, null, '', 'soon', NaN, -1].forEach(bad => {
  assert.strictEqual(r({ type: 'warning', message: 'x', timeout: bad }).timeout, 5000,
    'timeout ' + String(bad) + ' must fall back');
});

// 5. a bare string is the commonest call, and an unknown type is not a crash
assert.deepStrictEqual(
  [r('hello').type, r('hello').message, r('hello').timeout],
  ['info', 'hello', 5000]);
assert.strictEqual(r({ type: 'catastrophe', message: 'x' }).type, 'info',
  'an unknown type falls back to info rather than throwing');
assert.deepStrictEqual([r().message, r(null).type], ['', 'info']);

// 6. the title defaults to the type's label, and an empty title is respected
assert.strictEqual(r({ type: 'critical', message: 'x' }).title, 'Critical');
assert.strictEqual(r({ type: 'critical', message: 'x', title: '' }).title, '');
assert.strictEqual(r({ type: 'info', message: 'x' }).title, '', 'info carries no title by default');

// 7. screen readers: critical and error interrupt, the rest wait
assert.strictEqual(r({ type: 'critical', message: 'x' }).live, 'assertive');
assert.strictEqual(r({ type: 'error', message: 'x' }).live, 'assertive');
assert.strictEqual(r({ type: 'success', message: 'x' }).live, 'polite');

// 8. configure MERGES into the table - one number changes everywhere, and the
//    rest of the type is left alone
Notify = load();
Notify.configure({ types: { warning: { timeout: 8000 } } });
assert.strictEqual(r2(Notify, { type: 'warning', message: 'x' }).timeout, 8000);
assert.strictEqual(r2(Notify, { type: 'warning', message: 'x' }).style, 'warning',
  'merged, not replaced');
assert.strictEqual(r2(Notify, { type: 'info', message: 'x' }).timeout, 5000,
  'the other types are untouched');

// 8b. a widget may add a severity of its own without editing the library
Notify.configure({ types: { audit: { style: 'secondary', label: 'Audit', timeout: 0 } } });
assert.strictEqual(r2(Notify, { type: 'audit', message: 'x' }).sticky, true);
assert.strictEqual(r2(Notify, { type: 'audit', message: 'x' }).title, 'Audit');

// 9. types() hands back a copy: changing it must not change the policy
Notify = load();
const snapshot = Notify.types();
snapshot.info.timeout = 999999;
assert.strictEqual(r2(Notify, { type: 'info', message: 'x' }).timeout, 5000);

// 10. the library must not reach into a widget's DOM conventions
const src = fs.readFileSync(FILE, 'utf8');
assert.ok(/document\.body\.appendChild/.test(src),
  'the stack hangs off document.body, which survives a page re-render');
assert.ok(!/widget\.body\s*\.\s*append/.test(src),
  'it must never be attached to widget.body - the widget clears that on every re-render');
assert.ok(!/console\.(log|info|warn|debug)/.test(src), 'a shared library does not log');

function r2(N, input) { return N._resolve(input); }

console.log('ALL NOTIFY TESTS PASSED');
