// Run: node src/test/js/jazzysole-request.test.js   (from external-widget/)
// Tests JazzySole/Request - the one request wrapper: URL building, tenant and
// SecurityContext, CSRF tracking and the single retry of rule R5.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname,
  '../../main/resources/static/WidgetPacket/JazzySole/PlatformService/Request.js');

const SPACE = 'https://vm/3dspace';

/**
 * @param {Array} replies  one per call, in order:
 *   { body }                      -> onComplete(body, transport)
 *   { fail, status }              -> onFailure(reason, transport)
 *   { timeout: true }             -> onTimeout()
 */
function setup(replies) {
  const prefs = { x3dPlatformId: 'OnPremise' };
  global.widget = {
    lang: 'en',
    getValue: k => prefs[k],
    setValue: (k, v) => { prefs[k] = v; }
  };

  const calls = [];   // { url, method, headers, data }
  const WAFData = {
    authenticatedRequest(url, o) {
      calls.push({ url, method: o.method, headers: o.headers, data: o.data });
      const reply = replies.shift() || { body: {} };
      const transport = { status: reply.status || 200, getResponseHeader: () => reply.header || null };
      setImmediate(() => {
        if (reply.timeout) { o.onTimeout(); }
        else if (reply.fail !== undefined) { o.onFailure(reply.fail, transport); }
        else { o.onComplete(reply.body, transport); }
      });
    }
  };
  const Credentials = {
    get3DSpaceUrl: () => Promise.resolve(SPACE),
    getSecurityContext: () => 'ctx::VPLMCreator.Co.Alpha'
  };

  let Request;
  const define = (name, deps, f) => {
    assert.strictEqual(name, 'JazzySole/Request');
    Request = f(WAFData, Credentials);
  };
  // load like a browser script: AMD define in scope, not Node's require
  new Function('define', fs.readFileSync(FILE, 'utf8'))(define);
  return { Request, calls };
}

(async () => {
  // 1. GET: relative path resolved against 3DSpace, tenant and SecurityContext added
  let t = setup([{ body: { data: [] } }]);
  await t.Request.get('resources/v1/modeler/projects', { params: { '$include': 'none' } });
  let url = t.calls[0].url;
  assert.ok(url.startsWith(SPACE + '/resources/v1/modeler/projects?'), url);
  assert.ok(url.includes('%24include=none'), 'params are encoded: ' + url);
  assert.ok(url.includes('tenant=OnPremise'), url);
  assert.ok(url.includes('SecurityContext=ctx%3A%3AVPLMCreator.Co.Alpha'), url);
  assert.strictEqual(t.calls[0].method, 'GET');
  assert.strictEqual(t.calls[0].headers['Accept-Language'], 'en');
  assert.ok(!t.calls[0].headers.ENO_CSRF_TOKEN, 'a GET must not need a CSRF token');

  // 1b. empty and null params are dropped, not sent as "="
  t = setup([{ body: {} }]);
  await t.Request.get('x', { params: { a: '', b: null, c: 0 } });
  assert.ok(!t.calls[0].url.includes('a='), t.calls[0].url);
  assert.ok(t.calls[0].url.includes('c=0'), 'a zero is a value: ' + t.calls[0].url);

  // 2. an absolute URL is used as given; noContext omits SecurityContext
  t = setup([{ body: {} }]);
  await t.Request.get('https://other/svc?x=1', { noContext: true });
  assert.ok(t.calls[0].url.startsWith('https://other/svc?x=1&'), t.calls[0].url);
  assert.ok(!t.calls[0].url.includes('SecurityContext'), t.calls[0].url);
  assert.ok(t.calls[0].url.includes('tenant=OnPremise'), t.calls[0].url);

  // 3. the token is picked up from a response body that carries one (the project GET does)
  t = setup([{ body: { data: [], csrf: { name: 'ENO_CSRF_TOKEN', value: 'tok-1' } } },
             { body: { success: true } }]);
  assert.strictEqual(t.Request.hasCsrfToken(), false);
  await t.Request.get('resources/v1/modeler/projects');
  assert.strictEqual(t.Request.hasCsrfToken(), true, 'the GET response refreshed the token');
  await t.Request.send('resources/v1/modeler/projects/1', { method: 'PATCH', data: { title: 'x' } });
  assert.strictEqual(t.calls[1].headers.ENO_CSRF_TOKEN, 'tok-1', 'the write must send it');
  assert.strictEqual(t.calls[1].headers['Content-Type'], 'application/json');
  assert.strictEqual(t.calls[1].data, '{"title":"x"}');
  assert.strictEqual(t.calls.length, 2, 'no extra CSRF call when a token is already held');

  // 3b. the X-DS-CSRFTOKEN response header is accepted too (other DS services use it)
  t = setup([{ body: {}, header: 'tok-hdr' }]);
  await t.Request.get('x');
  assert.strictEqual(t.Request.hasCsrfToken(), true);

  // 4. no token yet -> a write fetches one from the CSRF service first, then sends
  t = setup([{ body: { csrf: { name: 'ENO_CSRF_TOKEN', value: 'tok-2' } } },  // the CSRF call
             { body: { success: true } }]);                                   // the POST
  await t.Request.send('resources/v1/modeler/projects', { method: 'POST', data: {} });
  assert.ok(t.calls[0].url.includes('resources/v1/application/CSRF'), t.calls[0].url);
  assert.strictEqual(t.calls[1].headers.ENO_CSRF_TOKEN, 'tok-2');

  // 5. rule R5: a write rejected with 403 fetches a fresh token and retries ONCE
  t = setup([{ body: { csrf: { value: 'stale' } } },        // first CSRF call
             { fail: { message: 'Forbidden' }, status: 403 },// the write fails
             { body: { csrf: { value: 'fresh' } } },        // second CSRF call
             { body: { success: true } }]);                 // the retry succeeds
  await t.Request.send('resources/v1/modeler/projects', { method: 'POST', data: {} });
  assert.strictEqual(t.calls.length, 4, 'CSRF, write, CSRF, retry');
  assert.strictEqual(t.calls[1].headers.ENO_CSRF_TOKEN, 'stale');
  assert.strictEqual(t.calls[3].headers.ENO_CSRF_TOKEN, 'fresh');

  // 5b. ONCE means once: a second failure is reported, not retried again
  t = setup([{ body: { csrf: { value: 'stale' } } },
             { fail: { message: 'Forbidden' }, status: 403 },
             { body: { csrf: { value: 'fresh' } } },
             { fail: { message: 'Forbidden' }, status: 403 }]);
  await assert.rejects(t.Request.send('x', { method: 'POST', data: {} }), /Forbidden/);
  assert.strictEqual(t.calls.length, 4, 'exactly one retry');

  // 5c. a failure that is not about the token is not retried at all
  t = setup([{ body: { csrf: { value: 'tok' } } },
             { fail: { message: 'Project not found', status: 404 } }]);
  await assert.rejects(t.Request.send('x', { method: 'PUT', data: {} }), /not found/);
  assert.strictEqual(t.calls.length, 2, 'no retry for a 404');

  // 6. HTTP 200 with an error inside the body is a failure, not a result
  //    (several DS services answer this way - enovia-api-labs skill, Gotchas)
  t = setup([{ body: { success: false, message: 'Invalid query parameter' } }]);
  await assert.rejects(t.Request.get('x'), /Invalid query parameter/);

  // 7. a timeout says which call timed out
  t = setup([{ timeout: true }]);
  await assert.rejects(t.Request.get('resources/v1/modeler/projects'), /timed out/);

  // 8. the token value is never exposed by the API
  t = setup([{ body: { csrf: { value: 'secret-token' } } }]);
  await t.Request.get('x');
  assert.ok(!('csrf' in t.Request) && !('getCsrfToken' in t.Request),
    'only hasCsrfToken() is public - the value must stay inside the module');
  const src = fs.readFileSync(FILE, 'utf8');
  assert.ok(!/console\.(log|info|warn|debug)/.test(src),
    'the wrapper must not log - a token could end up in the console');

  console.log('ALL REQUEST TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
