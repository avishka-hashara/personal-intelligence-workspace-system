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
    activeTimer,
    clearTimer,
  } = useUIStore();

  const { tasks } = useTaskStore();
  const [interruptions, setInterruptions] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sessionStartedAtRef = useRef<Date | null>(null);

  // Find active task if one is selected
  const effectiveTaskId = activeTimer?.taskId || activeFocusTaskId;
  const activeTask = effectiveTaskId
    ? tasks.find((t) => t.id === effectiveTaskId) ?? null
    : null;
  const displayTitle = activeTimer?.taskTitle || activeTask?.title || "General Focus Session";

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
    clearTimer();
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
      if (effectiveTaskId) {
        await recordFocusSession(
          effectiveTaskId,
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
      clearTimer();
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
      <div className="w-[360px] bg-zinc-950/90 text-white rounded-3xl p-5 shadow-float border border-zinc-800/80 backdrop-blur-2xl transition-all">
        {/* Header with Title and Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium tracking-wider text-zinc-400 flex items-center gap-1.5 uppercase">
                Focus Mode
                <span className="text-[10px] px-1.5 py-0.2 bg-zinc-850 text-zinc-300 rounded border border-zinc-800 font-mono">
                  F
                </span>
              </div>
              <div className="text-xs font-medium text-zinc-200 truncate mt-0.5" title={displayTitle}>
                {displayTitle}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTimerOpen(false)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer"
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
              className={`w-2 h-2 rounded-full transition-all ${
                timerStatus === "running"
                  ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                  : timerStatus === "paused"
                  ? "bg-amber-400"
                  : "bg-zinc-600"
              }`}
            />
            <span className="text-5xl font-mono font-medium tracking-tight text-white select-none tabular-nums">
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
                  : "text-zinc-400"
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
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80">
          {/* Play / Pause */}
          <button
            type="button"
            onClick={handleTogglePlayPause}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs transition-all cursor-pointer active:scale-[0.985] ${
              timerStatus === "running"
                ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30"
                : "bg-white hover:bg-zinc-100 text-zinc-900 font-semibold shadow-subtle"
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
            className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-700/60 transition-colors cursor-pointer active:scale-[0.985]"
            title="Log an external interruption"
          >
            <AlertCircle className="w-3.5 h-3.5 text-zinc-400" />
            <span>Interrupt</span>
          </button>

          {/* Finish */}
          <button
            type="button"
            onClick={handleFinish}
            disabled={isSubmitting || elapsedSeconds === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 disabled:opacity-40 text-white font-medium text-xs transition-all border border-zinc-700/60 cursor-pointer disabled:cursor-not-allowed active:scale-[0.985]"
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
          <div className="mt-3 pt-2 flex items-center justify-center border-t border-zinc-800/40">
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
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
