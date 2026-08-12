"use client"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { Plus, ArrowUpCircle, RefreshCw, X, Save, Trash2, SquarePen } from "lucide-react"
import Link from "next/link"
import { getCached, setCached, invalidate } from "@/lib/cache"
import { SkeletonRows, SkeletonCards } from "@/components/SkeletonRows"
import { groupTransactions, type TxGroup } from "@/lib/groupTransactions"

export default function TillPage() {
  const token = useAuthStore(state => state.token)
  const role = useAuthStore(state => state.role)
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN"

  const [usdBalance, setUsdBalance] = useState(0)
  const [francsBalance, setFrancsBalance] = useState(0)
  const [expenses, setExpenses] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])

  // Modals
  const [showExpense, setShowExpense] = useState(false)
  const [showTillToBank, setShowTillToBank] = useState(false)
  const [showConvert, setShowConvert] = useState(false)

  // Add Expense form
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", currency: "USD" })
  const [expenseLoading, setExpenseLoading] = useState(false)
  const [expenseError, setExpenseError] = useState<string | null>(null)

  // Till to Bank form
  const [bankForm, setBankForm] = useState({ amount: "", recipientName: "" })
  const [bankLoading, setBankLoading] = useState(false)
  const [bankError, setBankError] = useState<string | null>(null)

  // Convert Currency form — Figma says "vice versa" so support both directions
  const [convertDir, setConvertDir] = useState<"francs-to-usd" | "usd-to-francs">("francs-to-usd")
  const [convertForm, setConvertForm] = useState({ amount: "", exchangeRate: "" })
  const [convertLoading, setConvertLoading] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)

  // Delete
  const [deleteExpense, setDeleteExpense] = useState<any | null>(null)
  const [deleteTx, setDeleteTx] = useState<TxGroup | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Edit Expense
  const [editExpense, setEditExpense] = useState<any | null>(null)
  const [editExpenseForm, setEditExpenseForm] = useState({ description: "", amount: "", expenseDate: "" })
  const [editExpenseLoading, setEditExpenseLoading] = useState(false)
  const [editExpenseError, setEditExpenseError] = useState<string | null>(null)

  // Edit Transaction
  const [editTx, setEditTx] = useState<TxGroup | null>(null)
  const [editTxForm, setEditTxForm] = useState({ description: "", amount: "", secondAmount: "" })
  const [editTxLoading, setEditTxLoading] = useState(false)
  const [editTxError, setEditTxError] = useState<string | null>(null)

  async function fetchAll() {
    const headers = { Authorization: `Bearer ${token}` }
    const cached = getCached<{ usdBalance: number; francsBalance: number; expenses: any[]; transactions: any[] }>('till-all')
    if (cached) {
      setUsdBalance(cached.usdBalance)
      setFrancsBalance(cached.francsBalance)
      setExpenses(cached.expenses)
      setTransactions(cached.transactions)
      return
    }
    setLoading(true)
    try {
      const [usd, francs, exp, tx] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/till/balance/usd`, { headers }).then(r => r.json()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/till/balance/francs`, { headers }).then(r => r.json()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/till/expenses/top5`, { headers }).then(r => r.json()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/till/transactions/top5`, { headers }).then(r => r.json()),
      ])
      const freshUsd = usd.data ?? 0
      const freshFrancs = francs.data ?? 0
      const freshExpenses = Array.isArray(exp.data) ? exp.data : []
      const freshTransactions = Array.isArray(tx.data) ? tx.data : []
      setUsdBalance(freshUsd)
      setFrancsBalance(freshFrancs)
      setExpenses(freshExpenses)
      setTransactions(freshTransactions)
      setCached('till-all', { usdBalance: freshUsd, francsBalance: freshFrancs, expenses: freshExpenses, transactions: freshTransactions })
    } catch (err) {
      console.error("Till fetchAll error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) fetchAll()
  }, [token])

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!expenseForm.description || !expenseForm.amount) { setExpenseError("All fields are required"); return }
    setExpenseLoading(true); setExpenseError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/till/add/expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: expenseForm.description, amount: Number(expenseForm.amount), currency: expenseForm.currency }),
      })
      const data = await res.json()
      if (!res.ok) { setExpenseError(data.message || "Failed to add expense"); return }
      invalidate("till-")
      setShowExpense(false)
      setExpenseForm({ description: "", amount: "", currency: "USD" })
      fetchAll()
    } catch { setExpenseError("Something went wrong.") }
    finally { setExpenseLoading(false) }
  }

  async function handleTillToBank(e: React.FormEvent) {
    e.preventDefault()
    if (!bankForm.amount || !bankForm.recipientName) { setBankError("All fields are required"); return }
    setBankLoading(true); setBankError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/till/till-to-bank`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(bankForm.amount), currency: "USD", recipientName: bankForm.recipientName }),
      })
      const data = await res.json()
      if (!res.ok) { setBankError(data.message || "Transfer failed"); return }
      invalidate("till-")
      setShowTillToBank(false)
      setBankForm({ amount: "", recipientName: "" })
      fetchAll()
    } catch { setBankError("Something went wrong.") }
    finally { setBankLoading(false) }
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault()
    if (!convertForm.amount || !convertForm.exchangeRate) { setConvertError("Amount and exchange rate are required"); return }
    setConvertLoading(true); setConvertError(null)
    try {
      const endpoint = convertDir === "francs-to-usd"
        ? "/till/conversion/francs-to-usd"
        : "/till/conversion/usd-to-francs"
      const body = convertDir === "francs-to-usd"
        ? { francsAmount: Number(convertForm.amount), exchangeRate: Number(convertForm.exchangeRate) }
        : { usdAmount: Number(convertForm.amount), exchangeRate: Number(convertForm.exchangeRate) }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setConvertError(data.message || "Conversion failed"); return }
      invalidate("till-")
      setShowConvert(false)
      setConvertForm({ amount: "", exchangeRate: "" })
      fetchAll()
    } catch { setConvertError("Something went wrong.") }
    finally { setConvertLoading(false) }
  }

  async function handleDeleteExpense() {
    setDeleteLoading(true); setDeleteError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/till/delete/expense/${deleteExpense.id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { const d = await res.json(); setDeleteError(d.message || "Failed to delete"); return }
      setDeleteExpense(null); fetchAll()
    } catch { setDeleteError("Something went wrong.") }
    finally { setDeleteLoading(false) }
  }

  async function handleDeleteTx() {
    if (!deleteTx) return
    setDeleteLoading(true); setDeleteError(null)
    try {
      for (const id of deleteTx.ids) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/till/delete/transaction/${id}`, {
          method: "DELETE", headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) { const d = await res.json(); setDeleteError(d.message || "Failed to delete"); return }
      }
      invalidate("till-")
      setDeleteTx(null); fetchAll()
    } catch { setDeleteError("Something went wrong.") }
    finally { setDeleteLoading(false) }
  }

  async function handleEditExpense(e: React.FormEvent) {
    e.preventDefault()
    setEditExpenseLoading(true); setEditExpenseError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/till/update/expense/${editExpense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: editExpenseForm.description, amount: Number(editExpenseForm.amount), expenseDate: editExpenseForm.expenseDate }),
      })
      const data = await res.json()
      if (!res.ok) { setEditExpenseError(data.message || "Update failed"); return }
      invalidate("till-"); setEditExpense(null); fetchAll()
    } catch { setEditExpenseError("Something went wrong.") }
    finally { setEditExpenseLoading(false) }
  }

  async function handleEditTx(e: React.FormEvent) {
    e.preventDefault()
    if (!editTx) return
    setEditTxLoading(true); setEditTxError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/till/update/transaction/${editTx.primary.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: editTxForm.description }),
      })
      const data = await res.json()
      if (!res.ok) { setEditTxError(data.message || "Update failed"); return }
      if (editTx.merged && editTx.secondary) {
        const res2 = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/till/update/transaction/${editTx.secondary.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ description: editTxForm.description }),
        })
        const data2 = await res2.json()
        if (!res2.ok) { setEditTxError(data2.message || "Update failed"); return }
      }
      invalidate("till-"); setEditTx(null); fetchAll()
    } catch { setEditTxError("Something went wrong.") }
    finally { setEditTxLoading(false) }
  }

  function formatDate(dt: string) {
    if (!dt) return ""
    const d = new Date(dt)
    return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }) +
      ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  }

  function formatAmount(amount: number, currency: string) {
    return currency === "FRANCS" ? `${(amount ?? 0).toLocaleString()} Francs` : `$${(amount ?? 0).toFixed(2)}`
  }

  return (
    <div>
      {/* Header */}
      <h1 className="text-2xl font-bold">Till Management</h1>
      <p className="text-gray-500 text-sm mt-1">Manage cash flow, expenses, and transactions</p>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="bg-green-600 rounded-xl p-5 text-white">
          <p className="text-xs opacity-80">Total Dollars</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-light">$</span>
            <span className="text-3xl font-bold">${usdBalance.toFixed(2)}</span>
          </div>
        </div>
        <div className="bg-blue-600 rounded-xl p-5 text-white">
          <p className="text-xs opacity-80">Total Francs</p>
          <p className="text-3xl font-bold mt-1">{francsBalance.toLocaleString()}</p>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <button onClick={() => { setShowExpense(true); setExpenseError(null) }} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-left hover:shadow-md transition-shadow">
          <Plus className="w-5 h-5 text-red-500 mb-2" />
          <p className="font-semibold text-gray-800">Add Expense</p>
          <p className="text-xs text-gray-400 mt-0.5">Record new expense</p>
        </button>
        <button onClick={() => { setShowTillToBank(true); setBankError(null) }} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-left hover:shadow-md transition-shadow">
          <ArrowUpCircle className="w-5 h-5 text-purple-500 mb-2" />
          <p className="font-semibold text-gray-800">Till to Bank</p>
          <p className="text-xs text-gray-400 mt-0.5">Transfer to bank</p>
        </button>
        <button onClick={() => { setShowConvert(true); setConvertError(null) }} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-left hover:shadow-md transition-shadow">
          <RefreshCw className="w-5 h-5 text-blue-500 mb-2" />
          <p className="font-semibold text-gray-800">Convert Currency</p>
          <p className="text-xs text-gray-400 mt-0.5">Francs to Dollars</p>
        </button>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Expenses</h2>
          <Link href="/expenses" className="text-sm text-blue-600 hover:underline">View more</Link>
        </div>
        <div className="overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Expense Name</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Currency</th>
              <th className="px-6 py-3">Recorded By</th>
              {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows cols={isAdmin ? 6 : 5} rows={3} /> : expenses.length === 0 ? (
              <tr key="empty-exp"><td colSpan={isAdmin ? 6 : 5} className="px-6 py-6 text-center text-gray-400 text-sm">No expenses recorded yet.</td></tr>
            ) : expenses.map((exp, i) => (
              <tr key={exp.id ?? i} className="text-sm text-gray-600 border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{exp.expenseDate?.split("T")[0]}</td>
                <td className="px-6 py-4">{exp.description}</td>
                <td className="px-6 py-4 whitespace-nowrap">{exp.currency === "USD" ? `$${(exp.amount ?? 0).toFixed(2)}` : (exp.amount ?? 0).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">{exp.currency}</td>
                <td className="px-6 py-4 whitespace-nowrap">{exp.recordedBy}</td>
                {isAdmin && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditExpense(exp); setEditExpenseForm({ description: exp.description, amount: String(exp.amount), expenseDate: exp.expenseDate?.split("T")[0] ?? "" }); setEditExpenseError(null) }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><SquarePen className="w-4 h-4" /></button>
                      <button onClick={() => { setDeleteExpense(exp); setDeleteError(null) }} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Mobile Cards - Expenses */}
        <div className="block md:hidden">
          {loading ? <SkeletonCards rows={3} /> : expenses.length === 0 ? (
            <p className="px-4 py-6 text-center text-gray-400 text-sm">No expenses recorded yet.</p>
          ) : expenses.map((exp, i) => (
            <div key={exp.id ?? i} className="relative bg-white border-b p-4">
              {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-1">
                  <button onClick={() => { setEditExpense(exp); setEditExpenseForm({ description: exp.description, amount: String(exp.amount), expenseDate: exp.expenseDate?.split("T")[0] ?? "" }); setEditExpenseError(null) }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><SquarePen className="w-4 h-4" /></button>
                  <button onClick={() => { setDeleteExpense(exp); setDeleteError(null) }} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm pr-8">
                <div>
                  <p className="text-xs text-gray-400">Date</p>
                  <p className="font-medium text-gray-700">{exp.expenseDate?.split("T")[0]}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Amount</p>
                  <p className="font-medium text-gray-700">{exp.currency === "USD" ? `$${(exp.amount ?? 0).toFixed(2)}` : (exp.amount ?? 0).toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Expense Name</p>
                  <p className="text-gray-600">{exp.description}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Currency</p>
                  <p className="text-gray-600">{exp.currency}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Recorded By</p>
                  <p className="text-gray-600">{exp.recordedBy}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Till Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Till Transactions</h2>
          <Link href="/till/transactions" className="text-sm text-blue-600 hover:underline">View more</Link>
        </div>
        <div className="overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="px-6 py-3">Description</th>
              <th className="px-6 py-3">Date & Time</th>
              <th className="px-6 py-3">Recorded By</th>
              <th className="px-6 py-3">Currency</th>
              <th className="px-6 py-3 text-right">Amount</th>
              {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows cols={isAdmin ? 6 : 5} rows={3} /> : transactions.length === 0 ? (
              <tr key="empty-tx"><td colSpan={isAdmin ? 6 : 5} className="px-6 py-6 text-center text-gray-400 text-sm">No transactions recorded yet.</td></tr>
            ) : groupTransactions(transactions).map((g, i) => (
              <tr key={g.ids.join("-") ?? i} className="text-sm text-gray-600 border-b hover:bg-gray-50">
                <td className="px-6 py-4">{g.description}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatDate(g.transactionDate)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{g.recordedBy}</td>
                <td className="px-6 py-4 whitespace-nowrap">{g.merged ? <span className="text-xs text-gray-500">USD/FRANCS</span> : g.primary.currency}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {g.merged && g.secondary
                    ? <span>{formatAmount(Math.abs(g.primary.amount), g.primary.currency)} → {formatAmount(Math.abs(g.secondary.amount), g.secondary.currency)}</span>
                    : formatAmount(g.primary.amount, g.primary.currency)}
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditTx(g); setEditTxForm({ description: g.primary.description, amount: String(g.primary.amount), secondAmount: g.secondary ? String(g.secondary.amount) : "" }); setEditTxError(null) }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><SquarePen className="w-4 h-4" /></button>
                      <button onClick={() => { setDeleteTx(g); setDeleteError(null) }} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Mobile Cards - Transactions */}
        <div className="block md:hidden">
          {loading ? <SkeletonCards rows={3} /> : transactions.length === 0 ? (
            <p className="px-4 py-6 text-center text-gray-400 text-sm">No transactions recorded yet.</p>
          ) : groupTransactions(transactions).map((g, i) => (
            <div key={g.ids.join("-") ?? i} className="relative bg-white border-b p-4">
              {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-1">
                  <button onClick={() => { setEditTx(g); setEditTxForm({ description: g.primary.description, amount: String(g.primary.amount), secondAmount: g.secondary ? String(g.secondary.amount) : "" }); setEditTxError(null) }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><SquarePen className="w-4 h-4" /></button>
                  <button onClick={() => { setDeleteTx(g); setDeleteError(null) }} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm pr-8">
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Description</p>
                  <p className="font-medium text-gray-700">{g.description}</p>
                </div>
                <div className={g.merged ? "col-span-2" : ""}>
                  <p className="text-xs text-gray-400">Amount</p>
                  {g.merged && g.secondary
                    ? <p className="font-medium text-gray-700">{formatAmount(Math.abs(g.primary.amount), g.primary.currency)} → {formatAmount(Math.abs(g.secondary.amount), g.secondary.currency)}</p>
                    : <p className="font-medium text-gray-700">{formatAmount(g.primary.amount, g.primary.currency)}</p>}
                </div>
                {!g.merged && (
                  <div>
                    <p className="text-xs text-gray-400">Currency</p>
                    <p className="text-gray-600">{g.primary.currency}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400">Date &amp; Time</p>
                  <p className="text-gray-600">{formatDate(g.transactionDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Recorded By</p>
                  <p className="text-gray-600">{g.recordedBy}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showExpense && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Add Expense</h2>
              <button onClick={() => setShowExpense(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expense Name <span className="text-red-500">*</span></label>
                <input value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Enter expense name" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="Enter amount" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency <span className="text-red-500">*</span></label>
                <select value={expenseForm.currency} onChange={e => setExpenseForm({ ...expenseForm, currency: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="USD">USD</option>
                  <option value="FRANCS">Francs</option>
                </select>
              </div>
              {expenseError && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg"><span>⚠</span><p>{expenseError}</p></div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowExpense(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={expenseLoading} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {expenseLoading ? "Adding..." : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Till to Bank Modal */}
      {showTillToBank && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Till to Bank</h2>
              <button onClick={() => setShowTillToBank(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleTillToBank} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (USD) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" value={bankForm.amount} onChange={e => setBankForm({ ...bankForm, amount: e.target.value })} placeholder="Enter amount" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <p className="text-xs text-blue-500 mt-1">Available: ${usdBalance.toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name <span className="text-red-500">*</span></label>
                <input value={bankForm.recipientName} onChange={e => setBankForm({ ...bankForm, recipientName: e.target.value })} placeholder="Enter recipient name" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              {bankError && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg"><span>⚠</span><p>{bankError}</p></div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTillToBank(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={bankLoading} className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                  {bankLoading ? "Transferring..." : "Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Currency Modal */}
      {showConvert && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Convert Currency</h2>
              <button onClick={() => setShowConvert(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {/* Direction toggle */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button type="button" onClick={() => setConvertDir("francs-to-usd")} className={`py-2 rounded-lg text-sm font-medium border-2 transition-colors ${convertDir === "francs-to-usd" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                Francs → USD
              </button>
              <button type="button" onClick={() => setConvertDir("usd-to-francs")} className={`py-2 rounded-lg text-sm font-medium border-2 transition-colors ${convertDir === "usd-to-francs" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                USD → Francs
              </button>
            </div>
            <form onSubmit={handleConvert} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {convertDir === "francs-to-usd" ? "Francs Amount" : "USD Amount"} <span className="text-red-500">*</span>
                </label>
                <input type="number" step="0.01" value={convertForm.amount} onChange={e => setConvertForm({ ...convertForm, amount: e.target.value })} placeholder="Enter amount" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exchange Rate (FC per $1) <span className="text-red-500">*</span></label>
                <input type="number" value={convertForm.exchangeRate} onChange={e => setConvertForm({ ...convertForm, exchangeRate: e.target.value })} placeholder="e.g. 2800" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {convertForm.amount && convertForm.exchangeRate && (
                  <p className="text-xs text-blue-500 mt-1">
                    {convertDir === "francs-to-usd"
                      ? `≈ $${(Number(convertForm.amount) / Number(convertForm.exchangeRate)).toFixed(2)} USD`
                      : `≈ ${(Number(convertForm.amount) * Number(convertForm.exchangeRate)).toLocaleString()} Francs`}
                  </p>
                )}
              </div>
              {convertError && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg"><span>⚠</span><p>{convertError}</p></div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowConvert(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={convertLoading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  {convertLoading ? "Converting..." : "Convert"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {editExpense && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Expense</h2>
              <button onClick={() => setEditExpense(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditExpense} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={editExpenseForm.description} onChange={e => setEditExpenseForm({ ...editExpenseForm, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="number" value={editExpenseForm.amount} onChange={e => setEditExpenseForm({ ...editExpenseForm, amount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={editExpenseForm.expenseDate} onChange={e => setEditExpenseForm({ ...editExpenseForm, expenseDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {editExpenseError && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg"><span>⚠</span><p>{editExpenseError}</p></div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditExpense(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={editExpenseLoading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {editExpenseLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Transaction</h2>
              <button onClick={() => setEditTx(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditTx} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={editTxForm.description} onChange={e => setEditTxForm({ ...editTxForm, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {editTxError && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg"><span>⚠</span><p>{editTxError}</p></div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditTx(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={editTxLoading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {editTxLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Expense Modal */}
      {deleteExpense && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 rounded-full p-2"><Trash2 className="w-5 h-5 text-red-600" /></div>
              <h2 className="text-lg font-semibold">Delete Expense</h2>
            </div>
            <p className="text-gray-600 text-sm mb-4">Delete <span className="font-medium">{deleteExpense.description}</span>? This cannot be undone.</p>
            {deleteError && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4"><span>⚠</span><p>{deleteError}</p></div>}
            <div className="flex gap-3">
              <button onClick={() => setDeleteExpense(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleDeleteExpense} disabled={deleteLoading} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Transaction Modal */}
      {deleteTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 rounded-full p-2"><Trash2 className="w-5 h-5 text-red-600" /></div>
              <h2 className="text-lg font-semibold">Delete Transaction</h2>
            </div>
            <p className="text-gray-600 text-sm mb-1">Delete <strong>&quot;{deleteTx?.description}&quot;</strong>? This cannot be undone.</p>
            {deleteTx?.merged && <p className="text-xs text-amber-600 mb-4">This will delete both the USD and Francs entries for this sale.</p>}
            {deleteError && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4"><span>⚠</span><p>{deleteError}</p></div>}
            <div className="flex gap-3">
              <button onClick={() => setDeleteTx(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleDeleteTx} disabled={deleteLoading} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
