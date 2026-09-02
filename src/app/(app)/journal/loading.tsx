export default function JournalLoading() {
  return (
    <div className="w-full flex flex-col gap-8 pb-12 animate-pulse">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-200/60 rounded" />
          <div className="h-8 w-64 bg-slate-200/90 rounded-xl" />
          <div className="h-4 w-80 bg-slate-200/60 rounded-lg" />
        </div>
        <div className="h-9 w-36 bg-indigo-600/80 rounded-xl" />
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        <div className="h-8 w-24 bg-slate-200/80 rounded-lg" />
        <div className="h-8 w-28 bg-slate-100 rounded-lg" />
        <div className="h-8 w-28 bg-slate-100 rounded-lg" />
      </div>

      {/* Review Cards */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-20 bg-indigo-50 rounded-md" />
                <div className="h-5 w-40 bg-slate-200/80 rounded" />
              </div>
              <div className="h-4 w-28 bg-slate-200/50 rounded" />
            </div>

            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-200/60 rounded" />
              <div className="h-3 w-4/5 bg-slate-200/60 rounded" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
              <div className="h-12 bg-slate-50 rounded-xl" />
              <div className="h-12 bg-slate-50 rounded-xl" />
              <div className="h-12 bg-slate-50 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
