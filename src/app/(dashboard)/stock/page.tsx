"use client"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { Search, Upload, Plus, SquarePen, Trash2, X, Save } from "lucide-react"
import Link from "next/link"
import { getCached, setCached, invalidate } from "@/lib/cache"

export default function StockPage() {
  const token = useAuthStore(state => state.token)
  const role = useAuthStore(state => state.role)
  const isSuperAdmin = role === "SUPER_ADMIN"

  const [stock, setStock] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [selectedContainer, setSelectedContainer] = useState("")
  const [containers, setContainers] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const pageSize = 10

  const [editItem, setEditItem] = useState<any | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteItem, setDeleteItem] = useState<any | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchMeta() {
      const headers = { Authorization: `Bearer ${token}` }
      const containersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/container/names`, { headers }).then(r => r.json())
      setContainers(containersRes.data)
    }
    if (token) fetchMeta()
  }, [token])

  async function fetchStock() {
    const headers = { Authorization: `Bearer ${token}` }
    const url = search || selectedContainer
      ? `${process.env.NEXT_PUBLIC_API_URL}/stock/search?keyword=${search}&containerName=${selectedContainer}&page=${page}&size=${pageSize}`
      : `${process.env.NEXT_PUBLIC_API_URL}/stock/?page=${page}&size=${pageSize}`
    const cacheKey = `stock-${page}-${search}-${selectedContainer}`
    const cached = getCached<{ content: any[]; totalElements: number }>(cacheKey)
    if (cached) {
      setStock(cached.content)
      setTotalItems(cached.totalElements)
    }
    setLoading(!cached)
    try {
      const res = await fetch(url, { headers })
      const data = await res.json()
      setStock(data.data.content)
      setTotalItems(data.data.totalElements)
      setCached(cacheKey, { content: data.data.content, totalElements: data.data.totalElements })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) fetchStock()
  }, [token, search, selectedContainer, page])

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditLoading(true)
    setEditError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/update/${editItem.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: editItem.code,
          name: editItem.name,
          containerName: editItem.containerName,
          quantity: Number(editItem.quantity),
          price: Number(editItem.price),
          weight: editItem.weight,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.message || "Update failed"); return }
      setEditItem(null)
      fetchStock()
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/delete/${deleteItem.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        setDeleteError(data.message || "Failed to delete item")
        return
      }
      invalidate("stock-")
      setDeleteItem(null)
      fetchStock()
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
          <h1 className="text-2xl font-bold">Stock Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your inventory and stock levels</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/stock/bulk-upload" className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
            <Upload className="w-4 h-4" />
            Bulk Upload
          </Link>
          <Link href="/stock/add" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Add Stock
          </Link>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="mt-6 flex flex-wrap gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search by item name, item code, and container"
            className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={selectedContainer}
          onChange={e => { setSelectedContainer(e.target.value); setPage(0) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All</option>
          {containers.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-4">
        <div className="overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="px-6 py-3 whitespace-nowrap">Item Code</th>
              <th className="px-6 py-3 whitespace-nowrap">Item Name</th>
              <th className="px-6 py-3 whitespace-nowrap">Container</th>
              <th className="px-6 py-3 whitespace-nowrap">Quantity</th>
              <th className="px-6 py-3 whitespace-nowrap">Weight</th>
              <th className="px-6 py-3 whitespace-nowrap">Price</th>
              {isSuperAdmin && <th className="px-6 py-3 whitespace-nowrap text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr key="loading"><td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-8 text-center text-gray-400 text-sm">Loading…</td></tr>
            ) : stock.length === 0 ? (
              <tr key="empty"><td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-8 text-center text-gray-400 text-sm">No items found.</td></tr>
            ) : stock.map((item, index) => (
              <tr key={item.id ?? index} className="text-sm text-gray-600 border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{item.code}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.containerName}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.quantity}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.weight}</td>
                <td className="px-6 py-4 whitespace-nowrap">${item.price}</td>
                {isSuperAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => { setEditItem(item); setEditError(null) }} className="text-blue-500 hover:text-blue-700"><SquarePen className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteItem(item)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
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
          {loading ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">Loading…</p>
          ) : stock.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">No items found.</p>
          ) : stock.map((item, index) => (
            <div key={item.id ?? index} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.code}</p>
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditItem(item); setEditError(null) }} className="text-blue-500 hover:text-blue-700"><SquarePen className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteItem(item)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                <div><p className="text-xs text-gray-400">Container</p><p className="text-gray-700">{item.containerName}</p></div>
                <div><p className="text-xs text-gray-400">Quantity</p><p className="text-gray-700">{item.quantity}</p></div>
                <div><p className="text-xs text-gray-400">Weight</p><p className="text-gray-700">{item.weight}</p></div>
                <div><p className="text-xs text-gray-400">Price</p><p className="text-gray-700">${item.price}</p></div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 text-sm text-gray-500">
          <p>Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalItems)} of {totalItems} items</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0} className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-50">‹</button>
            <span>Page {page + 1} of {Math.ceil(totalItems / pageSize)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * pageSize >= totalItems} className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-50">›</button>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {deleteItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 rounded-full p-2">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-lg font-semibold">Delete Stock</h2>
              </div>
              <button onClick={() => setDeleteItem(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-600 text-sm mb-6">Are you sure you want to delete <span className="font-medium">{deleteItem.name}</span>? This action cannot be undone.</p>
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
              <h2 className="text-lg font-semibold text-blue-600">Edit Stock Item</h2>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
                <input value={editItem.code} onChange={e => setEditItem({ ...editItem, code: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Container Name</label>
                <input value={editItem.containerName} onChange={e => setEditItem({ ...editItem, containerName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input type="number" value={editItem.quantity} onChange={e => setEditItem({ ...editItem, quantity: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (USD)</label>
                <input type="number" step="0.01" value={editItem.price} onChange={e => setEditItem({ ...editItem, price: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                <input value={editItem.weight} onChange={e => setEditItem({ ...editItem, weight: e.target.value })} placeholder="e.g. 75KG" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
