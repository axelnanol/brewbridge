import { createSession, postMessage } from '../api.js';
import { renderQR } from '../qr.js';

export function renderSender(container) {
  container.innerHTML = `
    <div class="card">
      <h1>📤 Sender</h1>
      <button id="createBtn">Create New Session</button>
      <div id="sessionInfo" style="display:none">
        <p class="info">Viewer URL (share this):</p>
        <div class="url-box" id="viewerUrl"></div>
        <canvas id="qrCanvas" style="display:block;margin:0.5rem 0;"></canvas>
        <hr/>
        <h3>Send a Message</h3>
        <div class="view-controls">
          <label class="toggle-label">
            <input type="checkbox" id="inputToggle" role="switch" aria-checked="false" />
            <span id="inputToggleText">Mode: Text</span>
          </label>
        </div>
        <p class="info" id="inputHint">Enter key: value pairs (one per line). Indent with spaces to nest.</p>
        <textarea id="msgInput" placeholder="event: brew_update&#10;payload:&#10;  temperature: 68.5&#10;  gravity: 1.048"></textarea>
        <br/>
        <button id="sendBtn">Send</button>
        <button id="testBtn">Send Test Message</button>
        <button id="envBtn">Send Environment Info</button>
        <p class="info" id="sendStatus"></p>
      </div>
    </div>
  `;

  let session = null;
  let useTextMode = true; // true = text input mode, false = JSON mode

  const createBtn = container.querySelector('#createBtn');
  const sessionInfo = container.querySelector('#sessionInfo');
  const viewerUrlEl = container.querySelector('#viewerUrl');
  const qrCanvas = container.querySelector('#qrCanvas');
  const msgInput = container.querySelector('#msgInput');
  const sendBtn = container.querySelector('#sendBtn');
  const testBtn = container.querySelector('#testBtn');
  const envBtn = container.querySelector('#envBtn');
  const sendStatus = container.querySelector('#sendStatus');
  const inputToggle = container.querySelector('#inputToggle');
  const inputToggleText = container.querySelector('#inputToggleText');
  const inputHint = container.querySelector('#inputHint');

  function updateInputMode() {
    if (useTextMode) {
      inputToggleText.textContent = 'Mode: Text';
      inputToggle.setAttribute('aria-checked', 'false');
      inputHint.textContent = 'Enter key: value pairs (one per line). Indent with spaces to nest.';
      msgInput.placeholder = 'event: brew_update\npayload:\n  temperature: 68.5\n  gravity: 1.048';
      msgInput.style.fontFamily = "'Segoe UI', Arial, sans-serif";
    } else {
      inputToggleText.textContent = 'Mode: JSON';
      inputToggle.setAttribute('aria-checked', 'true');
      inputHint.textContent = 'Paste or type valid JSON here.';
      msgInput.placeholder = '{"event":"brew_update","payload":{"temperature":68.5}}';
      msgInput.style.fontFamily = "'Courier New', monospace";
    }
  }

  function toggleInputMode() {
    useTextMode = !useTextMode;
    inputToggle.checked = !useTextMode;
    updateInputMode();
  }

  inputToggle.addEventListener('change', () => {
    useTextMode = !inputToggle.checked;
    updateInputMode();
  });

  // Expose toggle for Yellow remote button
  window.__bbPageToggle = toggleInputMode;

  updateInputMode();

  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    createBtn.textContent = 'Creating…';
    try {
      session = await createSession();
      const base = window.location.href.split('#')[0];
      const viewerUrl = `${base}#/view?s=${encodeURIComponent(session.sessionId)}&r=${encodeURIComponent(session.readKey)}`;
      viewerUrlEl.textContent = viewerUrl;
      await renderQR(qrCanvas, viewerUrl);
      sessionInfo.style.display = 'block';
      createBtn.textContent = 'Create New Session';
      createBtn.disabled = false;
    } catch (err) {
      alert('Error creating session: ' + err.message);
      createBtn.textContent = 'Create New Session';
      createBtn.disabled = false;
    }
  });

  async function send(data) {
    if (!session) return;
    sendBtn.disabled = true;
    testBtn.disabled = true;
    envBtn.disabled = true;
    sendStatus.textContent = 'Sending…';
    try {
      const result = await postMessage(session.sessionId, session.writeKey, data);
      sendStatus.textContent = `✅ Sent (seq=${result.seq}, ts=${result.timestamp})`;
    } catch (err) {
      sendStatus.textContent = '❌ ' + err.message;
    } finally {
      sendBtn.disabled = false;
      testBtn.disabled = false;
      envBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', () => {
    let parsed;
    const raw = msgInput.value.trim();
    if (!raw) {
      sendStatus.textContent = '❌ Nothing to send';
      return;
    }
    if (useTextMode) {
      try {
        parsed = parseTextToJSON(raw);
      } catch (err) {
        sendStatus.textContent = '❌ Parse error: ' + err.message;
        return;
      }
    } else {
      try {
        parsed = JSON.parse(raw);
      } catch {
        sendStatus.textContent = '❌ Invalid JSON';
        return;
      }
    }
    send(parsed);
  });

  testBtn.addEventListener('click', () => {
    const testMessage = {
      event: 'test',
      source: 'BrewBridge Sender',
      payload: { value: 42, unit: 'ibu', timestamp: new Date().toISOString() },
    };
    msgInput.value = useTextMode
      ? jsonToText(testMessage)
      : JSON.stringify(testMessage, null, 2);
    send(testMessage);
  });

  function buildEnvironmentInfo() {
    const nav = navigator;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    const info = {
      event: 'env_info',
      source: 'BrewBridge Sender',
      timestamp: new Date().toISOString(),
      navigator: {
        userAgent: nav.userAgent,
        platform: nav.platform,
        language: nav.language,
        languages: nav.languages ? Array.from(nav.languages) : undefined,
        cookieEnabled: nav.cookieEnabled,
        onLine: nav.onLine,
        hardwareConcurrency: nav.hardwareConcurrency,
        deviceMemory: nav.deviceMemory,
      },
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        orientation: screen.orientation
          ? { type: screen.orientation.type, angle: screen.orientation.angle }
          : undefined,
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      connection: conn
        ? {
            type: conn.type,
            effectiveType: conn.effectiveType,
            downlink: conn.downlink,
            rtt: conn.rtt,
            saveData: conn.saveData,
          }
        : undefined,
      tizen: (function () {
        if (typeof window.tizen === 'undefined') return { available: false };
        const t = { available: true };
        try {
          t.version = window.tizen.systeminfo
            ? window.tizen.systeminfo.getCapabilityValue('http://tizen.org/feature/platform.version')
            : undefined;
        } catch (_) {
          // getCapabilityValue may throw on restricted profiles; leave version undefined
        }
        return t;
      }()),
      webapis: typeof window.webapis !== 'undefined'
        ? { available: true }
        : { available: false },
    };
    return info;
  }

  envBtn.addEventListener('click', () => {
    const info = buildEnvironmentInfo();
    msgInput.value = useTextMode
      ? jsonToText(info)
      : JSON.stringify(info, null, 2);
    send(info);
  });
}

// ── Text ↔ JSON conversion ────────────────────────────────────

/**
 * Parse an indented key:value text format into a JSON object.
 * Rules:
 *   - Lines are "key: value" pairs; value may be empty (nested object follows).
 *   - Indented lines (leading spaces) are children of the most-recent shallower key.
 *   - Numbers, booleans, and null are auto-coerced; everything else is a string.
 *   - If no key:value pattern is found, wraps input as { message: "..." }.
 */
export function parseTextToJSON(text) {
  const lines = text.split('\n');
  const hasKeyValue = lines.some(l => l.trim() && l.includes(':'));
  if (!hasKeyValue) {
    return { message: text.trim() };
  }

  // Stack entries: { indent, key, obj, parent }
  const root = {};
  const stack = [{ indent: -1, obj: root }];

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawVal = line.slice(colonIdx + 1).trim();

    // Pop stack to find the right parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    if (!rawVal) {
      // No value — this key will own indented children
      const child = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
    } else {
      parent[key] = coerceValue(rawVal);
    }
  }

  return root;
}

function coerceValue(str) {
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === 'null') return null;
  const trimmed = str.trim();
  const num = Number(trimmed);
  if (trimmed !== '' && !isNaN(num)) return num;
  return str;
}

/**
 * Convert a JSON object to the indented key:value text format.
 * Useful for pre-filling the text-mode textarea with structured data.
 */
export function jsonToText(data, indent) {
  const pad = indent === undefined ? '' : ' '.repeat(indent);
  if (data === null) return 'null';
  if (typeof data !== 'object' || Array.isArray(data)) return String(data);
  return Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const nested = jsonToText(v, (indent || 0) + 2);
        return `${pad}${k}:\n${nested}`;
      }
      return `${pad}${k}: ${v === null ? 'null' : String(v)}`;
    })
    .join('\n');
}
