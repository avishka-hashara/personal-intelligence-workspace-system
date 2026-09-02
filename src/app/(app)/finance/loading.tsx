export default function FinanceLoading() {
  return (
    <div className="w-full flex flex-col gap-8 pb-12 animate-pulse">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-200/60 rounded" />
          <div className="h-8 w-60 bg-slate-200/90 rounded-xl" />
          <div className="h-4 w-80 bg-slate-200/60 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-slate-200/80 rounded-xl" />
          <div className="h-9 w-32 bg-slate-200/80 rounded-xl" />
        </div>
      </header>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-200/60 rounded" />
              <div className="w-8 h-8 rounded-xl bg-slate-100" />
            </div>
            <div className="h-7 w-28 bg-slate-200/90 rounded" />
            <div className="h-3 w-36 bg-slate-200/50 rounded" />
          </div>
        ))}
      </div>

      {/* Main Grid: Transactions & Budgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-36 bg-slate-200/80 rounded" />
            <div className="h-7 w-20 bg-slate-200/60 rounded-lg" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 border border-slate-100 rounded-xl"
              >
                <div className="space-y-1">
                  <div className="h-4 w-40 bg-slate-200/80 rounded" />
                  <div className="h-3 w-20 bg-slate-200/50 rounded" />
                </div>
                <div className="h-4 w-16 bg-slate-200/70 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="h-5 w-28 bg-slate-200/80 rounded" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-3 w-20 bg-slate-200/70 rounded" />
                  <div className="h-3 w-16 bg-slate-200/70 rounded" />
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-slate-200 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
