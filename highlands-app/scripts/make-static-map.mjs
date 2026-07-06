// Generates public/route-static.svg — a stylised, on-brand offline route map
// plotted from the itinerary coordinates. Used as the map fallback with no signal.

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const { bases } = await import('../src/data/bases.js')

// One point per base centre (bases 1–9; the drive home to Burbage is left off
// so the Scotland loop isn't squashed).
const stops = bases
  .filter((b) => b.id !== 10 && b.lat != null)
  .map((b) => ({ n: b.id, name: b.name, lat: b.lat, lng: b.lng }))

const W = 720, H = 1000, M = 70
const lats = stops.map((s) => s.lat)
const lngs = stops.map((s) => s.lng)
const minLat = Math.min(...lats), maxLat = Math.max(...lats)
const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
// Equirectangular projection, corrected for latitude, letterboxed into the frame.
const midLat = (minLat + maxLat) / 2
const cos = Math.cos((midLat * Math.PI) / 180)
const geoW = (maxLng - minLng) * cos
const geoH = maxLat - minLat
const scale = Math.min((W - 2 * M) / geoW, (H - 2 * M) / geoH)
const offX = (W - geoW * scale) / 2
const offY = (H - geoH * scale) / 2

const project = (lat, lng) => {
  const x = offX + (lng - minLng) * cos * scale
  const y = offY + (maxLat - lat) * scale
  return [x, y]
}

const pts = stops.map((s) => ({ ...s, xy: project(s.lat, s.lng) }))
const routeD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.xy[0].toFixed(1)},${p.xy[1].toFixed(1)}`).join(' ')

const marker = (p) => {
  const [x, y] = p.xy
  return `
    <g>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="#14343f" stroke="#e6c987" stroke-width="2"/>
      <text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-family="Georgia, serif" font-size="13" fill="#fff" font-weight="bold">${p.n}</text>
    </g>`
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Highlands Adventure route map">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d232b"/><stop offset="1" stop-color="#14343f"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="rgba(230,201,135,0.08)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="rgba(230,201,135,0.35)" stroke-width="1.5" rx="10"/>

  <text x="${W / 2}" y="58" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#f4efe4">Highlands Adventure</text>
  <text x="${W / 2}" y="84" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" letter-spacing="3" fill="#e6c987">8–23 AUGUST 2026 · 16 DAYS · CLOCKWISE LOOP</text>

  <path d="${routeD}" fill="none" stroke="#c8912f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="2 9" opacity="0.85"/>
  ${pts.map(marker).join('')}

  <g transform="translate(${W - 92}, ${H - 92})">
    <circle r="30" fill="rgba(13,35,43,0.6)" stroke="#e6c987" stroke-width="1.5"/>
    <path d="M0,-24 L6,0 L0,24 L-6,0 Z" fill="#e6c987"/>
    <text x="0" y="-34" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#e6c987" font-weight="bold">N</text>
  </g>

  <text x="${W / 2}" y="${H - 34}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="11" letter-spacing="2" fill="rgba(244,239,228,0.7)">OFFLINE ROUTE MAP · NUMBERS ARE DAYS</text>
</svg>
`

await writeFile(path.join(ROOT, 'public', 'route-static.svg'), svg)
console.log(`Wrote public/route-static.svg (${stops.length} stops)`)
