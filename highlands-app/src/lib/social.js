// Auto-written social captions from a base + journal note. Pure templating —
// no network, works offline. The app hands the finished caption + a photo to
// the native share sheet; the user taps Post in Facebook / LinkedIn / TikTok.

import { poi } from '../data/pois.js'

function topSpots(base, n = 2) {
  return base.explore.slice(0, n).map((s) => poi(s).name)
}

function firstSentence(note) {
  if (!note) return ''
  const t = note.trim().replace(/\s+/g, ' ')
  const m = t.match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : t).trim()
}

export const PLATFORMS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' }
]

export function makeCaption(base, note, platform) {
  const region = base.region
  const place = base.name
  const spots = topSpots(base)
  const spotsText = spots.length ? spots.join(' and ') : region
  const line = firstSentence(note)

  if (platform === 'linkedin') {
    return [
      `${place}, ${region}.`,
      '',
      line || `A memorable stop on our Scottish Highlands road trip — ${spotsText}.`,
      '',
      'Part of a 16-day motorhome loop of the Highlands — slow roads, big views, and a real reset.',
      '',
      '#Scotland #Highlands #Travel #RoadTrip'
    ].join('\n')
  }

  if (platform === 'tiktok') {
    const tags = ['#scotland', '#highlands', '#roadtrip', '#motorhome', '#vanlife', '#travel',
      `#${place.toLowerCase().replace(/[^a-z]/g, '')}`]
    return `${place} hits different 🏴󠁧󠁢󠁳󠁣󠁴󠁿✨ ${line || spotsText} ${tags.join(' ')}`
  }

  // facebook (default) — warm & personal
  return [
    `Day at ${place} in the ${region} 🏴󠁧󠁢󠁳󠁣󠁴󠁿`,
    '',
    line || `Exploring ${spotsText} today — what a spot.`,
    spots.length ? `Highlights: ${spots.join(', ')}.` : '',
    '',
    'Phil & Tracey · Highlands Adventure 2026 🚐',
    '#Scotland #Highlands #Motorhome'
  ].filter((l) => l !== '').join('\n')
}

// A caption for the whole trip (used on the book / closing share).
export function makeTripCaption(platform) {
  if (platform === 'linkedin') {
    return '16 days, 9 bases, ~1,430 miles around the Scottish Highlands. Slow roads, big views, and a proper reset. #Scotland #Highlands #Travel'
  }
  if (platform === 'tiktok') {
    return '16 days round the Scottish Highlands 🏴󠁧󠁢󠁳󠁣󠁴󠁿🚐 #scotland #highlands #roadtrip #vanlife #traveltiktok'
  }
  return 'We did it — 16 days and ~1,430 miles around the Scottish Highlands in the motorhome. Slow roads, big views, unforgettable memories. 🏴󠁧󠁢󠁳󠁣󠁴󠁿🚐\n#Scotland #Highlands #Motorhome'
}
