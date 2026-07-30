type CacheStore = Record<string, { data: unknown; ts: number }>

declare global {
  interface Window { __appCache: CacheStore }
}

function getStore(): CacheStore {
  if (typeof window === "undefined") return {}
  if (!window.__appCache) window.__appCache = {}
  return window.__appCache
}

const TTL = 5 * 60_000 // 5 minutes

export function getCached<T>(key: string): T | null {
  const entry = getStore()[key]
  if (entry && Date.now() - entry.ts < TTL) return entry.data as T
  return null
}

export function setCached(key: string, data: unknown) {
  const store = getStore()
  if (store) store[key] = { data, ts: Date.now() }
}

export function invalidate(prefix: string) {
  const store = getStore()
  Object.keys(store).forEach(k => { if (k.startsWith(prefix)) delete store[k] })
}
