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
        <textarea id="jsonInput" placeholder='Paste JSON here…'></textarea>
        <br/>
        <button id="sendBtn">Send JSON</button>
        <button id="testBtn">Send Test Message</button>
        <button id="envBtn">Send Environment Info</button>
        <p class="info" id="sendStatus"></p>
      </div>
    </div>
  `;

  let session = null;

  const createBtn = container.querySelector('#createBtn');
  const sessionInfo = container.querySelector('#sessionInfo');
  const viewerUrlEl = container.querySelector('#viewerUrl');
  const qrCanvas = container.querySelector('#qrCanvas');
  const jsonInput = container.querySelector('#jsonInput');
  const sendBtn = container.querySelector('#sendBtn');
  const testBtn = container.querySelector('#testBtn');
  const envBtn = container.querySelector('#envBtn');
  const sendStatus = container.querySelector('#sendStatus');

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
    try {
      parsed = JSON.parse(jsonInput.value);
    } catch {
      sendStatus.textContent = '❌ Invalid JSON';
      return;
    }
    send(parsed);
  });

  testBtn.addEventListener('click', () => {
    // Build a fresh test message with the current timestamp each time
    const testMessage = {
      event: 'test',
      source: 'BrewBridge Sender',
      payload: { value: 42, unit: 'ibu', timestamp: new Date().toISOString() },
    };
    jsonInput.value = JSON.stringify(testMessage, null, 2);
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
    jsonInput.value = JSON.stringify(info, null, 2);
    send(info);
  });
}
