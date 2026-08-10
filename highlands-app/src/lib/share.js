// Build and share the public (view-only) link to the trip magazine.

export function publicMagazineUrl() {
  const origin = window.location.origin
  const base = import.meta.env.BASE_URL // e.g. /cassidy-landform/highlands/
  return `${origin}${base}?view#/magazine`
}

// Share via the native share sheet; fall back to copying the link.
export async function shareTrip() {
  const url = publicMagazineUrl()
  const payload = { title: 'Highlands Adventure', text: 'Follow Phil & Tracey’s Highlands trip 🏴󠁧󠁢󠁳󠁣󠁴󠁿🚐', url }
  try {
    if (navigator.share) { await navigator.share(payload); return { how: 'shared', url } }
  } catch { return { how: 'cancelled', url } }
  try {
    await navigator.clipboard.writeText(url)
    return { how: 'copied', url }
  } catch {
    return { how: 'manual', url }
  }
}
