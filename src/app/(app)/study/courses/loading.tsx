export default function CoursesLoading() {
  return (
    <div className="w-full flex flex-col gap-8 pb-12 animate-pulse">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-28 bg-slate-200/60 rounded" />
            <div className="h-4 w-16 bg-slate-200/70 rounded-full" />
          </div>
          <div className="h-8 w-56 bg-slate-200/90 rounded-xl" />
          <div className="h-4 w-80 bg-slate-200/60 rounded-lg" />
        </div>
      </header>

      {/* Quick Add Course Form */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="h-5 w-36 bg-slate-200/70 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="h-9 bg-slate-100 rounded-xl border border-slate-200/60" />
          <div className="h-9 bg-slate-100 rounded-xl border border-slate-200/60" />
          <div className="h-9 bg-slate-100 rounded-xl border border-slate-200/60" />
          <div className="h-9 bg-slate-100 rounded-xl border border-slate-200/60" />
        </div>
      </section>

      {/* Courses Grid */}
      <section className="space-y-4">
        <div className="h-5 w-36 bg-slate-200/80 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-6 w-16 bg-slate-200/80 rounded-lg" />
                <div className="h-4 w-20 bg-slate-200/60 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-5 w-3/4 bg-slate-200/90 rounded" />
                <div className="h-3 w-1/2 bg-slate-200/60 rounded" />
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="h-3 w-20 bg-slate-200/60 rounded" />
                <div className="h-3 w-24 bg-slate-200/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
