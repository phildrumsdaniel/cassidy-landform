import { useParams, useNavigate, Link } from 'react-router-dom'
import { useRef } from 'react'
import { days } from '../data/days.js'
import Photo from '../components/Photo.jsx'
import { DayPlate, Diamond, Ribbon, Note, Eyebrow } from '../components/ui.jsx'
import { IconChevronLeft, IconChevronRight, IconPin } from '../components/icons.jsx'
import Journal from '../components/Journal.jsx'

export default function DayDetail() {
  const { n } = useParams()
  const navigate = useNavigate()
  const num = parseInt(n, 10)
  const day = days.find((d) => d.n === num)

  const touch = useRef({ x: 0, y: 0 })

  if (!day) {
    return (
      <div className="container">
        <p>Day not found.</p>
        <Link className="btn" to="/">← Home</Link>
      </div>
    )
  }

  const prev = days.find((d) => d.n === num - 1)
  const next = days.find((d) => d.n === num + 1)
  const hero = day.pois.find((p) => p.image === day.hero) || day.pois[0]

  const onTouchStart = (e) => {
    touch.current = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
  }
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && next) navigate(`/day/${next.n}`)
      if (dx > 0 && prev) navigate(`/day/${prev.n}`)
    }
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="hero">
        <Photo slug={hero?.image} name={hero?.name || day.title} className="hero-img" eager minimal />
        <div className="hero-overlay" />
        <div className="hero-content">
          <button className="back" onClick={() => navigate('/')} style={{ marginBottom: 14 }}>← All days</button>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <DayPlate n={day.n} />
            <div>
              <Eyebrow>{day.weekday} {day.date}</Eyebrow>
              <h1 style={{ fontSize: '1.7rem', marginTop: 4, color: '#fff' }}>{day.title}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container stack">
        <Ribbon drive={day.drive} distance={day.distance} overnight={day.overnight} />

        <div>
          <div className="section-title" style={{ margin: '6px 0 10px' }}>
            <Diamond /><h2>The plan</h2>
          </div>
          <ul className="plan">
            {day.plan.map((p, i) => (
              <li key={i}><Diamond /> <span>{p}</span></li>
            ))}
          </ul>
        </div>

        <Note>{day.goodToKnow}</Note>

        <div>
          <div className="section-title" style={{ margin: '18px 0 12px' }}>
            <Diamond /><h2>Points of interest</h2>
          </div>
          {day.pois.map((poi) => (
            <div className="poi" key={poi.image + poi.name}>
              <Photo slug={poi.image} name={poi.name} className="poi-img" />
              <div className="poi-body">
                <div className="poi-name">{poi.name}</div>
                <p className="poi-blurb">{poi.blurb}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {poi.lat != null && (
                    <Link
                      className="btn"
                      to={`/map?lat=${poi.lat}&lng=${poi.lng}&name=${encodeURIComponent(poi.name)}&day=${day.n}`}
                    >
                      <IconPin /> Show on map
                    </Link>
                  )}
                  {poi.lat != null && (
                    <a
                      className="btn ghost"
                      href={`https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Maps ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="section-title" style={{ margin: '18px 0 10px' }}>
            <Diamond /><h2>Journal</h2>
          </div>
          <Journal dayN={day.n} />
        </div>

        <div className="daynav">
          <button className="btn ghost" disabled={!prev} onClick={() => prev && navigate(`/day/${prev.n}`)}>
            <IconChevronLeft /> {prev ? `Day ${prev.n}` : 'Start'}
          </button>
          <button className="btn ghost" disabled={!next} onClick={() => next && navigate(`/day/${next.n}`)}>
            {next ? `Day ${next.n}` : 'End'} <IconChevronRight />
          </button>
        </div>
        <p className="swipe-hint">← swipe between days →</p>
      </div>
    </div>
  )
}
