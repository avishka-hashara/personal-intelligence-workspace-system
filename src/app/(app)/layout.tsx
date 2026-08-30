import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { QuickCapture } from "@/components/QuickCapture";
import { FocusTimer } from "@/components/FocusTimer";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <CommandPalette />
      <QuickCapture />
      <FocusTimer />
      {/* 240px Left Rail */}
      <Sidebar />
      
      {/* Center Column & Right Rail Wrapper */}
      <main className="flex-1 lg:pl-[240px] flex">
        {/* Center column capped at 880px */}
        <div className="flex-1 max-w-[880px] w-full mx-auto p-6 md:p-8">
          {children}
        </div>
        
        {/* 320px Right Rail (Visible on extra-large screens) */}
        <aside className="hidden xl:block w-[320px] border-l border-slate-200 p-6 bg-slate-50 shrink-0">
          <div className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-4">Day Strip</div>
          <div className="h-full border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-sm text-center p-4">
            Right rail reserved for calendar, timer, and streak data.
          </div>
        </aside>
      </main>
    </div>
  );
}
