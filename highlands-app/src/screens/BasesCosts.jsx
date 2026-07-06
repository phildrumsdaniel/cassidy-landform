import { useNavigate, Link } from 'react-router-dom'
import { bases, legs } from '../data/bases.js'
import { useChecklist } from '../lib/storage.js'
import { Eyebrow, Diamond } from '../components/ui.jsx'
import { IconCheck } from '../components/icons.jsx'

const betweenBases = legs.filter((l) => l.n < legs.length).reduce((s, l) => s + l.miles, 0)
const allDriving = legs.reduce((s, l) => s + l.miles, 0)
const totalNights = legs.reduce((s, l) => s + l.nights, 0)

// Every stay across the trip, for the booking tracker + cost total.
const stays = bases.flatMap((b) => b.stays.map((s) => ({ ...s, baseId: b.id, baseName: b.name, dateLabel: b.dateLabel })))
const knownCost = stays.reduce((s, x) => s + (x.cost || 0), 0)
const hasTbc = stays.some((x) => x.cost == null)

export default function BasesCosts() {
  const navigate = useNavigate()
  const [ticked, toggle] = useChecklist('bookings')
  const booked = stays.filter((s) => ticked[`${s.baseId}|${s.name}`]).length

  return (
    <>
      <header className="topbar">
        <button className="back" onClick={() => navigate('/')}>← Home</button>
        <div style={{ marginTop: 12 }}>
          <Eyebrow>The loop &amp; the numbers</Eyebrow>
          <h1 className="serif" style={{ fontSize: '1.8rem', marginTop: 4 }}>Bases &amp; costs</h1>
        </div>
      </header>

      <div className="container stack">
        <div className="section-title" style={{ margin: '6px 0 6px' }}><Diamond /><h2 style={{ fontSize: '1.15rem' }}>Driving &amp; mileage</h2></div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="mtab">
            <thead><tr><th>Leg</th><th>Miles</th><th>Drive</th><th>Nights</th></tr></thead>
            <tbody>
              {legs.map((l) => (
                <tr key={l.n}>
                  <td><span className="nn">{l.n}</span> {l.route}</td>
                  <td>~{l.miles}</td>
                  <td>{l.drive}</td>
                  <td>{l.nights || '—'}</td>
                </tr>
              ))}
              <tr className="tot"><td>All driving legs</td><td>~{allDriving.toLocaleString()}</td><td>—</td><td>{totalNights}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="note">
          <span className="diamond" />
          <div>
            <span className="k label">Fuel budget</span>
            <p>Between bases is ~{betweenBases.toLocaleString()} mi; the drive home adds ~380. With day-trips on top, budget fuel for roughly <b>1,900–2,000 miles</b> — about <b>£450–520</b>.</p>
          </div>
        </div>

        <div className="section-title" style={{ margin: '10px 0 4px' }}><Diamond /><h2 style={{ fontSize: '1.15rem' }}>Booking tracker</h2></div>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.82rem' }}>{booked} of {stays.length} booked · tick as you confirm (saved on this phone).</p>
        {stays.map((s) => {
          const key = `${s.baseId}|${s.name}`
          const on = !!ticked[key]
          return (
            <div className={`check-item${on ? ' on' : ''}`} key={key} onClick={() => toggle(key)}>
              <span className="box">{on && <IconCheck />}</span>
              <span className="txt" style={{ flex: 1 }}>
                <b style={{ color: on ? 'inherit' : 'var(--loch)' }}>{s.name}</b><br />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>
                  {s.dateLabel}{s.phone ? ` · ${s.phone}` : ''} · {s.cost != null ? `≈ £${s.cost}` : 'confirm rate'}
                </span>
              </span>
            </div>
          )
        })}

        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="label" style={{ marginBottom: 6 }}>Estimated totals (2026)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--serif)', fontSize: '1.05rem' }}>
            <span>Campsites (known)</span><span>≈ £{knownCost}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-soft)', marginTop: 4, fontSize: '0.9rem' }}>
            <span>+ Galley of Lorne hotel</span><span>confirm rate</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-soft)', marginTop: 4, fontSize: '0.9rem' }}>
            <span>+ Fuel (~2,000 mi)</span><span>≈ £450–520</span>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--serif)', fontSize: '1.1rem', color: 'var(--loch)' }}>
            <span><b>All in{hasTbc ? '*' : ''}</b></span><span><b>≈ £950–1,050</b></span>
          </div>
          <p className="muted" style={{ fontSize: '0.72rem', marginTop: 8, marginBottom: 0 }}>
            *Before food, ferries, whisky &amp; the hotel room. Rough prices — confirm each when you book. August fills fast.
          </p>
        </div>

        <Link className="btn" to="/predeparture" style={{ alignSelf: 'flex-start' }}>Pre-departure checklist →</Link>
      </div>
    </>
  )
}
