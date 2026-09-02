export default function GoalsLoading() {
  return (
    <div className="w-full flex flex-col gap-8 pb-12 animate-pulse">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-200/60 rounded" />
          <div className="h-9 w-64 bg-slate-200/90 rounded-xl" />
          <div className="h-4 w-80 bg-slate-200/60 rounded-lg" />
        </div>
        <div className="h-8 w-28 bg-slate-200/70 rounded-lg" />
      </header>

      {/* Quick Add Goal Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="h-5 w-36 bg-slate-200/70 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 h-10 bg-slate-100 rounded-lg border border-slate-200/60" />
          <div className="sm:col-span-3 h-10 bg-slate-100 rounded-lg border border-slate-200/60" />
          <div className="sm:col-span-3 h-10 bg-slate-100 rounded-lg border border-slate-200/60" />
        </div>
      </section>

      {/* Goals Grid */}
      <section className="space-y-4">
        <div className="h-4 w-32 bg-slate-200/70 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-16 bg-slate-200/70 rounded-full" />
                <div className="h-4 w-14 bg-slate-200/60 rounded-full" />
              </div>
              <div className="h-5 w-4/5 bg-slate-200/90 rounded" />
              <div className="h-3 w-full bg-slate-200/50 rounded" />
              <div className="h-3 w-2/3 bg-slate-200/50 rounded" />
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="h-3 w-24 bg-slate-200/60 rounded" />
                <div className="h-3 w-4 bg-slate-200/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
