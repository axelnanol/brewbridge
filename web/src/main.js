import { renderSender } from './pages/sender.js';
import { renderViewer } from './pages/viewer.js';
import { renderEnvironment } from './pages/environment.js';
import { renderDebug } from './pages/debug.js';

const content = document.getElementById('bb-content');
const menuBtn = document.getElementById('bb-menu-btn');
const sidebar = document.getElementById('bb-sidebar');
const overlay = document.getElementById('bb-overlay');

menuBtn.addEventListener('click', () => {
  const open = sidebar.classList.toggle('mobile-open');
  overlay.classList.toggle('mobile-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
});

overlay.addEventListener('click', () => {
  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('mobile-open');
  menuBtn.setAttribute('aria-expanded', 'false');
});

function setActiveNav(path) {
  document.querySelectorAll('#bb-nav .nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + path);
  });
}

function closeMobileSidebar() {
  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('mobile-open');
  menuBtn.setAttribute('aria-expanded', 'false');
}

function route() {
  const hash = window.location.hash || '#/send';
  const [path, queryString] = hash.slice(1).split('?');
  const params = new URLSearchParams(queryString || '');

  content.innerHTML = '';
  window.__bbPageToggle = null;
  setActiveNav(path);
  closeMobileSidebar();

  if (path === '/send') {
    renderSender(content);
  } else if (path === '/view') {
    // Session persistence: store valid params and restore when navigating back.
    // Wrapped in try/catch because sessionStorage can throw in privacy/sandbox modes.
    try {
      const s = params.get('s');
      const r = params.get('r');
      if (s && r) {
        sessionStorage.setItem('bb_s', s);
        sessionStorage.setItem('bb_r', r);
        renderViewer(content, params);
      } else {
        const storedS = sessionStorage.getItem('bb_s');
        const storedR = sessionStorage.getItem('bb_r');
        if (storedS && storedR) {
          const restored = new URLSearchParams({ s: storedS, r: storedR });
          history.replaceState(
            null, '',
            `#/view?s=${encodeURIComponent(storedS)}&r=${encodeURIComponent(storedR)}`
          );
          renderViewer(content, restored);
        } else {
          renderViewer(content, params);
        }
      }
    } catch (_e) {
      // Fallback when sessionStorage is unavailable or throws
      renderViewer(content, params);
    }
  } else if (path === '/env') {
    renderEnvironment(content);
  } else if (path === '/debug') {
    renderDebug(content);
  } else {
    content.innerHTML = '<p class="info">Select a page from the sidebar.</p>';
  }
}

window.addEventListener('hashchange', route);
route();

// ─────────────────────────────────────────────────────────────
// Spatial Navigation
// Adapted from BrewDocs / TizenPortal
// https://github.com/axelnanol/brewdocs
// ─────────────────────────────────────────────────────────────
(function () {
  var DIRS = {
    37: { x: -1, y: 0 },  // Left
    38: { x: 0, y: -1 },  // Up
    39: { x: 1, y: 0 },   // Right
    40: { x: 0, y: 1 },   // Down
  };

  var FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '.focusable',
  ].join(', ');

  function isVisible(el) {
    if (!el) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getFocusableElements(container) {
    var root = container || document;
    var all = root.querySelectorAll(FOCUSABLE_SELECTOR);
    var result = [];
    for (var i = 0; i < all.length; i++) {
      if (isVisible(all[i])) result.push(all[i]);
    }
    return result;
  }

  function getCenter(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function getDistance(fromRect, toRect, dir) {
    var fc = getCenter(fromRect);
    var tc = getCenter(toRect);
    var dx = tc.x - fc.x;
    var dy = tc.y - fc.y;
    var primary = dir.x * dx + dir.y * dy;
    if (primary <= 0) return Infinity;
    var secondary = Math.abs(dir.y * dx - dir.x * dy);
    var overlapBonus = 0;
    if (dir.x !== 0) {
      var overlapTop = Math.max(fromRect.top, toRect.top);
      var overlapBot = Math.min(fromRect.bottom, toRect.bottom);
      if (overlapBot > overlapTop) overlapBonus = (overlapBot - overlapTop) * 0.3;
    } else {
      var overlapLeft = Math.max(fromRect.left, toRect.left);
      var overlapRight = Math.min(fromRect.right, toRect.right);
      if (overlapRight > overlapLeft) overlapBonus = (overlapRight - overlapLeft) * 0.3;
    }
    return primary + secondary * 0.5 - overlapBonus;
  }

  function findNextFocusable(currentEl, keyCode) {
    var dir = DIRS[keyCode];
    if (!dir) return null;
    var searchRoot = null;
    if (dir.y !== 0) {
      var contentEl = document.getElementById('bb-content');
      var sidebarEl = document.getElementById('bb-sidebar');
      if (contentEl && contentEl.contains(currentEl)) {
        searchRoot = contentEl;
      } else if (sidebarEl && sidebarEl.contains(currentEl)) {
        searchRoot = sidebarEl;
      }
    }
    var candidates = getFocusableElements(searchRoot);
    var fromRect = currentEl.getBoundingClientRect();
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el === currentEl) continue;
      var rect = el.getBoundingClientRect();
      var dist = getDistance(fromRect, rect, dir);
      if (dist < bestDist) { bestDist = dist; best = el; }
    }
    return best;
  }

  function isTextInput(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      var type = (el.type || 'text').toLowerCase();
      return ['text', 'email', 'password', 'number', 'tel', 'url', 'search',
              'date', 'time', 'datetime-local', 'month', 'week', ''].includes(type);
    }
    return false;
  }

  document.addEventListener('keydown', function (e) {
    var code = e.keyCode;

    // 🟡 Yellow (405) — call the current page's toggle function
    if (code === 405) {
      if (typeof window.__bbPageToggle === 'function') {
        window.__bbPageToggle();
      }
      e.preventDefault();
      return;
    }

    // 🔵 Blue (406) — scroll content back to top
    if (code === 406) {
      var contentPane = document.getElementById('bb-content');
      if (contentPane) contentPane.scrollTop = 0;
      var sidebarLinks = getFocusableElements(document.getElementById('bb-sidebar'));
      if (sidebarLinks.length) sidebarLinks[0].focus();
      e.preventDefault();
      return;
    }

    // 🔴 Red (403) / 🟢 Green (404) — reserved for future enhancements
    if (code === 403 || code === 404) {
      e.preventDefault();
      return;
    }

    if (!DIRS[code]) return;

    // Text field protection: let arrow keys work normally inside text inputs
    var focused = document.activeElement;
    if (isTextInput(focused)) return;

    if (!focused || focused === document.body || focused === document.documentElement) {
      var els = getFocusableElements();
      if (els.length) els[0].focus();
      e.preventDefault();
      return;
    }

    var next = findNextFocusable(focused, code);
    if (next) {
      e.preventDefault();
      next.focus();
      next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else if (code === 40 || code === 38) {
      var pane = document.getElementById('bb-content');
      if (pane && pane.contains(focused)) {
        e.preventDefault();
        var delta = pane.clientHeight * 0.8;
        pane.scrollBy({ top: code === 40 ? delta : -delta, behavior: 'smooth' });
      }
    }
  });

  window.addEventListener('load', function () {
    var els = getFocusableElements();
    if (els.length) setTimeout(function () { els[0].focus(); }, 150);
  });
}());
