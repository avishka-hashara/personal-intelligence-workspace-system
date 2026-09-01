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
        className={`flex-1 w-full p-4 sm:p-6 md:p-8 transition-all duration-300 ease-in-out ${
          isDayStripOpen ? "max-w-[1020px] mx-auto" : "max-w-7xl mx-auto"
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
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/95 hover:bg-white text-slate-700 hover:text-indigo-600 border border-slate-200/90 shadow-md hover:shadow-lg backdrop-blur-md transition-all text-xs font-semibold cursor-pointer group"
          >
            <PanelRightOpen className="w-4 h-4 text-slate-500 group-hover:text-indigo-600 transition-colors" />
            <span>Day Strip</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded border border-slate-200">
              Ctrl+\
            </kbd>
          </button>
        </div>
      )}

      {/* Day Strip (Right Rail) */}
      <aside
        className={`hidden xl:flex flex-col border-l border-slate-200 bg-slate-50/90 backdrop-blur-xs transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
          isDayStripOpen
            ? "w-[320px] p-6 opacity-100"
            : "w-0 p-0 border-l-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between mb-4 w-[272px]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Day Strip
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            title="Collapse Day Strip (Ctrl+\)"
            className="flex items-center gap-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>

        {/* Day Strip Content Area */}
        <div className="flex-1 w-[272px] flex flex-col gap-4">
          <div className="flex-1 border-2 border-dashed border-slate-200/90 rounded-2xl flex flex-col items-center justify-center text-slate-400 text-xs text-center p-6 bg-white/50 space-y-2">
            <Clock className="w-6 h-6 text-indigo-400/80 mb-1" />
            <span className="font-semibold text-slate-700 text-sm">Daily Rail</span>
            <p className="text-slate-500 text-xs leading-relaxed">
              Real-time daily timeline, focus timer status, and habit streak queue.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
