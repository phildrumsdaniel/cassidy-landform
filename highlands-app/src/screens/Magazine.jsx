import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TRIP, bases } from '../data/bases.js'
import { POIS } from '../data/pois.js'
import Photo from '../components/Photo.jsx'
import { readJSON, subscribeKey } from '../lib/storage.js'
import { cloudOn, listAllPhotos, publicUrl, thumbUrl } from '../lib/cloud.js'
import { shareTrip } from '../lib/share.js'
import { VIEW_ONLY } from '../lib/viewOnly.js'

const dateRange = () => {
  const opts = { day: 'numeric', month: 'long' }
  try {
    const s = new Date(TRIP.startDate).toLocaleDateString('en-GB', opts)
    const e = new Date(TRIP.endDate).toLocaleDateString('en-GB', { ...opts, year: 'numeric' })
    return `${s} – ${e}`
  } catch { return '' }
}

// A read-only, magazine-style telling of the whole trip: every stop, the public
// notes, the shared photos, and — crucially — everywhere that was recommended,
// whether or not it was visited.
export default function Magazine() {
  const navigate = useNavigate()
  const [photosByBase, setPhotosByBase] = useState({})
  const [notes, setNotes] = useState(() =>
    Object.fromEntries(bases.map((b) => [b.id, readJSON(`journalpub:${b.id}`, '')]))
  )
  const [lightbox, setLightbox] = useState(null)
  const [toast, setToast] = useState('')

  // Feature the destinations, not the final drive-home leg.
  const stops = bases.filter((b) => b.name !== 'Home')

  useEffect(() => {
    if (!cloudOn()) return
    listAllPhotos().then((rows) => {
      const g = {}
      for (const r of rows) (g[r.base_id] = g[r.base_id] || []).push(r)
      setPhotosByBase(g)
    })
  }, [])

  // Keep public notes live as sync lands them (important on a viewer's device).
  useEffect(() => {
    const unsubs = bases.map((b) =>
      subscribeKey(`journalpub:${b.id}`, (v) => setNotes((n) => ({ ...n, [b.id]: v })))
    )
    return () => unsubs.forEach((u) => u())
  }, [])

  async function onShare() {
    const r = await shareTrip()
    if (r.how === 'copied') { setToast('Link copied — paste it to anyone'); setTimeout(() => setToast(''), 2500) }
    else if (r.how === 'manual') { setToast(r.url) }
  }

  return (
    <div className="mag">
      <header className="mag-cover">
        <Photo slug={bases[0].hero} name={TRIP.title} className="mag-cover-img" eager />
        <div className="mag-cover-text">
          <div className="mag-kicker">A Highlands travel journal</div>
          <h1 className="serif">{TRIP.title}</h1>
          <div className="mag-sub">{TRIP.subtitle} · {TRIP.who}</div>
          <div className="mag-dates">{dateRange()}</div>
          <button className="btn gold mag-share" onClick={onShare}>🔗 Share this journal</button>
        </div>
      </header>

      {!VIEW_ONLY && (
        <div className="mag-editnote container">
          You’re previewing the public journal. Only your <strong>🌍 public notes</strong> and shared photos appear here — private notes and costs never do. Tap <em>Share</em> to send the view-only link.
        </div>
      )}

      {stops.map((b) => {
        const shots = photosByBase[b.id] || []
        const note = notes[b.id]
        return (
          <section className="mag-stop" key={b.id}>
            <div className="mag-stop-head container">
              <span className="mag-num">Stop {b.id}</span>
              <h2 className="serif">{b.name}</h2>
              <div className="mag-meta">{b.region} · {b.dateLabel} · {b.nights} night{b.nights > 1 ? 's' : ''}</div>
            </div>

            <Photo slug={b.hero} name={b.name} className="mag-hero" />

            {note && <p className="mag-note container">{note}</p>}

            {shots.length > 0 && (
              <div className="mag-gallery">
                {shots.map((r) => (
                  <button className="mag-shot" key={r.uid} onClick={() => setLightbox(publicUrl(r.path))}>
                    <img
                      src={r.type === 'video' ? publicUrl(r.path) : thumbUrl(r.path)}
                      alt="Trip photo" loading="lazy" decoding="async"
                      onError={(e) => { if (!e.currentTarget.dataset.f) { e.currentTarget.dataset.f = '1'; e.currentTarget.src = publicUrl(r.path) } }}
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="container">
              <div className="mag-section-label">Worth seeing here</div>
              <div className="mag-pois">
                {b.explore.map((slug) => {
                  const poi = POIS[slug]
                  if (!poi) return null
                  return (
                    <div className="mag-poi" key={slug}>
                      <Photo slug={slug} name={poi.name} className="mag-poi-img" />
                      <div className="mag-poi-text">
                        <strong>{poi.name}</strong>
                        <p>{poi.blurb}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })}

      <footer className="mag-foot">
        <div className="serif">{TRIP.title}</div>
        <div>{TRIP.who} · {dateRange()}</div>
        {!VIEW_ONLY && <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => navigate('/')}>← Back to the app</button>}
      </footer>

      {toast && <div className="mag-toast" onClick={() => setToast('')}>{toast}</div>}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox} alt="Trip photo" />
            <div className="lightbox-bar"><button className="btn" onClick={() => setLightbox(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
