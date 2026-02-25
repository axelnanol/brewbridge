const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_MESSAGES = 60;
const MAX_BODY_BYTES = 64 * 1024; // 64 KB

export class SessionDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'POST' && url.pathname === '/init') {
      return this.handleInit(request);
    }
    if (method === 'POST' && url.pathname === '/messages') {
      return this.handlePostMessage(request, url);
    }
    if (method === 'GET' && url.pathname === '/messages') {
      return this.handleGetMessages(request, url);
    }

    return new Response('Not found', { status: 404 });
  }

  async handleInit(request) {
    const { writeKey, readKey } = await request.json();
    const existing = await this.state.storage.get('session');
    if (existing) {
      // Already initialised (idempotent)
      return Response.json({ ok: true });
    }
    const session = {
      writeKey,
      readKey,
      messages: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    await this.state.storage.put('session', session);
    return Response.json({ ok: true });
  }

  async handlePostMessage(request, url) {
    const session = await this.state.storage.get('session');
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    if (this.isExpired(session)) return Response.json({ error: 'Session expired' }, { status: 410 });

    const writeKey = url.searchParams.get('w');
    if (writeKey !== session.writeKey) {
      return Response.json({ error: 'Invalid write key' }, { status: 403 });
    }

    // Enforce body size limit
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
      return Response.json({ error: 'Payload too large' }, { status: 413 });
    }

    if (session.messages.length >= MAX_MESSAGES) {
      return Response.json({ error: 'Message limit reached' }, { status: 429 });
    }

    let body;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) {
        return Response.json({ error: 'Payload too large' }, { status: 413 });
      }
      body = JSON.parse(text);
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const seq = session.messages.length + 1;
    const timestamp = new Date().toISOString();
    session.messages.push({ seq, body, timestamp });
    session.lastActivity = Date.now();

    await this.state.storage.put('session', session);
    return Response.json({ seq, timestamp });
  }

  async handleGetMessages(request, url) {
    const session = await this.state.storage.get('session');
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    if (this.isExpired(session)) return Response.json({ error: 'Session expired' }, { status: 410 });

    const readKey = url.searchParams.get('r');
    if (readKey !== session.readKey) {
      return Response.json({ error: 'Invalid read key' }, { status: 403 });
    }

    const since = parseInt(url.searchParams.get('since') || '0', 10);
    const messages = session.messages.filter((m) => m.seq > since);
    const nextSince = messages.length > 0 ? messages[messages.length - 1].seq : since;

    session.lastActivity = Date.now();
    await this.state.storage.put('session', session);

    return Response.json({ messages, nextSince });
  }

  isExpired(session) {
    return Date.now() - session.lastActivity > SESSION_TTL_MS;
  }
}
