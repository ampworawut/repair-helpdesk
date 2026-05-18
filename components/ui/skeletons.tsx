export function CardSkeleton() {
  return <div className="bg-white rounded-xl border p-5 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-gray-200" />
      <div className="space-y-2 flex-1">
        <div className="h-5 bg-gray-200 rounded w-16" />
        <div className="h-4 bg-gray-100 rounded w-24" />
      </div>
    </div>
  </div>
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden animate-pulse">
      <div className="px-5 py-3 border-b bg-gray-50 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-5 py-3.5 border-b flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-4 bg-gray-100 rounded" style={{ width: `${60 + Math.random() * 80}px` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-200" />
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-32" />
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-5 h-48" />
          <div className="bg-white rounded-xl border p-5 h-64" />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border p-5 h-96" />
        </div>
      </div>
    </div>
  )
}
