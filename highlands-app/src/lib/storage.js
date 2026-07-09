// Tiny localStorage wrapper + React hook. All keys are namespaced so the app
// never collides with anything else on the origin.
//
// It also exposes a small change bus so cloud sync (lib/sync.js) can (a) observe
// local writes to push them, and (b) apply remote changes and have the UI update
// live. When sync is not configured, none of this changes existing behaviour.

import { useCallback, useEffect, useState } from 'react'

const NS = 'highlands:'

const keyListeners = new Map() // key -> Set<cb(value)>
const writeObservers = new Set() // cb(key, value) — fired on local user writes

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

function emit(key, value) {
  const ls = keyListeners.get(key)
  if (ls) ls.forEach((cb) => { try { cb(value) } catch { /* */ } })
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable — ignore, app still works in-memory */
  }
  emit(key, value)
  writeObservers.forEach((cb) => { try { cb(key, value) } catch { /* */ } })
}

// Subscribe to changes for a single key (used by usePersistentState so remote
// sync updates reflect in the UI without a reload).
export function subscribeKey(key, cb) {
  let s = keyListeners.get(key)
  if (!s) { s = new Set(); keyListeners.set(key, s) }
  s.add(cb)
  return () => s.delete(cb)
}

// Observe every local write (sync uses this to push user changes).
export function registerWriteObserver(cb) {
  writeObservers.add(cb)
  return () => writeObservers.delete(cb)
}

// Apply a value that came from sync: writes storage + updates any live UI,
// WITHOUT notifying write-observers (so it isn't re-pushed as a local change).
export function applyExternal(key, value) {
  try { localStorage.setItem(NS + key, JSON.stringify(value)) } catch { /* */ }
  emit(key, value)
}

/** Persisted state hook backed by localStorage; live-updates on remote sync. */
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => readJSON(key, initial))

  useEffect(() => {
    writeJSON(key, value)
  }, [key, value])

  // React to external (sync-applied) changes for this key.
  useEffect(() => {
    return subscribeKey(key, (incoming) => {
      setValue((cur) => (JSON.stringify(cur) === JSON.stringify(incoming) ? cur : incoming))
    })
  }, [key])

  return [value, setValue]
}

/** Persisted set of ticked ids, with a stable toggle helper. */
export function useChecklist(key) {
  const [ticked, setTicked] = usePersistentState(key, {})
  const toggle = useCallback((id) => {
    setTicked((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [setTicked])
  const clear = useCallback(() => setTicked({}), [setTicked])
  return [ticked, toggle, clear]
}
