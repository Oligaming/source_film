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
```

## Run on your PC

Open `web/index.html` through a small static server (a service worker needs
`http://` or `https://`, not `file://`):

```bash
# from the repo root, with Node installed:
npx serve web
# then open the printed http://localhost:… address
```

## Host it on GitHub Pages (free HTTPS)

The included workflow `.github/workflows/deploy.yml` publishes `web/` to GitHub
Pages on every push to `main`, and stamps a fresh service-worker version each
time (that's what triggers the in-app "Update" prompt).

1. Create a **public** GitHub repo and push this project to `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**.
3. The app is then served at `https://<user>.github.io/<repo>/`.

> Prefer another host? Any static HTTPS host works (Netlify, Vercel, Cloudflare
> Pages…) — deploy the `web/` folder as the site root and bump `VERSION` in
> `web/sw.js` manually on each release.

## Install on your phone (as an app)

The `web/` app is a PWA, so once it's reachable over **HTTPS** it installs like
a native app (own icon, fullscreen, offline, local data). The tutorial is also
in the app itself: **⚙ Settings → Install on Android**.

1. On the phone, open the hosted URL in Chrome.
2. Menu (⋮) → **Install app** / *Add to Home screen*.

## Updating — it checks and updates itself

The service worker (`web/sw.js`) makes updates automatic:

- **Silent:** while online, assets refresh in the background, so the next launch
  already has your latest changes.
- **Prompted:** each deploy carries a new version. The app detects it on
  launch/refocus and shows an **"Update"** button; tapping it reloads into the
  new version. Nothing to reinstall.

So your update flow is simply: edit files in `web/` → push to `main` → the
installed app updates itself.

## Features

- **Add / edit / delete** entries; the ✎ and 🗑 buttons appear on each row
  (always visible on touch screens).
- The **sequel button** on a row pre-fills the form to log the next
  season/sequel in one tap.
- **Sort** by clicking any column header (click again to reverse).
- **Stat boxes** at the top expand (tap them) to show averages and counts.
- **⚙ Settings** modal: export/import (sync), last-sync date, and the Android
  install tutorial.

## Sync & backups

Everything is stored locally in the browser, so **clearing site data wipes it**.
Sync and backups live in the **⚙ Settings** modal:

- **Export data** downloads a JSON snapshot of the whole database.
- **Import & merge** reads such a file and adds only the entries you don't have
  yet (matched on name + type + season + date) — no duplicates, so it doubles
  as a **sync** between PC and phone: export on one device, send the file over
  (Drive, mail, USB…), import on the other. Do it in both directions to fully
  converge.
- The modal shows the **date of the last sync** (export or import) on this
  device.

## Search

Plain text matches the name. Combine with `#key:value` filters:
`#type:movie` · `#rating:5` · `#heart:2` · `#season:3` · `#saga:foo` ·
`#tag:sci-fi` · `#rewatched:yes` · `#sequel:maybe` ·
`#date:2026-07-12` or a range `#date:2026-07-01..2026-07-31`.
