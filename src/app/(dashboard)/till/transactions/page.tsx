"use client"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { ArrowLeft, RotateCcw, AlertTriangle, SquarePen } from "lucide-react"
import Link from "next/link"
import { getCached, setCached, invalidate } from "@/lib/cache"
import { SkeletonRows, SkeletonCards } from "@/components/SkeletonRows"
import { groupTransactions, type TillTx, type TxGroup } from "@/lib/groupTransactions"

type ViewTillTransactionDto = TillTx

function formatAmount(amount: number, currency: string) {
  if (currency === "USD") {
    return amount < 0 ? `-$${Math.abs(amount).toFixed(2)}` : `$${amount.toFixed(2)}`
  }
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString() + " Francs"
  return amount < 0 ? `-${formatted}` : formatted
}

function formatDateTime(iso: string) {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}

export default function TillTransactionsPage() {
  const token = useAuthStore(state => state.token)
  const role = useAuthStore(state => state.role)
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN"

  const [transactions, setTransactions] = useState<ViewTillTransactionDto[]>([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(false)

  const [reverseTarget, setReverseTarget] = useState<TxGroup | null>(null)
  const [reverseError, setReverseError] = useState("")
  const [reversing, setReversing] = useState(false)

  const [editTarget, setEditTarget] = useState<TxGroup | null>(null)
  const [editDescription, setEditDescription] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editSecondAmount, setEditSecondAmount] = useState("")
  const [editError, setEditError] = useState("")
  const [editing, setEditing] = useState(false)

  const size = 10

  async function fetchTransactions(p = 0) {
    if (!token) return
    const cacheKey = `till-transactions-${p}`
    const cached = getCached<{ content: ViewTillTransactionDto[]; totalPages: number; totalElements: number }>(cacheKey)
    if (cached) {
      setTransactions(cached.content)
      setTotalPages(cached.totalPages)
      setTotalElements(cached.totalElements)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/till/transactions?page=${p}&size=${size}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      const pageData = json.data ?? {}
      const content = pageData.content ?? []
      const totalPages = pageData.totalPages ?? 1
      const totalElements = pageData.totalElements ?? 0
      setTransactions(content)
      setTotalPages(totalPages)
      setTotalElements(totalElements)
      setCached(cacheKey, { content, totalPages, totalElements })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTransactions(page) }, [token, page])

  async function handleReverse() {
    if (!reverseTarget) return
    setReversing(true)
    setReverseError("")
    try {
      for (const id of reverseTarget.ids) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/till/delete/transaction/${id}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
        )
        if (!res.ok) {
          const j = await res.json()
          setReverseError(j.message ?? "Reverse failed")
          return
        }
      }
      invalidate("till-transactions-")
      setReverseTarget(null)
      fetchTransactions(page)
    } catch {
      setReverseError("Network error")
    } finally {
      setReversing(false)
    }
  }

  async function handleEdit() {
    if (!editTarget) return
    setEditing(true)
    setEditError("")
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/till/update/transaction/${editTarget.primary.id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ description: editDescription, amount: Number(editAmount) }),
        }
      )
      if (!res.ok) {
        const j = await res.json()
        setEditError(j.message ?? "Update failed")
        return
      }
      if (editTarget.merged && editTarget.secondary) {
        const res2 = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/till/update/transaction/${editTarget.secondary.id}`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ description: editDescription, amount: Number(editSecondAmount) }),
          }
        )
        if (!res2.ok) {
          const j = await res2.json()
          setEditError(j.message ?? "Update failed")
          return
        }
      }
      invalidate("till-transactions-")
      setEditTarget(null)
      fetchTransactions(page)
    } catch {
      setEditError("Network error")
    } finally {
      setEditing(false)
    }
  }

  const groups = groupTransactions(transactions)
  const from = totalElements === 0 ? 0 : page * size + 1
  const to = Math.min((page + 1) * size, totalElements)

  return (
    <div>
      <Link href="/till" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Till Management
      </Link>

      <h1 className="text-2xl font-bold">Till Transaction History</h1>
      <p className="text-sm text-gray-500 mt-1">Complete record of <span className="text-blue-600">all till transactions</span></p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
        {/* Desktop Table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Date &amp; Time</th>
                <th className="px-6 py-3">Recorded By</th>
                <th className="px-6 py-3">Currency</th>
                <th className="px-6 py-3 text-right">Amount</th>
                {isAdmin && <th className="px-6 py-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows cols={isAdmin ? 6 : 5} /> : groups.length === 0 ? (
                <tr key="empty">
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-8 text-center text-gray-400 text-sm">No transactions found.</td>
                </tr>
              ) : groups.map((g, i) => (
                <tr key={g.ids.join("-") ?? i} className="text-sm text-gray-700 border-b hover:bg-gray-50">
                  <td className="px-6 py-4">{g.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatDateTime(g.transactionDate)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{g.recordedBy}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {g.merged ? <span className="text-xs text-gray-400 italic">Mixed</span> : (g.primary.currency === "USD" ? "USD" : "Francs")}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-right font-medium ${g.primary.amount < 0 ? "text-red-500" : "text-gray-800"}`}>
                    {g.merged && g.secondary ? (
                      <span className="flex items-center justify-end gap-1">
                        <span>{formatAmount(g.primary.amount, g.primary.currency)}</span>
                        <span className="text-gray-400">+</span>
                        <span>{formatAmount(g.secondary.amount, g.secondary.currency)}</span>
                      </span>
                    ) : formatAmount(g.primary.amount, g.primary.currency)}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => { setEditTarget(g); setEditDescription(g.primary.description); setEditAmount(String(g.primary.amount)); setEditSecondAmount(g.secondary ? String(g.secondary.amount) : ""); setEditError("") }}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                          title="Edit transaction"
                        >
                          <SquarePen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setReverseTarget(g); setReverseError("") }}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                          title="Reverse transaction"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden">
          {loading ? <SkeletonCards rows={6} /> : groups.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">No transactions found.</p>
          ) : groups.map((g, i) => (
            <div key={g.ids.join("-") ?? i} className="relative bg-white border-b p-4">
              {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-1">
                  {!g.merged && (
                    <button
                      onClick={() => { setEditTarget(g.primary); setEditDescription(g.primary.description); setEditAmount(String(g.primary.amount)); setEditError("") }}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                      title="Edit transaction"
                    >
                      <SquarePen className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { setReverseTarget(g); setReverseError("") }}
                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                    title="Reverse transaction"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm pr-8">
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Description</p>
                  <p className="font-medium text-gray-700">{g.description}</p>
                </div>
                <div className={g.merged ? "col-span-2" : ""}>
                  <p className="text-xs text-gray-400">Amount</p>
                  {g.merged && g.secondary ? (
                    <p className="font-medium text-gray-800">
                      {formatAmount(g.primary.amount, g.primary.currency)} + {formatAmount(g.secondary.amount, g.secondary.currency)}
                    </p>
                  ) : (
                    <p className={`font-medium ${g.primary.amount < 0 ? "text-red-500" : "text-gray-800"}`}>
                      {formatAmount(g.primary.amount, g.primary.currency)}
                    </p>
                  )}
                </div>
                {!g.merged && (
                  <div>
                    <p className="text-xs text-gray-400">Currency</p>
                    <p className="text-gray-600">{g.primary.currency === "USD" ? "USD" : "Francs"}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400">Date &amp; Time</p>
                  <p className="text-gray-600">{formatDateTime(g.transactionDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Recorded By</p>
                  <p className="text-gray-600">{g.recordedBy}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-t">
          <p className="text-sm text-gray-500">Showing {from} to {to} of {totalElements} items</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded border text-gray-500 hover:bg-gray-50 disabled:opacity-40">&lt;</button>
            <span className="text-sm text-gray-600 px-2">Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded border text-gray-500 hover:bg-gray-50 disabled:opacity-40">&gt;</button>
          </div>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-semibold text-gray-800 mb-4">Edit Transaction</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{editTarget?.merged ? "USD Amount" : "Amount"}</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {editTarget?.merged && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Francs Amount</label>
                  <input
                    type="number"
                    value={editSecondAmount}
                    onChange={e => setEditSecondAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            {editError && <p className="text-red-500 text-sm mt-3">{editError}</p>}
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleEdit} disabled={editing} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {editing ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Transaction Modal */}
      {reverseTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
              <h2 className="font-semibold text-gray-800">Reverse Transaction</h2>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              Are you sure you want to reverse <strong>&quot;{reverseTarget.description}&quot;</strong>?
            </p>
            {reverseTarget.merged && (
              <p className="text-xs text-amber-600 mb-3">This will reverse both the USD and Francs entries for this sale.</p>
            )}
            {reverseError && <p className="text-red-500 text-sm mb-3">{reverseError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setReverseTarget(null)} className="px-4 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleReverse} disabled={reversing} className="px-4 py-2 text-sm rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
                {reversing ? "Reversing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
