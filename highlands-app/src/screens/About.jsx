import { useNavigate } from 'react-router-dom'
import { TRIP } from '../data/days.js'
import { photoSources } from '../data/photo-sources.js'
import credits from '../data/credits.json'
import { Eyebrow, Diamond } from '../components/ui.jsx'

// Merge fetched attribution (credits.json, written by the photo pipeline) with
// the source catalog so every POI is listed even before photos are fetched.
function creditRows() {
  const byslug = Object.fromEntries(credits.map((c) => [c.slug, c]))
  return photoSources.map((s) => ({ ...s, ...(byslug[s.slug] || {}) }))
}

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export default function About() {
  const navigate = useNavigate()
  const rows = creditRows()
  const haveCredits = credits.length > 0

  return (
    <>
      <header className="topbar">
        <button className="back" onClick={() => navigate('/')}>← Home</button>
        <div style={{ marginTop: 12 }}>
          <Eyebrow>About & credits</Eyebrow>
          <h1 className="serif" style={{ fontSize: '1.8rem', marginTop: 4 }}>{TRIP.title}</h1>
        </div>
      </header>

      <div className="container stack">
        <div className="card" style={{ padding: 16 }}>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            A pocket guide to {TRIP.who}’s 16-day Scottish Highlands motorhome tour,
            8–23 August 2026 — a clockwise loop up the west coast, across the north,
            and down the east coast home. Built to work fully offline, so it keeps
            going where the signal doesn’t.
          </p>
          <p className="muted" style={{ marginBottom: 0, fontStyle: 'italic', fontFamily: 'var(--serif)' }}>
            “{TRIP.tagline}”
          </p>
        </div>

        <div>
          <div className="section-title" style={{ margin: '8px 0 4px' }}>
            <Diamond /><h2 style={{ fontSize: '1.2rem' }}>Photo credits</h2>
          </div>
          <p className="credit-line" style={{ marginTop: 0 }}>
            Photos are sourced from Wikimedia Commons and remain under their original
            licences (mostly CC BY / CC BY-SA / public domain); attribution is retained below.
            Where we’ve added our own photos they replace the Commons image.
          </p>
          {!haveCredits && (
            <div className="note" style={{ marginBottom: 12 }}>
              <span className="diamond" />
              <div>
                <span className="k label">Photos not fetched yet</span>
                <p>Run <code>npm run fetch-photos</code> to download the images and fill in full attribution. The intended sources are listed below.</p>
              </div>
            </div>
          )}
          <div className="card" style={{ padding: '2px 14px' }}>
            {rows.map((r) => (
              <div className="credit-item" key={r.slug}>
                <div className="cn">{r.name}</div>
                <div className="credit-line">
                  {r.title || (r.commons ? `File: ${r.commons}` : `Search: “${r.query}”`)}
                  {r.artist && <> · {stripHtml(r.artist)}</>}
                  {r.license && <> · {r.license}</>}
                  {r.descriptionurl && <> · <a href={r.descriptionurl} target="_blank" rel="noreferrer">Commons ↗</a></>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="section-title" style={{ margin: '8px 0 4px' }}>
            <Diamond /><h2 style={{ fontSize: '1.2rem' }}>Map data</h2>
          </div>
          <p className="credit-line" style={{ marginTop: 0 }}>
            Live map tiles © OpenStreetMap contributors, used under the Open Database Licence.
            Map rendering by Leaflet.
          </p>
        </div>

        <p className="muted center" style={{ fontSize: '0.72rem' }}>
          Made with love for the road. Version 1.0 · works offline.
        </p>
      </div>
    </>
  )
}
