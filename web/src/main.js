import { renderSender } from './pages/sender.js';
import { renderViewer } from './pages/viewer.js';

const app = document.getElementById('app');

function route() {
  const hash = window.location.hash || '#/send';
  const [path, queryString] = hash.slice(1).split('?');
  const params = new URLSearchParams(queryString || '');

  app.innerHTML = '';

  if (path === '/send') {
    renderSender(app);
  } else if (path === '/view') {
    renderViewer(app, params);
  } else {
    app.innerHTML = '<div class="card"><h1>BrewBridge</h1><p><a href="#/send">Open Sender</a></p></div>';
  }
}

window.addEventListener('hashchange', route);
route();
