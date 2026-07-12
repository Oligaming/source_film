# The Android app (Pixel)

The app *is* the `web/` PWA. On Android there's nothing to compile — you host
`web/` over HTTPS once, install it from Chrome, and from then on it updates
itself. This folder is just the guide.

## 1. Host it (once)

The included workflow `.github/workflows/deploy.yml` publishes `web/` to GitHub
Pages automatically and stamps a new version into `sw.js` on every push (this is
what makes the "Update" prompt appear).

1. Create a GitHub repo and push this project.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**.
3. Push to `main`. The Action deploys, and your app is served at:
   `https://<your-user>.github.io/<repo>/`

> Prefer another host? Any static HTTPS host works (Netlify, Vercel, Cloudflare
> Pages) — just deploy the `web/` folder as the site root. HTTPS is required for
> install + self-update.

## 2. Install on the Pixel (once)

1. Open the Pages URL in **Chrome** on the phone.
2. Menu **⋮ → Install app** (or *Add to Home screen*).
3. Launch it from the home screen — it runs fullscreen, works offline, and
   stores data on the device.

## 3. Updating — automatic

- Edit files in `web/` → commit → push.
- The Action redeploys and bumps the service-worker version.
- Next time you open the app (it also re-checks when you switch back to it), it
  fetches the new version and shows an **"Update"** button; tap it to reload
  into the latest. Small changes also apply silently on the next launch.

No reinstalling, no app store, no manual version numbers.

## Notes

- **Backups:** data lives only on the device. Use **Export** in the app to save
  a JSON backup; **Import** restores it (also how you move data to another
  phone/PC).
- **Want a real `.apk`** to sideload or put on Play later? Because `web/` is a
  valid PWA, you can wrap the hosted URL into an APK/AAB at
  [pwabuilder.com](https://www.pwabuilder.com) — no Android Studio. It still
  loads the hosted PWA, so it keeps auto-updating. Ask me and I'll walk through
  it.
