import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { QuickCapture } from "@/components/QuickCapture";
import { FocusTimer } from "@/components/FocusTimer";
import { Copilot } from "@/components/Copilot";
import { AppShell } from "@/components/layout/AppShell";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-slate-50/30" suppressHydrationWarning>
      <CommandPalette />
      <QuickCapture />
      <FocusTimer />
      <Copilot />
      {/* 240px Left Rail */}
      <Sidebar />

      {/* Dynamic Content & Collapsible Day Strip Shell */}
      <AppShell>
        {children}
      </AppShell>
    </div>
  );
}

