import { getMessages } from '../api.js';

const POLL_INTERVAL_MS = 2000;
const MIN_TABLE_ROWS = 2;
const MAX_TABLE_COLUMNS = 10;

export function renderViewer(container, params) {
  const sessionId = params.get('s');
  const readKey = params.get('r');

  if (!sessionId || !readKey) {
    container.innerHTML = `<div class="card">
      <h2>📺 Viewer</h2>
      <p>No active viewing session was found.</p>
      <p class="info">
        To use the Viewer, open the <strong>Sender</strong> page, create a session,
        then scan the QR code or follow the link it generates.
        The link includes a session ID and read key that are needed here.
      </p>
      <p class="info">
        If you arrived here by manually typing the address, make sure the URL
        contains both a session ID (<code>s=…</code>) and a read key (<code>r=…</code>).
      </p>
      <a class="nav-link" href="#/send" style="display:inline-block;margin-top:1rem;">Go to Sender →</a>
    </div>`;
    return;
  }

  container.innerHTML = `
    <div class="card">
      <h1>📺 Viewer</h1>
      <p class="info">Session: <code id="sessionIdDisplay"></code></p>
      <p class="info" id="pollStatus">Polling for messages…</p>
      <div class="view-controls">
        <button id="downloadBtn" disabled>⬇ Download Latest JSON</button>
        <button id="clearBtn">🗑 Clear Messages</button>
        <label class="toggle-label">
          <input type="checkbox" id="viewToggle" role="switch" aria-checked="false" />
          <span id="viewToggleText">Show: JSON</span>
        </label>
      </div>
      <div id="messageList" style="margin-top:1rem;"></div>
    </div>
  `;
  container.querySelector('#sessionIdDisplay').textContent = sessionId;

  const pollStatus = container.querySelector('#pollStatus');
  const messageList = container.querySelector('#messageList');
  const downloadBtn = container.querySelector('#downloadBtn');
  const clearBtn = container.querySelector('#clearBtn');
  const viewToggle = container.querySelector('#viewToggle');
  const viewToggleText = container.querySelector('#viewToggleText');

  let since = 0;
  let latestMessage = null;
  let pollTimer = null;
  let active = true;
  let showHuman = false;

  // Rendered messages cache for re-rendering on toggle
  const renderedMessages = [];

  function updateToggleLabel() {
    viewToggleText.textContent = showHuman ? 'Show: Human Readable' : 'Show: JSON';
    viewToggle.setAttribute('aria-checked', String(showHuman));
  }

  function reRenderMessages() {
    renderedMessages.forEach(({ div, msg }) => {
      const bodyEl = div.querySelector('.message-body');
      if (bodyEl) bodyEl.innerHTML = showHuman ? renderHuman(msg.body, 0) : renderJSON(msg.body);
    });
  }

  function toggleViewMode() {
    showHuman = !showHuman;
    viewToggle.checked = showHuman;
    updateToggleLabel();
    reRenderMessages();
  }

  viewToggle.addEventListener('change', () => {
    showHuman = viewToggle.checked;
    updateToggleLabel();
    reRenderMessages();
  });

  // Expose toggle for Yellow remote button
  window.__bbPageToggle = toggleViewMode;

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

  clearBtn.addEventListener('click', () => {
    messageList.innerHTML = '';
    renderedMessages.length = 0;
    latestMessage = null;
    downloadBtn.disabled = true;
    pollStatus.textContent = 'Messages cleared. Polling for new messages…';
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
    const safeSeq = Number(msg.seq);
    const bodyHtml = showHuman ? renderHuman(msg.body, 0) : renderJSON(msg.body);
    div.innerHTML = `
      <div class="message-meta">seq=${safeSeq} &bull; ${escapeHtml(new Date(msg.timestamp).toLocaleString())}</div>
      <div class="message-body">${bodyHtml}</div>
    `;
    renderedMessages.unshift({ div, msg });
    messageList.insertBefore(div, messageList.firstChild);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderJSON(body) {
    return `<pre>${escapeHtml(JSON.stringify(body, null, 2))}</pre>`;
  }

  // ── Human-readable renderer ───────────────────────────────────
  function renderHuman(data, depth) {
    if (data === null) return '<span class="hr-null">null</span>';
    if (data === undefined) return '';
    if (typeof data === 'boolean') {
      return `<span class="hr-bool">${data ? 'Yes' : 'No'}</span>`;
    }
    if (typeof data === 'number') {
      return `<span class="hr-num">${escapeHtml(String(data))}</span>`;
    }
    if (typeof data === 'string') {
      return `<span class="hr-str">${escapeHtml(data)}</span>`;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) return '<em class="hr-empty">(empty list)</em>';
      // Array of plain objects with consistent keys → table
      const allObjects = data.every(
        item => item !== null && typeof item === 'object' && !Array.isArray(item)
      );
      if (allObjects && data.length >= MIN_TABLE_ROWS) {
        const allKeys = [...new Set(data.flatMap(item => Object.keys(item)))];
        if (allKeys.length > 0 && allKeys.length <= MAX_TABLE_COLUMNS) {
          let html = '<table class="hr-table"><thead><tr>';
          allKeys.forEach(k => { html += `<th>${escapeHtml(k)}</th>`; });
          html += '</tr></thead><tbody>';
          data.forEach(row => {
            html += '<tr>';
            allKeys.forEach(k => {
              html += `<td>${row[k] !== undefined ? renderHuman(row[k], depth + 1) : ''}</td>`;
            });
            html += '</tr>';
          });
          html += '</tbody></table>';
          return html;
        }
      }
      // Array of primitives or irregular objects → bullet list
      let html = '<ul class="hr-list">';
      data.forEach(item => { html += `<li>${renderHuman(item, depth + 1)}</li>`; });
      html += '</ul>';
      return html;
    }

    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return '<em class="hr-empty">(empty)</em>';

      if (depth === 0) {
        // Top-level object: definition list
        let html = '<dl class="hr-dl">';
        keys.forEach(k => {
          const val = data[k];
          html += `<dt>${escapeHtml(k)}</dt><dd>${renderHuman(val, depth + 1)}</dd>`;
        });
        html += '</dl>';
        return html;
      }
      // Nested object: compact inline table
      let html = '<table class="hr-table hr-nested"><tbody>';
      keys.forEach(k => {
        html += `<tr><td class="hr-key">${escapeHtml(k)}</td><td>${renderHuman(data[k], depth + 1)}</td></tr>`;
      });
      html += '</tbody></table>';
      return html;
    }

    return escapeHtml(String(data));
  }

  function cleanup() {
    active = false;
    clearTimeout(pollTimer);
    window.__bbPageToggle = null;
    window.removeEventListener('hashchange', cleanup);
  }
  window.addEventListener('hashchange', cleanup);

  poll();
}
