// Cloud sync for the light stuff — bookings, journal notes, checklist ticks —
// so both phones stay in step. Photos/videos are NOT synced (too big for
// patchy Highland signal; they stay per-phone + the backup export).
//
// Approach: a single shared row in Supabase holding { key: {v, t} } for each
// synced key, where t is a last-write timestamp. Merge is per-key
// last-write-wins with union (nothing is deleted), so two phones combine
// cleanly. No realtime sockets — we pull on focus + on an interval and push on
// change, which is robust on flaky networks. Entirely dormant when unconfigured.

import { readJSON, writeJSON, registerWriteObserver, applyExternal } from './storage.js'
import { syncConfig, TRIP_ID, SYNC_PREFIXES } from './syncConfig.js'

const TIMES = '__synctimes'
let inFlight = false
let timer = null
const lastApplied = new Map() // key -> JSON string we last wrote from remote (echo guard)

const isSyncKey = (k) => SYNC_PREFIXES.some((p) => k.startsWith(p))
const now = () => new Date().getTime()

function headers() {
  return {
    apikey: syncConfig.anonKey,
    Authorization: `Bearer ${syncConfig.anonKey}`,
    'Content-Type': 'application/json'
  }
}

function localSnapshot() {
  const out = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith('highlands:')) continue
    const bare = k.slice('highlands:'.length)
    if (isSyncKey(bare)) out[bare] = readJSON(bare, null)
  }
  return out
}

async function pullRemote() {
  const res = await fetch(`${syncConfig.url}/rest/v1/trips?id=eq.${encodeURIComponent(TRIP_ID)}&select=data`, { headers: headers() })
  if (!res.ok) throw new Error('pull ' + res.status)
  const rows = await res.json()
  return (rows[0] && rows[0].data) || {}
}

async function pushRemote(data) {
  const res = await fetch(`${syncConfig.url}/rest/v1/trips`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ id: TRIP_ID, data, updated_at: new Date().toISOString() }])
  })
  if (!res.ok) throw new Error('push ' + res.status)
}

export async function syncNow() {
  if (!syncConfig || inFlight || (typeof navigator !== 'undefined' && navigator.onLine === false)) return
  inFlight = true
  try {
    const remote = await pullRemote()
    const local = localSnapshot()
    const times = readJSON(TIMES, {})
    const merged = {}
    const keys = new Set([...Object.keys(remote), ...Object.keys(local)])

    for (const key of keys) {
      const r = remote[key]
      const rt = (r && r.t) || 0
      const lt = times[key] || 0
      const hasLocal = key in local

      if (r && rt > lt) {
        // Remote is newer — apply to this phone.
        const s = JSON.stringify(r.v)
        lastApplied.set(key, s)
        applyExternal(key, r.v)
        times[key] = rt
        merged[key] = { v: r.v, t: rt }
      } else if (hasLocal) {
        const t = lt || now()
        times[key] = t
        merged[key] = { v: local[key], t }
      } else if (r) {
        merged[key] = { v: r.v, t: rt }
      }
    }

    writeJSON(TIMES, times)
    if (JSON.stringify(remote) !== JSON.stringify(merged)) await pushRemote(merged)
  } catch {
    /* offline or transient — we'll try again on the next tick */
  } finally {
    inFlight = false
  }
}

function onLocalWrite(key, value) {
  if (!isSyncKey(key)) return
  // Ignore the echo of a value we just applied from remote.
  if (lastApplied.get(key) === JSON.stringify(value)) { lastApplied.delete(key); return }
  const times = readJSON(TIMES, {})
  times[key] = now()
  writeJSON(TIMES, times)
  clearTimeout(timer)
  timer = setTimeout(syncNow, 800) // debounce a burst of edits
}

export function startSync() {
  if (!syncConfig) return // dormant until configured
  registerWriteObserver(onLocalWrite)
  syncNow()
  const kick = () => { if (!document.hidden) syncNow() }
  window.addEventListener('online', syncNow)
  window.addEventListener('focus', kick)
  document.addEventListener('visibilitychange', kick)
  setInterval(kick, 20000)
}
