// Build and share the public (view-only) link to the trip magazine.

export function publicMagazineUrl() {
  const origin = window.location.origin
  const base = import.meta.env.BASE_URL // e.g. /cassidy-landform/highlands/
  return `${origin}${base}?view#/magazine`
}

// Link to a single day/stop of the trip.
export function publicDayUrl(id) {
  return `${window.location.origin}${import.meta.env.BASE_URL}?view#/magazine/${id}`
}

async function doShare(payload) {
  try {
    if (navigator.share) { await navigator.share(payload); return { how: 'shared', url: payload.url } }
  } catch { return { how: 'cancelled', url: payload.url } }
  try {
    await navigator.clipboard.writeText(payload.url)
    return { how: 'copied', url: payload.url }
  } catch {
    return { how: 'manual', url: payload.url }
  }
}

// Share the whole journal via the native share sheet; fall back to copying.
export function shareTrip() {
  return doShare({ title: 'Highlands Adventure', text: 'Follow Phil & Tracey’s Highlands trip 🏴󠁧󠁢󠁳󠁣󠁴󠁿🚐', url: publicMagazineUrl() })
}

// Share a single day/stop.
export function shareDay(id, name) {
  return doShare({ title: `${name} — Highlands Adventure`, text: `${name} — from Phil & Tracey’s Highlands trip 🏴󠁧󠁢󠁳󠁣󠁴󠁿`, url: publicDayUrl(id) })
}
