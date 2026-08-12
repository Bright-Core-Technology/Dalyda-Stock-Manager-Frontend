"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuthStore } from "@/store/authStore"
import { Search, Plus, SquarePen, Trash2, RefreshCw, X, Users, Shield, Crown } from "lucide-react"
import { getCached, setCached, invalidate } from "@/lib/cache"
import { SkeletonRows, SkeletonCards } from "@/components/SkeletonRows"

interface ViewUserDto {
  id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  role: "USER" | "ADMIN" | "SUPER_ADMIN"
  createdAt: string
}

function roleBadge(role: string) {
  if (role === "SUPER_ADMIN") return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Super Admin</span>
  if (role === "ADMIN") return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Admin</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">User</span>
}

function formatDate(iso: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })
}

const ROLES = ["USER", "ADMIN", "SUPER_ADMIN"] as const

export default function UsersPage() {
  const token = useAuthStore(state => state.token)
  const role = useAuthStore(state => state.role)
  const loggedInEmail = useAuthStore(state => state.email)
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN"
  const isSuperAdmin = role === "SUPER_ADMIN"

  // Stats
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalAdmins, setTotalAdmins] = useState(0)
  const [totalSuperAdmins, setTotalSuperAdmins] = useState(0)

  // List
  const [users, setUsers] = useState<ViewUserDto[]>([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [search, setSearch] = useState("")

  // Modals
  const [showRegister, setShowRegister] = useState(false)
  const [editTarget, setEditTarget] = useState<ViewUserDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ViewUserDto | null>(null)
  const [resetTarget, setResetTarget] = useState<ViewUserDto | null>(null)

  // Register form
  const [regForm, setRegForm] = useState({ firstName: "", lastName: "", email: "", phoneNumber: "", role: "USER" as typeof ROLES[number] })
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState("")
  const [regSuccess, setRegSuccess] = useState("")

  // Edit form
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phoneNumber: "", role: "USER" as typeof ROLES[number] })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState("")

  // Delete
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  // Reset password
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState("")
  const [resetSuccess, setResetSuccess] = useState("")

  const size = 10
  const headers = { Authorization: `Bearer ${token}` }

  async function fetchStats() {
    const [total, admins, superAdmins] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/count/total`, { headers }).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/count/admins`, { headers }).then(r => r.json()),
      isSuperAdmin
        ? fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/count/super-admins`, { headers }).then(r => r.json())
        : Promise.resolve({ data: null }),
    ])
    setTotalUsers(total.data ?? 0)
    setTotalAdmins(admins.data ?? 0)
    if (isSuperAdmin) setTotalSuperAdmins(superAdmins.data ?? 0)
  }

  const fetchUsers = useCallback(async (p = 0, kw = search) => {
    if (!token) return
    const cacheKey = `users-${p}-${kw}`
    const cached = getCached<{ content: ViewUserDto[]; totalPages: number; totalElements: number }>(cacheKey)
    if (cached) {
      setUsers(cached.content)
      setTotalPages(cached.totalPages)
      setTotalElements(cached.totalElements)
      return
    }
    setLoading(true)
    try {
      const url = kw
        ? `${process.env.NEXT_PUBLIC_API_URL}/user/search?keyword=${encodeURIComponent(kw)}&page=${p}&size=${size}`
        : `${process.env.NEXT_PUBLIC_API_URL}/user/?page=${p}&size=${size}`
      const res = await fetch(url, { headers })
      const json = await res.json()
      const pg = json.data ?? {}
      const content = pg.content ?? []
      const totalPages = pg.totalPages ?? 1
      const totalElements = pg.totalElements ?? 0
      setUsers(content)
      setTotalPages(totalPages)
      setTotalElements(totalElements)
      setCached(cacheKey, { content, totalPages, totalElements })
    } finally {
      setLoading(false)
    }
  }, [token, search])

  useEffect(() => { if (token) { fetchStats(); fetchUsers(0, search) } }, [token])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(0)
    setSearch(keyword)
    fetchUsers(0, keyword)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!regForm.firstName || !regForm.lastName || !regForm.email) { setRegError("First name, last name and email are required"); return }
    setRegLoading(true); setRegError(""); setRegSuccess("")
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/user/registration?role=${regForm.role}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ firstName: regForm.firstName, lastName: regForm.lastName, email: regForm.email, phoneNumber: regForm.phoneNumber }),
        }
      )
      const data = await res.json()
      if (!res.ok) { setRegError(data.message ?? "Registration failed"); return }
      setRegSuccess("User registered! A temporary password has been emailed.")
      setRegForm({ firstName: "", lastName: "", email: "", phoneNumber: "", role: "USER" })
      invalidate("users-")
      fetchUsers(0, search); fetchStats()
    } catch { setRegError("Network error") }
    finally { setRegLoading(false) }
  }

  function openEdit(user: ViewUserDto) {
    setEditTarget(user)
    setEditForm({ firstName: user.firstName, lastName: user.lastName, phoneNumber: user.phoneNumber ?? "", role: user.role })
    setEditError("")
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    setEditLoading(true); setEditError("")
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/user/update/${editTarget.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(
            editTarget.email === loggedInEmail
              ? { firstName: editForm.firstName, lastName: editForm.lastName, phoneNumber: editForm.phoneNumber }
              : { firstName: editForm.firstName, lastName: editForm.lastName, phoneNumber: editForm.phoneNumber, role: editForm.role }
          ),
        }
      )
      const data = await res.json()
      if (!res.ok) { setEditError(data.message ?? "Update failed"); return }
      invalidate("users-")
      setPage(0)
      setEditTarget(null); fetchUsers(0, search)
    } catch { setEditError("Network error") }
    finally { setEditLoading(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true); setDeleteError("")
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/user/delete/${deleteTarget.id}`,
        { method: "DELETE", headers }
      )
      if (!res.ok) { const d = await res.json(); setDeleteError(d.message ?? "Delete failed"); return }
      invalidate("users-")
      setPage(0)
      setDeleteTarget(null); fetchUsers(0, search); fetchStats()
    } catch { setDeleteError("Network error") }
    finally { setDeleteLoading(false) }
  }

  async function handleResetPassword() {
    if (!resetTarget) return
    setResetLoading(true); setResetError(""); setResetSuccess("")
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/user/password/reset?email=${encodeURIComponent(resetTarget.email)}`,
        { method: "POST", headers }
      )
      const data = await res.json()
      if (!res.ok) { setResetError(data.message ?? "Reset failed"); return }
      setResetSuccess("Password reset email sent successfully.")
    } catch { setResetError("Network error") }
    finally { setResetLoading(false) }
  }

  const from = totalElements === 0 ? 0 : page * size + 1
  const to = Math.min((page + 1) * size, totalElements)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-gray-500 text-sm mt-1">Manage system users and roles</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => { setShowRegister(true); setRegError(""); setRegSuccess("") }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> New User
          </button>
        )}
      </div>

      {/* Stats */}
      {isAdmin && (
        <div className={`grid ${isSuperAdmin ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"} gap-4 mt-6`}>
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl"><Users className="w-6 h-6 text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-2xl font-bold">{totalUsers}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-xl"><Shield className="w-6 h-6 text-purple-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Admins</p>
              <p className="text-2xl font-bold">{totalAdmins}</p>
            </div>
          </div>
          {isSuperAdmin && (
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-orange-50 rounded-xl"><Crown className="w-6 h-6 text-orange-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Super Admins</p>
                <p className="text-2xl font-bold">{totalSuperAdmins}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2 mt-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Search</button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-4">
        <div className="overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Joined</th>
              {isSuperAdmin && <th className="px-6 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows cols={isSuperAdmin ? 5 : 4} /> : users.length === 0 ? (
              <tr key="empty"><td colSpan={isSuperAdmin ? 6 : 5} className="px-6 py-8 text-center text-gray-400 text-sm">No users found.</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className="text-sm text-gray-700 border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium">{user.firstName} {user.lastName}</td>
                <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                <td className="px-6 py-4">{roleBadge(user.role)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatDate(user.createdAt)}</td>
                {isSuperAdmin && (
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => { setResetTarget(user); setResetError(""); setResetSuccess("") }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg">
                        <RefreshCw className="w-3.5 h-3.5" /> Reset Password
                      </button>
                      <button onClick={() => openEdit(user)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Edit">
                        <SquarePen className="w-4 h-4" />
                      </button>
                      {user.email !== loggedInEmail && (
                        <button onClick={() => { setDeleteTarget(user); setDeleteError("") }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
          {loading ? <SkeletonCards rows={6} /> : users.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">No users found.</p>
          ) : users.map(user => (
            <div key={user.id} className="relative bg-white border-b p-4">
              {isSuperAdmin && (
                <div className="absolute top-4 right-4 flex items-center gap-1">
                  <button onClick={() => { setResetTarget(user); setResetError(""); setResetSuccess("") }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Reset Password">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(user)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Edit">
                    <SquarePen className="w-4 h-4" />
                  </button>
                  {user.email !== loggedInEmail && (
                    <button onClick={() => { setDeleteTarget(user); setDeleteError("") }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm pr-24">
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Name</p>
                  <p className="font-medium text-gray-700">{user.firstName} {user.lastName}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-gray-600 break-all">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Role</p>
                  <div className="mt-0.5">{roleBadge(user.role)}</div>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Joined</p>
                  <p className="text-gray-600">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-t">
          <p className="text-sm text-gray-500">Showing {from} to {to} of {totalElements} items</p>
          <div className="flex items-center gap-2">
            <button onClick={() => { const p = Math.max(0, page - 1); setPage(p); fetchUsers(p, search) }} disabled={page === 0} className="p-1.5 rounded border text-gray-500 hover:bg-gray-50 disabled:opacity-40">&lt;</button>
            <span className="text-sm text-gray-600 px-2">Page {page + 1} of {totalPages}</span>
            <button onClick={() => { const p = Math.min(totalPages - 1, page + 1); setPage(p); fetchUsers(p, search) }} disabled={page >= totalPages - 1} className="p-1.5 rounded border text-gray-500 hover:bg-gray-50 disabled:opacity-40">&gt;</button>
          </div>
        </div>
      </div>

      {/* Register Modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Register New User</h2>
              <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {regSuccess ? (
              <div className="text-center py-4">
                <p className="text-green-600 font-medium mb-1">User registered!</p>
                <p className="text-sm text-gray-500 mb-6">A temporary password has been emailed to the new user.</p>
                <button onClick={() => { setShowRegister(false); setRegSuccess("") }} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Done</button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                    <input value={regForm.firstName} onChange={e => setRegForm({ ...regForm, firstName: e.target.value })} placeholder="Jane" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                    <input value={regForm.lastName} onChange={e => setRegForm({ ...regForm, lastName: e.target.value })} placeholder="Doe" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input type="email" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} placeholder="jane@example.com" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                  <select value={regForm.role} onChange={e => setRegForm({ ...regForm, role: e.target.value as typeof ROLES[number] })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                {regError && <p className="text-red-500 text-sm">{regError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowRegister(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={regLoading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {regLoading ? "Registering…" : "Register"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Edit User</h2>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {editTarget?.email !== loggedInEmail && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value as typeof ROLES[number] })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
              )}
              {editError && <p className="text-red-500 text-sm">{editError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={editLoading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {editLoading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="font-semibold text-gray-800">Delete User</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong>? This cannot be undone.
            </p>
            {deleteError && <p className="text-red-500 text-sm mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="font-semibold text-gray-800">Reset Password</h2>
            </div>
            {resetSuccess ? (
              <div className="text-center py-2">
                <p className="text-green-600 text-sm font-medium mb-4">{resetSuccess}</p>
                <button onClick={() => setResetTarget(null)} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Done</button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Reset password for <strong>{resetTarget.firstName} {resetTarget.lastName}</strong>? A new temporary password will be sent to <span className="text-blue-600">{resetTarget.email}</span>.
                </p>
                {resetError && <p className="text-red-500 text-sm mb-3">{resetError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setResetTarget(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button onClick={handleResetPassword} disabled={resetLoading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {resetLoading ? "Sending…" : "Reset & Send Email"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
