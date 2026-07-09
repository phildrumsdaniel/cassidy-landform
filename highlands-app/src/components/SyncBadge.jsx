import { syncConfig } from '../lib/syncConfig.js'

// Reassurance that both phones are kept in step. Renders nothing until sync
// is configured, so it's invisible until switched on.
export default function SyncBadge() {
  if (!syncConfig) return null
  return <div className="sync-badge">☁︎ Bookings &amp; notes sync across your phones</div>
}
