"use client"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { SkeletonRows, SkeletonCards } from "@/components/SkeletonRows"

interface AuditTrailDto {
  action: string
  performedBy: string
  performedAt: string
  details: string
}

const TABS = [
  { label: "Users",        endpoint: "/user/audit-trail" },
  { label: "Stock",        endpoint: "/stock/audit-trail" },
  { label: "Sales",        endpoint: "/sales/audit-trail" },
  { label: "Till",         endpoint: "/till/audit-trail/transaction" },
  { label: "Expenses",     endpoint: "/till/audit-trail/expense" },
  { label: "Debts",        endpoint: "/debt/audit-trail" },
  { label: "Advances",     endpoint: "/advance/audit-trail" },
]

function actionBadge(action: string) {
  const map: Record<string, string> = {
    ADD:    "bg-green-100 text-green-700",
    UPDATE: "bg-blue-100 text-blue-700",
    DELETE: "bg-red-100 text-red-700",
    PAY:    "bg-purple-100 text-purple-700",
  }
  const cls = map[action?.toUpperCase()] ?? "bg-gray-100 text-gray-600"
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{action}</span>
}

function formatDateTime(iso: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleString("en-US", {
    month: "numeric", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  })
}

export default function AuditPage() {
  const token = useAuthStore(state => state.token)
  const [activeTab, setActiveTab] = useState(0)
  const [records, setRecords] = useState<AuditTrailDto[]>([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const size = 10

  async function fetchAudit(tab = activeTab, p = 0) {
    if (!token) return
    setLoading(true); setError("")
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}${TABS[tab].endpoint}?page=${p}&size=${size}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      if (!res.ok) { setError(json.message ?? "Failed to load audit trail"); setRecords([]); return }
      const pg = json.data ?? {}
      setRecords(pg.content ?? [])
      setTotalPages(pg.totalPages ?? 1)
      setTotalElements(pg.totalElements ?? 0)
    } catch {
      setError("Network error. Please try again.")
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(0)
    fetchAudit(activeTab, 0)
  }, [token, activeTab])

  function switchTab(i: number) {
    setActiveTab(i)
    setPage(0)
    setRecords([])
  }

  const from = totalElements === 0 ? 0 : page * size + 1
  const to = Math.min((page + 1) * size, totalElements)

  return (
    <div>
      {/* Header */}
      <h1 className="text-2xl font-bold">Audit Trail</h1>
      <p className="text-sm text-gray-500 mt-1">Complete log of all system actions</p>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mt-6 bg-gray-100 p-1 rounded-xl">
        {TABS.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => switchTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === i
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-4">
        <div className="overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="px-6 py-3">Action</th>
              <th className="px-6 py-3">Performed By</th>
              <th className="px-6 py-3">Date & Time</th>
              <th className="px-6 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows cols={4} /> : error ? (
              <tr key="error"><td colSpan={4} className="px-6 py-8 text-center text-red-400 text-sm">{error}</td></tr>
            ) : records.length === 0 ? (
              <tr key="empty"><td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">No audit records found.</td></tr>
            ) : (records.map((rec, i) => (
              <tr key={i} className="text-sm text-gray-700 border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{actionBadge(rec.action)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{rec.performedBy}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatDateTime(rec.performedAt)}</td>
                <td className="px-6 py-4 text-gray-500">{rec.details}</td>
              </tr>
            )))}
          </tbody>
        </table>
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden">
          {loading && <SkeletonCards rows={5} />}
          {!loading && error && <p className="px-4 py-8 text-center text-red-400 text-sm">{error}</p>}
          {!loading && !error && records.length === 0 && <p className="px-4 py-8 text-center text-gray-400 text-sm">No audit records found.</p>}
          {!loading && !error && records.map((rec, i) => (
            <div key={i} className="bg-white border-b p-4">
              <div className="flex items-center justify-between mb-2">
                <div>{actionBadge(rec.action)}</div>
                <span className="text-xs text-gray-400">{formatDateTime(rec.performedAt)}</span>
              </div>
              <div className="grid grid-cols-1 gap-1 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Performed By</p>
                  <p className="font-medium text-gray-700">{rec.performedBy}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Details</p>
                  <p className="text-gray-500">{rec.details}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-t">
          <p className="text-sm text-gray-500">Showing {from} to {to} of {totalElements} records</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { const p = Math.max(0, page - 1); setPage(p); fetchAudit(activeTab, p) }}
              disabled={page === 0}
              className="p-1.5 rounded border text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >&lt;</button>
            <span className="text-sm text-gray-600 px-2">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => { const p = Math.min(totalPages - 1, page + 1); setPage(p); fetchAudit(activeTab, p) }}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded border text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >&gt;</button>
          </div>
        </div>
      </div>
    </div>
  )
}
