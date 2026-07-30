"use client"

export function SkeletonRows({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-6 py-4">
              <div className="h-4 bg-gray-200 rounded w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function SkeletonCards({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="h-3 bg-gray-200 rounded" />
            <div className="h-3 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm animate-pulse">
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
          <div className="h-7 bg-gray-200 rounded w-1/3" />
        </div>
      ))}
    </>
  )
}
