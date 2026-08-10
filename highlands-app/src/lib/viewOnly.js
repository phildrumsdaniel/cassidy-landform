// View-only mode. Share a link ending in ?view (e.g. …/highlands/?view) and the
// app opens look-but-don't-touch: all the itinerary, bookings, notes and the
// shared photo album are visible and stay live, but the editing controls
// (adding/editing bookings, journal text, photos, checklist ticks, restore) are
// hidden. Phil & Tracey use the normal link to edit.
export const VIEW_ONLY = (() => {
  try { return new URLSearchParams(window.location.search).has('view') } catch { return false }
})()
