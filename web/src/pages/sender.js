import { createSession, postMessage } from '../api.js';
import { renderQR } from '../qr.js';

export function renderSender(container) {
  container.innerHTML = `
    <div class="card">
      <h1>🍺 BrewBridge</h1>
      <h2>Sender</h2>
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
    sendStatus.textContent = 'Sending…';
    try {
      const result = await postMessage(session.sessionId, session.writeKey, data);
      sendStatus.textContent = `✅ Sent (seq=${result.seq}, ts=${result.timestamp})`;
    } catch (err) {
      sendStatus.textContent = '❌ ' + err.message;
    } finally {
      sendBtn.disabled = false;
      testBtn.disabled = false;
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
}
