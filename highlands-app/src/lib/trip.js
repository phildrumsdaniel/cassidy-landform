import { TRIP, bases } from '../data/bases.js'

function ymd(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// The base you're at "today", or null if outside the trip window.
// A base covers its arrival day through the morning you leave (start .. start+nights).
export function currentBaseId(now = new Date()) {
  const today = ymd(now)
  for (const b of bases) {
    const start = new Date(b.start + 'T00:00:00')
    const end = new Date(start)
    end.setDate(start.getDate() + Math.max(0, b.nights))
    if (today >= ymd(start) && today <= ymd(end)) return b.id
  }
  return null
}

// Day number (1..16) of the trip, or null if outside.
export function currentDayNumber(now = new Date()) {
  const start = new Date(TRIP.startDate + 'T00:00:00')
  const ms = ymd(now) - ymd(start)
  if (ms < 0) return null
  const n = Math.floor(ms / 86400000) + 1
  return n >= 1 && n <= TRIP.totalDays ? n : null
}

export function daysUntilStart(now = new Date()) {
  const start = new Date(TRIP.startDate + 'T00:00:00')
  const ms = ymd(start) - ymd(now)
  if (ms < 0) return null
  return Math.max(0, Math.round(ms / 86400000))
}
