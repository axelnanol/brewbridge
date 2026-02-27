# BrewBridge 🍺

BrewBridge is a proof-of-concept data-transfer bridge for [TizenBrew](https://github.com/reisir/tizenbrew). It lets a smart TV app (or any sender) push small JSON payloads to a phone or second screen in real time — with no accounts, no pairing, just a QR code.

A **Sender** creates an ephemeral session and sends JSON messages over a Cloudflare Worker API. A **Viewer** scans the QR code and polls for new messages every 2 seconds.

---

## Quick start (local dev)

### 1. Start the Worker locally

```bash
cd worker
npm install
npm run dev          # starts wrangler dev on http://localhost:8787
```

### 2. Start the web app

```bash
cd web
npm install
VITE_API_BASE_URL=http://localhost:8787 npm run dev
```

Open `http://localhost:5173/brewbridge/` in your browser.

- Go to `/#/send` to create a session and send messages.
- Scan the QR code (or copy the URL) and open `/#/view?s=…&r=…` on another device.

---

## Deploying the Worker

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/) and log in:
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. Edit `worker/wrangler.toml` and set your `account_id`.

3. Deploy:
   ```bash
   cd worker
   npm run deploy
   ```

4. Note the Worker URL (e.g. `https://brewbridge-worker.<your-subdomain>.workers.dev`).

5. Set the `ALLOWED_ORIGINS` secret on your Worker to the origin(s) that are allowed to call it. For a GitHub Pages deployment this is your Pages origin:
   ```
   https://<org>.github.io
   ```
   Multiple origins can be comma-separated. Loopback origins (`http://127.0.0.1`, `http://localhost`) are **always** allowed automatically so TizenBrew works without any configuration.

   > **Note:** `ALLOWED_ORIGINS` is origin-based (scheme + host + optional port), not path-based. You **never** need to update this value when bumping the app version or changing which HTML file is served.

   Set it with Wrangler:
   ```bash
   wrangler secret put ALLOWED_ORIGINS
   # paste: https://<org>.github.io
   ```

---

## Configuring the API base URL in the web app

Set the `VITE_API_BASE_URL` environment variable before building:

```bash
# .env file in /web (do not commit)
VITE_API_BASE_URL=https://brewbridge-worker.<your-subdomain>.workers.dev
```

Or pass it inline:

```bash
VITE_API_BASE_URL=https://... npm run build
```

For GitHub Actions, set it as a repository variable (`vars.VITE_API_BASE_URL`) in **Settings → Secrets and variables → Actions → Variables**.

---

## GitHub Pages deployment

Push to `main` and the `deploy.yml` workflow will build the web app and deploy it to GitHub Pages automatically.

Enable GitHub Pages in **Settings → Pages → Source: GitHub Actions**.

The site will be available at `https://<org>.github.io/brewbridge/`.

---

## Installing as a TizenBrew module

BrewBridge can be installed directly on a Samsung Smart TV running [TizenBrew](https://github.com/reisir/tizenbrew).

The root-level `package.json` declares BrewBridge as a TizenBrew `mods` module. The `keys` field lists the [TVInputDevice](https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references/tvinputdevice-api.html) key names that the app registers with the TV: `ColorF0Red`, `ColorF1Green`, `ColorF2Yellow`, `ColorF3Blue`, `ChannelUp`, and `ChannelDown`. Yellow toggles the JSON/Human-Readable view (Viewer) or Text/JSON input mode (Sender); Blue scrolls the content back to the top; Channel Up / Channel Down scroll the content pane up or down by one page; Red and Green navigate between app pages.

### Install from the TV

1. On your TV, open TizenBrew and navigate to the **Module Manager** (3rd icon from the left).
2. Select **Add Module**.
3. Enter `axelnanol/brewbridge`.
4. TizenBrew fetches the latest release tag, reads `package.json`, and registers the module.
5. BrewBridge now appears in your TizenBrew dashboard.

### How updates reach the TV

The old versioned-HTML scheme (`index-0005.html`) was meant to bypass jsdelivr's CDN cache by changing the URL on each release. It had a fatal flaw: the TV must first fetch a fresh `package.json` to discover the new `appPath` — but `package.json` itself was also cached by jsdelivr, so the TV never saw the new path and stayed stuck on the old file.

The current approach is simpler and more reliable:

1. Every push to `main` triggers CI, which builds `web/dist/` and commits the result.
2. CI then calls the jsdelivr purge API for both `package.json` and `web/dist/index.html`, forcing the CDN to fetch fresh content from GitHub immediately.
3. The JS bundle inside `web/dist/` is always content-hashed by Vite (e.g. `index-BZd8MSNk.js`), so the browser never serves a stale script.
4. `appPath` stays fixed at `web/dist/index.html` — no need to update it on every version bump.

### Publishing a release

TizenBrew fetches files directly from the repository at the release tag, so the built assets in `web/dist/` must be committed before the tag is created.

To cut a new release:

1. Bump `version` in `package.json` (root), e.g.:
   ```json
   "version": "0007"
   ```
2. Push the change to `main` — CI will rebuild `web/dist/` and purge the jsdelivr cache automatically. **Wait for the workflow to complete** (check the Actions tab) before creating the tag.
3. Create and push a git tag matching the new version:
   ```bash
   git pull          # fetch the CI commit
   git tag 0007
   git push origin 0007
   ```
4. Create a GitHub release from that tag. TizenBrew will read `package.json` and serve `web/dist/index.html` directly from the repository at that tag.

---

## How to use

### Sender page (`/#/send`)

1. Click **Create New Session** — a session ID, write key, and read key are generated by the Worker.
2. A viewer URL and QR code are displayed. Share them with the receiver.
3. Paste any JSON into the text area and click **Send JSON**, or click **Send Test Message** to send a pre-built payload.

### Viewer page (`/#/view?s=<sessionId>&r=<readKey>`)

1. Open the URL (or scan the QR code).
2. Messages appear automatically as they are sent (polled every 2 seconds).
3. Click **⬇ Download Latest JSON** to save the most recent message as a `.json` file.

---

## Project structure

```
brewbridge/
├── package.json          TizenBrew module metadata (mods type)
├── web/                  Vite + vanilla JS web app
│   ├── src/
│   │   ├── main.js       Hash router
│   │   ├── api.js        API client
│   │   ├── qr.js         QR code helper
│   │   └── pages/
│   │       ├── sender.js
│   │       └── viewer.js
│   ├── index.html
│   └── vite.config.js
├── worker/               Cloudflare Worker + Durable Object
│   ├── src/
│   │   ├── index.js      Worker entry + routing
│   │   └── session.js    Durable Object (session storage)
│   └── wrangler.toml
└── .github/workflows/
    └── deploy.yml        GitHub Pages CI/CD
```
