# source_film

A fully local tracker for the movies and series you've watched. No server, no
PHP, no accounts — data lives on your device (browser IndexedDB). The same code
runs on your PC in a browser **and** installs as an app on your phone.

```
source_film/
  web/        the app — runs on PC and installs on Android (single source of truth)
    index.html, app.js, db.js, style.css
    manifest.webmanifest, sw.js      (PWA: installable + offline + self-update)
    icons/                           (app icons)
  android/    (added next) packages web/ into an installable APK
```

## Run on your PC

Open `web/index.html` through a small static server (a service worker needs
`http://` or `https://`, not `file://`):

```bash
# from the repo root, with Node installed:
npx serve web
# then open the printed http://localhost:… address
```

## Install on your Pixel (as an app)

The `web/` app is a PWA, so once it's reachable over **HTTPS** it installs like a
native app (own icon, fullscreen, offline, local data). Easiest free host is
**GitHub Pages**:

1. Put this repo on GitHub and enable Pages (Settings → Pages → deploy from the
   `main` branch). Your app will be at
   `https://<user>.github.io/<repo>/web/`.
2. On the Pixel, open that URL in Chrome → menu (⋮) → **Install app** /
   *Add to Home screen*.

## Updating — it checks and updates itself

The service worker (`web/sw.js`) makes updates automatic:

- **Silent:** while online, assets refresh in the background, so the next launch
  already has your latest changes.
- **Prompted:** bump `VERSION` in `web/sw.js` on each release. The app detects
  the new version on launch/refocus and shows an **"Update"** button; tapping it
  reloads into the new version. Nothing to reinstall.

So your update flow is simply: edit files in `web/` → push to GitHub → the
installed app updates itself.

## Data & backups

Everything is stored locally in the browser, so **clearing site data wipes it**.
Use the **Export** button to save a JSON backup and **Import** to restore or move
data to another device.

## Search

Plain text matches the name. Combine with `#key:value` filters:
`#type:movie` · `#rating:5` · `#heart:2` · `#season:3` · `#saga:foo` ·
`#tag:sci-fi` · `#rewatched:yes` · `#sequel:maybe` ·
`#date:2026-07-12` or a range `#date:2026-07-01..2026-07-31`.
