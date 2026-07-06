import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { TRIP } from '../data/bases.js'
import { photoSources } from '../data/photo-sources.js'
import credits from '../data/credits.json'
import { Eyebrow, Diamond } from '../components/ui.jsx'
import { exportTrip, importTrip } from '../lib/backup.js'
import { estimateUsage, countMedia } from '../lib/media.js'

function creditRows() {
  const byslug = Object.fromEntries(credits.map((c) => [c.slug, c]))
  return photoSources.map((s) => ({ ...s, ...(byslug[s.slug] || {}) }))
}
const stripHtml = (h) => (h ? h.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '')
const mb = (b) => (b / 1048576).toFixed(b > 10485760 ? 0 : 1)

export default function About() {
  const navigate = useNavigate()
  const rows = creditRows()
  const haveCredits = credits.length > 0
  const importRef = useRef(null)
  const [status, setStatus] = useState('')
  const [usage, setUsage] = useState({ usage: 0, quota: 0 })
  const [photos, setPhotos] = useState(0)

  useEffect(() => {
    estimateUsage().then(setUsage)
    countMedia().then(setPhotos)
  }, [status])

  async function doExport() {
    setStatus('Preparing backup…')
    try {
      const now = new Date()
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const r = await exportTrip(stamp)
      setStatus(`Backup saved — ${r.photos} photo/video(s). Choose “Save to Files” to keep it.`)
    } catch (e) {
      setStatus('Export failed: ' + (e.message || e))
    }
  }
  async function doImport(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setStatus('Restoring…')
    try {
      const r = await importTrip(f)
      setStatus(`Restored ${r.photos} photo/video(s) and your notes. Reopen a base to see them.`)
    } catch (err) {
      setStatus('Restore failed: ' + (err.message || err))
    }
  }

  return (
    <>
      <header className="topbar">
        <button className="back" onClick={() => navigate('/')}>← Home</button>
        <div style={{ marginTop: 12 }}>
          <Eyebrow>About · backup · credits</Eyebrow>
          <h1 className="serif" style={{ fontSize: '1.8rem', marginTop: 4 }}>{TRIP.title}</h1>
        </div>
      </header>

      <div className="container stack">
        <div className="card" style={{ padding: 16 }}>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            {TRIP.who}’s 16-day Scottish Highlands motorhome tour — <b>{TRIP.subtitle}</b>. Drive to a base,
            stay put, explore. Built to work fully offline, so it keeps going where the signal doesn’t.
          </p>
          <p className="muted" style={{ marginBottom: 0, fontStyle: 'italic', fontFamily: 'var(--serif)' }}>“{TRIP.tagline}”</p>
        </div>

        {/* BACKUP */}
        <div>
          <div className="section-title" style={{ margin: '8px 0 6px' }}><Diamond /><h2 style={{ fontSize: '1.2rem' }}>Backup &amp; restore</h2></div>
          <p className="credit-line" style={{ marginTop: 0 }}>
            Your journal notes and photos/videos live on this phone only. To be safe on a trip you can’t redo,
            export a backup to your phone (Files/iCloud) now and then — and restore it if you ever need to.
          </p>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={doExport}>⬇︎ Export journal &amp; photos</button>
              <button className="btn ghost" onClick={() => importRef.current.click()}>⬆︎ Restore from backup</button>
              <input ref={importRef} type="file" accept=".zip,application/zip" hidden onChange={doImport} />
            </div>
            {status && <p style={{ marginTop: 10, marginBottom: 0, fontSize: '0.85rem', color: 'var(--loch)' }}>{status}</p>}
            <p className="muted" style={{ fontSize: '0.74rem', marginTop: 10, marginBottom: 0 }}>
              {photos} photo/video(s) stored{usage.usage ? ` · using ~${mb(usage.usage)} MB` : ''}{usage.quota ? ` of ~${mb(usage.quota)} MB available` : ''}.
              Backups are a single <code>.zip</code> containing your notes and every photo &amp; video.
            </p>
          </div>
        </div>

        {/* CREDITS */}
        <div>
          <div className="section-title" style={{ margin: '8px 0 4px' }}><Diamond /><h2 style={{ fontSize: '1.2rem' }}>Photo credits</h2></div>
          <p className="credit-line" style={{ marginTop: 0 }}>
            Photos are from Wikimedia Commons under their original licences (mostly CC BY / CC BY-SA / public domain);
            attribution is retained below. Your own photos replace the Commons image where added.
          </p>
          {!haveCredits && (
            <div className="note" style={{ marginBottom: 12 }}>
              <span className="diamond" />
              <div><span className="k label">Photos not fetched yet</span><p>Run <code>npm run fetch-photos</code> to download images and fill in full attribution.</p></div>
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
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="section-title" style={{ margin: '8px 0 4px' }}><Diamond /><h2 style={{ fontSize: '1.2rem' }}>Map data</h2></div>
          <p className="credit-line" style={{ marginTop: 0 }}>Live map tiles © OpenStreetMap contributors (ODbL). Rendering by Leaflet.</p>
        </div>

        <p className="muted center" style={{ fontSize: '0.72rem' }}>Made with love for the road. Version 2.0 · works offline.</p>
      </div>
    </>
  )
}
