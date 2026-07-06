# Highlands Adventure — offline PWA

An installable, **offline-capable** phone web app for Phil & Tracey's 16-day
Scottish Highlands motorhome tour, **8–23 August 2026**. A clockwise loop:
up the west coast → across the north → down the east coast → home.

Built with React + Vite + `vite-plugin-pwa`. Once opened, it works fully
offline — all 16 days, photos, checklists, journal and a static route map.

> This app is **completely self-contained** in the `highlands-app/` folder and
> is independent of the landform project in the rest of this repository. It has
> its own `package.json`, build, and deploy workflow, and deploys to a separate
> sub-path so the two never collide.

## Quick start

```bash
cd highlands-app
npm install
npm run dev        # http://localhost:5173/cassidy-landform/highlands/
```

## Features

The trip is organised as **The Relaxed Loop** — 9 bases over 16 days (drive to a
base, stay put, explore from it).

- **Home** — Phil & Tracey’s photo over a Scottish backdrop, live "You’re here
  today" jump during the trip, the nine bases, trip stats and quick links.
- **Base detail** — swipeable between bases; hero photo, Drive/Miles/Nights
  ribbon, **accommodation** (tap-to-call, postcode, cost, booking link),
  a "Good to know" note, POI cards ("Show on map" + Maps deep-link), and a
  **media journal**.
- **Media journal** — a text note **plus photos and videos** taken with the
  phone’s camera, stored in **IndexedDB** so it all works fully offline. View,
  share/save, and delete per item.
- **Bases & costs** — mileage table, fuel estimate, a tickable **booking
  tracker**, and an all-in cost summary.
- **Backup & restore** — export all journal notes + photos/videos to a single
  `.zip` (Files/iCloud) so memories survive a cache clear, and restore later.
- **Map** — Leaflet + OpenStreetMap with base-numbered pins and a route line
  (toggle this-base / all POIs). Falls back to a **bundled static route map**
  with no signal.
- **Packing** & **Pre-departure** checklists — tickable, saved locally.
- **About / credits** — backup tools, photo attributions and map data credits.
- **Highland night** dark mode (remembers your choice).

### Your own photos

`public/images/mine/<slug>.jpg` overrides any Commons photo. The home-screen
portrait lives at `public/images/mine/phil-tracey-avatar.jpg` (and the full
shot at `phil-tracey.jpg`) — replace them to change the header.

## Photos

Photos are **downloaded at build time** into `public/images/` so the app works
offline — nothing is hot-linked at runtime.

```bash
npm run fetch-photos          # download from Wikimedia Commons
npm run fetch-photos -- --force   # re-download everything
```

For each point of interest the script uses a verified Commons filename or
searches Commons for a good landscape image, saves a ~1200px JPEG to
`public/images/<slug>.jpg`, and records author/licence attribution into
`src/data/credits.json` (shown on the About page).

- **Your own photos:** drop them in `public/images/mine/<slug>.jpg` and they
  automatically override the Commons image. Slugs are listed in
  `src/data/photo-sources.js`.
- **Missing photo:** a tasteful parchment placeholder (POI name + gold diamond)
  is shown, so nothing ever looks broken.

> Some networks/sandboxes block `wikimedia.org`. If `fetch-photos` can't reach
> Commons, run it on an unrestricted network, or let CI do it (the deploy
> workflow fetches photos automatically).

## Generated assets

App icons, the favicon and the static offline route map are generated (no
native dependencies) and refreshed automatically before every build:

```bash
npm run assets     # scripts/make-icons.mjs + scripts/make-static-map.mjs
```

## Build

```bash
npm run build      # → dist/  (runs `assets` first via prebuild)
npm run preview
```

## Deploy to GitHub Pages

The app builds with `base = /cassidy-landform/highlands/` (override with
`VITE_BASE`) and the PWA scope matches, so it lives at:

```
https://<owner>.github.io/cassidy-landform/highlands/
```

### GitHub Actions (recommended)

`.github/workflows/highlands-deploy.yml` runs on pushes to `main` that touch
`highlands-app/**` (or manually via *Run workflow*). It installs, **fetches the
photos**, builds, and publishes `dist/` into a **`highlands/` folder on the
`main` branch** with `keep_files: true`.

Because it publishes into `main` (not a separate branch), the app serves under
**whatever Pages setup already serves the landform site at the repo root** — so
there is **no Pages source change to make**, and the landform files are never
touched. If Pages isn't enabled yet, enable it once with
**Settings → Pages → Deploy from a branch → `main` / `root`**; that lights up
both the landform site and the highlands app at `/highlands/`.

### Manual (alternative: dedicated gh-pages branch)

```bash
npm run deploy     # builds and pushes dist/ to the gh-pages branch, highlands/ dir
```

This publishes to a separate `gh-pages` branch instead; it requires setting the
Pages source to `gh-pages`. Prefer the Actions workflow above unless you
specifically want a dedicated branch.

## Install on an iPhone

1. Open the URL in Safari.
2. Share → **Add to Home Screen**.
3. Open it once with signal so everything caches, then it works fully offline.

## Project layout

```
highlands-app/
  scripts/          # fetch-photos, make-icons, make-static-map (build-time)
  public/
    images/         # downloaded Commons photos (<slug>.jpg)
    images/mine/    # your own photos override Commons (<slug>.jpg)
    icons/, favicon.svg, route-static.svg   # generated
  src/
    data/           # days.js, checklists.js, photo-sources.js, credits.json
    components/, screens/, lib/
```

Data model, itinerary and checklists live in `src/data/` — edit `days.js` to
change the plan.
