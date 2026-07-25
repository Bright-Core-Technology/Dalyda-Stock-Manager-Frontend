"use client"

import { LogIn, Eye, EyeOff } from "lucide-react"
import { useState, useEffect } from "react"

if (typeof window !== "undefined") {
  const _fetch = window.fetch
  window.fetch = (input, init) => {
    const headers = new Headers(init?.headers)
    headers.set("ngrok-skip-browser-warning", "true")
    return _fetch(input, { ...init, headers })
  }
}
import { useAuthStore } from "@/store/authStore"
import { useRouter } from "next/navigation"
import Link from "next/link"



export default function LoginForm() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null >(null)
    const [isLoading, setIsLoading] = useState(false)
    const setAuth = useAuthStore(state => state.setAuth)
    const router = useRouter()
    useEffect(() => {
  useAuthStore.persist.rehydrate()
}, [])




async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()

  if (!email || !password) {
    setError("Both fields are required")
    return
  }

  setError(null)

  setIsLoading(true)

  try { 
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    })

    const data = await res.json()


    if (!res.ok) {
      setError(data.message || "Login failed")
      return
    }

    // setAuth(data.data, null, email)
    const payload = JSON.parse(atob(data.data.split(".")[1]))
    const name = payload.name ?? email.split("@")[0]
    setAuth(data.data, payload.role ?? null, email, name)

    router.replace("/dashboard")

  } catch (err) {
    setError("Something went wrong. Please try again.")
  }finally {
    setIsLoading(false)
  }
}


  return (
    <form onSubmit={handleSubmit}>
        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
               Email Address
               </label>
            <input
             type="email" 
             value={email}
             onChange={e => setEmail(e.target.value)}
             placeholder="Enter your email"
             className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
             />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

       {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
           <span>⚠</span><p>{error}</p>
          </div>
       )}
        <button  disabled={isLoading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium mt-6 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {isLoading ? "Signing in..." : (
            <>
              <LogIn className="w-4 h-4" />
              Sign In
            </>
          )}
        </button>

    </form>
  )
}
