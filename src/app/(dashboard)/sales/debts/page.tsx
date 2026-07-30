"use client"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { Search, SquarePen, Trash2, X, Save, DollarSign } from "lucide-react"
import Link from "next/link"
import { getCached, setCached, invalidate } from "@/lib/cache"
import { SkeletonRows, SkeletonCards } from "@/components/SkeletonRows"

export default function DebtsPage() {
  const token = useAuthStore(state => state.token)
  const role = useAuthStore(state => state.role)
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN"

  const [debts, setDebts] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const pageSize = 10

  const [editItem, setEditItem] = useState<any | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteItem, setDeleteItem] = useState<any | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [payItem, setPayItem] = useState<any | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchDebts() {
    const headers = { Authorization: `Bearer ${token}` }
    const url = search
      ? `${process.env.NEXT_PUBLIC_API_URL}/debt/search?customerName=${search}&page=${page}&size=${pageSize}`
      : `${process.env.NEXT_PUBLIC_API_URL}/debt/?page=${page}&size=${pageSize}`
    const cacheKey = `debts-${page}-${search}`
    const cached = getCached<{ content: any[]; totalElements: number }>(cacheKey)
    if (cached) {
      setDebts(cached.content)
      setTotalItems(cached.totalElements)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(url, { headers })
      const data = await res.json()
      setDebts(data.data.content)
      setTotalItems(data.data.totalElements)
      setCached(cacheKey, { content: data.data.content, totalElements: data.data.totalElements })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) fetchDebts()
  }, [token, search, page])

  async function handlePay() {
    if (!payAmount || Number(payAmount) <= 0) {
      setPayError("Please enter a valid payment amount")
      return
    }
    setPayLoading(true)
    setPayError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/debt/${payItem.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountPaid: Number(payAmount) }),
      })
      if (!res.ok) {
        const data = await res.json()
        setPayError(data.message || "Failed to record payment")
        return
      }
      setPayItem(null)
      setPayAmount("")
      fetchDebts()
    } catch {
      setPayError("Something went wrong. Please try again.")
    } finally {
      setPayLoading(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditLoading(true)
    setEditError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/debt/update/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerName: editItem.customerName,
          amount: Number(editItem.amount),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.message || "Update failed"); return }
      invalidate("debts-")
      setEditItem(null)
      fetchDebts()
    } catch {
      setEditError("Something went wrong. Please try again.")
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/debt/delete/${deleteItem.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        setDeleteError(data.message || "Failed to delete debt")
        return
      }
      invalidate("debts-")
      setDeleteItem(null)
      fetchDebts()
    } catch {
      setDeleteError("Something went wrong. Please try again.")
    } finally {
      setDeleteLoading(false)
    }
  }

  function formatAmount(amount: number, currency: string) {
    const num = (amount ?? 0).toLocaleString()
    return currency === "FRANCS" ? `FC ${num}` : `$${num}`
  }

  function statusBadge(status: string) {
    if (status === "PAID") return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Paid</span>
    if (status === "PARTIALLY_PAID") return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Partial</span>
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">Unpaid</span>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1">
            <Link href="/sales" className="text-sm text-gray-500 hover:text-gray-700">← Back to Sales</Link>
          </div>
          <h1 className="text-2xl font-bold">Debts Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage customer debts</p>
        </div>
      </div>

      {/* Search */}
      <div className="mt-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search by customer name..."
          className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-4">
        <div className="overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="px-6 py-3 whitespace-nowrap">Customer</th>
              <th className="px-6 py-3 whitespace-nowrap">Amount</th>
              <th className="px-6 py-3 whitespace-nowrap">Status</th>
              <th className="px-6 py-3 whitespace-nowrap">Date</th>
              <th className="px-6 py-3 whitespace-nowrap">Recorded By</th>
              <th className="px-6 py-3 whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows cols={6} /> : debts.length === 0 ? (
              <tr key="empty"><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">No debts found.</td></tr>
            ) : debts.map((debt, index) => (
              <tr key={debt.id ?? index} className="text-sm text-gray-600 border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium">{debt.customerName}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatAmount(debt.amount, debt.currency)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{statusBadge(debt.status)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{debt.date}</td>
                <td className="px-6 py-4 whitespace-nowrap">{debt.recordedBy}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-3">
                    {debt.status !== "PAID" && (
                      <button
                        onClick={() => { setPayItem(debt); setPayAmount(""); setPayError(null) }}
                        className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                      >
                        <DollarSign className="w-3 h-3" />
                        Pay Debt
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button onClick={() => { setEditItem(debt); setEditError(null) }} className="text-blue-500 hover:text-blue-700"><SquarePen className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteItem(debt)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden divide-y">
          {loading ? <SkeletonCards rows={6} /> : debts.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">No debts found.</p>
          ) : debts.map((debt, index) => (
            <div key={debt.id ?? index} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-800">{debt.customerName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{debt.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  {debt.status !== "PAID" && (
                    <button
                      onClick={() => { setPayItem(debt); setPayAmount(""); setPayError(null) }}
                      className="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded-lg text-xs font-medium hover:bg-green-700"
                    >
                      <DollarSign className="w-3 h-3" />
                      Pay
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={() => { setEditItem(debt); setEditError(null) }} className="text-blue-500 hover:text-blue-700"><SquarePen className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteItem(debt)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                <div><p className="text-xs text-gray-400">Amount</p><p className="text-gray-700">{formatAmount(debt.amount, debt.currency)}</p></div>
                <div><p className="text-xs text-gray-400">Status</p><div className="mt-0.5">{statusBadge(debt.status)}</div></div>
                <div className="col-span-2"><p className="text-xs text-gray-400">Recorded By</p><p className="text-gray-700">{debt.recordedBy}</p></div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 text-sm text-gray-500">
          <p>Showing {totalItems === 0 ? 0 : page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalItems)} of {totalItems} items</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0} className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-50">‹</button>
            <span>Page {page + 1} of {Math.max(1, Math.ceil(totalItems / pageSize))}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * pageSize >= totalItems} className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-50">›</button>
          </div>
        </div>
      </div>

      {/* Pay Debt Modal */}
      {payItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Record Debt Payment</h2>
              <button onClick={() => setPayItem(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-blue-500">Customer</p>
                <p className="font-semibold text-gray-800 mt-0.5">{payItem.customerName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Amount Owed</p>
                <p className="font-semibold text-gray-800 mt-0.5">{formatAmount(payItem.amount, payItem.currency)}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="0.01"
                max={payItem.amount}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="Enter payment amount"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">Maximum: {formatAmount(payItem.amount, payItem.currency)}</p>
            </div>
            {payError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mt-4">
                <span>⚠</span><p>{payError}</p>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setPayItem(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handlePay} disabled={payLoading} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {payLoading ? "Processing..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 rounded-full p-2"><Trash2 className="w-5 h-5 text-red-600" /></div>
                <h2 className="text-lg font-semibold">Delete Debt</h2>
              </div>
              <button onClick={() => setDeleteItem(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-600 text-sm mb-4">Delete the debt record for <span className="font-medium">{deleteItem.customerName}</span>? This action cannot be undone.</p>
            {deleteError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
                <span>⚠</span><p>{deleteError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteItem(null); setDeleteError(null) }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-blue-600">Edit Debt</h2>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input value={editItem.customerName} onChange={e => setEditItem({ ...editItem, customerName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="number" step="0.01" value={editItem.amount} onChange={e => setEditItem({ ...editItem, amount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {editError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
                  <span>⚠</span><p>{editError}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditItem(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={editLoading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {editLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
