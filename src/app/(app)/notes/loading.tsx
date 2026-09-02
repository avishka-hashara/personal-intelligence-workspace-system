export default function NotesLoading() {
  return (
    <div className="w-full flex flex-col gap-8 pb-12 animate-pulse">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-28 bg-slate-200/60 rounded" />
            <div className="h-4 w-16 bg-slate-200/70 rounded-full" />
          </div>
          <div className="h-8 w-60 bg-slate-200/90 rounded-xl" />
          <div className="h-4 w-80 bg-slate-200/60 rounded-lg" />
        </div>
        <div className="h-10 w-32 bg-slate-900/80 rounded-xl" />
      </header>

      {/* Notes Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded-lg bg-indigo-50" />
                <div className="h-3 w-16 bg-slate-200/60 rounded" />
              </div>
              <div className="h-5 w-3/4 bg-slate-200/90 rounded" />
              <div className="space-y-1.5">
                <div className="h-3 w-full bg-slate-200/50 rounded" />
                <div className="h-3 w-5/6 bg-slate-200/50 rounded" />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="h-3 w-20 bg-slate-200/50 rounded" />
              <div className="h-3 w-16 bg-slate-200/60 rounded" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
