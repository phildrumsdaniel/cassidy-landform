import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { bases } from '../data/bases.js'
import { poi } from '../data/pois.js'

const base = import.meta.env.BASE_URL

function pin(label, highlight) {
  return L.divIcon({
    className: 'hl-pin-wrap',
    html: `<div class="hl-pin${highlight ? ' hot' : ''}"><span>${label}</span></div>`,
    iconSize: [26, 34], iconAnchor: [13, 34], popupAnchor: [0, -32]
  })
}

function basePois(id) {
  const b = bases.find((x) => x.id === id)
  if (!b) return []
  return b.explore.map(poi).filter((p) => p.lat != null).map((p) => ({ ...p, base: b.id }))
}
function allPois() {
  const seen = new Set()
  const out = []
  bases.forEach((b) => b.explore.map(poi).forEach((p) => {
    if (p.lat != null && !seen.has(p.slug)) { seen.add(p.slug); out.push({ ...p, base: b.id }) }
  }))
  return out
}

export default function MapScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)

  const focusLat = params.get('lat')
  const focusLng = params.get('lng')
  const focusBase = params.get('base') ? parseInt(params.get('base'), 10) : null
  const focusName = params.get('name')

  const [scope, setScope] = useState(focusBase ? 'base' : 'all')
  const [baseId, setBaseId] = useState(focusBase || 1)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [showLive, setShowLive] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false); const off = () => setOffline(true)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    if (!showLive || mapRef.current || !mapEl.current) return
    const map = L.map(mapEl.current, { zoomControl: true }).setView([57.4, -4.8], 7)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    setTimeout(() => map.invalidateSize(), 60)
  }, [showLive])

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const pts = scope === 'base' ? basePois(baseId) : allPois()

    if (scope === 'all') {
      const line = bases.filter((b) => b.nights > 0 || b.id === 10).map((b) => [b.lat, b.lng])
      L.polyline(line, { color: '#c8912f', weight: 3, opacity: 0.7, dashArray: '2 8' }).addTo(layer)
    }

    const bounds = []
    pts.forEach((p) => {
      const hot = focusName && p.name === focusName
      const m = L.marker([p.lat, p.lng], { icon: pin(p.base, hot) }).addTo(layer)
      m.bindPopup(`<b>${p.name}</b><br><span style="color:#6b4a7a">Base ${p.base}</span>`)
      if (hot) m.openPopup()
      bounds.push([p.lat, p.lng])
    })

    if (focusLat && focusLng) map.setView([parseFloat(focusLat), parseFloat(focusLng)], 12)
    else if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 })
  }, [scope, baseId, showLive, focusLat, focusLng, focusName])

  return (
    <>
      <header className="topbar" style={{ paddingBottom: 12 }}>
        <button className="back" onClick={() => navigate(-1)}>← Back</button>
        <h1 className="serif" style={{ fontSize: '1.5rem', marginTop: 10 }}>Route map</h1>
      </header>

      <div className="container" style={{ paddingBottom: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="map-toggle" style={{ position: 'static', transform: 'none', margin: 0 }}>
            <button className={scope === 'base' ? 'on' : ''} onClick={() => setScope('base')}>This base</button>
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All POIs</button>
          </div>
          {scope === 'base' && (
            <select value={baseId} onChange={(e) => setBaseId(parseInt(e.target.value, 10))}
              style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', font: 'inherit' }}>
              {bases.map((b) => <option key={b.id} value={b.id}>Base {b.id} — {b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="container" style={{ paddingTop: 12 }}>
        <div className="map-wrap card" style={{ borderRadius: 14, overflow: 'hidden' }}>
          {showLive ? (
            <div ref={mapEl} style={{ height: '100%', width: '100%' }} />
          ) : (
            <div className="map-offline">
              <img src={`${base}route-static.svg`} alt="Static route map of the Highlands tour" />
              <p className="muted" style={{ maxWidth: 320 }}>{offline ? 'You’re offline — showing the bundled route map.' : 'Bundled offline route map.'}</p>
              <button className="btn" onClick={() => setShowLive(true)}>Load live map ↗</button>
            </div>
          )}
        </div>
        {showLive && offline && (
          <p className="muted center" style={{ fontSize: '0.75rem', marginTop: 10 }}>
            Offline — only areas you’ve already viewed will show. <button onClick={() => setShowLive(false)} style={{ background: 'none', border: 'none', color: 'var(--whisky)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>Show route map</button>
          </p>
        )}
      </div>
    </>
  )
}
