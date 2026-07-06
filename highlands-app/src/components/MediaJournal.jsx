import { useEffect, useRef, useState, useCallback } from 'react'
import { usePersistentState } from '../lib/storage.js'
import { addMedia, getMediaForBase, deleteMedia, requestPersistence } from '../lib/media.js'

// Per-base journal: a text note (localStorage) + photos/videos (IndexedDB).
// Capture uses the phone's native camera via a file input with `capture`, so it
// works in an installed PWA with no extra permissions and fully offline.
export default function MediaJournal({ baseId }) {
  const [text, setText] = usePersistentState(`journal:${baseId}`, '')
  const [saved, setSaved] = useState(true)
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const urls = useRef(new Map())
  const photoIn = useRef(null)
  const videoIn = useRef(null)
  const libIn = useRef(null)
  const saveTimer = useRef(null)

  const urlFor = useCallback((m) => {
    if (!urls.current.has(m.id)) urls.current.set(m.id, URL.createObjectURL(m.blob))
    return urls.current.get(m.id)
  }, [])

  const refresh = useCallback(async () => {
    const list = await getMediaForBase(baseId)
    setItems(list)
  }, [baseId])

  useEffect(() => { requestPersistence(); refresh() }, [refresh])

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
    try {
      for (const f of files) await addMedia(baseId, f)
      await refresh()
    } catch (err) {
      alert('Sorry — couldn’t save that. Your phone may be low on storage.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this from your journal?')) return
    const u = urls.current.get(id)
    if (u) { URL.revokeObjectURL(u); urls.current.delete(id) }
    await deleteMedia(id)
    await refresh()
    setLightbox(null)
  }

  async function share(m) {
    try {
      const file = new File([m.blob], m.name || `highlands.${m.type === 'video' ? 'mov' : 'jpg'}`, { type: m.blob.type })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Highlands Adventure' })
      } else {
        const u = urlFor(m)
        const a = document.createElement('a')
        a.href = u; a.download = file.name; a.click()
      }
    } catch { /* user cancelled */ }
  }

  return (
    <div className="journal">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What did we see, eat and remember here? (saved on this phone)"
      />
      <div className="saved">{text ? (saved ? '✓ Saved on this device' : 'Saving…') : 'Notes & photos are kept privately on this phone.'}</div>

      <div className="media-actions">
        <button className="btn" onClick={() => photoIn.current.click()} disabled={busy}>📷 Photo</button>
        <button className="btn" onClick={() => videoIn.current.click()} disabled={busy}>🎥 Video</button>
        <button className="btn ghost" onClick={() => libIn.current.click()} disabled={busy}>＋ From library</button>
      </div>
      <input ref={photoIn} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
      <input ref={videoIn} type="file" accept="video/*" capture="environment" hidden onChange={onFiles} />
      <input ref={libIn} type="file" accept="image/*,video/*" multiple hidden onChange={onFiles} />

      {busy && <div className="saved">Saving media…</div>}

      {items.length > 0 && (
        <div className="media-grid">
          {items.map((m) => (
            <button className="media-thumb" key={m.id} onClick={() => setLightbox(m)}>
              {m.type === 'video'
                ? <><video src={urlFor(m)} preload="metadata" muted playsInline /><span className="play">▶</span></>
                : <img src={urlFor(m)} alt="Journal photo" loading="lazy" />}
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            {lightbox.type === 'video'
              ? <video src={urlFor(lightbox)} controls autoPlay playsInline />
              : <img src={urlFor(lightbox)} alt="Journal photo" />}
            <div className="lightbox-bar">
              <button className="btn ghost" onClick={() => share(lightbox)}>Save / Share</button>
              <button className="btn" onClick={() => setLightbox(null)}>Close</button>
              <button className="btn danger" onClick={() => remove(lightbox.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
