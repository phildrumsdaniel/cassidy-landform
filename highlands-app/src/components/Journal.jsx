import { useEffect, useRef, useState } from 'react'
import { usePersistentState } from '../lib/storage.js'

// Per-day journal note, autosaved to localStorage.
export default function Journal({ dayN }) {
  const [text, setText] = usePersistentState(`journal:${dayN}`, '')
  const [saved, setSaved] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (!text) { setSaved(false); return }
    setSaved(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setSaved(true), 500)
    return () => clearTimeout(timer.current)
  }, [text])

  return (
    <div className="journal">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What did we see, eat and remember today? (saved on this phone)"
      />
      <div className="saved">{text ? (saved ? '✓ Saved on this device' : 'Saving…') : 'Notes are kept privately on this phone.'}</div>
    </div>
  )
}
