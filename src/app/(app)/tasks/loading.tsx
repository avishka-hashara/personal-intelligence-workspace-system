export default function TasksLoading() {
  return (
    <div className="w-full flex flex-col gap-8 animate-pulse pb-12">
      {/* Header */}
      <header className="space-y-2">
        <div className="h-9 w-44 bg-slate-200/90 rounded-xl" />
        <div className="h-4 w-52 bg-slate-200/60 rounded-lg" />
      </header>

      {/* Instant Capture Bar */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm flex gap-4 items-center">
        <div className="flex-1 h-10 bg-white rounded-lg border border-slate-200" />
        <div className="h-10 w-28 bg-slate-200 rounded-lg" />
      </section>

      {/* Task List Items */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-36 bg-slate-200/70 rounded-md" />
        </div>

        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
