// Offline photo & video storage using IndexedDB. Blobs are far too big for
// localStorage, so all captured media lives here — fully offline, on the phone.
// Journal *text* stays in localStorage (see storage.js); media lives here and
// is linked to a base by baseId.

const DB = 'highlands-media'
const STORE = 'media'
const VERSION = 1

let dbp = null

function open() {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        os.createIndex('baseId', 'baseId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

function tx(mode) {
  return open().then((db) => db.transaction(STORE, mode).objectStore(STORE))
}

// Ask the browser to keep our data (reduces the chance iOS evicts it).
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist()
    }
  } catch { /* ignore */ }
  return false
}

export async function estimateUsage() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate()
      return { usage, quota }
    }
  } catch { /* ignore */ }
  return { usage: 0, quota: 0 }
}

export async function addMedia(baseId, file) {
  const type = (file.type || '').startsWith('video') ? 'video' : 'image'
  const record = {
    baseId,
    type,
    blob: file,
    name: file.name || `${type}-${baseId}`,
    size: file.size || 0,
    created: Date.now()
  }
  const store = await tx('readwrite')
  return new Promise((resolve, reject) => {
    const req = store.add(record)
    req.onsuccess = () => resolve({ ...record, id: req.result })
    req.onerror = () => reject(req.error)
  })
}

export async function getMediaForBase(baseId) {
  const store = await tx('readonly')
  const idx = store.index('baseId')
  return new Promise((resolve, reject) => {
    const out = []
    const req = idx.openCursor(IDBKeyRange.only(baseId))
    req.onsuccess = () => {
      const cur = req.result
      if (cur) { out.push(cur.value); cur.continue() }
      else resolve(out.sort((a, b) => a.created - b.created))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getAllMedia() {
  const store = await tx('readonly')
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.created - b.created))
    req.onerror = () => reject(req.error)
  })
}

export async function deleteMedia(id) {
  const store = await tx('readwrite')
  return new Promise((resolve, reject) => {
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function countMedia() {
  const store = await tx('readonly')
  return new Promise((resolve) => {
    const req = store.count()
    req.onsuccess = () => resolve(req.result || 0)
    req.onerror = () => resolve(0)
  })
}
