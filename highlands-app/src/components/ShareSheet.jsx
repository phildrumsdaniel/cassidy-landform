import { useEffect, useState, useRef } from 'react'
import { getMediaForBase } from '../lib/media.js'
import { PLATFORMS, makeCaption } from '../lib/social.js'
import { usePersistentState } from '../lib/storage.js'

// Pick a platform → auto-written caption (editable) → attach a photo/clip →
// one tap to the native share sheet. It hands over the caption + media; you
// tap Post in the chosen app. (No silent auto-posting — that needs each
// platform's API + a server.)
export default function ShareSheet({ base, onClose }) {
  const [note] = usePersistentState(`journal:${base.id}`, '')
  const [platform, setPlatform] = useState('facebook')
  const [caption, setCaption] = useState('')
  const [media, setMedia] = useState([])
  const [pick, setPick] = useState(null)
  const [msg, setMsg] = useState('')
  const urls = useRef(new Map())

  useEffect(() => { getMediaForBase(base.id).then(setMedia) }, [base.id])
  useEffect(() => { setCaption(makeCaption(base, note, platform)) }, [platform]) // eslint-disable-line
  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current.clear() }, [])

  const urlFor = (m) => {
    if (!urls.current.has(m.id)) urls.current.set(m.id, URL.createObjectURL(m.blob))
    return urls.current.get(m.id)
  }

  async function share() {
    const chosen = media.find((m) => m.id === pick)
    try {
      if (chosen) {
        const file = new File([chosen.blob], chosen.name || `highlands.${chosen.type === 'video' ? 'mov' : 'jpg'}`, { type: chosen.blob.type })
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: caption })
          return
        }
      }
      if (navigator.share) { await navigator.share({ text: caption }); return }
      throw new Error('no share')
    } catch (e) {
      if (e && e.name === 'AbortError') return
      copy()
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(caption); setMsg('Caption copied — paste it into your post.') }
    catch { setMsg('Select the caption text above to copy it.') }
  }

  return (
    <div className="lightbox" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <strong className="serif">Share {base.name}</strong>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>

        <div className="seg">
          {PLATFORMS.map((p) => (
            <button key={p.id} className={platform === p.id ? 'on' : ''} onClick={() => setPlatform(p.id)}>{p.label}</button>
          ))}
        </div>

        <textarea className="cap" value={caption} onChange={(e) => setCaption(e.target.value)} rows={7} />

        {media.length > 0 && (
          <>
            <div className="label" style={{ margin: '4px 0 6px' }}>Attach a photo or clip</div>
            <div className="share-media">
              {media.map((m) => (
                <button key={m.id} className={`media-thumb${pick === m.id ? ' picked' : ''}`} onClick={() => setPick(pick === m.id ? null : m.id)}>
                  {m.type === 'video' ? <video src={urlFor(m)} muted playsInline /> : <img src={urlFor(m)} alt="" />}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn gold" onClick={share}>Share{pick ? ' with photo' : ''} →</button>
          <button className="btn ghost" onClick={copy}>Copy caption</button>
        </div>
        {msg && <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>{msg}</p>}
        <p className="muted" style={{ fontSize: '0.72rem', marginTop: 8 }}>
          Opens your share sheet — pick Facebook, LinkedIn, TikTok or anywhere, with the caption ready. You tap Post.
        </p>
      </div>
    </div>
  )
}
