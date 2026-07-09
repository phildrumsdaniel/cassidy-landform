import { useParams, useNavigate, Link } from 'react-router-dom'
import { useRef } from 'react'
import { bases, alternateSites, altReturn } from '../data/bases.js'
import { poi } from '../data/pois.js'

const mapsSearch = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
import Photo from '../components/Photo.jsx'
import { DayPlate, Diamond, BaseRibbon, Note, Eyebrow } from '../components/ui.jsx'
import { IconChevronLeft, IconChevronRight, IconPin } from '../components/icons.jsx'
import MediaJournal from '../components/MediaJournal.jsx'
import ShareSheet from '../components/ShareSheet.jsx'
import { useState } from 'react'

function Stay({ s }) {
  return (
    <div className="stay">
      <div className="stay-kind label">{s.kind}</div>
      <div className="stay-name">{s.name}</div>
      <div className="stay-meta">
        {s.tel && <a className="tel" href={`tel:${s.tel}`}>☎ {s.phone}</a>}
        {s.postcode && <span className="pc">{s.postcode}</span>}
        {s.cost != null
          ? <span className="cost">≈ £{s.cost}</span>
          : <span className="cost tbc">Confirm rate</span>}
      </div>
      {s.note && <div className="stay-note">{s.note}</div>}
      <div className="stay-links">
        {s.url && <a className="btn ghost" href={s.url} target="_blank" rel="noreferrer">Book ↗</a>}
        {s.lat != null && (
          <a className="btn ghost" href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`} target="_blank" rel="noreferrer">Directions ↗</a>
        )}
      </div>
    </div>
  )
}

export default function BaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const n = parseInt(id, 10)
  const base = bases.find((b) => b.id === n)
  const touch = useRef({ x: 0, y: 0 })
  const [share, setShare] = useState(false)

  if (!base) {
    return <div className="container"><p>Base not found.</p><Link className="btn" to="/">← Home</Link></div>
  }

  const prev = bases.find((b) => b.id === n - 1)
  const next = bases.find((b) => b.id === n + 1)
  const hero = poi(base.hero)
  const pois = base.explore.map(poi)

  const onStart = (e) => { touch.current = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } }
  const onEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && next) navigate(`/base/${next.id}`)
      if (dx > 0 && prev) navigate(`/base/${prev.id}`)
    }
  }

  return (
    <div onTouchStart={onStart} onTouchEnd={onEnd}>
      <div className="hero">
        <Photo slug={hero.slug} name={hero.name} className="hero-img" eager minimal />
        <div className="hero-overlay" />
        <div className="hero-content">
          <button className="back" onClick={() => navigate('/')} style={{ marginBottom: 14 }}>← All bases</button>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <DayPlate n={base.id === 10 ? '⌂' : base.id} label={base.id === 10 ? 'Trip' : 'Base'} />
            <div>
              <Eyebrow>{base.dateLabel} · {base.region}</Eyebrow>
              <h1 style={{ fontSize: '1.8rem', marginTop: 4, color: '#fff' }}>{base.name}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container stack">
        <BaseRibbon miles={base.miles} drive={base.drive} nights={base.nights} />
        <p className="muted" style={{ margin: '-4px 2px 0', fontSize: '0.85rem' }}>
          From {base.from}{base.via ? ` · via ${base.via}` : ''}
        </p>

        {base.stays.length > 0 && (
          <div>
            <div className="section-title" style={{ margin: '10px 0 10px' }}><Diamond /><h2>Where you stay</h2></div>
            {base.stays.map((s, i) => <Stay s={s} key={i} />)}

            <details className="alt-sites">
              <summary>Fully booked? Alternatives &amp; nearby sites</summary>
              <div className="alt-body">
                {(alternateSites[base.id] || []).length > 0 && (
                  <>
                    <div className="label" style={{ marginBottom: 6 }}>Nearby sites to try</div>
                    {(alternateSites[base.id] || []).map((name) => (
                      <a className="alt-row" key={name} href={mapsSearch(`${name}, ${base.region}, Scotland`)} target="_blank" rel="noreferrer">
                        <span>{name}</span><span className="alt-cta">Find &amp; call ↗</span>
                      </a>
                    ))}
                    <p className="muted" style={{ fontSize: '0.72rem', margin: '8px 0 12px' }}>Suggestions — confirm availability &amp; price when you call.</p>
                  </>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a className="btn" href={mapsSearch(`caravan and camping sites near ${base.name}, ${base.region}`)} target="_blank" rel="noreferrer">📍 Sites near {base.name}</a>
                  <a className="btn ghost" href={`https://park4night.com/en/search?lat=${base.lat}&lng=${base.lng}`} target="_blank" rel="noreferrer">Motorhome aires ↗</a>
                </div>
                <p className="muted" style={{ fontSize: '0.72rem', marginTop: 8, marginBottom: 0 }}>Opens maps with campsites around here — each listing has a Call button. (Needs signal.)</p>
              </div>
            </details>
          </div>
        )}

        {base.id === 10 && (
          <Note title={altReturn.title}>
            {altReturn.blurb}
            <span style={{ display: 'block', marginTop: 8 }}>
              {altReturn.stops.map((s, i) => <span key={i} style={{ display: 'block' }}>· {s}</span>)}
            </span>
          </Note>
        )}

        <Note>{base.goodToKnow}</Note>

        <div>
          <div className="section-title" style={{ margin: '18px 0 12px' }}>
            <Diamond /><h2>{base.nights === 0 ? 'On the way home' : 'Explore from here'}</h2>
          </div>
          {pois.map((p) => (
            <div className="poi" key={p.slug}>
              <Photo slug={p.slug} name={p.name} className="poi-img" />
              <div className="poi-body">
                <div className="poi-name">{p.name}</div>
                <p className="poi-blurb">{p.blurb}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {p.lat != null && (
                    <Link className="btn" to={`/map?lat=${p.lat}&lng=${p.lng}&name=${encodeURIComponent(p.name)}&base=${base.id}`}><IconPin /> Show on map</Link>
                  )}
                  {p.lat != null && (
                    <a className="btn ghost" href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">Open in Maps ↗</a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="section-title" style={{ margin: '18px 0 10px' }}><Diamond /><h2>Journal</h2></div>
          <p className="muted" style={{ marginTop: '-4px', fontSize: '0.82rem' }}>Notes, photos &amp; videos — saved on your phone, works offline.</p>
          <MediaJournal baseId={base.id} />
          <button className="btn gold" style={{ marginTop: 12 }} onClick={() => setShare(true)}>✦ Share this base</button>
        </div>

        <div className="daynav">
          <button className="btn ghost" disabled={!prev} onClick={() => prev && navigate(`/base/${prev.id}`)}>
            <IconChevronLeft /> {prev ? prev.name.split(' ')[0] : 'Start'}
          </button>
          <button className="btn ghost" disabled={!next} onClick={() => next && navigate(`/base/${next.id}`)}>
            {next ? next.name.split(' ')[0] : 'End'} <IconChevronRight />
          </button>
        </div>
        <p className="swipe-hint">← swipe between bases →</p>
      </div>

      {share && <ShareSheet base={base} onClose={() => setShare(false)} />}
    </div>
  )
}
