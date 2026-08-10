// Lightweight "who's viewed" logging. No login exists, so this is best-effort:
// each viewer can optionally set a name; we also record device type, which page
// (day) they opened, and when. Everything fails soft — if the backend table
// isn't there yet, logging and listing simply no-op.

import { syncConfig } from './syncConfig.js'
import { readJSON, writeJSON } from './storage.js'

function deviceLabel() {
  const ua = (navigator && navigator.userAgent) || ''
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Macintosh|Mac OS/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  return 'Other'
}

function visitorId() {
  let v = readJSON('__visitor', null)
  if (!v) {
    try { v = crypto.randomUUID() } catch { v = `${new Date().getTime()}-${Math.random().toString(16).slice(2)}` }
    writeJSON('__visitor', v)
  }
  return v
}

export function viewerName() { return readJSON('viewerName', '') }
export function setViewerName(n) { writeJSON('viewerName', (n || '').slice(0, 40)) }

const headers = () => ({ apikey: syncConfig.anonKey, Authorization: `Bearer ${syncConfig.anonKey}`, 'Content-Type': 'application/json' })

export async function logView(page) {
  if (!syncConfig) return
  const key = `__lastview:${page}`
  const now = new Date().getTime()
  if (now - readJSON(key, 0) < 10 * 60 * 1000) return // throttle: 1 per page / 10 min
  writeJSON(key, now)
  try {
    await fetch(`${syncConfig.url}/rest/v1/views`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify([{ name: viewerName() || null, device: deviceLabel(), page, visitor: visitorId() }])
    })
  } catch { /* table may not exist yet, or offline — ignore */ }
}

export async function listViews() {
  if (!syncConfig) return []
  try {
    const res = await fetch(`${syncConfig.url}/rest/v1/views?select=at,name,device,page&order=at.desc&limit=100`, { headers: headers() })
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}
