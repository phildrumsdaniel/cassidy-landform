import { useEffect, useRef, useState, useCallback } from 'react'
import { usePersistentState } from '../lib/storage.js'
import { addMedia, getMediaForBase, deleteMedia, requestPersistence } from '../lib/media.js'
import { compressImage } from '../lib/img.js'
import { cloudOn, listPhotos, publicUrl, thumbUrl, deletePhoto, uploadAllPending, pendingCount, SHARE_MAX } from '../lib/cloud.js'
import { VIEW_ONLY } from '../lib/viewOnly.js'

// Grid image: loads the small thumbnail, falls back to the full image if the
// thumb isn't ready, and retries a couple of times on a flaky connection.
function GridImg({ thumb, full }) {
  const [src, setSrc] = useState(thumb || full)
  const step = useRef(0)
  return (
    <img
      src={src} alt="Journal photo" loading="lazy" decoding="async"
      onError={() => {
        step.current += 1
        if (src !== full && step.current === 1) setSrc(full)
        else if (step.current < 4) setTimeout(() => setSrc(`${full}?r=${step.current}`), 600 * step.current)
      }}
    />
  )
}

// Per-base journal: a text note (synced) + a shared photo/video album. Capture
// uses the phone's native camera and saves on-device first (works fully
// offline), then uploads to shared cloud storage so everyone on the trip link
// sees the same album. Photos from the other phone appear here too.
export default function MediaJournal({ baseId }) {
  const [text, setText] = usePersistentState(`journal:${baseId}`, '')
  const [saved, setSaved] = useState(true)
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [progress, setProgress] = useState(null) // {done, total} while preparing
  const [sharing, setSharing] = useState(null)   // number left | 'done' | null
  const [lightbox, setLightbox] = useState(null)
  const urls = useRef(new Map()) // localId -> objectURL
  const photoIn = useRef(null)
  const videoIn = useRef(null)
  const libIn = useRef(null)
  const saveTimer = useRef(null)
  const shareTimer = useRef(null)

  const urlFor = useCallback((localId, blob) => {
    if (!urls.current.has(localId)) urls.current.set(localId, URL.createObjectURL(blob))
    return urls.current.get(localId)
  }, [])

  // Merge on-device items (have blobs) with the shared cloud album (by uid).
  const refresh = useCallback(async () => {
    const [local, remote] = await Promise.all([
      getMediaForBase(baseId),
      cloudOn() ? listPhotos(baseId) : Promise.resolve([])
    ])
    const byUid = new Map()
    for (const r of remote) {
      const full = publicUrl(r.path)
      byUid.set(r.uid, { uid: r.uid, type: r.type, path: r.path, isLocal: false, src: r.type === 'video' ? full : thumbUrl(r.path), full, created: Date.parse(r.created_at) || 0 })
    }
    for (const m of local) {
      const key = m.uid || `local-${m.id}`
      const blobUrl = urlFor(m.id, m.blob)
      byUid.set(key, { uid: m.uid, type: m.type, path: m.path, isLocal: true, localId: m.id, blob: m.blob, uploaded: !!m.uploaded, localOnly: !!m.localOnly, src: blobUrl, full: blobUrl, created: m.created || 0 })
    }
    setItems([...byUid.values()].sort((a, b) => a.created - b.created))
  }, [baseId, urlFor])

  // Keep pushing pending uploads and show how many are left, until done.
  const startSharing = useCallback(() => {
    if (!cloudOn()) return
    clearInterval(shareTimer.current)
    const tick = async () => {
      uploadAllPending()
      const left = await pendingCount()
      await refresh()
      if (left === 0) {
        clearInterval(shareTimer.current); shareTimer.current = null
        setSharing((prev) => (typeof prev === 'number' && prev > 0 ? 'done' : null))
        setTimeout(() => setSharing((p) => (p === 'done' ? null : p)), 2500)
      } else {
        setSharing(left)
      }
    }
    tick()
    shareTimer.current = setInterval(tick, 2500)
  }, [refresh])

  useEffect(() => {
    requestPersistence()
    refresh()
    // resume any interrupted uploads (e.g. signal dropped mid-batch)
    ;(async () => { if (cloudOn() && (await pendingCount()) > 0) startSharing() })()
    const onOnline = () => startSharing()
    window.addEventListener('online', onOnline)
    return () => { window.removeEventListener('online', onOnline); clearInterval(shareTimer.current) }
  }, [refresh, startSharing])

  // revoke object URLs on unmount / base change
  useEffect(() => () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u))
    urls.current.clear()
  }, [baseId])

  useEffect(() => {
    setSaved(false)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaved(true), 500)
    return () => clearTimeout(saveTimer.current)
  }, [text])

  async function onFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    setNotice('')

    // Save each one on-device first (surviving any single failure, yielding to
    // the phone between each so a big batch can't lock up the tab). Uploading is
    // handled separately by startSharing so it's resilient to signal drops.
    let added = 0, failed = 0, tooBig = 0
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      setProgress({ done: i, total: files.length })
      try {
        const isVideo = (f.type || '').startsWith('video')
        const blob = isVideo ? f : await compressImage(f)
        if (cloudOn() && blob.size > SHARE_MAX) tooBig++
        await addMedia(baseId, blob, { type: isVideo ? 'video' : 'image', name: f.name })
        added++
      } catch {
        failed++
      }
      // Give the phone time to reclaim memory between photos (and a longer
      // breather every few) so large batches don't run the tab out of memory.
      await new Promise((r) => setTimeout(r, (i + 1) % 6 === 0 ? 500 : 60))
    }
    setProgress(null)
    setBusy(false)
    await refresh()

    const msgs = []
    if (tooBig) msgs.push(`${tooBig} video${tooBig > 1 ? 's' : ''} over 50 MB kept on this phone only`)
    if (failed) msgs.push(`${failed} couldn’t be added (phone may be low on storage)`)
    setNotice(msgs.length ? `${msgs.join('; ')}.` : '')

    if (cloudOn() && added) startSharing() // upload in the background, with a counter
  }

  async function remove(entry) {
    if (!confirm(cloudOn() ? 'Delete this for everyone on the trip?' : 'Delete this from your journal?')) return
    if (entry.isLocal && entry.localId != null) {
      const u = urls.current.get(entry.localId)
      if (u) { URL.revokeObjectURL(u); urls.current.delete(entry.localId) }
      await deleteMedia(entry.localId)
    }
    if (cloudOn() && entry.path) await deletePhoto(entry.uid, entry.path)
    await refresh()
    setLightbox(null)
  }

  async function share(entry) {
    const name = `highlands.${entry.type === 'video' ? 'mp4' : 'jpg'}`
    try {
      if (entry.blob) {
        const file = new File([entry.blob], name, { type: entry.blob.type })
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Highlands Adventure' })
          return
        }
      }
      if (navigator.share) { await navigator.share({ title: 'Highlands Adventure', url: entry.full }) }
      else { const a = document.createElement('a'); a.href = entry.full; a.download = name; a.target = '_blank'; a.click() }
    } catch { /* user cancelled */ }
  }

  const savedNote = cloudOn()
    ? (text ? (saved ? '✓ Saved & shared with the trip' : 'Saving…') : 'Notes & photos are shared with everyone on the trip link.')
    : (text ? (saved ? '✓ Saved on this device' : 'Saving…') : 'Notes & photos are kept privately on this phone.')

  const total = items.length
  const shared = items.filter((m) => !m.isLocal || m.uploaded).length

  return (
    <div className="journal">
      <textarea
        value={text}
        readOnly={VIEW_ONLY}
        onChange={(e) => setText(e.target.value)}
        placeholder={VIEW_ONLY ? 'No notes yet.' : 'What did we see, eat and remember here?'}
      />
      {!VIEW_ONLY && <div className="saved">{savedNote}</div>}

      {!VIEW_ONLY && (
        <div className="media-actions">
          <button className="btn" onClick={() => photoIn.current.click()} disabled={busy}>📷 Photo</button>
          <button className="btn" onClick={() => videoIn.current.click()} disabled={busy}>🎥 Video</button>
          <button className="btn ghost" onClick={() => libIn.current.click()} disabled={busy}>＋ From library</button>
        </div>
      )}
      <input ref={photoIn} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
      <input ref={videoIn} type="file" accept="video/*" capture="environment" hidden onChange={onFiles} />
      <input ref={libIn} type="file" accept="image/*,video/*" multiple hidden onChange={onFiles} />

      {progress && <div className="saved">Preparing photos… {progress.done} of {progress.total}</div>}
      {busy && !progress && <div className="saved">Saving…</div>}
      {typeof sharing === 'number' && sharing > 0 && <div className="saved">☁︎ Sharing to the album… {sharing} to go</div>}
      {sharing === 'done' && <div className="saved">✓ All photos shared</div>}
      {notice && <div className="saved" style={{ color: 'var(--rust, #b4552d)' }}>📵 {notice}</div>}
      {cloudOn() && !VIEW_ONLY && total > 0 && (
        <div className="saved">📷 {total} here · ☁︎ {shared} shared{total > shared ? ` · ${total - shared} to upload` : ''}</div>
      )}

      {items.length > 0 && (
        <div className="media-grid">
          {items.map((m) => (
            <button className="media-thumb" key={m.uid || m.localId} onClick={() => setLightbox(m)}>
              {m.type === 'video'
                ? <><video src={m.src} preload="metadata" muted playsInline /><span className="play">▶</span></>
                : <GridImg thumb={m.src} full={m.full} />}
              {!m.isLocal && <span className="from-other">☁︎</span>}
              {m.isLocal && m.localOnly && <span className="from-other" title="Too big to share — on this phone only">📵</span>}
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            {lightbox.type === 'video'
              ? <video src={lightbox.full} controls autoPlay playsInline />
              : <img src={lightbox.full} alt="Journal photo" />}
            <div className="lightbox-bar">
              <button className="btn ghost" onClick={() => share(lightbox)}>Save / Share</button>
              <button className="btn" onClick={() => setLightbox(null)}>Close</button>
              {!VIEW_ONLY && <button className="btn danger" onClick={() => remove(lightbox)}>Delete</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
