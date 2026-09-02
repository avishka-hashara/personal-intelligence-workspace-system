export default function TodayLoading() {
  return (
    <div className="w-full flex flex-col gap-8 pb-12 animate-pulse">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-32 bg-slate-200/90 rounded-xl" />
          <div className="h-4 w-52 bg-slate-200/60 rounded-lg" />
        </div>
      </header>

      {/* Quick Add Bar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex gap-3 items-center">
        <div className="flex-1 h-10 bg-slate-100 rounded-xl border border-slate-200/60" />
        <div className="h-10 w-24 bg-slate-900/80 rounded-xl" />
      </section>

      {/* NOW Task Card Skeleton */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-16 bg-amber-200/70 rounded-md" />
        </div>
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-5 h-5 rounded-md bg-slate-200" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-2/3 bg-slate-200/90 rounded" />
              <div className="h-3 w-28 bg-slate-200/60 rounded" />
            </div>
          </div>
          <div className="h-9 w-28 bg-slate-900/80 rounded-xl" />
        </div>
      </section>

      {/* NEXT UP Tasks Skeleton */}
      <section className="space-y-3">
        <div className="h-4 w-28 bg-slate-200/70 rounded-md" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-xs"
            >
              <div className="w-4 h-4 rounded bg-slate-200 shrink-0" />
              <div className="h-4 flex-1 bg-slate-200/70 rounded" />
              <div className="w-16 h-4 bg-slate-200/50 rounded shrink-0" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
