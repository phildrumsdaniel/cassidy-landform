import { Link } from 'react-router-dom'
import { bases, TRIP, legs, twoNightBases } from '../data/bases.js'
import { poi } from '../data/pois.js'
import { currentBaseId, daysUntilStart } from '../lib/trip.js'
import { useTheme } from '../lib/theme.js'
import Photo from '../components/Photo.jsx'
import { DayPlate, Diamond, Eyebrow } from '../components/ui.jsx'
import { IconMoon, IconSun, IconMap, IconCheck, IconList, IconInfo } from '../components/icons.jsx'
import BackupBanner from '../components/BackupBanner.jsx'
import SyncBadge from '../components/SyncBadge.jsx'

const totalMiles = legs.reduce((s, l) => s + l.miles, 0)
const BASE_URL = import.meta.env.BASE_URL

export default function Home() {
  const [theme, toggle] = useTheme()
  const todayId = currentBaseId()
  const until = daysUntilStart()

  return (
    <>
      <header className="topbar home-hero" style={{ paddingBottom: 22 }}>
        <img
          className="home-backdrop"
          src={`${BASE_URL}images/glencoe.jpg`}
          alt=""
          aria-hidden="true"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <button className="theme-toggle" onClick={toggle} aria-label="Toggle dark mode">
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <figure className="portrait">
          <img
            src={`${BASE_URL}images/mine/phil-tracey-avatar.jpg`}
            alt="Phil and Tracey"
            onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }}
          />
          <figcaption>Phil &amp; Tracey</figcaption>
        </figure>
        <Eyebrow>{TRIP.who} · 8–23 August 2026</Eyebrow>
        <h1 className="serif" style={{ fontSize: '2.2rem', margin: '6px 0 2px' }}>{TRIP.title}</h1>
        <div className="eyebrow" style={{ color: 'var(--whisky-soft)', letterSpacing: '.26em' }}>{TRIP.subtitle}</div>
        <p style={{ margin: '10px 0 0', opacity: 0.92, fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
          {TRIP.tagline}
        </p>
        {todayId ? (
          <Link to={`/base/${todayId}`} style={{ textDecoration: 'none', display: 'inline-block', marginTop: 16 }}>
            <span className="today-pill"><Diamond /> You’re here today → Base {todayId}</span>
          </Link>
        ) : until != null ? (
          <p style={{ marginTop: 14, marginBottom: 0, fontSize: '0.82rem', opacity: 0.85 }}>
            {until === 0 ? 'The adventure begins today!' : `${until} day${until === 1 ? '' : 's'} until departure`}
          </p>
        ) : (
          <p style={{ marginTop: 14, marginBottom: 0, fontSize: '0.82rem', opacity: 0.85 }}>Trip complete — 16 days of memories.</p>
        )}
      </header>

      <div className="stat">
        <div><span className="n">16</span><span className="l">Days</span></div>
        <div><span className="n">9</span><span className="l">Bases</span></div>
        <div><span className="n">~{totalMiles.toLocaleString()}</span><span className="l">Miles</span></div>
      </div>

      <div className="container" style={{ paddingTop: 0 }}>
        <div className="intro">
          <b>The idea:</b> drive to a base and <b>stay put</b> — {twoNightBases} of the nine bases are two-night stops, so most mornings you wake up, leave the van pitched, and go exploring.
        </div>

        <BackupBanner />
        <SyncBadge />

        <div className="quicklinks">
          <Link className="quicklink" to="/map"><IconMap /><span>Map</span></Link>
          <Link className="quicklink" to="/costs"><IconList /><span>Bases &amp; costs</span></Link>
          <Link className="quicklink" to="/packing"><IconCheck /><span>Packing</span></Link>
          <Link className="quicklink" to="/about"><IconInfo /><span>About &amp; backup</span></Link>
        </div>

        <Link className="book-cta" to="/book">
          <span className="book-cta-emoji">📖</span>
          <span>
            <b>Make a keepsake book</b>
            <small>Turn your notes &amp; photos into a printable PDF</small>
          </span>
          <span className="book-cta-arrow">→</span>
        </Link>

        <div className="section-title" style={{ marginTop: 24 }}>
          <Diamond /><h2>The nine bases</h2>
        </div>

        {bases.map((b) => {
          const h = poi(b.hero)
          const isToday = todayId === b.id
          const label = b.id === 10 ? 'Home' : `${b.id}`
          return (
            <Link className="dcard" to={`/base/${b.id}`} key={b.id} style={isToday ? { outline: '2px solid var(--whisky)' } : undefined}>
              <DayPlate n={b.id === 10 ? '⌂' : b.id} label={b.id === 10 ? 'Trip' : 'Base'} />
              <div className="meta">
                <span className="date">{b.dateLabel}{isToday ? ' · Today' : ''}</span>
                <span className="rtitle">{b.name}</span>
                <span className="overnight"><Diamond /> {b.nights === 0 ? 'Drive home' : `${b.nights} night${b.nights > 1 ? 's' : ''} · ${b.region}`}</span>
              </div>
              <div className="thumb"><Photo slug={h.slug} name={h.name} /></div>
            </Link>
          )
        })}

        <p className="center muted" style={{ fontSize: '0.75rem', margin: '18px 0 4px' }}>Drive less. Stay longer. Safe travels.</p>
      </div>
    </>
  )
}
