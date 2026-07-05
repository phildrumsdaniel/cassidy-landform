// Tiny localStorage wrapper + React hook. All keys are namespaced so the app
// never collides with anything else on the origin.

import { useCallback, useEffect, useState } from 'react'

const NS = 'highlands:'

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable — ignore, app still works in-memory */
  }
}

/** Persisted state hook backed by localStorage. */
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => readJSON(key, initial))

  useEffect(() => {
    writeJSON(key, value)
  }, [key, value])

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
