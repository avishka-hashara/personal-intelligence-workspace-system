"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@/store/uiStore";
import { useTaskStore } from "@/store/taskStore";
import { Plus, CornerDownLeft, Sparkles } from "lucide-react";

export function QuickCapture() {
  const {
    isCaptureOpen,
    setCaptureOpen,
    isCommandOpen,
    isCopilotOpen,
    isTimerOpen,
  } = useUIStore();
  const { addTask } = useTaskStore();
  const [title, setTitle] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCaptureOpen(false);
        return;
      }

      if (
        (e.key === "q" || e.key === "Q") &&
        !isCaptureOpen &&
        !isCommandOpen &&
        !isCopilotOpen &&
        !isTimerOpen &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        const activeElement = document.activeElement as HTMLElement | null;
        if (
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.isContentEditable)
        ) {
          return;
        }

        e.preventDefault();
        setCaptureOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [setCaptureOpen, isCaptureOpen, isCommandOpen, isCopilotOpen, isTimerOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setTitle("");
    setCaptureOpen(false);

    // Instant optimistic 0ms task addition + background sync
    await addTask({ title: trimmedTitle });
  };


  if (!isCaptureOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 dark:bg-black/60 flex items-start justify-center pt-[20vh] backdrop-blur-md transition-all"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setCaptureOpen(false);
        }
      }}
    >
      <div className="w-full max-w-xl mx-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-float border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <form onSubmit={handleSubmit} className="p-4">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <input
              type="text"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Capture a task or idea... (e.g. 'Read docs tomorrow 4pm')"
              autoFocus
              className="flex-1 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-base font-medium outline-none border-none focus:ring-0"
            />
            <button
              type="submit"
              disabled={!title.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white disabled:opacity-40 text-white dark:text-zinc-900 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed shadow-2xs"
            >
              <span>Capture</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
            <span className="flex items-center gap-1 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Natural date parsing supported (e.g., today, tomorrow 5pm)
            </span>
            <span className="font-mono text-[11px]">Esc to close</span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuickCapture;
