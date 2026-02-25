import { SessionDO } from './session.js';

export { SessionDO };

/** Generate a random hex string of the given byte length (result is 2x chars) */
function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Determine the CORS origin to reflect.
 * If ALLOWED_ORIGINS env var is set, only reflect origins in that list.
 * Otherwise default to "*" (open – suitable for development).
 */
function getCorsOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

  if (allowed.length === 0) {
    // Dev fallback: allow all origins
    return '*';
  }
  if (allowed.includes(origin)) {
    return origin;
  }
  return null; // origin not allowed
}

function corsHeaders(request, env) {
  const origin = getCorsOrigin(request, env);
  if (!origin) {
    // Origin is not allowed; omit Allow-Origin so browsers block the request.
    // Include Vary so intermediate caches don't serve this to allowed origins.
    return { Vary: 'Origin' };
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Route: POST /v1/sessions
    if (request.method === 'POST' && url.pathname === '/v1/sessions') {
      const sessionId = randomHex(4);  // 8 hex chars
      const writeKey = randomHex(8);   // 16 hex chars
      const readKey = randomHex(8);    // 16 hex chars

      // Get (or create) the Durable Object stub for this session
      const id = env.SESSIONS.idFromName(sessionId);
      const stub = env.SESSIONS.get(id);

      // Initialise the DO with the generated keys
      const initRes = await stub.fetch(new Request('http://do/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ writeKey, readKey }),
      }));
      if (!initRes.ok) {
        return jsonResponse({ error: 'Failed to initialize session' }, 500, cors);
      }

      return jsonResponse({ sessionId, writeKey, readKey, expiresInSeconds: 600 }, 201, cors);
    }

    // Route: POST /v1/sessions/:id/messages?w=<writeKey>
    const postMsgMatch = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/messages$/);
    if (request.method === 'POST' && postMsgMatch) {
      const sessionId = postMsgMatch[1];
      const id = env.SESSIONS.idFromName(sessionId);
      const stub = env.SESSIONS.get(id);

      const doUrl = new URL('http://do/messages');
      doUrl.searchParams.set('w', url.searchParams.get('w') || '');

      const doReq = new Request(doUrl.toString(), {
        method: 'POST',
        headers: request.headers,
        body: request.body,
      });
      const doRes = await stub.fetch(doReq);
      const data = await doRes.json();
      return jsonResponse(data, doRes.status, cors);
    }

    // Route: GET /v1/sessions/:id/messages?r=<readKey>&since=<seq>
    const getMsgMatch = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/messages$/);
    if (request.method === 'GET' && getMsgMatch) {
      const sessionId = getMsgMatch[1];
      const id = env.SESSIONS.idFromName(sessionId);
      const stub = env.SESSIONS.get(id);

      const doUrl = new URL('http://do/messages');
      doUrl.searchParams.set('r', url.searchParams.get('r') || '');
      doUrl.searchParams.set('since', url.searchParams.get('since') || '0');

      const doRes = await stub.fetch(new Request(doUrl.toString(), { method: 'GET' }));
      const data = await doRes.json();
      return jsonResponse(data, doRes.status, cors);
    }

    return jsonResponse({ error: 'Not found' }, 404, cors);
  },
};
