import { Link } from 'react-router-dom'
import { days, TRIP } from '../data/days.js'
import { currentDayNumber, daysUntilStart } from '../lib/trip.js'
import { useTheme } from '../lib/theme.js'
import Photo from '../components/Photo.jsx'
import { DayPlate, Diamond, Eyebrow } from '../components/ui.jsx'
import { IconMoon, IconSun, IconMap, IconCheck, IconList, IconInfo } from '../components/icons.jsx'

function heroSlug(day) {
  const p = day.pois.find((x) => x.image === day.hero) || day.pois[0]
  return { slug: p?.image || day.hero, name: p?.name || day.title }
}

export default function Home() {
  const [theme, toggle] = useTheme()
  const todayN = currentDayNumber()
  const until = daysUntilStart()

  return (
    <>
      <header className="topbar" style={{ paddingBottom: 22 }}>
        <button className="theme-toggle" onClick={toggle} aria-label="Toggle dark mode">
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <Eyebrow>{TRIP.who} · 8–23 August 2026</Eyebrow>
        <h1 className="serif" style={{ fontSize: '2.2rem', margin: '6px 0 4px' }}>{TRIP.title}</h1>
        <p style={{ margin: '2px 0 0', opacity: 0.9, fontFamily: 'var(--serif)', fontStyle: 'italic', lineHeight: 1.4 }}>
          {TRIP.tagline}
        </p>
        {todayN ? (
          <Link to={`/day/${todayN}`} style={{ textDecoration: 'none', display: 'inline-block', marginTop: 16 }}>
            <span className="today-pill">
              <Diamond /> Day {todayN} of {TRIP.totalDays} — Today →
            </span>
          </Link>
        ) : until != null ? (
          <p style={{ marginTop: 14, marginBottom: 0, fontSize: '0.82rem', opacity: 0.85 }}>
            {until === 0 ? 'The adventure begins today!' : `${until} day${until === 1 ? '' : 's'} until departure`}
          </p>
        ) : (
          <p style={{ marginTop: 14, marginBottom: 0, fontSize: '0.82rem', opacity: 0.85 }}>
            Trip complete — 16 days of memories.
          </p>
        )}
      </header>

      <div className="container">
        <div className="quicklinks">
          <Link className="quicklink" to="/map"><IconMap /><span>Map</span></Link>
          <Link className="quicklink" to="/packing"><IconCheck /><span>Packing</span></Link>
          <Link className="quicklink" to="/predeparture"><IconList /><span>Pre-departure</span></Link>
          <Link className="quicklink" to="/about"><IconInfo /><span>About</span></Link>
        </div>

        <div className="section-title" style={{ marginTop: 24 }}>
          <Diamond />
          <h2>The 16-day route</h2>
        </div>

        {days.map((day) => {
          const h = heroSlug(day)
          const isToday = todayN === day.n
          return (
            <Link className="dcard" to={`/day/${day.n}`} key={day.n} style={isToday ? { outline: '2px solid var(--whisky)' } : undefined}>
              <DayPlate n={day.n} />
              <div className="meta">
                <span className="date">{day.weekday} {day.date}{isToday ? ' · Today' : ''}</span>
                <span className="rtitle">{day.title}</span>
                <span className="overnight"><Diamond /> {day.overnight}</span>
              </div>
              <div className="thumb">
                <Photo slug={h.slug} name={h.name} />
              </div>
            </Link>
          )
        })}

        <p className="center muted" style={{ fontSize: '0.75rem', margin: '18px 0 4px' }}>
          Slow roads. Big views. Safe travels.
        </p>
      </div>
    </>
  )
}
