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
  const res = await fetch(`${syncConfig.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': (blob && blob.type) || 'application/octet-stream', 'x-upsert': 'true' },
    body: blob
  })
  if (!res.ok) throw new Error('upload ' + res.status)
}

async function insertRow(row) {
  const res = await fetch(`${syncConfig.url}/rest/v1/photos`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row)
  })
  if (!res.ok) throw new Error('row ' + res.status)
}

// Fetch the shared album for one base (metadata rows; blobs come from publicUrl).
export async function listPhotos(baseId) {
  if (!syncConfig) return []
  try {
    const res = await fetch(
      `${syncConfig.url}/rest/v1/photos?base_id=eq.${baseId}&select=uid,base_id,path,type,name,created_at&order=created_at.asc`,
      { headers: headers() }
    )
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function deletePhoto(uid, path) {
  if (!syncConfig) return
  try { await fetch(`${syncConfig.url}/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE', headers: headers() }) } catch { /* */ }
  try { await fetch(`${syncConfig.url}/rest/v1/photos?uid=eq.${encodeURIComponent(uid)}`, { method: 'DELETE', headers: headers() }) } catch { /* */ }
}

let uploading = false

// Upload every locally-captured item that isn't in the cloud yet.
export async function uploadAllPending() {
  if (!syncConfig || uploading || (typeof navigator !== 'undefined' && navigator.onLine === false)) return
  uploading = true
  try {
    const all = await getAllMedia()
    for (const m of all) {
      if (!m.blob) continue
      let { uid, path } = m

      // 1) Upload the full media if it isn't in the cloud yet.
      if (!m.uploaded && !m.localOnly) {
        if (m.blob.size > SHARE_MAX) { await updateMedia(m.id, { localOnly: true, uid: m.uid || newUid() }); continue }
        uid = m.uid || newUid()
        path = `${m.baseId}/${uid}.${extFor(m)}`
        try {
          await uploadBlob(path, m.blob)
          await insertRow({ uid, base_id: m.baseId, path, type: m.type, name: m.name || null })
          await updateMedia(m.id, { uploaded: true, uid, path })
        } catch { continue /* leave pending for next time */ }
      }

      // 2) Make + upload a small grid thumbnail (backfills older full-size ones).
      if (m.type === 'image' && !m.thumbed && path) {
        try {
          const thumb = await makeThumb(m.blob)
          if (thumb) {
            await uploadBlob(`thumb/${path}`, thumb)
            await updateMedia(m.id, { thumbed: true })
          }
        } catch { /* try again next time */ }
      }
    }
  } catch { /* */ } finally {
    uploading = false
  }
}
