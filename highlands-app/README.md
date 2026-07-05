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

- **Home** — trip title, dates, tagline, live "Day X of 16 — Today" jump during
  the trip, a scrollable list of all 16 days, and quick links.
- **Day detail** — swipeable between days; hero photo, Drive/Distance/Overnight
  ribbon, the plan, a "Good to know" note, POI cards ("Show on map" + Maps
  deep-link), and a per-day **journal** saved on the phone.
- **Map** — Leaflet + OpenStreetMap with day-numbered pins and a route line
  (toggle this-day / all POIs). Gracefully falls back to a **bundled static
  route map** with no signal.
- **Packing** & **Pre-departure** checklists — tickable, saved locally.
- **About / credits** — photo attributions and map data credits.
- **Highland night** dark mode (remembers your choice).

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

Two ways to publish, both **non-destructive** to the existing landform site
(they only ever write to the `highlands/` sub-directory):

### 1. GitHub Actions (recommended)

`.github/workflows/highlands-deploy.yml` runs on pushes that touch
`highlands-app/**` (or manually via *Run workflow*). It installs, **fetches the
photos**, builds, and publishes `dist/` to the `gh-pages` branch under
`highlands/` (with `keep_files: true`).

Then set **Settings → Pages → Deploy from a branch → `gh-pages` / `root`**.

### 2. Manual

```bash
npm run deploy     # builds and pushes dist/ to gh-pages branch, highlands/ dir
```

> **Note on the landform site:** if your Pages is currently served from the
> `main` branch root, switch the Pages source to `gh-pages` (root) so both the
> highlands sub-path and your other content are served from there — or keep the
> app on `main` under a `highlands/` folder if you prefer. The build output is
> the same either way; only the Pages *source* setting differs. Confirm this
> before switching so the landform site keeps serving.

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
