import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { startSync } from './lib/sync.js'
import { uploadAllPending } from './lib/cloud.js'
import './styles.css'

// Cloud sync between phones + shared photo album (config in lib/syncConfig.js).
startSync()
uploadAllPending()
window.addEventListener('online', uploadAllPending)

// When the service worker updates (autoUpdate → skipWaiting), the new worker
// takes control and fires `controllerchange` — reload once so the newest
// version shows automatically instead of the cached one.
if ('serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
  // Check for a newer version each time the app is opened / brought to front.
  const check = () => navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {})
  window.addEventListener('focus', check)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check() })
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
