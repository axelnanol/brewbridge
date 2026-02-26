import { getMessages } from '../api.js';

const POLL_INTERVAL_MS = 2000;

export function renderViewer(container, params) {
  const sessionId = params.get('s');
  const readKey = params.get('r');

  if (!sessionId || !readKey) {
    container.innerHTML = `<div class="card"><h2>⚠️ Missing session parameters</h2>
      <p>Expected URL: <code>#/view?s=&lt;sessionId&gt;&r=&lt;readKey&gt;</code></p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="card">
      <h1>📺 Viewer</h1>
      <p class="info">Session: <code id="sessionIdDisplay"></code></p>
      <p class="info" id="pollStatus">Polling for messages…</p>
      <button id="downloadBtn" disabled>⬇ Download Latest JSON</button>
      <div id="messageList" style="margin-top:1rem;"></div>
    </div>
  `;
  // Set sessionId via textContent to prevent XSS from malicious URL params
  container.querySelector('#sessionIdDisplay').textContent = sessionId;

  const pollStatus = container.querySelector('#pollStatus');
  const messageList = container.querySelector('#messageList');
  const downloadBtn = container.querySelector('#downloadBtn');

  let since = 0;
  let latestMessage = null;
  let pollTimer = null;
  let active = true; // set to false when the view is unmounted

  downloadBtn.addEventListener('click', () => {
    if (!latestMessage) return;
    const blob = new Blob([JSON.stringify(latestMessage.body, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `brewbridge-${sessionId}-seq${latestMessage.seq}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  async function poll() {
    if (!active) return;
    try {
      const data = await getMessages(sessionId, readKey, since);
      if (data.messages && data.messages.length > 0) {
        for (const msg of data.messages) {
          appendMessage(msg);
          latestMessage = msg;
        }
        since = data.nextSince ?? since;
        downloadBtn.disabled = false;
      }
      pollStatus.textContent = `Last checked: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
      pollStatus.textContent = `⚠️ Error: ${err.message}`;
    }
    if (active) {
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    }
  }

  function appendMessage(msg) {
    const div = document.createElement('div');
    div.className = 'message-item';
    // Use Number() to ensure seq is a safe integer, never an arbitrary string from the API
    const safeSeq = Number(msg.seq);
    div.innerHTML = `
      <div class="message-meta">seq=${safeSeq} &bull; ${escapeHtml(new Date(msg.timestamp).toLocaleString())}</div>
      <pre>${escapeHtml(JSON.stringify(msg.body, null, 2))}</pre>
    `;
    // Prepend so newest messages appear at the top
    messageList.insertBefore(div, messageList.firstChild);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Stop polling when the user navigates away (hash changes trigger a re-render)
  function cleanup() {
    active = false;
    clearTimeout(pollTimer);
    window.removeEventListener('hashchange', cleanup);
  }
  window.addEventListener('hashchange', cleanup);

  poll();
}
