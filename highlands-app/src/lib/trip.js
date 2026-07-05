import { TRIP } from '../data/days.js'

// Which day number (1..16) is "today", or null if outside the trip window.
// Uses local date only (no time zone surprises on the road).
export function currentDayNumber(now = new Date()) {
  const start = new Date(TRIP.startDate + 'T00:00:00')
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ms = today - start
  if (ms < 0) return null
  const n = Math.floor(ms / 86400000) + 1
  return n >= 1 && n <= TRIP.totalDays ? n : null
}

// Whole days until the trip begins (0 during the trip, null once it's over).
export function daysUntilStart(now = new Date()) {
  const start = new Date(TRIP.startDate + 'T00:00:00')
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ms = start - today
  if (ms < 0) return null
  return Math.max(0, Math.round(ms / 86400000))
}
