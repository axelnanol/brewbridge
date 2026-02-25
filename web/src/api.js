const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');

/** Create a new session. Returns { sessionId, writeKey, readKey, expiresInSeconds } */
export async function createSession() {
  const res = await fetch(`${BASE_URL}/v1/sessions`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  return res.json();
}

/** Post a message to a session. Returns { seq, timestamp } */
export async function postMessage(sessionId, writeKey, body) {
  const res = await fetch(`${BASE_URL}/v1/sessions/${sessionId}/messages?w=${writeKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send message (${res.status}): ${text}`);
  }
  return res.json();
}

/** Poll messages since a given sequence number. Returns { messages, nextSince } */
export async function getMessages(sessionId, readKey, since = 0) {
  const res = await fetch(
    `${BASE_URL}/v1/sessions/${sessionId}/messages?r=${readKey}&since=${since}`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch messages (${res.status}): ${text}`);
  }
  return res.json();
}
