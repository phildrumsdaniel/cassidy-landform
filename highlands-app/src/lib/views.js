// Best-effort "who's viewed" logging — no prompt, no login. A web link cannot
// read a phone's real name or exact GPS without asking, so we auto-capture what
// a browser *can* see silently: device + browser, approximate town (from the
// connection's IP), and time. Everything fails soft.

import { syncConfig } from './syncConfig.js'
import { readJSON, writeJSON } from './storage.js'

function deviceLabel() {
  const ua = (navigator && navigator.userAgent) || ''
  let os = 'Device'
  if (/iPhone/.test(ua)) os = 'iPhone'
  else if (/iPad/.test(ua)) os = 'iPad'
  else if (/Android/.test(ua)) {
    const m = ua.match(/Android[^;]*;\s*([^;)]+?)\s*(?:Build|\))/)
    os = m ? `Android (${m[1].trim()})` : 'Android'
  } else if (/Macintosh|Mac OS/.test(ua)) os = 'Mac'
  else if (/Windows/.test(ua)) os = 'Windows'
  else os = 'Other'

  let br = ''
  if (/Edg/.test(ua)) br = 'Edge'
  else if (/CriOS|Chrome/.test(ua)) br = 'Chrome'
  else if (/FxiOS|Firefox/.test(ua)) br = 'Firefox'
  else if (/Safari/.test(ua)) br = 'Safari'
  return br ? `${os} · ${br}` : os
}

// Coarse town/region from the viewer's IP — no permission prompt. Cached so we
// only hit the geo API once per device.
async function approxLocation() {
  const cached = readJSON('__geo', null)
  if (cached) return cached
  for (const url of ['https://ipapi.co/json/', 'https://ipwho.is/']) {
    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const j = await r.json()
      const loc = {
        city: j.city || j.region || '',
        region: j.region || j.region_name || '',
        country: j.country_name || j.country || ''
      }
      if (loc.city || loc.country) { writeJSON('__geo', loc); return loc }
    } catch { /* try next */ }
  }
  return { city: '', region: '', country: '' }
}

function visitorId() {
  let v = readJSON('__visitor', null)
  if (!v) {
    try { v = crypto.randomUUID() } catch { v = `${new Date().getTime()}-${Math.random().toString(16).slice(2)}` }
    writeJSON('__visitor', v)
  }
  return v
}

// Optional: a device can label itself (Phil/Tracey naming their own phones).
export function viewerName() { return readJSON('viewerName', '') }
export function setViewerName(n) { writeJSON('viewerName', (n || '').slice(0, 40)) }

const headers = () => ({ apikey: syncConfig.anonKey, Authorization: `Bearer ${syncConfig.anonKey}`, 'Content-Type': 'application/json' })

export async function logView(page) {
  if (!syncConfig) return
  const key = `__lastview:${page}`
  const now = new Date().getTime()
  if (now - readJSON(key, 0) < 10 * 60 * 1000) return // throttle: 1 per page / 10 min
  writeJSON(key, now)
  const loc = await approxLocation()
  try {
    await fetch(`${syncConfig.url}/rest/v1/views`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify([{
        name: viewerName() || null,
        device: deviceLabel(),
        city: loc.city || null,
        region: loc.region || null,
        country: loc.country || null,
        page,
        visitor: visitorId()
      }])
    })
  } catch { /* table missing or offline — ignore */ }
}

export async function listViews() {
  if (!syncConfig) return []
  try {
    const res = await fetch(`${syncConfig.url}/rest/v1/views?select=at,name,device,city,region,country,page&order=at.desc&limit=100`, { headers: headers() })
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}
