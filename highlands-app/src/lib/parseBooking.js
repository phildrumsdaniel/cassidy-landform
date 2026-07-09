// Best-effort parser for campsite booking confirmation emails (tuned for
// Pitchup.com, works reasonably for others). Extracts the fields the booking
// editor needs; anything it misses you can just type in. Runs entirely on the
// phone — paste the email, no data leaves the device.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

const clean = (s) => (s || '').replace(/[\t ]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim()

export function parseBookingEmail(text) {
  const t = (text || '').replace(/\r/g, '')
  const out = { name: '', phone: '', postcode: '', cost: '', note: '', arrivalISO: '' }

  // Site name
  let m = t.match(/sent to ([^\n.]+?)(?:\.|\s*All bookings|\n)/i) ||
          t.match(/You have booked[….\s]*\n\s*([^\n]+)/i) ||
          t.match(/\n\s*([A-Z][^\n]*?(?:Campsite|Caravan[^\n]*Site|Holiday Park|Camping[^\n]*|Club Site|Park|Farm))\s*\n/)
  if (m) out.name = clean(m[1]).replace(/\s+Address:.*$/i, '')

  // Site phone (first Phone: line — the site, not the guest)
  m = t.match(/Phone:?\s*(\+?44[\d ]{6,}|0[\d ]{6,})/i)
  if (m) out.phone = clean(m[1])

  // UK postcode (first match is the site address; the guest's is lower down)
  m = t.match(/\b([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})\b/)
  if (m) out.postcode = m[1].toUpperCase()

  // Total cost
  m = t.match(/Total cost:?\s*£\s?([\d,]+(?:\.\d{1,2})?)/i) || t.match(/£\s?([\d,]+\.\d{2})\b/)
  if (m) out.cost = String(Math.round(parseFloat(m[1].replace(/,/g, ''))))

  // Arrival date → ISO (to check it matches the base)
  m = t.match(/Arrival:?\s*(?:[A-Za-z]+,?\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i)
  if (m) {
    const mo = MONTHS.indexOf(m[2].toLowerCase())
    if (mo >= 0) out.arrivalISO = `${m[3]}-${String(mo + 1).padStart(2, '0')}-${String(parseInt(m[1], 10)).padStart(2, '0')}`
  }

  // Booking ref + arrival window → a tidy note
  const ref = (t.match(/booking\s*(?:ID|\(|:)?\s*\(?([A-Z0-9]{5,})\)?/i) || [])[1]
  const win = (t.match(/Arrive:?\s*([\d.:apm –\-]+?)(?:\n|Depart|$)/i) || [])[1]
  out.note = [
    ref ? `Booked · ref ${ref}` : 'Booked',
    win ? `arrive ${clean(win)}` : ''
  ].filter(Boolean).join(' · ')

  out.found = !!(out.name || out.phone || out.postcode || out.cost)
  return out
}
