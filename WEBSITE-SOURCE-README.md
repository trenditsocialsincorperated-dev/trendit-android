# Trendit Website Source

This archive is the website/web-app portion of Trendit, separated from the Android native project.

## Included
- `src/` — Vite + React + TypeScript application source
- `public/` — website static assets, PWA files, and Firebase messaging service worker
- `netlify/functions/` — website backend functions (including social push and Agora token endpoints)
- Vite, TypeScript, npm/Bun, Netlify, and environment example configuration

## Excluded
- `android/` — generated/native Android Studio project and Android resources
- `www/` — older/legacy web bundle, kept out to avoid mixing it with the current Vite source
- `capacitor.config.ts` — native wrapper configuration

## Run locally
1. Install Node.js (or Bun).
2. Run `npm install` (or `bun install`).
3. Create a local `.env` based on `.env.example` and fill in the required values. Never commit real secrets.
4. Run `npm run build:web` to build the website into `dist/`.

For local development, check the scripts in `package.json`; this export retains the project's existing scripts and dependencies. The deployed Netlify site uses `netlify.toml`.

## Important
This is a source separation, not a code change or a push-notification fix. The website still relies on its Firebase project and server-side Netlify environment variables.
