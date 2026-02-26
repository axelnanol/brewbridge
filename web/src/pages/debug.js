/**
 * Debug Page
 * Collects and displays every piece of information that can be gathered
 * from the current Tizen OS / browser environment.  Intentionally verbose.
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Safely read a property, returning a fallback string on any error. */
function safe(fn, fallback = '(error)') {
  try {
    const v = fn();
    if (v === undefined) return '(undefined)';
    if (v === null)      return 'null';
    return v;
  } catch (e) {
    return `(error: ${e && e.message ? e.message : String(e)})`;
  }
}

/** Convert any value to a display string. */
function display(v) {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch (_) { return '[object]'; }
  }
  return String(v);
}

/** Render a single key/value row. */
function row(key, value) {
  const valStr = display(value);
  return `<tr>
    <td class="dbg-key">${escapeHtml(key)}</td>
    <td class="dbg-val">${escapeHtml(valStr)}</td>
  </tr>`;
}

/** Render a section with a heading and a rows table. */
function section(title, rows) {
  if (!rows.length) return '';
  return `
    <h2>${escapeHtml(title)}</h2>
    <table class="dbg-table" role="table">
      <thead><tr><th>Key</th><th>Value</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;
}

// ── Individual data collectors ───────────────────────────────

function collectNavigator() {
  const nav = navigator;
  const keys = [
    'appCodeName','appName','appVersion','buildID','cookieEnabled',
    'deviceMemory','doNotTrack','hardwareConcurrency','language',
    'maxTouchPoints','onLine','oscpu','pdfViewerEnabled','platform',
    'product','productSub','userAgent','vendor','vendorSub','webdriver',
  ];
  const rows = keys.map(k => row(k, safe(() => nav[k])));
  if (nav.languages) rows.push(row('languages', safe(() => Array.from(nav.languages))));
  if (nav.userAgentData) {
    rows.push(row('userAgentData.brands',   safe(() => nav.userAgentData.brands)));
    rows.push(row('userAgentData.mobile',   safe(() => nav.userAgentData.mobile)));
    rows.push(row('userAgentData.platform', safe(() => nav.userAgentData.platform)));
  }
  return rows;
}

function collectScreen() {
  const s = screen;
  const rows = [
    'width','height','availWidth','availHeight',
    'colorDepth','pixelDepth',
  ].map(k => row(k, safe(() => s[k])));
  if (s.orientation) {
    rows.push(row('orientation.type',  safe(() => s.orientation.type)));
    rows.push(row('orientation.angle', safe(() => s.orientation.angle)));
  }
  return rows;
}

function collectWindow() {
  const keys = [
    'innerWidth','innerHeight','outerWidth','outerHeight',
    'screenX','screenY','scrollX','scrollY',
    'devicePixelRatio','isSecureContext','crossOriginIsolated',
    'name','status','closed','length',
  ];
  return keys.map(k => row(k, safe(() => window[k])));
}

function collectDocument() {
  const d = document;
  return [
    row('title',           safe(() => d.title)),
    row('URL',             safe(() => d.URL)),
    row('domain',          safe(() => d.domain)),
    row('readyState',      safe(() => d.readyState)),
    row('charset',         safe(() => d.charset)),
    row('characterSet',    safe(() => d.characterSet)),
    row('contentType',     safe(() => d.contentType)),
    row('compatMode',      safe(() => d.compatMode)),
    row('visibilityState', safe(() => d.visibilityState)),
    row('hidden',          safe(() => d.hidden)),
    row('cookie (length)', safe(() => d.cookie ? d.cookie.length + ' chars' : '0 chars')),
    row('referrer',        safe(() => d.referrer || '(none)')),
  ];
}

function collectLocation() {
  const l = window.location;
  return [
    row('href',     safe(() => l.href)),
    row('protocol', safe(() => l.protocol)),
    row('host',     safe(() => l.host)),
    row('hostname', safe(() => l.hostname)),
    row('port',     safe(() => l.port || '(default)')),
    row('pathname', safe(() => l.pathname)),
    row('search',   safe(() => l.search || '(none)')),
    row('hash',     safe(() => l.hash || '(none)')),
    row('origin',   safe(() => l.origin)),
  ];
}

function collectConnection() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return [row('Network Information API', '(not available)')];
  return [
    row('type',           safe(() => conn.type)),
    row('effectiveType',  safe(() => conn.effectiveType)),
    row('downlink',       safe(() => conn.downlink != null ? conn.downlink + ' Mbps' : '(unavailable)')),
    row('downlinkMax',    safe(() => conn.downlinkMax != null ? conn.downlinkMax + ' Mbps' : '(unavailable)')),
    row('rtt',            safe(() => conn.rtt != null ? conn.rtt + ' ms' : '(unavailable)')),
    row('saveData',       safe(() => conn.saveData)),
  ];
}

function collectPerformance() {
  if (typeof performance === 'undefined') return [row('Performance API', '(not available)')];
  const rows = [
    row('now()',          safe(() => performance.now().toFixed(3) + ' ms')),
    row('timeOrigin',     safe(() => performance.timeOrigin)),
  ];
  if (performance.memory) {
    rows.push(row('memory.jsHeapSizeLimit',   safe(() => performance.memory.jsHeapSizeLimit)));
    rows.push(row('memory.totalJSHeapSize',   safe(() => performance.memory.totalJSHeapSize)));
    rows.push(row('memory.usedJSHeapSize',    safe(() => performance.memory.usedJSHeapSize)));
  }
  if (performance.navigation) {
    rows.push(row('navigation.type',       safe(() => performance.navigation.type)));
    rows.push(row('navigation.redirectCount', safe(() => performance.navigation.redirectCount)));
  }
  return rows;
}

function collectStorage() {
  const rows = [];
  rows.push(row('sessionStorage available', safe(() => { sessionStorage.setItem('__bb_probe','1'); sessionStorage.removeItem('__bb_probe'); return true; })));
  rows.push(row('localStorage available',   safe(() => { localStorage.setItem('__bb_probe','1'); localStorage.removeItem('__bb_probe'); return true; })));
  rows.push(row('sessionStorage length', safe(() => sessionStorage.length)));
  rows.push(row('localStorage length',   safe(() => localStorage.length)));
  if (navigator.storage && navigator.storage.estimate) {
    rows.push(row('storage.estimate()', '(async — see console for result)'));
  } else {
    rows.push(row('StorageManager API', '(not available)'));
  }
  return rows;
}

function collectBattery() {
  if (!navigator.getBattery) return [row('Battery API', '(not available)')];
  return [row('Battery API', '(async — use "Send Debug Info" in Sender to capture live value)')];
}

function collectTizen() {
  const rows = [];
  if (typeof window.tizen === 'undefined') {
    rows.push(row('window.tizen', '(not available — not running on Tizen)'));
    return rows;
  }
  rows.push(row('window.tizen', 'present'));

  // Platform version
  const CAPS = [
    'http://tizen.org/feature/platform.version',
    'http://tizen.org/feature/platform.version.name',
    'http://tizen.org/feature/platform.native.api.version',
    'http://tizen.org/feature/platform.web.api.version',
    'http://tizen.org/feature/screen.width',
    'http://tizen.org/feature/screen.height',
    'http://tizen.org/feature/screen.dpi',
    'http://tizen.org/feature/screen.bpp',
    'http://tizen.org/feature/screen.coordinate_system',
    'http://tizen.org/feature/screen.size.normal',
    'http://tizen.org/feature/network.wifi',
    'http://tizen.org/feature/network.ethernet',
    'http://tizen.org/feature/network.bluetooth',
    'http://tizen.org/feature/network.nfc',
    'http://tizen.org/feature/network.telephony',
    'http://tizen.org/feature/location',
    'http://tizen.org/feature/location.gps',
    'http://tizen.org/feature/camera',
    'http://tizen.org/feature/microphone',
    'http://tizen.org/feature/sensor.accelerometer',
    'http://tizen.org/feature/sensor.gyroscope',
    'http://tizen.org/feature/sensor.magnetometer',
    'http://tizen.org/feature/usb.host',
    'http://tizen.org/feature/battery',
    'http://tizen.org/feature/keyboard',
    'http://tizen.org/feature/tv.display',
    'http://tizen.org/feature/tv.audio',
    'http://tizen.org/feature/tv.inputdevice',
    'http://tizen.org/feature/profile',
    'http://tizen.org/system/platform.name',
    'http://tizen.org/system/platform.version',
    'http://tizen.org/system/build.type',
    'http://tizen.org/system/build.string',
    'http://tizen.org/system/build.date',
    'http://tizen.org/system/build.time',
    'http://tizen.org/system/build.id',
    'http://tizen.org/system/manufacturer',
    'http://tizen.org/system/model_name',
    'http://tizen.org/system/device_type',
    'http://tizen.org/system/tizenid',
  ];

  if (window.tizen.systeminfo) {
    for (const cap of CAPS) {
      rows.push(row(cap, safe(() => window.tizen.systeminfo.getCapabilityValue(cap))));
    }
  } else {
    rows.push(row('tizen.systeminfo', '(not available)'));
  }

  return rows;
}

function collectWebAPIs() {
  if (typeof window.webapis === 'undefined') {
    return [row('window.webapis', '(not available)')];
  }
  const rows = [row('window.webapis', 'present')];
  const apis = [
    'avplay','appcommon','billing','caph','network','productinfo',
    'sso','tvinfo','tvinputdevice','widgetdata',
  ];
  for (const api of apis) {
    rows.push(row(`webapis.${api}`, safe(() => typeof window.webapis[api] !== 'undefined' ? 'present' : '(not available)')));
  }
  // Product info
  if (window.webapis.productinfo) {
    const pi = window.webapis.productinfo;
    const piKeys = [
      ['getFirmwareVersion','getFirmwareVersion()'],
      ['getDuid','getDuid()'],
      ['getModelCode','getModelCode()'],
      ['getRealModelCode','getRealModelCode()'],
      ['getLocalSet','getLocalSet()'],
      ['getSmartTVServerType','getSmartTVServerType()'],
      ['getSmartTVServerVersion','getSmartTVServerVersion()'],
      ['getTizenId','getTizenId()'],
    ];
    for (const [fn, label] of piKeys) {
      rows.push(row(`productinfo.${label}`, safe(() => pi[fn] ? pi[fn]() : '(unavailable)')));
    }
  }
  // TV Info
  if (window.webapis.tvinfo) {
    const ti = window.webapis.tvinfo;
    rows.push(row('tvinfo.getSystemConfig(CAPTION_ONOFF)',  safe(() => ti.getSystemConfig ? ti.getSystemConfig(ti.TvInfoMenuKey && ti.TvInfoMenuKey.CAPTION_ONOFF) : '(unavailable)')));
  }
  return rows;
}

function collectCryptoApi() {
  const rows = [];
  rows.push(row('window.crypto present',          safe(() => typeof window.crypto !== 'undefined')));
  rows.push(row('window.crypto.subtle present',   safe(() => typeof window.crypto !== 'undefined' && typeof window.crypto.subtle !== 'undefined')));
  rows.push(row('window.crypto.getRandomValues',  safe(() => typeof window.crypto !== 'undefined' && typeof window.crypto.getRandomValues === 'function')));
  return rows;
}

function collectMediaCapabilities() {
  const rows = [];
  rows.push(row('HTMLMediaElement present', safe(() => typeof HTMLMediaElement !== 'undefined')));
  rows.push(row('MediaSource present',      safe(() => typeof MediaSource !== 'undefined')));
  rows.push(row('navigator.mediaCapabilities present', safe(() => typeof navigator.mediaCapabilities !== 'undefined')));
  rows.push(row('navigator.mediaDevices present',      safe(() => typeof navigator.mediaDevices !== 'undefined')));
  if (typeof HTMLVideoElement !== 'undefined') {
    const vid = document.createElement('video');
    const types = [
      'video/mp4; codecs="avc1.42E01E"',
      'video/mp4; codecs="hev1.1.6.L93.B0"',
      'video/webm; codecs="vp9"',
      'video/webm; codecs="av01.0.05M.08"',
      'application/x-mpegURL',
      'application/vnd.apple.mpegurl',
    ];
    for (const t of types) {
      rows.push(row(`canPlayType("${t}")`, safe(() => { const r = vid.canPlayType(t); return r === '' ? '(empty string)' : r; })));
    }
  }
  return rows;
}

function collectAPIs() {
  const apis = [
    ['Fetch API',           () => typeof fetch !== 'undefined'],
    ['WebSocket',           () => typeof WebSocket !== 'undefined'],
    ['Worker',              () => typeof Worker !== 'undefined'],
    ['ServiceWorker',       () => 'serviceWorker' in navigator],
    ['IndexedDB',           () => typeof indexedDB !== 'undefined'],
    ['WebGL',               () => { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); }],
    ['WebGL2',              () => !!document.createElement('canvas').getContext('webgl2')],
    ['WebAssembly',         () => typeof WebAssembly !== 'undefined'],
    ['Notifications API',   () => typeof Notification !== 'undefined'],
    ['Geolocation API',     () => 'geolocation' in navigator],
    ['Pointer Events',      () => typeof PointerEvent !== 'undefined'],
    ['Touch Events',        () => typeof TouchEvent !== 'undefined'],
    ['ResizeObserver',      () => typeof ResizeObserver !== 'undefined'],
    ['IntersectionObserver',() => typeof IntersectionObserver !== 'undefined'],
    ['MutationObserver',    () => typeof MutationObserver !== 'undefined'],
    ['BroadcastChannel',    () => typeof BroadcastChannel !== 'undefined'],
    ['AbortController',     () => typeof AbortController !== 'undefined'],
    ['CSS Custom Properties',() => CSS && CSS.supports && CSS.supports('--a', '0')],
    ['CSS Grid',            () => CSS && CSS.supports && CSS.supports('display', 'grid')],
    ['CSS Flexbox',         () => CSS && CSS.supports && CSS.supports('display', 'flex')],
  ];
  return apis.map(([label, fn]) => row(label, safe(fn)));
}

// ── Build full debug data object (for "Send Debug Info" in Sender) ──

export function buildDebugInfo() {
  const nav = navigator;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  const data = {
    event: 'debug_info',
    source: 'BrewBridge Debug',
    timestamp: new Date().toISOString(),
    navigator: {},
    screen: {},
    window: {},
    document: {},
    location: {},
    connection: {},
    performance: {},
    storage: {},
    tizen: {},
    webapis: {},
    apis: {},
  };

  // Navigator
  [
    'appCodeName','appName','appVersion','buildID','cookieEnabled',
    'deviceMemory','doNotTrack','hardwareConcurrency','language',
    'maxTouchPoints','onLine','oscpu','platform','product','productSub',
    'userAgent','vendor','vendorSub','webdriver','pdfViewerEnabled',
  ].forEach(k => { try { if (nav[k] !== undefined) data.navigator[k] = nav[k]; } catch (_) {} });
  try { if (nav.languages) data.navigator.languages = Array.from(nav.languages); } catch (_) {}

  // Screen
  ['width','height','availWidth','availHeight','colorDepth','pixelDepth'].forEach(k => {
    try { data.screen[k] = screen[k]; } catch (_) {}
  });
  try {
    if (screen.orientation) {
      data.screen.orientation = { type: screen.orientation.type, angle: screen.orientation.angle };
    }
  } catch (_) {}

  // Window
  ['innerWidth','innerHeight','outerWidth','outerHeight','screenX','screenY',
   'scrollX','scrollY','devicePixelRatio','isSecureContext','crossOriginIsolated'].forEach(k => {
    try { data.window[k] = window[k]; } catch (_) {}
  });

  // Connection
  if (conn) {
    ['type','effectiveType','downlink','downlinkMax','rtt','saveData'].forEach(k => {
      try { if (conn[k] !== undefined) data.connection[k] = conn[k]; } catch (_) {}
    });
  } else {
    data.connection.available = false;
  }

  // Performance
  try { data.performance.now = performance.now(); } catch (_) {}
  try { data.performance.timeOrigin = performance.timeOrigin; } catch (_) {}
  try {
    if (performance.memory) {
      data.performance.memory = {
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        usedJSHeapSize:  performance.memory.usedJSHeapSize,
      };
    }
  } catch (_) {}

  // Storage
  try { data.storage.sessionStorageLength = sessionStorage.length; } catch (_) {}
  try { data.storage.localStorageLength   = localStorage.length;   } catch (_) {}

  // Tizen
  if (typeof window.tizen !== 'undefined') {
    data.tizen.available = true;
    const CAPS = [
      'http://tizen.org/feature/platform.version',
      'http://tizen.org/feature/screen.width',
      'http://tizen.org/feature/screen.height',
      'http://tizen.org/feature/network.wifi',
      'http://tizen.org/feature/network.ethernet',
      'http://tizen.org/feature/tv.display',
      'http://tizen.org/feature/tv.audio',
      'http://tizen.org/feature/profile',
      'http://tizen.org/system/manufacturer',
      'http://tizen.org/system/model_name',
      'http://tizen.org/system/build.type',
      'http://tizen.org/system/build.string',
    ];
    if (window.tizen.systeminfo) {
      data.tizen.capabilities = {};
      for (const cap of CAPS) {
        try { data.tizen.capabilities[cap] = window.tizen.systeminfo.getCapabilityValue(cap); } catch (_) {}
      }
    }
  } else {
    data.tizen.available = false;
  }

  // WebAPIs
  data.webapis.available = typeof window.webapis !== 'undefined';
  if (data.webapis.available && window.webapis.productinfo) {
    data.webapis.productinfo = {};
    ['getFirmwareVersion','getDuid','getModelCode','getRealModelCode','getLocalSet'].forEach(fn => {
      try { data.webapis.productinfo[fn] = window.webapis.productinfo[fn] ? window.webapis.productinfo[fn]() : undefined; } catch (_) {}
    });
  }

  return data;
}

// ── Page renderer ─────────────────────────────────────────────

export function renderDebug(container) {
  let html = `
    <div class="card dbg-card">
      <h1>🔬 Debug</h1>
      <p class="info">
        Comprehensive device and environment diagnostics. Every accessible property
        is listed here. Values marked <em>(error)</em> are not available in this context.
      </p>
  `;

  html += section('Navigator', collectNavigator());
  html += section('Screen', collectScreen());
  html += section('Window', collectWindow());
  html += section('Document', collectDocument());
  html += section('Location', collectLocation());
  html += section('Network Connection', collectConnection());
  html += section('Performance', collectPerformance());
  html += section('Storage', collectStorage());
  html += section('Battery', collectBattery());
  html += section('Tizen API', collectTizen());
  html += section('Samsung WebAPIs', collectWebAPIs());
  html += section('Crypto API', collectCryptoApi());
  html += section('Media Capabilities', collectMediaCapabilities());
  html += section('Web API Support', collectAPIs());

  html += `</div>`;
  container.innerHTML = html;
}
