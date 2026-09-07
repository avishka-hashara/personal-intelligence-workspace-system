"use client";

import React, { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";
import {
  PanelRightClose,
  PanelRightOpen,
  Calendar,
  Clock,
  Flame,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { DayStrip } from "@/components/DayStrip";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isDayStripOpen, toggleDayStrip, setDayStripOpen } = useUIStore();

  // Load persisted user preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("piw_day_strip_open");
      if (saved !== null) {
        setDayStripOpen(saved === "true");
      }
    } catch {}
  }, [setDayStripOpen]);

  // Global keyboard shortcut to toggle Day Strip (Ctrl+\ or Cmd+\)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        toggleDayStrip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleDayStrip]);

  const handleToggle = () => {
    const nextState = !isDayStripOpen;
    toggleDayStrip();
    try {
      localStorage.setItem("piw_day_strip_open", String(nextState));
    } catch {}
  };

  return (
    <div className="flex-1 lg:pl-[240px] flex min-h-screen relative w-full overflow-x-hidden">
      {/* Dynamic Center Column: expands smoothly when Day Strip is collapsed */}
      <main
        className={`flex-1 min-w-0 w-full p-4 sm:p-6 md:p-8 transition-all duration-300 ease-in-out ${
          isDayStripOpen ? "max-w-full" : "max-w-7xl mx-auto"
        }`}
      >
        {children}
      </main>

      {/* Floating Toggle Button when Day Strip is collapsed */}
      {!isDayStripOpen && (
        <div className="fixed top-4 right-4 z-40 hidden xl:block">
          <button
            type="button"
            onClick={handleToggle}
            title="Expand Day Strip (Ctrl+\)"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-card/80 hover:bg-white dark:hover:bg-card text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200/70 dark:border-border-subtle hover:border-zinc-300 dark:hover:border-white/20 shadow-subtle hover:shadow-float backdrop-blur-xl transition-all duration-150 text-xs font-medium cursor-pointer active:scale-[0.985] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
          >
            <PanelRightOpen className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors" />
            <span>Day Strip</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-border-subtle">
              Ctrl+\
            </kbd>
          </button>
        </div>
      )}

      {/* Day Strip (Right Rail) */}
      <aside
        className={`hidden xl:flex flex-col border-l border-zinc-200/70 dark:border-border-subtle bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
          isDayStripOpen
            ? "w-[320px] p-6 opacity-100"
            : "w-0 p-0 border-l-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between mb-4 w-[272px]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-700 dark:text-zinc-300 stroke-[1.8]" />
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Day Schedule
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            title="Collapse Day Strip (Ctrl+\)"
            className="flex items-center gap-1 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>

        {/* Day Strip Content Area */}
        <DayStrip />
      </aside>
    </div>
  );
}
