export interface TillTx {
  id: string
  type?: string
  amount: number
  currency: string
  description: string
  recordedBy: string
  transactionDate: string
  saleId?: string
}

export interface TxGroup {
  ids: string[]
  description: string
  transactionDate: string
  recordedBy: string
  merged: boolean
  primary: TillTx
  secondary?: TillTx
}

export function groupTransactions(txs: TillTx[]): TxGroup[] {
  const pairKey = (tx: TillTx) =>
    tx.saleId ? `sale:${tx.saleId}` : `dt:${tx.description}|||${tx.transactionDate}`

  const buckets = new Map<string, TillTx[]>()
  for (const tx of txs) {
    const k = pairKey(tx)
    const bucket = buckets.get(k) ?? []
    bucket.push(tx)
    buckets.set(k, bucket)
  }

  const groups: TxGroup[] = []
  const seen = new Set<string>()
  for (const tx of txs) {
    const k = pairKey(tx)
    if (seen.has(k)) continue
    seen.add(k)
    const bucket = buckets.get(k)!
    const hasUsd = bucket.some(t => t.currency === "USD")
    const hasFc = bucket.some(t => t.currency === "FRANCS")
    const isMixed = bucket.length === 2 && hasUsd && hasFc
    if (isMixed) {
      const usd = bucket.find(t => t.currency === "USD")!
      const fc = bucket.find(t => t.currency === "FRANCS")!
      groups.push({ ids: [usd.id, fc.id], description: usd.description, transactionDate: usd.transactionDate, recordedBy: usd.recordedBy, merged: true, primary: usd, secondary: fc })
    } else {
      for (const t of bucket) {
        groups.push({ ids: [t.id], description: t.description, transactionDate: t.transactionDate, recordedBy: t.recordedBy, merged: false, primary: t })
      }
    }
  }

  return groups
}
