const store: Record<string, { data: unknown; ts: number }> = {}
const TTL = 30_000 // 30 seconds

export function getCached<T>(key: string): T | null {
  const entry = store[key]
  if (entry && Date.now() - entry.ts < TTL) return entry.data as T
  return null
}

export function setCached(key: string, data: unknown) {
  store[key] = { data, ts: Date.now() }
}

export function invalidate(prefix: string) {
  Object.keys(store).forEach(k => { if (k.startsWith(prefix)) delete store[k] })
}
