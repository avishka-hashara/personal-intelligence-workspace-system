"use client";

import { useEffect, useState, useRef } from "react";
import { useUIStore } from "@/store/uiStore";
import { useTaskStore } from "@/store/taskStore";
import { recordFocusSession } from "@/server/actions/tasks";
import {
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  X,
  Zap,
  Check,
} from "lucide-react";

export function FocusTimer() {
  const {
    isTimerOpen,
    setTimerOpen,
    toggleTimer,
    activeFocusTaskId,
    timerStatus,
    setTimerStatus,
    elapsedSeconds,
    setElapsedSeconds,
    resetTimer,
    isCommandOpen,
    isCaptureOpen,
    isCopilotOpen,
  } = useUIStore();

  const { tasks } = useTaskStore();
  const [interruptions, setInterruptions] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sessionStartedAtRef = useRef<Date | null>(null);

  // Find active task if one is selected
  const activeTask = activeFocusTaskId
    ? tasks.find((t) => t.id === activeFocusTaskId) ?? null
    : null;

  // Global 'F' keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input, textarea, or contentEditable element
      const activeElement = document.activeElement as HTMLElement | null;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable)
      ) {
        return;
      }

      // Ignore if modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      // Ignore if command palette, quick capture, or copilot is currently active
      if (isCommandOpen || isCaptureOpen || isCopilotOpen) {
        return;
      }

      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleTimer();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleTimer, isCommandOpen, isCaptureOpen, isCopilotOpen]);

  // Interval ticker when timer is running
  useEffect(() => {
    if (timerStatus !== "running") return;

    if (!sessionStartedAtRef.current) {
      sessionStartedAtRef.current = new Date(Date.now() - elapsedSeconds * 1000);
    }

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [timerStatus, setElapsedSeconds, elapsedSeconds]);

  // Reset session start reference when timer is idle
  useEffect(() => {
    if (timerStatus === "idle" && elapsedSeconds === 0) {
      sessionStartedAtRef.current = null;
      setInterruptions(0);
    }
  }, [timerStatus, elapsedSeconds]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => num.toString().padStart(2, "0");

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const handleTogglePlayPause = () => {
    if (timerStatus === "running") {
      setTimerStatus("paused");
    } else {
      if (!sessionStartedAtRef.current) {
        sessionStartedAtRef.current = new Date();
      }
      setTimerStatus("running");
    }
  };

  const handleInterrupt = () => {
    setInterruptions((prev) => prev + 1);
  };

  const handleReset = () => {
    resetTimer();
    setInterruptions(0);
    sessionStartedAtRef.current = null;
  };

  const handleFinish = async () => {
    if (isSubmitting) return;

    const minutesToRecord = Math.max(1, Math.ceil(elapsedSeconds / 60));
    const startedAt = sessionStartedAtRef.current || new Date(Date.now() - elapsedSeconds * 1000);
    const endedAt = new Date();

    setIsSubmitting(true);

    try {
      if (activeFocusTaskId) {
        await recordFocusSession(
          activeFocusTaskId,
          startedAt,
          endedAt,
          minutesToRecord,
          interruptions
        );
      }
    } catch (err) {
      console.error("Failed to record focus session:", err);
    } finally {
      setIsSubmitting(false);
      resetTimer();
      setInterruptions(0);
      sessionStartedAtRef.current = null;
      setTimerOpen(false);
    }
  };

  if (!isTimerOpen) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200"
      role="region"
      aria-label="Focus Timer"
    >
      <div className="w-[360px] bg-slate-900/95 text-white rounded-2xl p-5 shadow-2xl border border-slate-700/80 backdrop-blur-xl transition-all">
        {/* Header with Title and Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                Focus Mode
                <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded border border-slate-700 font-mono">
                  F
                </span>
              </div>
              <div className="text-xs font-medium text-slate-200 truncate mt-0.5" title={activeTask ? activeTask.title : "No task linked"}>
                {activeTask ? activeTask.title : "General Focus Session"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTimerOpen(false)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Minimize Timer (F)"
            aria-label="Close timer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Timer Display */}
        <div className="py-5 flex flex-col items-center justify-center">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                timerStatus === "running"
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"
                  : timerStatus === "paused"
                  ? "bg-amber-400"
                  : "bg-slate-500"
              }`}
            />
            <span className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-white select-none">
              {formatTime(elapsedSeconds)}
            </span>
          </div>

          {/* Status Subtitle & Interruption Badge */}
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span
              className={`font-medium ${
                timerStatus === "running"
                  ? "text-emerald-400"
                  : timerStatus === "paused"
                  ? "text-amber-400"
                  : "text-slate-400"
              }`}
            >
              {timerStatus === "running"
                ? "Focus in progress..."
                : timerStatus === "paused"
                ? "Paused"
                : "Ready to focus"}
            </span>

            {interruptions > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-medium border border-rose-500/30">
                <AlertCircle className="w-3 h-3" />
                {interruptions} {interruptions === 1 ? "interruption" : "interruptions"}
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          {/* Play / Pause */}
          <button
            type="button"
            onClick={handleTogglePlayPause}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
              timerStatus === "running"
                ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20"
            }`}
          >
            {timerStatus === "running" ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{elapsedSeconds > 0 ? "Resume" : "Start"}</span>
              </>
            )}
          </button>

          {/* Interrupt */}
          <button
            type="button"
            onClick={handleInterrupt}
            className="flex items-center justify-center gap-1 px-2.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
            title="Log an external interruption"
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Interrupt</span>
          </button>

          {/* Finish */}
          <button
            type="button"
            onClick={handleFinish}
            disabled={isSubmitting || elapsedSeconds === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-900 font-semibold text-xs transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="animate-spin text-xs">⏳</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Finish</span>
              </>
            )}
          </button>
        </div>

        {/* Footer Actions (Reset) */}
        {elapsedSeconds > 0 && timerStatus !== "running" && (
          <div className="mt-3 pt-2 flex items-center justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset timer</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default FocusTimer;
