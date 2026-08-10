import { useEffect, useRef, useState, useCallback } from 'react'
import { usePersistentState } from '../lib/storage.js'
import { addMedia, getMediaForBase, deleteMedia, requestPersistence } from '../lib/media.js'
import { compressImage } from '../lib/img.js'
import { cloudOn, listPhotos, publicUrl, thumbUrl, deletePhoto, uploadAllPending, SHARE_MAX } from '../lib/cloud.js'

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
  const [lightbox, setLightbox] = useState(null)
  const urls = useRef(new Map()) // localId -> objectURL
  const photoIn = useRef(null)
  const videoIn = useRef(null)
  const libIn = useRef(null)
  const saveTimer = useRef(null)

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

  useEffect(() => {
    requestPersistence()
    refresh()
    // push anything captured offline, then show the merged album
    uploadAllPending().then(refresh)
    const onOnline = () => uploadAllPending().then(refresh)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [refresh])

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
    try {
      let tooBig = 0
      for (const f of files) {
        const isVideo = (f.type || '').startsWith('video')
        const blob = isVideo ? f : await compressImage(f)
        if (cloudOn() && blob.size > SHARE_MAX) tooBig++
        await addMedia(baseId, blob, { type: isVideo ? 'video' : 'image', name: f.name })
      }
      await refresh()
      uploadAllPending().then(refresh)
      if (tooBig) setNotice(`${tooBig === 1 ? 'That video is' : `${tooBig} videos are`} over 50 MB, so ${tooBig === 1 ? "it's" : "they're"} kept on this phone only (too big to share). Photos and shorter clips share fine.`)
    } catch (err) {
      alert('Sorry — couldn’t save that. Your phone may be low on storage.')
    } finally {
      setBusy(false)
    }
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

  return (
    <div className="journal">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What did we see, eat and remember here?"
      />
      <div className="saved">{savedNote}</div>

      <div className="media-actions">
        <button className="btn" onClick={() => photoIn.current.click()} disabled={busy}>📷 Photo</button>
        <button className="btn" onClick={() => videoIn.current.click()} disabled={busy}>🎥 Video</button>
        <button className="btn ghost" onClick={() => libIn.current.click()} disabled={busy}>＋ From library</button>
      </div>
      <input ref={photoIn} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
      <input ref={videoIn} type="file" accept="video/*" capture="environment" hidden onChange={onFiles} />
      <input ref={libIn} type="file" accept="image/*,video/*" multiple hidden onChange={onFiles} />

      {busy && <div className="saved">Saving &amp; uploading…</div>}
      {notice && <div className="saved" style={{ color: 'var(--rust, #b4552d)' }}>📵 {notice}</div>}

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
              <button className="btn danger" onClick={() => remove(lightbox)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
