// Save-and-load service for the private Cloudflare copy (ASTRO-128).
// Runs as a Cloudflare Pages Function at /api/state. The public GitHub Pages copy has no such service.
//
// GET  /api/state  -> { savedAt, data }   (both null when nothing is saved yet)
// PUT  /api/state  body { savedAt, data } -> 200 { savedAt }   saved
//                                          -> 409 { savedAt, data, conflict: true }   an equal or newer save is already
//                                             stored; the stored copy is returned and nothing is overwritten
//
// `data` is the same set of keys a backup file holds: every lt_* and confirmed_* key, as strings.
//
// Settings (Pages project -> Settings -> Variables), never in the code:
//   ALLOWED_EMAIL       the one email allowed to save and load
//   ACCESS_TEAM_DOMAIN  e.g. https://example.cloudflareaccess.com
//   ACCESS_AUD          the Access application's AUD tag; several may be given, separated by commas
//   KEY_PREFIX          optional; lets preview deployments use their own storage key
// Binding: LOAN_STATE, a Workers KV namespace.

const MAX_BYTES = 1024 * 1024; // a real backup is a few tens of KB
const KEY_RE = /^(lt_|confirmed_)/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

// Checks the Cf-Access-Jwt-Assertion token as Cloudflare's docs describe: RS256 signature by the key the token names,
// issuer is our team domain, audience is our application, and it is inside its valid time window.
// Returns the signed-in email, or null.
export async function verifyAccessToken(token, env, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header, payload;
  try { header = b64urlJson(parts[0]); payload = b64urlJson(parts[1]); } catch { return null; }
  if (header.alg !== 'RS256' || !header.kid) return null;
  const team = String(env.ACCESS_TEAM_DOMAIN || '').replace(/\/+$/, '');
  const auds = String(env.ACCESS_AUD || '').split(',').map((a) => a.trim()).filter(Boolean);
  if (!team || !auds.length) return null;
  if (payload.iss !== team) return null;
  const tokenAuds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!tokenAuds.some((a) => auds.includes(a))) return null;
  const sec = Math.floor(now / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= sec) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > sec + 60) return null;
  let certs;
  try { certs = await (await fetchImpl(team + '/cdn-cgi/access/certs')).json(); } catch { return null; }
  const jwk = (certs.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]),
      new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) return null;
  } catch { return null; }
  return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
}

function validData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const keys = Object.keys(data);
  if (!keys.length || !('lt_loans' in data)) return false;
  return keys.every((k) => KEY_RE.test(k) && typeof data[k] === 'string');
}

export async function handle(request, env, deps = {}) {
  const verify = deps.verify || ((t) => verifyAccessToken(t, env, deps));
  const allowed = String(env.ALLOWED_EMAIL || '').trim().toLowerCase();
  const email = await verify(request.headers.get('Cf-Access-Jwt-Assertion'));
  if (!allowed || !email || email !== allowed) return json({ error: 'forbidden' }, 403);
  if (!env.LOAN_STATE) return json({ error: 'storage not configured' }, 500);
  const key = (env.KEY_PREFIX || '') + 'state:' + email;
  const stored = await env.LOAN_STATE.get(key, 'json');

  if (request.method === 'GET') return json(stored || { savedAt: null, data: null });

  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_BYTES) return json({ error: 'too large' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'not JSON' }, 400); }
    const savedAt = body && body.savedAt;
    if (typeof savedAt !== 'string' || isNaN(Date.parse(savedAt))) return json({ error: 'savedAt must be a date' }, 400);
    if (!validData(body.data)) return json({ error: 'data must hold lt_ and confirmed_ keys as text, including lt_loans' }, 400);
    if (stored && stored.savedAt && Date.parse(stored.savedAt) >= Date.parse(savedAt)) {
      return json({ ...stored, conflict: true }, 409);
    }
    await env.LOAN_STATE.put(key, JSON.stringify({ savedAt, data: body.data }));
    return json({ savedAt });
  }

  return json({ error: 'method not allowed' }, 405);
}

export const onRequest = (context) => handle(context.request, context.env);
