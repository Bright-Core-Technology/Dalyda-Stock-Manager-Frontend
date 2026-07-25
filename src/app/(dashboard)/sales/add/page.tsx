"use client"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Search, DollarSign, CreditCard } from "lucide-react"

export default function AddSalePage() {
  const token = useAuthStore(state => state.token)
  const email = useAuthStore(state => state.email)
  const router = useRouter()

  const [containers, setContainers] = useState<string[]>([])
  const [weights, setWeights] = useState<string[]>([])
  const [advances, setAdvances] = useState<{ id: string; customerName: string; amount: number }[]>([])

  const [containerName, setContainerName] = useState("")
  const [itemCode, setItemCode] = useState("")
  const [itemName, setItemName] = useState("")
  const [weight, setWeight] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)

  // USD Only | FRANCS | BOTH
  const [paymentMethod, setPaymentMethod] = useState<"USD" | "FRANCS" | "BOTH">("USD")
  const [usdReceived, setUsdReceived] = useState("")
  const [francsReceived, setFrancsReceived] = useState("")
  const [exchangeRate, setExchangeRate] = useState("")

  // No Advance | Use Existing
  const [advanceOption, setAdvanceOption] = useState<"none" | "existing">("none")
  const [selectedAdvance, setSelectedAdvance] = useState<{ id: string; customerName: string; amount: number } | null>(null)

  const [lookupStatus, setLookupStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const totalPrice = (Number(quantity) || 0) * (Number(unitPrice) || 0)

  const cashPayment = paymentMethod === "USD"
    ? Number(usdReceived) || 0
    : paymentMethod === "FRANCS"
      ? (Number(francsReceived) || 0) / (Number(exchangeRate) || 1)
      : (Number(usdReceived) || 0) + (Number(francsReceived) || 0) / (Number(exchangeRate) || 1)

  const advanceAmount = advanceOption === "existing" && selectedAdvance ? selectedAdvance.amount : 0
  const totalPayment = cashPayment + advanceAmount
  const debtAmount = Math.max(0, totalPrice - totalPayment)

  const [debtCustomerName, setDebtCustomerName] = useState("")
  const overpayment = advanceOption === "none" && cashPayment > totalPrice && totalPrice > 0
  const needsCustomerName = overpayment || debtAmount > 0

  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    async function fetchMeta() {
      const headers = { Authorization: `Bearer ${token}` }
      const [containersRes, weightsRes, advancesRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/container/names`, { headers }).then(r => r.json()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/weights`, { headers }).then(r => r.json()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/advance/summary`, { headers }).then(r => r.json()),
      ])
      setContainers(containersRes.data ?? [])
      setWeights(weightsRes.data ?? [])
      setAdvances(advancesRes.data ?? [])
    }
    if (token) fetchMeta()
  }, [token])

  async function handleLookup() {
    if (!itemCode.trim()) { setLookupStatus({ type: "error", message: "Please enter an item code first." }); return }
    setLookupLoading(true)
    setLookupStatus(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/lookup/${itemCode.trim()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok && data.data) {
        setItemName(data.data.name ?? "")
        setWeight(data.data.weight ?? "")
        if (data.data.price) setUnitPrice(String(data.data.price))
        setLookupStatus({ type: "success", message: `Item found: ${data.data.name}` })
      } else {
        setItemName("")
        setWeight("")
        setLookupStatus({ type: "error", message: data.message ?? `No item found with code "${itemCode}". Please check and try again.` })
      }
    } catch {
      setLookupStatus({ type: "error", message: "Unable to connect to the server. Please try again." })
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!containerName || !quantity || !unitPrice) {
      setError("Container, quantity, and unit price are required")
      return
    }
    if (needsCustomerName && !debtCustomerName.trim()) {
      setError("Customer name is required")
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      // Determine currency and amountReceived
      const currency = paymentMethod === "FRANCS" ? "FRANCS" : "USD"
      const amountReceived = paymentMethod === "FRANCS"
        ? (Number(francsReceived) || 0) / (Number(exchangeRate) || 1)
        : paymentMethod === "BOTH"
          ? (Number(usdReceived) || 0) + (Number(francsReceived) || 0) / (Number(exchangeRate) || 1)
          : Number(usdReceived) || 0

      const body: Record<string, unknown> = {
        code: itemCode || undefined,
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
      <p className="text-gray-500 text-sm mt-1">Add a new sales transaction with payment and advance options</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">

        {/* Item Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Item Details</h2>
          <div className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Container Name <span className="text-red-500">*</span></label>
              <select
                value={containerName}
                onChange={e => setContainerName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select container --</option>
                {containers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Code <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="flex gap-2">
                <input
                  value={itemCode}
                  onChange={e => setItemCode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleLookup())}
                  placeholder="Enter item code"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={lookupLoading}
                  className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  {lookupLoading ? "..." : "Find"}
                </button>
              </div>
              {lookupStatus && (
                <p className={`text-sm mt-1.5 ${lookupStatus.type === "success" ? "text-green-600" : "text-red-500"}`}>
                  {lookupStatus.type === "success" ? "✓" : "⚠"} {lookupStatus.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name <span className="text-red-500">*</span></label>
                <input
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="Enter item name"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight <span className="text-red-500">*</span></label>
                <select
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select weight --</option>
                  {weights.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>

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

            {/* Total Price inside item card */}
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
                  {key === "USD" && <DollarSign className="w-4 h-4" />}
                  {key === "FRANCS" && <CreditCard className="w-4 h-4" />}
                  {key === "BOTH" && <DollarSign className="w-4 h-4" />}
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
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">Cash Payment Received:</span>
                  <span className="text-xs font-medium text-gray-700">${(Number(usdReceived) || 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            {(paymentMethod === "FRANCS" || paymentMethod === "BOTH") && (
              <>
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
              </>
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

            {/* Overpayment → advance will be created */}
          {overpayment && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-green-700 font-medium">Overpayment (advance):</span>
              <span className="text-sm font-bold text-green-700">+${(cashPayment - totalPrice).toFixed(2)}</span>
            </div>
          )}

          {/* Debt → customer underpaid */}
          {debtAmount > 0 && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-red-600 font-medium">Debt remaining:</span>
              <span className="text-sm font-bold text-red-600">${debtAmount.toFixed(2)}</span>
            </div>
          )}

          {/* Customer name — required for overpayment (advance) or debt */}
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

        {/* Footer */}
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
