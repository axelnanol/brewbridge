# BrewBridge Worker

Cloudflare Worker that powers the BrewBridge ephemeral session API.

## Setup

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/):
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Edit `wrangler.toml` and set your `account_id`.

## Local development

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

## Environment variables

| Variable | Description |
|---|---|
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (e.g. `https://your-org.github.io`). Leave empty to allow all origins (dev mode). |
