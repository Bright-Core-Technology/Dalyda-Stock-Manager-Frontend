"use client"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { Search, Download, Plus, SquarePen, Trash2, X, Save, CreditCard, TrendingUp } from "lucide-react"
import Link from "next/link"
import { getCached, setCached, invalidate } from "@/lib/cache"
import { SkeletonRows, SkeletonCards } from "@/components/SkeletonRows"

export default function SalesPage() {
  const token = useAuthStore(state => state.token)
  const role = useAuthStore(state => state.role)
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN"
  const isSuperAdmin = role === "SUPER_ADMIN"

  const [sales, setSales] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [page, setPage] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const pageSize = 10

  const [stats, setStats] = useState({ todayCount: 0, todayAmount: 0, weeklyCount: 0, weeklyAmount: 0 })

  const [showExport, setShowExport] = useState(false)
  const [exportFrom, setExportFrom] = useState("")
  const [exportTo, setExportTo] = useState("")
  const [exportError, setExportError] = useState<string | null>(null)

  const [editItem, setEditItem] = useState<any | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteItem, setDeleteItem] = useState<any | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchStats() {
      const cacheKey = `sales-stats-${isAdmin}`
      const cached = getCached<typeof stats>(cacheKey)
      if (cached) { setStats(cached); return }
      const headers = { Authorization: `Bearer ${token}` }
      const [todayCount, weeklyCount] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/today/count`, { headers }).then(r => r.json()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/total`, { headers }).then(r => r.json()),
      ])
      if (isAdmin) {
        const [todayAmount, weeklyAmount] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/today/amount`, { headers }).then(r => r.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/value`, { headers }).then(r => r.json()),
        ])
        const fresh = {
          todayCount: todayCount.data,
          todayAmount: todayAmount.data,
          weeklyCount: weeklyCount.data,
          weeklyAmount: weeklyAmount.data,
        }
        setStats(fresh)
        setCached(cacheKey, fresh)
      } else {
        const fresh = { todayCount: todayCount.data, todayAmount: 0, weeklyCount: weeklyCount.data, weeklyAmount: 0 }
        setStats(fresh)
        setCached(cacheKey, fresh)
      }
    }
    if (token && role) fetchStats()
  }, [token, role])

  async function fetchSales() {
    const headers = { Authorization: `Bearer ${token}` }
    const url = search || startDate || endDate
      ? `${process.env.NEXT_PUBLIC_API_URL}/sales/search?name=${search}&startDate=${startDate}&endDate=${endDate}&page=${page}&size=${pageSize}`
      : `${process.env.NEXT_PUBLIC_API_URL}/sales/?page=${page}&size=${pageSize}`
    const cacheKey = `sales-${page}-${search}-${startDate}-${endDate}`
    const cached = getCached<{ content: any[]; totalElements: number }>(cacheKey)
    if (cached) {
      setSales(cached.content)
      setTotalItems(cached.totalElements)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(url, { headers })
      const data = await res.json()
      setSales(data.data.content)
      setTotalItems(data.data.totalElements)
      setCached(cacheKey, { content: data.data.content, totalElements: data.data.totalElements })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) fetchSales()
  }, [token, search, startDate, endDate, page])

  async function handleExport() {
    const headers = { Authorization: `Bearer ${token}` }
    const params = new URLSearchParams()
    if (exportFrom) params.append("startDate", exportFrom)
    if (exportTo) params.append("endDate", exportTo)
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/export?${params}`, { headers })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "sales-export.xlsx"
    a.click()
    window.URL.revokeObjectURL(url)
    setShowExport(false)
    setExportFrom("")
    setExportTo("")
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditLoading(true)
    setEditError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          quantity: Number(editItem.quantity),
          price: Number(editItem.price),
          date: editItem.date,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.message || "Update failed"); return }
      invalidate("sales-")
      invalidate("till-")
      invalidate("stock-")
      setPage(0)
      setEditItem(null)
      await fetchSales()
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/delete/${deleteItem.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        setDeleteError(data.message || "Failed to delete sale")
        return
      }
      invalidate("sales-")
      invalidate("sales-stats-")
      invalidate("till-")
      invalidate("stock-")
      setPage(0)
      setDeleteItem(null)
      fetchSales()
    } catch {
      setDeleteError("Something went wrong. Please try again.")
    } finally {
      setDeleteLoading(false)
    }
  }

  const statCards = [
    { title: "Today's Sales", value: stats.todayCount, adminOnly: false },
    { title: "Today's Sales Amount", value: `$${(stats.todayAmount ?? 0).toLocaleString()}`, adminOnly: true },
    { title: "Weekly Sales", value: stats.weeklyCount, adminOnly: false },
    { title: "Weekly Sales Amount", value: `$${(stats.weeklyAmount ?? 0).toLocaleString()}`, adminOnly: true },
  ].filter(c => !c.adminOnly || isAdmin)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sales Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage your sales transactions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/sales/debts" className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors whitespace-nowrap">
            <CreditCard className="w-4 h-4" />
            Debts
          </Link>
          <Link href="/sales/advances" className="flex items-center gap-1.5 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors whitespace-nowrap">
            <TrendingUp className="w-4 h-4" />
            Advances
          </Link>
          <button onClick={() => setShowExport(true)} className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors whitespace-nowrap">
            <Download className="w-4 h-4" />
            Export
          </button>
          <Link href="/sales/add" className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap">
            <Plus className="w-4 h-4" />
            New Sale
          </Link>
        </div>
      </div>

      {/* Stats Bar — ADMIN/SUPER_ADMIN only */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 bg-blue-600 rounded-xl p-5">
          {statCards.map(card => (
            <div key={card.title} className="text-white">
              <p className="text-sm opacity-80">{card.title}</p>
              <p className="text-2xl font-bold mt-1">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Date filters */}
      <div className="mt-6 bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search by Item Name, Container, RecordedBy"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-500">From</span>
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(0) }} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-500">To</span>
          <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(0) }} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-4">
        <div className="overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="px-6 py-3 whitespace-nowrap">Date</th>
              <th className="px-6 py-3 whitespace-nowrap">Item Code</th>
              <th className="px-6 py-3 whitespace-nowrap">Item Name</th>
              <th className="px-6 py-3 whitespace-nowrap">Container</th>
              <th className="px-6 py-3 whitespace-nowrap">Quantity</th>
              <th className="px-6 py-3 whitespace-nowrap">Unit Price</th>
              <th className="px-6 py-3 whitespace-nowrap">Total</th>
              {isAdmin && <th className="px-6 py-3 whitespace-nowrap">Recorded By</th>}
              {isSuperAdmin && <th className="px-6 py-3 whitespace-nowrap text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows cols={isSuperAdmin ? 9 : isAdmin ? 8 : 7} /> : sales.length === 0 ? (
              <tr key="empty"><td colSpan={isSuperAdmin ? 9 : isAdmin ? 8 : 7} className="px-6 py-8 text-center text-gray-400 text-sm">No sales found.</td></tr>
            ) : sales.map((sale, index) => (
              <tr key={sale.id ?? index} className="text-sm text-gray-600 border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{sale.date}</td>
                <td className="px-6 py-4 whitespace-nowrap text-blue-600">{sale.code}</td>
                <td className="px-6 py-4 whitespace-nowrap">{sale.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-blue-600">{sale.containerName}</td>
                <td className="px-6 py-4 whitespace-nowrap">{sale.quantity}</td>
                <td className="px-6 py-4 whitespace-nowrap">${(sale.price ?? 0).toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">${(sale.totalPrice ?? 0).toFixed(2)}</td>
                {isAdmin && <td className="px-6 py-4 whitespace-nowrap">{sale.recordedBy}</td>}
                {isSuperAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => { setEditItem(sale); setEditError(null) }} className="text-blue-500 hover:text-blue-700"><SquarePen className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteItem(sale)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
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
          {loading ? <SkeletonCards rows={6} /> : sales.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">No sales found.</p>
          ) : sales.map((sale, index) => (
            <div key={sale.id ?? index} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-800">{sale.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sale.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800 text-sm">${(sale.totalPrice ?? 0).toFixed(2)}</span>
                  {isSuperAdmin && (
                    <>
                      <button onClick={() => { setEditItem(sale); setEditError(null) }} className="text-blue-500 hover:text-blue-700"><SquarePen className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteItem(sale)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                <div><p className="text-xs text-gray-400">Item Code</p><p className="text-blue-600">{sale.code}</p></div>
                <div><p className="text-xs text-gray-400">Container</p><p className="text-blue-600">{sale.containerName}</p></div>
                <div><p className="text-xs text-gray-400">Quantity</p><p className="text-gray-700">{sale.quantity}</p></div>
                <div><p className="text-xs text-gray-400">Unit Price</p><p className="text-gray-700">${(sale.price ?? 0).toFixed(2)}</p></div>
                {isAdmin && <div className="col-span-2"><p className="text-xs text-gray-400">Recorded By</p><p className="text-gray-700">{sale.recordedBy}</p></div>}
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

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Export Sales Data</h2>
              <button onClick={() => { setShowExport(false); setExportError(null) }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-600 mb-1">Export from date (optional)</label>
                <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-600 mb-1">Export to date (optional)</label>
                <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <p className="text-xs text-gray-400">Leave empty to export all filtered sales</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowExport(false); setExportError(null) }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleExport} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">Export CSV</button>
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
                <h2 className="text-lg font-semibold">Delete Sale</h2>
              </div>
              <button onClick={() => setDeleteItem(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-600 text-sm mb-4">Are you sure you want to delete the sale for <span className="font-medium">{deleteItem.name}</span>? This action cannot be undone.</p>
            {deleteError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
                <span>⚠</span><p>{deleteError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteItem(null); setDeleteError(null) }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
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
              <h2 className="text-lg font-semibold text-blue-600">Edit Sale</h2>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={editItem.date} onChange={e => setEditItem({ ...editItem, date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input type="number" value={editItem.quantity} onChange={e => setEditItem({ ...editItem, quantity: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (USD)</label>
                <input type="number" step="0.01" value={editItem.price} onChange={e => setEditItem({ ...editItem, price: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {editError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
                  <span>⚠</span><p>{editError}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditItem(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={editLoading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
