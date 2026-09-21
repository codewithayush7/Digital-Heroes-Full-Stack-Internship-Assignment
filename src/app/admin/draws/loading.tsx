export default function AdminDrawsLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-800 rounded"></div>
          <div className="h-8 w-64 bg-slate-800 rounded"></div>
          <div className="h-3 w-80 bg-slate-800 rounded"></div>
        </div>
        <div className="h-10 w-36 bg-slate-800 rounded-lg"></div>
      </div>

      {/* Metrics Row Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
            <div className="h-3 w-24 bg-slate-800 rounded"></div>
            <div className="h-7 w-32 bg-slate-800 rounded"></div>
            <div className="h-2 w-40 bg-slate-800 rounded"></div>
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-slate-800/60 rounded-lg"></div>
        ))}
      </div>
    </div>
  );
}
