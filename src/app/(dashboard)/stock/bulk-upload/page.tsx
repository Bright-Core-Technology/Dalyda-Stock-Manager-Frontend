"use client"

import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import Link from "next/link"
import { ArrowLeft, Download, FileText, Upload } from "lucide-react"
import { invalidate } from "@/lib/cache"

export default function BulkUploadPage() {
  const token = useAuthStore(state => state.token)

  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Per-row validation failures from a rejected upload — the only place the
  // user learns what to fix, so they must survive the non-2xx path.
  const [rowErrors, setRowErrors] = useState<string[]>([])

  async function handleDownloadTemplate() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/template/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "stock-template.xlsx"
    a.click()
    window.URL.revokeObjectURL(url)
  }

  async function handleUpload() {
    if (!file) { setError("Please choose a file first"); return }
    setError(null)
    setRowErrors([])
    setResult(null)
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/bulk-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        // Upload is all-or-nothing: nothing was saved, so don't touch the
        // stock cache. Surface every faulty row so the sheet can be fixed
        // in one pass.
        setError(data.message ?? "Upload failed")
        setRowErrors(data.data?.errors ?? [])
        return
      }
      invalidate("stock-")
      setResult(data.data)
      setFile(null)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Back link */}
      <Link href="/stock" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Stock
      </Link>

      <h1 className="text-2xl font-bold">Bulk Upload Stock</h1>
      <p className="text-blue-600 text-sm mt-1">Upload multiple stock items using a CSV file</p>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mt-6">
        <p className="text-blue-700 font-medium mb-3">Upload Instructions</p>
        <ol className="text-sm text-blue-600 space-y-1 list-none">
          <li>1. Download the CSV template below</li>
          <li>2. Fill in your stock data following the template format</li>
          <li>3. Save the file as CSV format</li>
          <li>4. Upload the completed file using the upload area below</li>
          <li>5. If any row is invalid, nothing is imported — fix the rows listed and upload again</li>
        </ol>
        <button
          onClick={handleDownloadTemplate}
          className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download CSV Template
        </button>
      </div>

      {/* Upload Area */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 mt-4 shadow-sm">
        <label className="block cursor-pointer">
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center justify-center hover:border-blue-400 transition-colors">
            <FileText className="w-12 h-12 text-gray-400 mb-3" />
            <p className="font-medium text-gray-700">Upload CSV File</p>
            <p className="text-sm text-orange-500 mt-1">Drag and drop or click to browse</p>
            {file && <p className="text-sm text-blue-600 mt-2 font-medium">{file.name}</p>}
          </div>
          <input
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null); setRowErrors([]) }}
          />
        </label>

        {file && (
          <button
            onClick={handleUpload}
            disabled={isLoading}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {isLoading ? "Uploading..." : "Upload File"}
          </button>
        )}
      </div>

      {/* CSV Format Guide */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 mt-4 shadow-sm">
        <p className="font-medium mb-4">CSV Format Guide</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-2 font-medium">Column</th>
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium">Example</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              { col: "ItemCode", desc: "Unique item code", ex: "V001" },
              { col: "ItemName", desc: "Item name", ex: "Baby Medium" },
              { col: "ContainerName", desc: "Container name", ex: "Huissen Container" },
              { col: "Quantity", desc: "Current stock quantity", ex: "100" },
              { col: "Price", desc: "Unit price", ex: "99.99" },
              { col: "Weight", desc: "Item weight", ex: "75KG" },
            ].map(row => (
              <tr key={row.col} className="border-b last:border-0">
                <td className="py-3 font-medium">{row.col}</td>
                <td className="py-3 text-blue-500">{row.desc}</td>
                <td className="py-3 text-blue-500">{row.ex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mt-4">
          <div className="flex items-start gap-2 text-red-600 text-sm">
            <span>⚠</span><p className="font-medium">{error}</p>
          </div>
          {rowErrors.length > 0 && (
            <>
              <p className="text-sm font-medium text-red-700 mt-4">Rows that need fixing</p>
              <ul className="mt-1.5 text-sm text-red-600 list-disc list-inside space-y-1">
                {rowErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
              <p className="text-xs text-red-500 mt-4">
                Nothing was imported. Row numbers match your spreadsheet, header included.
                Fix these rows and upload the <span className="font-medium">same corrected file</span> again —
                don&apos;t remove the rows that passed, or they&apos;ll be left out.
              </p>
            </>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mt-4">
          <p className="font-medium text-green-700 mb-2">Upload Complete</p>
          <p className="text-sm text-green-600">All {result.totalRows} item(s) were added to stock.</p>
          <Link href="/stock" className="inline-block text-sm text-blue-600 hover:underline mt-3">View stock →</Link>
        </div>
      )}
    </div>
  )
}
