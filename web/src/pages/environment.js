/**
 * Environment Page
 * Displays all collected environment information in a clear, TV-readable
 * format with a plain-English description for each item.
 */

const ENV_DESCRIPTIONS = {
  'userAgent':           'Browser or app identifier string reported by the device.',
  'platform':            'Operating system platform (e.g. "Linux armv7l" on Tizen).',
  'language':            'Primary UI language configured on the device.',
  'languages':           'All accepted languages, in preference order.',
  'cookieEnabled':       'Whether cookie storage is permitted in this context.',
  'onLine':              'Whether the device currently has a network connection.',
  'hardwareConcurrency': 'Number of logical CPU cores available to the browser.',
  'deviceMemory':        'Approximate RAM in GB (rounded for privacy). May be unavailable.',
  'screenWidth':         'Total screen width in CSS pixels.',
  'screenHeight':        'Total screen height in CSS pixels.',
  'availWidth':          'Screen width available to web content (excluding OS chrome).',
  'availHeight':         'Screen height available to web content (excluding OS chrome).',
  'colorDepth':          'Bits used to represent each pixel\'s color.',
  'pixelDepth':          'Bits used per pixel in the screen\'s color buffer.',
  'orientationType':     'Current screen orientation (e.g. "landscape-primary").',
  'orientationAngle':    'Rotation angle of the screen in degrees.',
  'innerWidth':          'Width of the browser viewport in CSS pixels.',
  'innerHeight':         'Height of the browser viewport in CSS pixels.',
  'devicePixelRatio':    'Ratio of physical pixels to CSS pixels (e.g. 2 on HiDPI).',
  'connectionType':      'Network type reported by the device (e.g. "wifi", "cellular").',
  'effectiveType':       'Estimated effective connection speed (e.g. "4g", "3g").',
  'downlink':            'Estimated downlink bandwidth in Mbps.',
  'rtt':                 'Estimated round-trip latency in milliseconds.',
  'saveData':            'Whether the user has requested reduced data usage.',
  'tizenAvailable':      'Whether the Tizen API is present in this environment.',
  'tizenVersion':        'Platform version string reported by Tizen.',
  'webapisAvailable':    'Whether the Samsung WebAPIs object is present.',
};

function collectEnvData() {
  const nav = navigator;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  const ori = screen.orientation;

  let tizenAvailable = false;
  let tizenVersion = null;
  if (typeof window.tizen !== 'undefined') {
    tizenAvailable = true;
    try {
      tizenVersion = window.tizen.systeminfo
        ? window.tizen.systeminfo.getCapabilityValue('http://tizen.org/feature/platform.version')
        : null;
    } catch (_) {
      // getCapabilityValue may throw on restricted profiles
    }
  }

  return [
    { group: 'Browser / Navigator', items: [
      { key: 'userAgent',           label: 'User Agent',            value: nav.userAgent },
      { key: 'platform',            label: 'Platform',              value: nav.platform },
      { key: 'language',            label: 'Language',              value: nav.language },
      { key: 'languages',           label: 'Languages',             value: nav.languages ? Array.from(nav.languages).join(', ') : '(unavailable)' },
      { key: 'cookieEnabled',       label: 'Cookies Enabled',       value: nav.cookieEnabled },
      { key: 'onLine',              label: 'Online',                value: nav.onLine },
      { key: 'hardwareConcurrency', label: 'CPU Cores',             value: nav.hardwareConcurrency ?? '(unavailable)' },
      { key: 'deviceMemory',        label: 'Device Memory',         value: nav.deviceMemory != null ? nav.deviceMemory + ' GB' : '(unavailable)' },
    ]},
    { group: 'Display', items: [
      { key: 'screenWidth',      label: 'Screen Width',         value: screen.width + ' px' },
      { key: 'screenHeight',     label: 'Screen Height',        value: screen.height + ' px' },
      { key: 'availWidth',       label: 'Available Width',      value: screen.availWidth + ' px' },
      { key: 'availHeight',      label: 'Available Height',     value: screen.availHeight + ' px' },
      { key: 'colorDepth',       label: 'Color Depth',          value: screen.colorDepth + ' bits' },
      { key: 'pixelDepth',       label: 'Pixel Depth',          value: screen.pixelDepth + ' bits' },
      { key: 'orientationType',  label: 'Orientation Type',     value: ori ? ori.type : '(unavailable)' },
      { key: 'orientationAngle', label: 'Orientation Angle',    value: ori ? ori.angle + '°' : '(unavailable)' },
      { key: 'innerWidth',       label: 'Viewport Width',       value: window.innerWidth + ' px' },
      { key: 'innerHeight',      label: 'Viewport Height',      value: window.innerHeight + ' px' },
      { key: 'devicePixelRatio', label: 'Pixel Ratio (DPR)',    value: window.devicePixelRatio },
    ]},
    { group: 'Network', items: [
      { key: 'connectionType', label: 'Connection Type',   value: conn ? (conn.type || '(unavailable)') : '(API unavailable)' },
      { key: 'effectiveType',  label: 'Effective Type',    value: conn ? (conn.effectiveType || '(unavailable)') : '(API unavailable)' },
      { key: 'downlink',       label: 'Downlink Speed',    value: conn ? (conn.downlink != null ? conn.downlink + ' Mbps' : '(unavailable)') : '(API unavailable)' },
      { key: 'rtt',            label: 'Round-Trip Time',   value: conn ? (conn.rtt != null ? conn.rtt + ' ms' : '(unavailable)') : '(API unavailable)' },
      { key: 'saveData',       label: 'Save Data Mode',    value: conn ? conn.saveData : '(API unavailable)' },
    ]},
    { group: 'Tizen / Samsung', items: [
      { key: 'tizenAvailable',  label: 'Tizen API Present',    value: tizenAvailable },
      { key: 'tizenVersion',    label: 'Tizen Version',        value: tizenVersion ?? '(unavailable)' },
      { key: 'webapisAvailable',label: 'WebAPIs Present',      value: typeof window.webapis !== 'undefined' },
    ]},
  ];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderValue(val) {
  if (val === true)  return '<span class="hr-bool">Yes</span>';
  if (val === false) return '<span class="hr-bool env-false">No</span>';
  return `<span class="env-val">${escapeHtml(String(val))}</span>`;
}

export function renderEnvironment(container) {
  const groups = collectEnvData();

  let html = `
    <div class="card env-card">
      <h1>🌍 Environment</h1>
      <p class="info">Live snapshot of the device environment. Refresh the page to update values.</p>
  `;

  for (const { group, items } of groups) {
    html += `<h2>${escapeHtml(group)}</h2>`;
    html += `<table class="env-table" role="table">
      <thead><tr><th>Property</th><th>Value</th><th>Description</th></tr></thead>
      <tbody>`;
    for (const { key, label, value } of items) {
      const desc = ENV_DESCRIPTIONS[key] || '';
      html += `<tr>
        <td class="env-key">${escapeHtml(label)}</td>
        <td class="env-val-cell">${renderValue(value)}</td>
        <td class="env-desc">${escapeHtml(desc)}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}
