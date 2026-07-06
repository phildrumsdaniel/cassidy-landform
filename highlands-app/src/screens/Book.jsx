import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bases, TRIP, legs } from '../data/bases.js'
import { poi } from '../data/pois.js'
import { getAllMedia } from '../lib/media.js'
import { usePersistentState } from '../lib/storage.js'
import { Eyebrow } from '../components/ui.jsx'

const BASE_URL = import.meta.env.BASE_URL
const totalMiles = legs.reduce((s, l) => s + l.miles, 0)

// A print-ready keepsake book, styled in the app's brand. "Save as PDF" uses
// the browser print dialog (iOS: Share → Save to Files as PDF). Works offline;
// photos come from IndexedDB. Videos aren't included in a PDF.
export default function Book() {
  const navigate = useNavigate()
  const [media, setMedia] = useState([])
  const urls = useRef(new Map())

  // read all journal notes once
  const notes = useMemo(() => {
    const out = {}
    bases.forEach((b) => {
      try { out[b.id] = JSON.parse(localStorage.getItem(`highlands:journal:${b.id}`) || '""') } catch { out[b.id] = '' }
    })
    return out
  }, [])

  useEffect(() => { getAllMedia().then(setMedia) }, [])
  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current.clear() }, [])

  const urlFor = (m) => {
    if (!urls.current.has(m.id)) urls.current.set(m.id, URL.createObjectURL(m.blob))
    return urls.current.get(m.id)
  }

  const photosByBase = useMemo(() => {
    const g = {}
    media.filter((m) => m.type === 'image').forEach((m) => { (g[m.baseId] = g[m.baseId] || []).push(m) })
    return g
  }, [media])

  const chapters = bases.filter((b) => (notes[b.id] && notes[b.id].trim()) || (photosByBase[b.id] || []).length)
  const empty = chapters.length === 0
  const photoCount = media.filter((m) => m.type === 'image').length

  return (
    <>
      <header className="topbar no-print">
        <button className="back" onClick={() => navigate('/')}>← Home</button>
        <div style={{ marginTop: 12 }}>
          <Eyebrow>Your keepsake</Eyebrow>
          <h1 className="serif" style={{ fontSize: '1.8rem', marginTop: 4 }}>Make a book</h1>
        </div>
      </header>

      <div className="container no-print">
        <p className="muted" style={{ marginTop: 0 }}>
          A printable book of your journey — notes and photos, base by base. Tap below, then choose
          <b> Save to Files / Save as PDF</b> in the print screen.
        </p>
        <button className="btn gold" onClick={() => window.print()} style={{ marginBottom: 6 }}>⬇︎ Save as PDF / Print</button>
        {empty && (
          <div className="note" style={{ marginTop: 12 }}>
            <span className="diamond" />
            <div><span className="k label">Nothing to bind yet</span><p>Add journal notes and photos as you travel — they’ll fill these pages. Here’s a preview of the cover.</p></div>
          </div>
        )}
        {!empty && <p className="muted" style={{ fontSize: '0.8rem' }}>{chapters.length} chapters · {photoCount} photo{photoCount === 1 ? '' : 's'}.</p>}
      </div>

      {/* THE BOOK */}
      <div className="book">
        {/* Cover */}
        <section className="book-page cover">
          <div className="cover-frame">
            <img src={`${BASE_URL}images/mine/phil-tracey.jpg`} alt="Phil and Tracey" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          </div>
          <div className="cover-eyebrow">{TRIP.who} · 8–23 August 2026</div>
          <h1 className="cover-title serif">{TRIP.title}</h1>
          <div className="cover-sub">{TRIP.subtitle}</div>
          <div className="cover-tag serif">“{TRIP.tagline}”</div>
          <div className="cover-foot">16 days · 9 bases · ~{totalMiles.toLocaleString()} miles</div>
        </section>

        {/* Chapters */}
        {chapters.map((b) => {
          const photos = photosByBase[b.id] || []
          return (
            <section className="book-page" key={b.id}>
              <div className="ch-eyebrow">{b.id === 10 ? 'The drive home' : `Base ${b.id}`} · {b.dateLabel} · {b.region}</div>
              <h2 className="ch-title serif">{b.name}</h2>
              {notes[b.id] && notes[b.id].trim()
                ? <p className="ch-note serif">{notes[b.id]}</p>
                : <p className="ch-note serif muted">{b.goodToKnow}</p>}
              {photos.length > 0 && (
                <div className={`ch-photos count-${Math.min(photos.length, 4)}`}>
                  {photos.map((m) => <img key={m.id} src={urlFor(m)} alt="" />)}
                </div>
              )}
            </section>
          )
        })}

        {/* Closing */}
        <section className="book-page closing">
          <img className="closing-map" src={`${BASE_URL}route-static.svg`} alt="Route map" />
          <h2 className="ch-title serif" style={{ textAlign: 'center' }}>Safe home</h2>
          <p className="ch-note serif" style={{ textAlign: 'center' }}>16 days, 9 bases and ~{totalMiles.toLocaleString()} miles of slow roads and big views.</p>
          <div className="cover-foot" style={{ textAlign: 'center' }}>✦ Phil &amp; Tracey · Highlands Adventure 2026 ✦</div>
        </section>
      </div>
    </>
  )
}
