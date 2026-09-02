export default function HealthLoading() {
  return (
    <div className="w-full flex flex-col gap-8 pb-12 animate-pulse">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-200/60 rounded" />
          <div className="h-8 w-56 bg-slate-200/90 rounded-xl" />
          <div className="h-4 w-80 bg-slate-200/60 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-slate-200/80 rounded-xl" />
          <div className="h-9 w-36 bg-slate-200/70 rounded-xl" />
        </div>
      </header>

      {/* Metrics Grid with Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100" />
                <div className="space-y-1">
                  <div className="h-4 w-24 bg-slate-200/80 rounded" />
                  <div className="h-3 w-16 bg-slate-200/50 rounded" />
                </div>
              </div>
              <div className="h-7 w-14 bg-slate-100 rounded-lg" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <div className="h-3 w-12 bg-slate-200/50 rounded" />
                <div className="h-6 w-20 bg-slate-200/90 rounded" />
              </div>
              <div className="space-y-1">
                <div className="h-3 w-16 bg-slate-200/50 rounded" />
                <div className="h-6 w-20 bg-slate-200/90 rounded" />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-slate-200/50 rounded" />
                <div className="h-3 w-24 bg-slate-200/50 rounded" />
              </div>
              <div className="h-28 w-full bg-slate-50 border border-dashed border-slate-200 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
