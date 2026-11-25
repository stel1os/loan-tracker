// Tests for the private copy's save-and-load service (functions/api/state.js, ASTRO-128).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, verifyAccessToken } from '../functions/api/state.js';

const TEAM = 'https://example-team.cloudflareaccess.com';
const AUD = 'aud-main';
const OWNER = 'owner@example.com';

function memoryKV() {
  const m = new Map();
  return {
    m,
    async get(k, type) { const v = m.get(k); return v == null ? null : (type === 'json' ? JSON.parse(v) : v); },
    async put(k, v) { m.set(k, v); },
  };
}
const env = (kv, extra = {}) => ({ ALLOWED_EMAIL: OWNER, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, LOAN_STATE: kv, ...extra });
const req = (method, body, token = 'tok') => new Request('https://x/api/state', {
  method, headers: { 'Cf-Access-Jwt-Assertion': token }, body: body === undefined ? undefined : JSON.stringify(body),
});
const asOwner = { verify: async () => OWNER };
const data = { lt_loans: '[{"id":0,"balance":95000}]', lt_budget_0: '1000', confirmed_0_act: '{}' };

test('save and load: a save is returned by the next load', async () => {
  const kv = memoryKV();
  let r = await handle(req('GET'), env(kv), asOwner);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { savedAt: null, data: null });
  r = await handle(req('PUT', { savedAt: '2026-11-25T10:00:00.000Z', data }), env(kv), asOwner);
  assert.equal(r.status, 200);
  r = await handle(req('GET'), env(kv), asOwner);
  assert.deepEqual(await r.json(), { savedAt: '2026-11-25T10:00:00.000Z', data });
  assert.deepEqual([...kv.m.keys()], ['state:' + OWNER]);
});

test('a stranger, a missing sign-in and a missing setting are all refused', async () => {
  const kv = memoryKV();
  for (const deps of [{ verify: async () => 'someone@else.com' }, { verify: async () => null }]) {
    const r = await handle(req('PUT', { savedAt: '2026-11-25T10:00:00.000Z', data }), env(kv), deps);
    assert.equal(r.status, 403);
  }
  const r = await handle(req('GET'), env(kv, { ALLOWED_EMAIL: '' }), asOwner);
  assert.equal(r.status, 403);
  assert.equal(kv.m.size, 0);
});

test('an older save is refused and the stored, newer copy comes back', async () => {
  const kv = memoryKV();
  const newer = { ...data, lt_budget_0: '1500' };
  await handle(req('PUT', { savedAt: '2026-11-25T12:00:00.000Z', data: newer }), env(kv), asOwner);
  const r = await handle(req('PUT', { savedAt: '2026-11-25T11:00:00.000Z', data }), env(kv), asOwner);
  assert.equal(r.status, 409);
  const body = await r.json();
  assert.equal(body.conflict, true);
  assert.equal(body.data.lt_budget_0, '1500');
  const same = await handle(req('PUT', { savedAt: '2026-11-25T12:00:00.000Z', data }), env(kv), asOwner);
  assert.equal(same.status, 409, 'a save with the same time does not overwrite either');
  assert.equal(JSON.parse(kv.m.get('state:' + OWNER)).data.lt_budget_0, '1500');
});

test('bad bodies are refused and nothing is stored', async () => {
  const kv = memoryKV();
  const bad = [
    { savedAt: 'not a date', data },
    { savedAt: '2026-11-25T10:00:00.000Z', data: { other_key: 'x', lt_loans: '[]' } },
    { savedAt: '2026-11-25T10:00:00.000Z', data: { lt_loans: 123 } },
    { savedAt: '2026-11-25T10:00:00.000Z', data: { lt_budget_0: '1000' } },
    { savedAt: '2026-11-25T10:00:00.000Z', data: [] },
    { savedAt: '2026-11-25T10:00:00.000Z', data: null },
  ];
  for (const b of bad) assert.equal((await handle(req('PUT', b), env(kv), asOwner)).status, 400, JSON.stringify(b));
  const big = { savedAt: '2026-11-25T10:00:00.000Z', data: { lt_loans: 'x'.repeat(1024 * 1024 + 10) } };
  assert.equal((await handle(req('PUT', big), env(kv), asOwner)).status, 413);
  assert.equal((await handle(req('DELETE'), env(kv), asOwner)).status, 405);
  assert.equal(kv.m.size, 0);
});

test('preview deployments can use their own storage key', async () => {
  const kv = memoryKV();
  await handle(req('PUT', { savedAt: '2026-11-25T10:00:00.000Z', data }), env(kv, { KEY_PREFIX: 'preview:' }), asOwner);
  assert.deepEqual([...kv.m.keys()], ['preview:state:' + OWNER]);
});

// ---- Sign-in token checks, with a key pair made for the test ----
const b64url = (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function makeSigner() {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const sign = async (payload, kid = 'k1') => {
    const h = b64url(Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })));
    const p = b64url(Buffer.from(JSON.stringify(payload)));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(h + '.' + p));
    return h + '.' + p + '.' + b64url(new Uint8Array(sig));
  };
  const fetchImpl = async (url) => { assert.equal(url, TEAM + '/cdn-cgi/access/certs'); return { json: async () => ({ keys: [{ ...pub, kid: 'k1' }] }) }; };
  return { sign, fetchImpl };
}
const NOW = Date.parse('2026-11-25T10:00:00Z');
const good = { iss: TEAM, aud: [AUD], email: 'Owner@Example.com', exp: NOW / 1000 + 600, nbf: NOW / 1000 - 10 };

test('a genuine Access token gives the signed-in email', async () => {
  const { sign, fetchImpl } = await makeSigner();
  assert.equal(await verifyAccessToken(await sign(good), env(null), { fetchImpl, now: NOW }), 'owner@example.com');
});

test('tokens are refused for the wrong app, wrong team, expiry, unknown key, or a changed payload', async () => {
  const { sign, fetchImpl } = await makeSigner();
  const opts = { fetchImpl, now: NOW };
  assert.equal(await verifyAccessToken(await sign({ ...good, aud: ['other-app'] }), env(null), opts), null);
  assert.equal(await verifyAccessToken(await sign({ ...good, iss: 'https://evil.cloudflareaccess.com' }), env(null), opts), null);
  assert.equal(await verifyAccessToken(await sign({ ...good, exp: NOW / 1000 - 1 }), env(null), opts), null);
  assert.equal(await verifyAccessToken(await sign(good, 'unknown-kid'), env(null), opts), null);
  const t = (await sign(good)).split('.');
  const forged = t[0] + '.' + b64url(Buffer.from(JSON.stringify({ ...good, email: 'attacker@x.com' }))) + '.' + t[2];
  assert.equal(await verifyAccessToken(forged, env(null), opts), null);
  assert.equal(await verifyAccessToken('', env(null), opts), null);
  assert.equal(await verifyAccessToken('a.b', env(null), opts), null);
});

test('the full path: a genuine token for the owner can save; the same token for a stranger cannot', async () => {
  const { sign, fetchImpl } = await makeSigner();
  const kv = memoryKV();
  const ok = await handle(req('PUT', { savedAt: '2026-11-25T10:00:00.000Z', data }, await sign(good)), env(kv), { fetchImpl, now: NOW });
  assert.equal(ok.status, 200);
  const no = await handle(req('GET', undefined, await sign({ ...good, email: 'stranger@x.com' })), env(kv), { fetchImpl, now: NOW });
  assert.equal(no.status, 403);
});

test('an empty save (after a Reset) is stored, so the reset reaches the online copy', async () => {
  const kv = memoryKV();
  await handle(req('PUT', { savedAt: '2026-11-25T10:00:00.000Z', data }), env(kv), asOwner);
  const r = await handle(req('PUT', { savedAt: '2026-11-25T11:00:00.000Z', data: {} }), env(kv), asOwner);
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse(kv.m.get('state:' + OWNER)).data, {});
});
