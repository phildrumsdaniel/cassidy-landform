import { useState } from 'react'
import { usePersistentState } from '../lib/storage.js'
import { parseBookingEmail } from '../lib/parseBooking.js'

const tel = (s) => (s || '').replace(/[^0-9+]/g, '')
const mapsSearch = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

// A suggested (default) campsite/hotel from the itinerary data.
function Stay({ s }) {
  return (
    <div className="stay">
      <div className="stay-kind label">{s.kind}</div>
      <div className="stay-name">{s.name}</div>
      <div className="stay-meta">
        {s.tel && <a className="tel" href={`tel:${s.tel}`}>☎ {s.phone}</a>}
        {s.postcode && <span className="pc">{s.postcode}</span>}
        {s.cost != null ? <span className="cost">≈ £{s.cost}</span> : <span className="cost tbc">Confirm rate</span>}
      </div>
      {s.note && <div className="stay-note">{s.note}</div>}
      <div className="stay-links">
        {s.url && <a className="btn ghost" href={s.url} target="_blank" rel="noreferrer">Book ↗</a>}
        {s.lat != null && <a className="btn ghost" href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`} target="_blank" rel="noreferrer">Directions ↗</a>}
      </div>
    </div>
  )
}

// Your actual booking for a base — overrides the suggested site. Saved on the
// phone (and included in the backup export). This is how you change the
// itinerary to the site you really booked when the suggestion is full.
export default function MyBooking({ base }) {
  const [booking, setBooking] = usePersistentState(`booking:${base.id}`, null)
  const [draft, setDraft] = useState(null) // null = closed
  const [paste, setPaste] = useState('')
  const [pasteMsg, setPasteMsg] = useState('')

  const open = () => { setPaste(''); setPasteMsg(''); setDraft(booking || { name: '', phone: '', postcode: '', cost: '', note: '', url: '' }) }
  const close = () => setDraft(null)
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  function autofill() {
    const r = parseBookingEmail(paste)
    if (!r.found) { setPasteMsg('Couldn’t read that — paste the whole confirmation, or just type the details below.'); return }
    setDraft((d) => ({
      ...d,
      name: r.name || d.name,
      phone: r.phone || d.phone,
      postcode: r.postcode || d.postcode,
      cost: r.cost || d.cost,
      note: r.note || d.note
    }))
    setPasteMsg(
      r.arrivalISO && r.arrivalISO !== base.start
        ? `Filled in ✓ — note: this email’s arrival (${r.arrivalISO}) isn’t ${base.name}’s date. Right base?`
        : 'Filled in below ✓ — check it and Save.'
    )
  }

  function save() {
    const name = (draft.name || '').trim()
    if (!name) { close(); return }
    setBooking({ ...draft, name })
    close()
  }
  function remove() {
    if (confirm('Remove your booking for this base? (The suggested site stays.)')) { setBooking(null); close() }
  }

  return (
    <>
      {booking ? (
        <div className="stay booked">
          <div className="stay-kind label">✓ Your booking</div>
          <div className="stay-name">{booking.name}</div>
          <div className="stay-meta">
            {booking.phone && <a className="tel" href={`tel:${tel(booking.phone)}`}>☎ {booking.phone}</a>}
            {booking.postcode && <span className="pc">{booking.postcode}</span>}
            {booking.cost !== '' && booking.cost != null && <span className="cost">≈ £{booking.cost}</span>}
          </div>
          {booking.note && <div className="stay-note">{booking.note}</div>}
          <div className="stay-links">
            {booking.url && <a className="btn ghost" href={booking.url} target="_blank" rel="noreferrer">Booking ↗</a>}
            {(booking.postcode || booking.name) && <a className="btn ghost" href={mapsSearch(booking.postcode || `${booking.name}, ${base.region}`)} target="_blank" rel="noreferrer">Directions ↗</a>}
            <button className="btn ghost" onClick={open}>Edit</button>
          </div>
        </div>
      ) : (
        <button className="btn gold" onClick={open} style={{ marginBottom: 4 }}>＋ Add the site you booked</button>
      )}

      {booking
        ? (
          <details className="alt-sites" style={{ marginTop: 12 }}>
            <summary>Our original suggestion</summary>
            <div className="alt-body">{base.stays.map((s, i) => <Stay s={s} key={i} />)}</div>
          </details>
        )
        : (
          <>
            <div className="label" style={{ margin: '14px 0 8px' }}>Our suggestion</div>
            {base.stays.map((s, i) => <Stay s={s} key={i} />)}
          </>
        )}

      {draft && (
        <div className="lightbox" onClick={close}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <strong className="serif">Your booking · {base.name}</strong>
              <button className="btn ghost" onClick={close}>Cancel</button>
            </div>

            <details className="paste-box">
              <summary>📋 Paste a confirmation email to autofill</summary>
              <div style={{ padding: '8px 0 2px' }}>
                <textarea className="cap" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)}
                  placeholder="Paste the whole booking confirmation email here…" />
                <button className="btn gold" style={{ marginTop: 8 }} onClick={autofill}>Autofill from email</button>
                {pasteMsg && <p className="muted" style={{ fontSize: '0.78rem', marginTop: 8 }}>{pasteMsg}</p>}
              </div>
            </details>

            <div className="form">
              <label className="fld"><span>Site name *</span>
                <input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Dropback Farm" autoFocus /></label>
              <label className="fld"><span>Phone</span>
                <input value={draft.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="01768 …" /></label>
              <div className="fld-row">
                <label className="fld"><span>Postcode</span>
                  <input value={draft.postcode} onChange={(e) => set('postcode', e.target.value)} placeholder="CA12 …" /></label>
                <label className="fld"><span>£ / night</span>
                  <input value={draft.cost} onChange={(e) => set('cost', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="30" /></label>
              </div>
              <label className="fld"><span>Notes (pitch, arrival time…)</span>
                <input value={draft.note} onChange={(e) => set('note', e.target.value)} placeholder="Caravan & Motorhome Club site · booked" /></label>
              <label className="fld"><span>Booking link (optional)</span>
                <input value={draft.url} onChange={(e) => set('url', e.target.value)} inputMode="url" placeholder="https://…" /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button className="btn gold" onClick={save}>Save booking</button>
              {booking && <button className="btn danger" onClick={remove}>Remove</button>}
            </div>
            <p className="muted" style={{ fontSize: '0.72rem', marginTop: 10 }}>Saved on this phone and included in your backup. Shows in place of the suggested site.</p>
          </div>
        </div>
      )}
    </>
  )
}
