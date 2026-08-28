"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@/store/uiStore";
import { useTaskStore } from "@/store/taskStore";
import { Plus, CornerDownLeft, Sparkles } from "lucide-react";

export function QuickCapture() {
  const { isCaptureOpen, setCaptureOpen, isCommandOpen } = useUIStore();
  const { addTask } = useTaskStore();
  const [title, setTitle] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCaptureOpen(false);
        return;
      }

      if (e.key.toLowerCase() === "c" && !isCommandOpen && !e.metaKey && !e.ctrlKey && !e.altKey) {
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
  }, [setCaptureOpen, isCommandOpen]);

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
      className="fixed inset-0 z-50 bg-black/20 flex items-start justify-center pt-[20vh] backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setCaptureOpen(false);
        }
      }}
    >
      <div className="w-full max-w-xl mx-4 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <form onSubmit={handleSubmit} className="p-4">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Capture a task or idea... (e.g. 'Read docs tomorrow 4pm')"
              autoFocus
              className="flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 text-base font-medium outline-none border-none focus:ring-0"
            />
            <button
              type="submit"
              disabled={!title.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Capture</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Natural date parsing supported (e.g., today, tomorrow 5pm)
            </span>
            <span>Esc to close</span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuickCapture;
