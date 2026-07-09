import { useEffect, useState } from 'react'
import { exportTrip, getLastBackup, hasJournalNotes } from '../lib/backup.js'
import { countMedia } from '../lib/media.js'

const DAY = 86400000

function ago(ms) {
  const d = Math.floor((new Date().getTime() - ms) / DAY)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

// Gentle nudge to keep a local backup once there's data worth saving.
// One tap exports everything to Files/iCloud. Never nags before there's data.
export default function BackupBanner() {
  const [photos, setPhotos] = useState(0)
  const [last, setLast] = useState(getLastBackup())
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { countMedia().then(setPhotos) }, [done])

  const hasData = photos > 0 || hasJournalNotes()
  if (!hasData) return null

  const stale = !last || (new Date().getTime() - last) > 5 * DAY

  async function backup() {
    setBusy(true)
    try {
      const now = new Date()
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      await exportTrip(stamp)
      setLast(getLastBackup())
      setDone(true)
    } catch { /* ignore */ }
    finally { setBusy(false) }
  }

  // Backed up recently → quiet reassurance only.
  if (!stale && !done) {
    return <div className="backup-ok">✓ Backed up {ago(last)} · <button onClick={backup} disabled={busy}>{busy ? 'Saving…' : 'back up again'}</button></div>
  }

  return (
    <div className="backup-banner">
      <div className="bb-text">
        <b>{last ? 'Time for a fresh backup' : 'Keep your memories safe'}</b>
        <small>{done ? 'Saved! Choose “Save to Files” to keep it.' : 'Save your notes, photos & videos to your phone — takes a second.'}</small>
      </div>
      <button className="btn gold" onClick={backup} disabled={busy}>{busy ? 'Saving…' : done ? '✓ Done' : 'Back up now'}</button>
    </div>
  )
}
