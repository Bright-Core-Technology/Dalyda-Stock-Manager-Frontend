"use client"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { Search, Plus, SquarePen, Trash2, X, Save } from "lucide-react"
import Link from "next/link"
import { getCached, setCached, invalidate } from "@/lib/cache"
import { SkeletonRows, SkeletonCards } from "@/components/SkeletonRows"

function formatAmount(amount: number, currency: string) {
  const num = (amount ?? 0).toLocaleString()
  return currency === "FRANCS" ? `FC ${num}` : `$${num}`
}

export default function AdvancesPage() {
  const token = useAuthStore(state => state.token)
  const role = useAuthStore(state => state.role)
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN"

  const [advances, setAdvances] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const pageSize = 10

  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ customerName: "", amount: "" })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editItem, setEditItem] = useState<any | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteItem, setDeleteItem] = useState<any | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchAdvances() {
    const headers = { Authorization: `Bearer ${token}` }
    const url = search
      ? `${process.env.NEXT_PUBLIC_API_URL}/advance/search?customerName=${search}&page=${page}&size=${pageSize}`
      : `${process.env.NEXT_PUBLIC_API_URL}/advance/?page=${page}&size=${pageSize}`
    const cacheKey = `advances-${page}-${search}`
    const cached = getCached<{ content: any[]; totalElements: number }>(cacheKey)
    if (cached) {
      setAdvances((cached.content ?? []).filter((a: any) => !a.archivedAt))
      setTotalItems(cached.totalElements)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(url, { headers })
      const data = await res.json()
      setAdvances((data.data.content ?? []).filter((a: any) => !a.archivedAt))
      setTotalItems(data.data.totalElements)
      setCached(cacheKey, { content: data.data.content, totalElements: data.data.totalElements })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) fetchAdvances()
  }, [token, search, page])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.customerName || !addForm.amount) {
      setAddError("Customer name and amount are required")
      return
    }
    setAddLoading(true)
    setAddError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/advance/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerName: addForm.customerName,
          amount: Number(addForm.amount),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.message || "Failed to add advance"); return }
      invalidate("advances-")
      invalidate("till-")
      setShowAdd(false)
      setAddForm({ customerName: "", amount: "" })
      fetchAdvances()
    } catch {
      setAddError("Something went wrong. Please try again.")
    } finally {
      setAddLoading(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditLoading(true)
    setEditError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/advance/update/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerName: editItem.customerName,
          amount: Number(editItem.amount),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.message || "Update failed"); return }
      invalidate("advances-")
      invalidate("till-")
      setPage(0)
      setEditItem(null)
      fetchAdvances()
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/advance/delete/${deleteItem.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        setDeleteError(data.message || "Failed to delete advance")
        return
      }
      invalidate("advances-")
      invalidate("till-")
      setPage(0)
      setDeleteItem(null)
      fetchAdvances()
    } catch {
      setDeleteError("Something went wrong. Please try again.")
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1">
            <Link href="/sales" className="text-sm text-gray-500 hover:text-gray-700">← Back to Sales</Link>
          </div>
          <h1 className="text-2xl font-bold">Advances Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track customer advance payments</p>
        </div>
        <button onClick={() => { setShowAdd(true); setAddError(null) }} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
          <Plus className="w-4 h-4" />
          Add Advance
        </button>
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
              <th className="px-6 py-3 whitespace-nowrap">Date</th>
              <th className="px-6 py-3 whitespace-nowrap">Recorded By</th>
              {isAdmin && <th className="px-6 py-3 whitespace-nowrap text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows cols={isAdmin ? 5 : 4} /> : advances.length === 0 ? (
              <tr key="empty"><td colSpan={isAdmin ? 5 : 4} className="px-6 py-8 text-center text-gray-400 text-sm">No advances found.</td></tr>
            ) : advances.map((adv, index) => (
              <tr key={adv.id ?? index} className="text-sm text-gray-600 border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium">{adv.customerName}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatAmount(adv.amount, adv.currency)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{adv.date}</td>
                <td className="px-6 py-4 whitespace-nowrap">{adv.recordedBy}</td>
                {isAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => { setEditItem(adv); setEditError(null) }} className="text-blue-500 hover:text-blue-700"><SquarePen className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteItem(adv)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden divide-y">
          {loading ? <SkeletonCards rows={6} /> : advances.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">No advances found.</p>
          ) : advances.map((adv, index) => (
            <div key={adv.id ?? index} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-800">{adv.customerName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{adv.date}</p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditItem(adv); setEditError(null) }} className="text-blue-500 hover:text-blue-700"><SquarePen className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteItem(adv)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                <div><p className="text-xs text-gray-400">Amount</p><p className="text-gray-700">{formatAmount(adv.amount, adv.currency)}</p></div>
                <div><p className="text-xs text-gray-400">Recorded By</p><p className="text-gray-700">{adv.recordedBy}</p></div>
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

      {/* Add Advance Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-purple-600">Add Advance</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
                <input value={addForm.customerName} onChange={e => setAddForm({ ...addForm, customerName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" value={addForm.amount} onChange={e => setAddForm({ ...addForm, amount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {addError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
                  <span>⚠</span><p>{addError}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={addLoading} className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {addLoading ? "Saving..." : "Add Advance"}
                </button>
              </div>
            </form>
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
                <h2 className="text-lg font-semibold">Delete Advance</h2>
              </div>
              <button onClick={() => setDeleteItem(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-amber-800 text-sm font-medium mb-1">⚠ Cash will be returned</p>
              <p className="text-amber-700 text-sm">Deleting this advance will record a refund of <span className="font-bold">${deleteItem.amount}</span> to the till. This means <span className="font-bold">${deleteItem.amount}</span> cash was returned to <span className="font-medium">{deleteItem.customerName}</span>. Only continue if you have actually returned the cash.</p>
            </div>
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
              <h2 className="text-lg font-semibold text-blue-600">Edit Advance</h2>
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
