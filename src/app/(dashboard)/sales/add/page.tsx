"use client"

import { useState, useEffect, useRef } from "react"
import { useAuthStore } from "@/store/authStore"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Search, DollarSign, CreditCard } from "lucide-react"
import { invalidate } from "@/lib/cache"

interface StockItem {
  id: string
  code: string
  name: string
  containerName: string
  weight: string
  price?: number
  quantity?: number
}

export default function AddSalePage() {
  const token = useAuthStore(state => state.token)
  const email = useAuthStore(state => state.email)
  const router = useRouter()

  const [advances, setAdvances] = useState<{ id: string; customerName: string; amount: number }[]>([])

  // Item search
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<StockItem[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Sale fields (read-only after item selected)
  const [itemCode, setItemCode] = useState("")
  const [itemName, setItemName] = useState("")
  const [containerName, setContainerName] = useState("")
  const [weight, setWeight] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unitPrice, setUnitPrice] = useState("")

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"USD" | "FRANCS" | "BOTH">("USD")
  const [usdReceived, setUsdReceived] = useState("")
  const [francsReceived, setFrancsReceived] = useState("")
  const [exchangeRate, setExchangeRate] = useState("")

  // Advance
  const [advanceOption, setAdvanceOption] = useState<"none" | "existing">("none")
  const [selectedAdvance, setSelectedAdvance] = useState<{ id: string; customerName: string; amount: number } | null>(null)

  const [debtCustomerName, setDebtCustomerName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const totalPrice = (Number(quantity) || 0) * (Number(unitPrice) || 0)
  const cashPayment = paymentMethod === "USD"
    ? Number(usdReceived) || 0
    : paymentMethod === "FRANCS"
      ? Number(francsReceived) || 0
      : (Number(usdReceived) || 0) + (Number(francsReceived) || 0) / (Number(exchangeRate) || 1)
  const advanceAmount = advanceOption === "existing" && selectedAdvance ? selectedAdvance.amount : 0
  const totalPayment = cashPayment + advanceAmount
  const debtAmount = Math.max(0, totalPrice - totalPayment)
  const overpayment = advanceOption === "none" && cashPayment > totalPrice && totalPrice > 0
  const needsCustomerName = overpayment || debtAmount > 0

  const today = new Date().toISOString().split("T")[0]

  // Load advances on mount
  useEffect(() => {
    if (!token) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/advance/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setAdvances(d.data ?? []))
      .catch(() => {})
  }, [token])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || selectedItem) { setSearchResults([]); setSearchOpen(false); return }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/stock/search?keyword=${encodeURIComponent(searchQuery)}&page=0&size=10`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const data = await res.json()
        const items: StockItem[] = data.data?.content ?? []
        setSearchResults(items)
        setSearchOpen(items.length > 0)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, token, selectedItem])

  function selectItem(item: StockItem) {
    setSelectedItem(item)
    setSearchQuery(`${item.code} — ${item.name}`)
    setItemCode(item.code)
    setItemName(item.name)
    setContainerName(item.containerName ?? "")
    setWeight(item.weight ?? "")
    if (item.price != null) setUnitPrice(String(item.price))
    setSearchOpen(false)
    setError(null)
  }

  function clearItem() {
    setSelectedItem(null)
    setSearchQuery("")
    setItemCode("")
    setItemName("")
    setContainerName("")
    setWeight("")
    setUnitPrice("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedItem) { setError("Please search and select an item first."); return }
    if (!quantity || Number(quantity) <= 0) { setError("Please enter a valid quantity."); return }
    if (!unitPrice || Number(unitPrice) <= 0) { setError("Please enter a valid unit price."); return }
    if (needsCustomerName && !debtCustomerName.trim()) { setError("Customer name is required."); return }

    setError(null)
    setIsLoading(true)
    try {
      const currency = paymentMethod === "FRANCS" ? "FRANCS" : "USD"
      const amountReceived = paymentMethod === "FRANCS"
        ? Number(francsReceived) || 0
        : paymentMethod === "BOTH"
          ? (Number(usdReceived) || 0) + (Number(francsReceived) || 0) / (Number(exchangeRate) || 1)
          : Number(usdReceived) || 0

      const body: Record<string, unknown> = {
        code: itemCode,
        quantity: Number(quantity),
        price: Number(unitPrice),
        date: today,
        amountReceived,
        currency,
      }

      if (advanceOption === "existing" && selectedAdvance) {
        body.advanceId = selectedAdvance.id ?? undefined
      }
      if (needsCustomerName && debtCustomerName.trim()) {
        body.customerName = debtCustomerName.trim()
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || "Failed to record sale"); return }
      invalidate("sales-")
      invalidate("stock-")
      router.replace("/sales")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <Link href="/sales" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Sales
      </Link>

      <h1 className="text-2xl font-bold">Record New Sale</h1>
      <p className="text-gray-500 text-sm mt-1">Search for an item to get started</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">

        {/* Item Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Item Details</h2>
          <div className="space-y-4">

            {/* Search */}
            <div ref={searchRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Item <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); if (selectedItem) clearItem() }}
                  placeholder="Type item name or code…"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
                {searchLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching…</span>
                )}
              </div>

              {/* Dropdown results */}
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {searchResults.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectItem(item)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 border-gray-100"
                    >
                      <p className="text-sm font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Code: {item.code} · Container: {item.containerName} · Weight: {item.weight}
                        {item.quantity !== undefined && ` · Stock: ${item.quantity}`}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && !searchLoading && !searchOpen && !selectedItem && searchQuery.length > 1 && (
                <p className="text-xs text-red-500 mt-1">⚠ No items found for &quot;{searchQuery}&quot;. Try a different name or code.</p>
              )}
            </div>

            {/* Read-only fields after selection */}
            {selectedItem && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Selected Item</p>
                  <button type="button" onClick={clearItem} className="text-xs text-gray-400 hover:text-red-500">Change item</button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Code</p>
                    <p className="font-medium text-gray-800">{itemCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Container</p>
                    <p className="font-medium text-gray-800">{containerName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Item Name</p>
                    <p className="font-medium text-gray-800">{itemName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Weight</p>
                    <p className="font-medium text-gray-800">{weight || "—"}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  placeholder="Enter unit price"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">Total Price:</span>
              <span className="text-lg font-bold text-blue-600">${totalPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Payment Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {(["USD", "FRANCS", "BOTH"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPaymentMethod(key)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                      paymentMethod === key
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-200 text-gray-600 hover:border-blue-300"
                    }`}
                  >
                    {key === "FRANCS" ? <CreditCard className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                    {key === "USD" ? "USD Only" : key === "FRANCS" ? "Francs Only" : "Both"}
                  </button>
                ))}
              </div>
            </div>

            {(paymentMethod === "USD" || paymentMethod === "BOTH") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">USD Amount Received <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={usdReceived}
                    onChange={e => setUsdReceived(e.target.value)}
                    placeholder="Enter amount received"
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {(paymentMethod === "FRANCS" || paymentMethod === "BOTH") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Francs Amount Received <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={francsReceived}
                  onChange={e => setFrancsReceived(e.target.value)}
                  placeholder="Enter amount in francs"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            {(paymentMethod === "FRANCS" || paymentMethod === "BOTH") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exchange Rate (FC per $1)</label>
                <input
                  type="number"
                  value={exchangeRate}
                  onChange={e => setExchangeRate(e.target.value)}
                  placeholder="e.g. 2800"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Advance Options */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Advance Options</h2>
          <p className="text-xs text-blue-600 mb-3">Customer Advance</p>
          <div className="space-y-2">
            {[
              { value: "none", label: "No Advance" },
              { value: "existing", label: "Use Existing Advance" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${advanceOption === opt.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                <input
                  type="radio"
                  name="advanceOption"
                  value={opt.value}
                  checked={advanceOption === opt.value}
                  onChange={() => { setAdvanceOption(opt.value as "none" | "existing"); setSelectedAdvance(null) }}
                  className="accent-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>

          {advanceOption === "existing" && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Customer Advance</label>
              <select
                value={selectedAdvance?.id ?? selectedAdvance?.customerName ?? ""}
                onChange={e => {
                  const found = advances.find(a => (a.id ?? a.customerName) === e.target.value) ?? null
                  setSelectedAdvance(found)
                }}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select advance --</option>
                {advances.map((a, i) => (
                  <option key={a.id ?? a.customerName ?? i} value={a.id ?? a.customerName}>
                    {a.customerName} — ${a.amount}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Payment Summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-700 mb-3">Payment Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Total Price:</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Cash Payment:</span>
              <span>${cashPayment.toFixed(2)}</span>
            </div>
            {advanceAmount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Advance Used:</span>
                <span>${advanceAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-300 pt-2 mt-2">
              <span>Total Payment:</span>
              <span>${totalPayment.toFixed(2)}</span>
            </div>
          </div>

          {overpayment && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-green-700 font-medium">Overpayment (advance):</span>
              <span className="text-sm font-bold text-green-700">+${(cashPayment - totalPrice).toFixed(2)}</span>
            </div>
          )}

          {debtAmount > 0 && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-red-600 font-medium">Debt remaining:</span>
              <span className="text-sm font-bold text-red-600">${debtAmount.toFixed(2)}</span>
            </div>
          )}

          {needsCustomerName && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 font-normal ml-1">
                  {overpayment ? "(for advance record)" : "(for debt record)"}
                </span>
              </label>
              <input
                value={debtCustomerName}
                onChange={e => setDebtCustomerName(e.target.value)}
                placeholder="Enter customer name"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
            <span>⚠</span><p>{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
          <span>Date: {today}</span>
          <span>Recorded by: <span className="text-blue-500">{email}</span></span>
        </div>

        <div className="flex gap-3">
          <Link href="/sales" className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors text-center">
            Cancel
          </Link>
          <button type="submit" disabled={isLoading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isLoading ? "Recording..." : "Record Sale"}
          </button>
        </div>
      </form>
    </div>
  )
}
