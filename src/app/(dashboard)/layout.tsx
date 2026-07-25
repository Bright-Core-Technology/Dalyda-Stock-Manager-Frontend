"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

// Patch fetch globally to bypass ngrok browser warning
if (typeof window !== "undefined") {
  const _fetch = window.fetch
  window.fetch = (input, init) => {
    const headers = new Headers(init?.headers)
    headers.set("ngrok-skip-browser-warning", "true")
    return _fetch(input, { ...init, headers })
  }
}
import { useAuthStore } from "@/store/authStore"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(state => state.token)
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [navigating, setNavigating] = useState(false)

  useEffect(() => {
    setNavigating(false)
  }, [pathname])

  useEffect(() => {
    useAuthStore.persist.rehydrate()
  }, [])

  useEffect(() => {
    if (token === null) {
      router.replace("/login")
    }
  }, [token, router])

  if (!token) return null

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          className="fixed inset-0 bg-black/40 z-20 lg:hidden w-full cursor-default"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 lg:relative lg:block transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <Sidebar onClose={() => { setSidebarOpen(false); setNavigating(true) }} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {navigating && (
          <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-blue-100">
            <div className="h-1 bg-blue-600 animate-pulse w-2/3" />
          </div>
        )}
        <Topbar onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
