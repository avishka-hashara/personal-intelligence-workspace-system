export default function CalendarLoading() {
  return (
    <div className="w-full flex flex-col gap-6 pb-12 animate-pulse">
      {/* Calendar Header / Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-8 w-32 bg-slate-200/90 rounded-lg" />
          <div className="h-8 w-16 bg-slate-100 rounded-lg" />
          <div className="flex gap-1">
            <div className="h-8 w-8 bg-slate-100 rounded-lg" />
            <div className="h-8 w-8 bg-slate-100 rounded-lg" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-slate-100 rounded-lg" />
          <div className="h-8 w-28 bg-slate-200/80 rounded-lg" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-4">
        <div className="grid grid-cols-7 gap-3 border-b border-slate-100 pb-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="text-center space-y-1">
              <div className="h-3 w-8 bg-slate-200/60 rounded mx-auto" />
              <div className="h-6 w-6 bg-slate-200/80 rounded-full mx-auto" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-3 min-h-[460px]">
          {[1, 2, 3, 4, 5, 6, 7].map((col) => (
            <div key={col} className="space-y-3 pt-2">
              {col % 2 === 0 ? (
                <div className="h-20 bg-indigo-50/50 border border-indigo-100 rounded-xl p-2 space-y-1">
                  <div className="h-3 w-16 bg-indigo-200/70 rounded" />
                  <div className="h-2 w-10 bg-indigo-200/50 rounded" />
                </div>
              ) : null}
              {col % 3 === 0 ? (
                <div className="h-16 bg-slate-50 border border-slate-200/60 rounded-xl p-2 space-y-1">
                  <div className="h-3 w-14 bg-slate-200/70 rounded" />
                  <div className="h-2 w-8 bg-slate-200/50 rounded" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
