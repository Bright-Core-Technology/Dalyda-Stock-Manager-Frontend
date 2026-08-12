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
      // For conversions: put the "given" (negative) side first so arrow reads correctly
      const [primary, secondary] = usd.amount < 0 ? [usd, fc] : fc.amount < 0 ? [fc, usd] : [usd, fc]
      groups.push({ ids: [primary.id, secondary.id], description: primary.description, transactionDate: primary.transactionDate, recordedBy: primary.recordedBy, merged: true, primary, secondary })
    } else {
      for (const t of bucket) {
        groups.push({ ids: [t.id], description: t.description, transactionDate: t.transactionDate, recordedBy: t.recordedBy, merged: false, primary: t })
      }
    }
  }

  return groups
}
