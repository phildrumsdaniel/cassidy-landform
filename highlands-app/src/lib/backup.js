// Backup & restore. Bundles all journal text, checklists and captured
// photos/videos into a single .zip the user can save to their phone (Files),
// so memories survive even if the browser cache is cleared. Fully offline —
// zipping happens on-device with fflate. Import restores everything.

import { zip, unzip } from 'fflate'
import { getAllMedia, addMedia } from './media.js'

const NS = 'highlands:'

function localData() {
  const out = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(NS)) out[k] = localStorage.getItem(k)
  }
  return out
}

function extFor(m) {
  if (m.name && m.name.includes('.')) return m.name.split('.').pop()
  return m.type === 'video' ? 'mov' : 'jpg'
}

async function blobToU8(blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

// Build a human-readable memories page listing journal notes per base.
function memoriesHtml(local, media) {
  const notes = Object.entries(local)
    .filter(([k]) => k.startsWith(NS + 'journal:'))
    .map(([k, v]) => [k.replace(NS + 'journal:', ''), JSON.parse(v || '""')])
    .filter(([, v]) => v && v.trim())
  const byBase = {}
  media.forEach((m) => { (byBase[m.baseId] = byBase[m.baseId] || 0, byBase[m.baseId]++) })
  const rows = notes.map(([base, text]) =>
    `<section><h2>Base ${base}</h2><p>${text.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>` +
    (byBase[base] ? `<em>${byBase[base]} photo/video(s) saved</em>` : '') + `</section>`
  ).join('\n')
  return `<!doctype html><meta charset="utf-8"><title>Highlands Adventure — memories</title>` +
    `<style>body{font-family:Georgia,serif;max-width:640px;margin:20px auto;padding:0 16px;color:#23282a}` +
    `h1{color:#14343f}h2{color:#6b4a7a;margin-top:24px}em{color:#8ca0a6;font-size:.85em}</style>` +
    `<h1>Highlands Adventure — our journal</h1>${rows || '<p>No notes yet.</p>'}`
}

export async function exportTrip(stamp) {
  const local = localData()
  const media = await getAllMedia()
  const files = {}

  const manifest = { app: 'highlands-adventure', version: 1, exported: stamp, local, media: [] }

  for (const m of media) {
    const fname = `media/${m.baseId}__${m.id}.${extFor(m)}`
    files[fname] = await blobToU8(m.blob)
    manifest.media.push({ file: fname, baseId: m.baseId, type: m.type, name: m.name, created: m.created })
  }

  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2))
  files['memories.html'] = new TextEncoder().encode(memoriesHtml(local, media))

  const zipped = await new Promise((resolve, reject) =>
    zip(files, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)))
  )
  const blob = new Blob([zipped], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `highlands-journal-${stamp}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return { photos: media.length, notes: Object.keys(local).filter((k) => k.startsWith(NS + 'journal:')).length }
}

export async function importTrip(file) {
  const buf = new Uint8Array(await file.arrayBuffer())
  const entries = await new Promise((resolve, reject) =>
    unzip(buf, (err, data) => (err ? reject(err) : resolve(data)))
  )
  const manifestRaw = entries['manifest.json']
  if (!manifestRaw) throw new Error('Not a Highlands backup (no manifest).')
  const manifest = JSON.parse(new TextDecoder().decode(manifestRaw))

  // Restore text/checklists.
  Object.entries(manifest.local || {}).forEach(([k, v]) => localStorage.setItem(k, v))

  // Restore media into IndexedDB.
  let restored = 0
  for (const m of manifest.media || []) {
    const bytes = entries[m.file]
    if (!bytes) continue
    const type = m.type === 'video' ? 'video/quicktime' : 'image/jpeg'
    const blob = new Blob([bytes], { type })
    const f = new File([blob], m.name || m.file, { type })
    await addMedia(m.baseId, f)
    restored++
  }
  return { notes: Object.keys(manifest.local || {}).length, photos: restored }
}
