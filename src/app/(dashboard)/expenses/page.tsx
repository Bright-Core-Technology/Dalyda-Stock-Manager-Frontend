"use client"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { ArrowLeft, Trash2, SquarePen } from "lucide-react"
import Link from "next/link"
import { getCached, setCached, invalidate } from "@/lib/cache"
import { SkeletonRows, SkeletonCards } from "@/components/SkeletonRows"

interface ViewExpenseDto {
  id: string
  description: string
  amount: number
  currency: string
  recordedBy: string
  expenseDate: string
}

function formatAmount(amount: number, currency: string) {
  if (currency === "USD") return `$${amount.toFixed(2)}`
  return `${amount.toLocaleString()} Francs`
}

function formatDate(iso: string) {
  return iso ? iso.split("T")[0] : ""
}

export default function ExpensesPage() {
  const token = useAuthStore(state => state.token)
  const role = useAuthStore(state => state.role)
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN"

  const [expenses, setExpenses] = useState<ViewExpenseDto[]>([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ViewExpenseDto | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  const [editTarget, setEditTarget] = useState<ViewExpenseDto | null>(null)
  const [editDescription, setEditDescription] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editDate, setEditDate] = useState("")
  const [editError, setEditError] = useState("")
  const [editing, setEditing] = useState(false)

  const size = 10

  async function fetchExpenses(p = 0) {
    if (!token) return
    const cacheKey = `expenses-${p}`
    const cached = getCached<{ content: ViewExpenseDto[]; totalPages: number; totalElements: number }>(cacheKey)
    if (cached) {
      setExpenses(cached.content)
      setTotalPages(cached.totalPages)
      setTotalElements(cached.totalElements)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/till/expenses?page=${p}&size=${size}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      const pageData = json.data ?? {}
      const content = pageData.content ?? []
      const totalPages = pageData.totalPages ?? 1
      const totalElements = pageData.totalElements ?? 0
      setExpenses(content)
      setTotalPages(totalPages)
      setTotalElements(totalElements)
      setCached(cacheKey, { content, totalPages, totalElements })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchExpenses(page) }, [token, page])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/till/delete/expense/${deleteTarget.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) {
        const j = await res.json()
        setDeleteError(j.message ?? "Delete failed")
        return
      }
      invalidate("expenses-")
      setPage(0)
      setDeleteTarget(null)
      fetchExpenses(0)
    } catch {
      setDeleteError("Network error")
    } finally {
      setDeleting(false)
    }
  }

  async function handleEdit() {
    if (!editTarget) return
    setEditing(true)
    setEditError("")
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/till/update/expense/${editTarget.id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ description: editDescription, amount: Number(editAmount), expenseDate: editDate }),
        }
      )
      if (!res.ok) {
        const j = await res.json()
        setEditError(j.message ?? "Update failed")
        return
      }
      invalidate("expenses-")
      setPage(0)
      setEditTarget(null)
      fetchExpenses(0)
    } catch {
      setEditError("Network error")
    } finally {
      setEditing(false)
    }
  }

  const from = totalElements === 0 ? 0 : page * size + 1
  const to = Math.min((page + 1) * size, totalElements)

  return (
    <div>
      {/* Back link */}
      <Link href="/till" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Till Management
      </Link>

      {/* Header */}
      <h1 className="text-2xl font-bold">Expense History</h1>
      <p className="text-sm text-gray-500 mt-1">Complete record of <span className="text-blue-600">all expenses</span></p>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
        <div className="overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Expense Name</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Currency</th>
              <th className="px-6 py-3">Recorded By</th>
              {isAdmin && <th className="px-6 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows cols={isAdmin ? 6 : 5} /> : expenses.length === 0 ? (
              <tr key="empty"><td colSpan={isAdmin ? 6 : 5} className="px-6 py-8 text-center text-gray-400 text-sm">No expenses found.</td></tr>
            ) : expenses.map((exp, i) => (
              <tr key={exp.id ?? i} className="text-sm text-gray-700 border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{formatDate(exp.expenseDate)}</td>
                <td className="px-6 py-4">{exp.description}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatAmount(exp.amount, exp.currency)}</td>
                <td className="px-6 py-4 whitespace-nowrap capitalize">{exp.currency === "USD" ? "USD" : "Francs"}</td>
                <td className="px-6 py-4 whitespace-nowrap">{exp.recordedBy}</td>
                {isAdmin && (
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditTarget(exp); setEditDescription(exp.description); setEditAmount(String(exp.amount)); setEditDate(formatDate(exp.expenseDate)); setEditError("") }}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                        title="Edit expense"
                      >
                        <SquarePen className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setDeleteTarget(exp); setDeleteError("") }}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        title="Delete expense"
                      >
                        <Trash2 className="w-4 h-4" />
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
          {loading ? <SkeletonCards rows={6} /> : expenses.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">No expenses found.</p>
          ) : expenses.map((exp, i) => (
            <div key={exp.id ?? i} className="relative bg-white border-b p-4">
              {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-1">
                  <button
                    onClick={() => { setEditTarget(exp); setEditDescription(exp.description); setEditAmount(String(exp.amount)); setEditDate(formatDate(exp.expenseDate)); setEditError("") }}
                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                    title="Edit expense"
                  >
                    <SquarePen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setDeleteTarget(exp); setDeleteError("") }}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    title="Delete expense"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm pr-8">
                <div>
                  <p className="text-xs text-gray-400">Date</p>
                  <p className="font-medium text-gray-700">{formatDate(exp.expenseDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Amount</p>
                  <p className="font-medium text-gray-700">{formatAmount(exp.amount, exp.currency)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Expense Name</p>
                  <p className="font-medium text-gray-700">{exp.description}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Currency</p>
                  <p className="text-gray-600">{exp.currency === "USD" ? "USD" : "Francs"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Recorded By</p>
                  <p className="text-gray-600">{exp.recordedBy}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-t">
          <p className="text-sm text-gray-500">
            Showing {from} to {to} of {totalElements} items
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded border text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              &lt;
            </button>
            <span className="text-sm text-gray-600 px-2">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded border text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-semibold text-gray-800 mb-4">Edit Expense</h2>
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
                <label className="block text-xs text-gray-500 mb-1">Amount</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {editError && <p className="text-red-500 text-sm mt-3">{editError}</p>}
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={editing}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {editing ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-semibold text-gray-800 mb-2">Delete Expense</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>&quot;{deleteTarget.description}&quot;</strong>? This action cannot be undone.
            </p>
            {deleteError && <p className="text-red-500 text-sm mb-3">{deleteError}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
