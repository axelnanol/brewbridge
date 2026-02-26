import { renderSender } from './pages/sender.js';
import { renderViewer } from './pages/viewer.js';

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
  setActiveNav(path);
  closeMobileSidebar();

  if (path === '/send') {
    renderSender(content);
  } else if (path === '/view') {
    renderViewer(content, params);
  } else {
    content.innerHTML = '<p class="info">Select a page from the sidebar.</p>';
  }
}

window.addEventListener('hashchange', route);
route();
