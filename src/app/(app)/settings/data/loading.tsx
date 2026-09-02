export default function DataSettingsLoading() {
  return (
    <div className="w-full flex flex-col gap-6 pb-12 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-44 bg-slate-200/90 rounded-xl" />
        <div className="h-4 w-72 bg-slate-200/60 rounded-lg" />
      </div>

      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 max-w-2xl">
        <div className="h-5 w-40 bg-slate-200/80 rounded" />
        <div className="space-y-3">
          <div className="h-10 w-full bg-slate-100 rounded-xl" />
          <div className="h-10 w-full bg-slate-100 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
