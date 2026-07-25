"use client"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { Package, DollarSign, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { getCached, setCached } from "@/lib/cache"


// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
}

function StatCard({ title, value, icon, iconBg }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-5 flex items-start justify-between shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold mt-2">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${iconBg}`}>
        {icon}
      </div>
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const token = useAuthStore(state => state.token)
  const role = useAuthStore(state => state.role)
  const name = useAuthStore(state => state.name)

  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN"

  const [stats, setStats] = useState({
    stockTotal: 0,
    stockValue: 0,
    salesTotal: 0,
    salesValue: 0,
  })

  const [recentSales, setRecentSales] = useState<any[]>([])

  useEffect(() => {
    async function fetchStats() {
      const headers = { Authorization: `Bearer ${token}` }

      const cachedStats = getCached<typeof stats>('dashboard-stats')
      if (cachedStats) setStats(cachedStats)
      const cachedRecent = getCached<any[]>('dashboard-recent')
      if (cachedRecent) setRecentSales(cachedRecent)

      if (isAdmin) {
        const [stockTotal, stockValue, salesTotal, salesValue, recent] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/total`, { headers }).then(r => r.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/value`, { headers }).then(r => r.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/total`, { headers }).then(r => r.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/value`, { headers }).then(r => r.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/recent`, { headers }).then(r => r.json()),
        ])
        const freshStats = {
          stockTotal: stockTotal.data,
          stockValue: stockValue.data,
          salesTotal: salesTotal.data,
          salesValue: salesValue.data,
        }
        setStats(freshStats)
        setCached('dashboard-stats', freshStats)
        setRecentSales(recent.data)
        setCached('dashboard-recent', recent.data)
      } else {
        const [stockTotal, salesTotal, recent] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/total`, { headers }).then(r => r.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/total`, { headers }).then(r => r.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/recent`, { headers }).then(r => r.json()),
        ])
        setStats(prev => {
          const freshStats = { ...prev, stockTotal: stockTotal.data, salesTotal: salesTotal.data }
          setCached('dashboard-stats', freshStats)
          return freshStats
        })
        setRecentSales(recent.data)
        setCached('dashboard-recent', recent.data)
      }
    }

    if (token) fetchStats()
  }, [token, isAdmin])

  const statCards = [
    {
      title: "Total Stock Items",
      value: stats.stockTotal,
      icon: <Package className="w-6 h-6 text-blue-600" />,
      iconBg: "bg-blue-50",
      adminOnly: false,
    },
    {
      title: "Stock Value",
      value: `$${(stats.stockValue ?? 0).toFixed(2)}`,
      icon: <DollarSign className="w-6 h-6 text-green-600" />,
      iconBg: "bg-green-50",
      adminOnly: true,
    },
    {
      title: "Weekly Sales Count",
      value: stats.salesTotal,
      icon: <ShoppingCart className="w-6 h-6 text-purple-600" />,
      iconBg: "bg-purple-50",
      adminOnly: false,
    },
    {
      title: "Weekly Sales Value",
      value: `$${(stats.salesValue ?? 0).toFixed(2)}`,
      icon: <DollarSign className="w-6 h-6 text-green-600" />,
      iconBg: "bg-green-50",
      adminOnly: true,
    },
  ].filter(card => !card.adminOnly || isAdmin)

  const quickActions = [
    {
      href: "/stock",
      icon: <Package className="w-8 h-8 text-blue-600 mb-3" />,
      label: "View Stock",
      description: "Browse available inventory",
      adminOnly: false,
    },
    {
      href: "/sales/add",
      icon: <ShoppingCart className="w-8 h-8 text-green-600 mb-3" />,
      label: "Record Sale",
      description: "Add new sales transaction",
      adminOnly: false,
    },
    {
      href: "/stock/add",
      icon: <Package className="w-8 h-8 text-purple-600 mb-3" />,
      label: "Bulk Upload",
      description: "Upload Excel file",
      adminOnly: true,
    },
  ].filter(action => !action.adminOnly || isAdmin)

  return (
    <div>

      {/* Header */}
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-gray-500 text-sm mt-1">Welcome back{name ? `, ${name}` : ""}! Here's the business overview.</p>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        {statCards.map(card => (
          <StatCard key={card.title} title={card.title} value={card.value} icon={card.icon} iconBg={card.iconBg} />
        ))}
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Recent Sales</h2>
          <Link href="/sales" className="text-sm text-blue-600 hover:underline">View All</Link>
        </div>

        <div className="overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              {isAdmin && <th className="px-6 py-3 whitespace-nowrap">Item Code</th>}
              <th className="px-6 py-3 whitespace-nowrap">Item Name</th>
              <th className="px-6 py-3 whitespace-nowrap">Date</th>
              <th className="px-6 py-3 whitespace-nowrap">Container</th>
              {isAdmin && <th className="px-6 py-3 whitespace-nowrap">Recorded By</th>}
              <th className="px-6 py-3 whitespace-nowrap">Quantity</th>
              <th className="px-6 py-3 whitespace-nowrap text-right">Total Price</th>
            </tr>
          </thead>
          <tbody>
            {recentSales.map((sale, index) => (
              <tr key={`${sale.code}-${sale.date}-${index}`} className="text-sm text-gray-600 border-b hover:bg-gray-50">
                {isAdmin && <td className="px-6 py-4 whitespace-nowrap">{sale.code}</td>}
                <td className="px-6 py-4 whitespace-nowrap">{sale.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{sale.date}</td>
                <td className="px-6 py-4 whitespace-nowrap">{sale.containerName}</td>
                {isAdmin && <td className="px-6 py-4 whitespace-nowrap">{sale.recordedBy}</td>}
                <td className="px-6 py-4 whitespace-nowrap">{sale.quantity} units</td>
                <td className="px-6 py-4 whitespace-nowrap text-right">${sale.totalPrice}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden">
          {recentSales.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">No recent sales.</p>
          ) : recentSales.map((sale, index) => (
            <div key={`${sale.code}-${sale.date}-${index}`} className="bg-white border-b px-4 py-3">
              <div className="flex items-start justify-between mb-1">
                <p className="font-semibold text-gray-800 text-sm">{sale.name}</p>
                <p className="font-semibold text-gray-800 text-sm">${sale.totalPrice}</p>
              </div>
              <p className="text-xs text-gray-500 mb-1">{sale.date}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Container: <span className="text-gray-700">{sale.containerName}</span></span>
                <span>Quantity: <span className="text-gray-700">{sale.quantity} units</span></span>
              </div>
              {isAdmin && sale.recordedBy && (
                <p className="text-xs text-gray-500 mt-1">Recorded By: <span className="text-gray-700">{sale.recordedBy}</span></p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6">
        <h2 className="font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map(action => (
            <Link key={action.href} href={action.href} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0">
              {action.icon}
              <div>
                <p className="font-medium text-gray-800">{action.label}</p>
                <p className="text-sm text-gray-500 mt-0.5">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
