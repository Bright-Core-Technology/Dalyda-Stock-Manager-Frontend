"use client"

import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { invalidate } from "@/lib/cache"

export default function AddStockPage() {
  const token = useAuthStore(state => state.token)
  const router = useRouter()

  const [form, setForm] = useState({
    code: "", name: "", containerName: "", quantity: "", price: "", weight: ""
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code || !form.name || !form.containerName || !form.quantity || !form.price || !form.weight) {
      setError("All fields are required")
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          containerName: form.containerName,
          quantity: Number(form.quantity),
          price: Number(form.price),
          weight: form.weight,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || "Failed to add stock"); return }
      invalidate("stock-")
      router.replace("/stock")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* Back link */}
      <Link href="/stock" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Stock
      </Link>

      <h1 className="text-2xl font-bold">Add New Stock Item</h1>
      <p className="text-gray-500 text-sm mt-1">Add a new item to your inventory</p>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-6 p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Code <span className="text-red-500">*</span></label>
            <input
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Container Name <span className="text-red-500">*</span></label>
            <input
              value={form.containerName}
              onChange={e => setForm({ ...form, containerName: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity <span className="text-red-500">*</span></label>
            <input
              type="number"
              value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price (USD) <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg pl-7 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight <span className="text-red-500">*</span></label>
            <input
              value={form.weight}
              onChange={e => setForm({ ...form, weight: e.target.value })}
              placeholder="e.g. 75KG"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
              <span>⚠</span><p>{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link href="/stock" className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors text-center">
              Cancel
            </Link>
            <button type="submit" disabled={isLoading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />
              {isLoading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
