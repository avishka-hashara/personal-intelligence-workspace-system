export default function Today() {
  return (
    <div className="flex flex-col gap-8">
      {/* Header section with mock data */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Today</h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          6 tasks · 3 h blocked · 24 cards due · CS3230 in 16 days
        </p>
      </header>

      {/* Now / Next Stack */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Now</h2>
        <div className="h-16 flex items-center">
          <p className="text-slate-600">The single recommended next action will appear here.</p>
        </div>
      </section>

      {/* Due Today */}
      <section>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Next up</h2>
        <div className="space-y-3">
          <div className="h-14 border border-slate-200 rounded-lg bg-white flex items-center px-4 hover:border-slate-300 transition-colors cursor-pointer">
            <div className="w-5 h-5 border-2 border-slate-300 rounded mr-4"></div>
            <span className="text-slate-700 font-medium">Task placeholder one</span>
          </div>
          <div className="h-14 border border-slate-200 rounded-lg bg-white flex items-center px-4 hover:border-slate-300 transition-colors cursor-pointer">
            <div className="w-5 h-5 border-2 border-slate-300 rounded mr-4"></div>
            <span className="text-slate-700 font-medium">Task placeholder two</span>
          </div>
        </div>
      </section>
    </div>
  );
}