// Shared photo/video album via Supabase Storage. Blobs go in a public bucket;
// a small `photos` table holds the metadata so every phone can list what's
// there. Offline-first: capture saves locally first (see media.js) and this
// uploads whatever is still pending whenever there's signal. All network calls
// fail soft — with no signal (or no config) the app just stays local-only.

import { syncConfig } from './syncConfig.js'
import { getAllMedia, updateMedia, newUid } from './media.js'
import { makeThumb } from './img.js'

const BUCKET = 'photos'
export const SHARE_MAX = 50 * 1024 * 1024 // free-tier per-file limit
export const cloudOn = () => !!syncConfig

const headers = () => ({ apikey: syncConfig.anonKey, Authorization: `Bearer ${syncConfig.anonKey}` })

// Every request gets a timeout so a stalled connection (patchy Highland signal)
// can never hang the upload queue — it fails, we move on, and retry later.
async function fetchT(url, opts, ms) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...opts, signal: c.signal }) }
  finally { clearTimeout(t) }
}

export function publicUrl(path) {
  return syncConfig ? `${syncConfig.url}/storage/v1/object/public/${BUCKET}/${path}` : ''
}

// The grid loads this small version; falls back to the full image if a thumb
// isn't generated yet (the phone that owns a photo makes its thumb).
export const thumbUrl = (path) => publicUrl(`thumb/${path}`)

function extFor(m) {
  if (m.type !== 'video') return 'jpg'
  const t = (m.blob && m.blob.type) || ''
  if (t.includes('quicktime')) return 'mov'
  if (t.includes('webm')) return 'webm'
  return 'mp4'
}

async function uploadBlob(path, blob) {
  const res = await fetchT(`${syncConfig.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': (blob && blob.type) || 'application/octet-stream', 'x-upsert': 'true' },
    body: blob
  }, 60000)
  if (!res.ok) throw new Error('upload ' + res.status)
}

async function insertRow(row) {
  const res = await fetchT(`${syncConfig.url}/rest/v1/photos`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row)
  }, 20000)
  if (!res.ok) throw new Error('row ' + res.status)
}

// Fetch the shared album for one base (metadata rows; blobs come from publicUrl).
export async function listPhotos(baseId) {
  if (!syncConfig) return []
  try {
    const res = await fetchT(
      `${syncConfig.url}/rest/v1/photos?base_id=eq.${baseId}&select=uid,base_id,path,type,name,created_at&order=created_at.asc`,
      { headers: headers() }, 15000
    )
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function deletePhoto(uid, path) {
  if (!syncConfig) return
  try { await fetchT(`${syncConfig.url}/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE', headers: headers() }, 15000) } catch { /* */ }
  try { await fetchT(`${syncConfig.url}/rest/v1/photos?uid=eq.${encodeURIComponent(uid)}`, { method: 'DELETE', headers: headers() }, 15000) } catch { /* */ }
}

// How many captured items still need sharing (drives the "N to go" indicator).
export async function pendingCount() {
  if (!syncConfig) return 0
  try {
    const all = await getAllMedia()
    return all.filter((m) => m.blob && !m.uploaded && !m.localOnly).length
  } catch { return 0 }
}

// One uploader at a time; extra triggers coalesce into a single re-run so
// nothing piles up and nothing gets dropped.
let running = false
let rerun = false

export async function uploadAllPending() {
  if (!syncConfig) return
  if (running) { rerun = true; return }
  running = true
  try {
    do { rerun = false; await runUploads() } while (rerun)
  } finally {
    running = false
  }
}

async function runUploads() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  // Pass 1 — share the actual photos/videos FIRST (this is what people wait on).
  let all = await getAllMedia()
  for (const m of all) {
    if (!m.blob || m.uploaded || m.localOnly) continue
    if (m.blob.size > SHARE_MAX) { await updateMedia(m.id, { localOnly: true, uid: m.uid || newUid() }); continue }
    const uid = m.uid || newUid()
    const path = `${m.baseId}/${uid}.${extFor(m)}`
    try {
      await uploadBlob(path, m.blob)
      await insertRow({ uid, base_id: m.baseId, path, type: m.type, name: m.name || null })
      await updateMedia(m.id, { uploaded: true, uid, path })
    } catch { /* leave pending, retry next time */ }
  }

  // Pass 2 — backfill small grid thumbnails (cosmetic; after everything shares).
  all = await getAllMedia()
  for (const m of all) {
    if (!m.blob || m.type !== 'image' || m.thumbed || !m.path) continue
    try {
      const thumb = await makeThumb(m.blob)
      if (thumb) { await uploadBlob(`thumb/${m.path}`, thumb); await updateMedia(m.id, { thumbed: true }) }
    } catch { /* try again next time */ }
  }
}
