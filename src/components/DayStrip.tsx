"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { useUIStore } from "@/store/uiStore";
import { logFocusSession } from "@/server/actions/tasks";
import { getTodayTimeBlocks, type TimeBlockWithTask, type TimeBlockKind } from "@/server/actions/calendar";
import {
  Clock,
  Zap,
  Square,
  AlertCircle,
  Calendar as CalendarIcon,
  RefreshCw,
  Plus,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

const KIND_STYLES: Record<TimeBlockKind, { bg: string; border: string; text: string; badge: string }> = {
  work: {
    bg: "bg-indigo-50/90 hover:bg-indigo-100/90",
    border: "border-indigo-200",
    text: "text-indigo-900",
    badge: "bg-indigo-100 text-indigo-700",
  },
  study: {
    bg: "bg-emerald-50/90 hover:bg-emerald-100/90",
    border: "border-emerald-200",
    text: "text-emerald-900",
    badge: "bg-emerald-100 text-emerald-700",
  },
  rest: {
    bg: "bg-amber-50/90 hover:bg-amber-100/90",
    border: "border-amber-200",
    text: "text-amber-900",
    badge: "bg-amber-100 text-amber-700",
  },
  admin: {
    bg: "bg-purple-50/90 hover:bg-purple-100/90",
    border: "border-purple-200",
    text: "text-purple-900",
    badge: "bg-purple-100 text-purple-700",
  },
};

function formatTimerTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

function formatTimeString(d: Date): string {
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function DayStrip() {
  const {
    activeTimer,
    clearTimer,
    setTimerOpen,
    toggleTimer,
  } = useUIStore();

  const [timeBlocks, setTimeBlocks] = useState<TimeBlockWithTask[]>([]);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [interruptions, setInterruptions] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Load today's time blocks
  const fetchBlocks = useCallback(async () => {
    try {
      setIsLoadingBlocks(true);
      const blocks = await getTodayTimeBlocks();
      setTimeBlocks(blocks);
    } catch (err) {
      console.error("Failed to load today's time blocks:", err);
    } finally {
      setIsLoadingBlocks(false);
    }
  }, []);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  // Live timer tick for active timer
  useEffect(() => {
    if (!activeTimer) {
      setElapsedSeconds(0);
      setInterruptions(0);
      return;
    }

    const computeElapsed = () => {
      const startMs = new Date(activeTimer.startTime).getTime();
      const nowMs = Date.now();
      return Math.max(0, Math.floor((nowMs - startMs) / 1000));
    };

    setElapsedSeconds(computeElapsed());

    const timerId = setInterval(() => {
      setElapsedSeconds(computeElapsed());
    }, 1000);

    return () => clearInterval(timerId);
  }, [activeTimer]);

  // Update current time every minute for the red timeline marker
  useEffect(() => {
    const clockId = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(clockId);
  }, []);

  // Stop & Log Handler
  const handleStopAndLog = async () => {
    if (!activeTimer || isStopping) return;

    setIsStopping(true);
    const endTime = new Date();

    try {
      await logFocusSession(
        activeTimer.taskId,
        new Date(activeTimer.startTime),
        endTime,
        interruptions
      );
      clearTimer();
      setInterruptions(0);
      // Refresh today's blocks
      fetchBlocks();
    } catch (err) {
      console.error("Failed to log focus session:", err);
    } finally {
      setIsStopping(false);
    }
  };

  // Timeline configuration: 08:00 to 22:00 (14 hours, 840 mins)
  const START_HOUR = 8;
  const END_HOUR = 22;
  const TOTAL_HOURS = END_HOUR - START_HOUR; // 14
  const TOTAL_MINUTES = TOTAL_HOURS * 60; // 840
  const START_MINUTES = START_HOUR * 60; // 480

  // Current time position in timeline percentage
  const currentMinutesFromMidnight = currentTime.getHours() * 60 + currentTime.getMinutes();
  const currentTimelineProgress =
    currentMinutesFromMidnight >= START_MINUTES && currentMinutesFromMidnight <= END_HOUR * 60
      ? ((currentMinutesFromMidnight - START_MINUTES) / TOTAL_MINUTES) * 100
      : null;

  return (
    <div className="flex-1 w-[272px] flex flex-col gap-4 text-slate-800 select-none">
      {/* 1. Prominent Active Focus Timer Card (if activeTimer is present) */}
      {activeTimer ? (
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-lg border border-indigo-900/60 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-bold tracking-wider text-emerald-300 uppercase">
                Focusing Now
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTimerOpen(true)}
              className="text-[10px] text-indigo-300 hover:text-white underline cursor-pointer"
            >
              Expand (F)
            </button>
          </div>

          <h3
            className="text-xs font-semibold text-slate-100 truncate mb-2"
            title={activeTimer.taskTitle}
          >
            {activeTimer.taskTitle}
          </h3>

          <div className="flex items-baseline justify-between mb-3 bg-slate-800/60 px-3 py-2 rounded-xl border border-slate-700/50">
            <span className="text-2xl font-mono font-bold tracking-tight text-white">
              {formatTimerTime(elapsedSeconds)}
            </span>
            {interruptions > 0 && (
              <span className="text-[10px] text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                {interruptions} int.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStopAndLog}
              disabled={isStopping}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isStopping ? (
                <span className="animate-spin text-xs">⏳</span>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop & Log</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setInterruptions((prev) => prev + 1)}
              title="Add interruption"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/80 border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-800 truncate">
                Focus Timer
              </div>
              <div className="text-[10px] text-slate-400">
                Press <kbd className="px-1 py-0.2 font-mono bg-slate-100 rounded border border-slate-200">F</kbd> to launch
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleTimer()}
            className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer shrink-0"
          >
            Start
          </button>
        </div>
      )}

      {/* 2. Timeline Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <Clock className="w-3.5 h-3.5 text-indigo-600" />
          <span>Today&apos;s Schedule</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={fetchBlocks}
            disabled={isLoadingBlocks}
            title="Refresh schedule"
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBlocks ? "animate-spin text-indigo-600" : ""}`} />
          </button>
          <Link
            href="/calendar"
            title="Open Calendar"
            className="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 3. Compact Vertical Timeline (08:00 to 22:00) */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl shadow-2xs p-3 flex flex-col overflow-hidden min-h-[420px]">
        {isLoadingBlocks ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
            <span className="text-xs">Loading timeline...</span>
          </div>
        ) : (
          <div className="relative flex-1 overflow-y-auto pr-1">
            {/* Hour ruler markers */}
            <div className="relative h-[630px] border-l border-slate-200 ml-9">
              {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => {
                const hour = START_HOUR + i;
                const topPct = (i / TOTAL_HOURS) * 100;
                return (
                  <div
                    key={hour}
                    className="absolute w-full flex items-center"
                    style={{ top: `${topPct}%` }}
                  >
                    <span className="absolute -left-9 text-[9px] font-mono text-slate-400 w-8 text-right pr-1">
                      {formatHour(hour)}
                    </span>
                    <div className="w-full border-b border-dashed border-slate-100" />
                  </div>
                );
              })}

              {/* Current Time Indicator Line */}
              {currentTimelineProgress !== null && (
                <div
                  className="absolute w-full z-20 flex items-center pointer-events-none transition-all duration-500"
                  style={{ top: `${currentTimelineProgress}%` }}
                >
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-rose-500 border-2 border-white shadow-xs" />
                  <div className="w-full border-b-2 border-rose-500" />
                </div>
              )}

              {/* Positioned Time Blocks */}
              {timeBlocks.length > 0 ? (
                timeBlocks.map((block) => {
                  const startDate = new Date(block.startAt);
                  const endDate = new Date(block.endAt);

                  const sMin = startDate.getHours() * 60 + startDate.getMinutes();
                  const eMin = endDate.getHours() * 60 + endDate.getMinutes();

                  // Clamp to 08:00 - 22:00
                  const clampedStart = Math.max(START_MINUTES, Math.min(END_HOUR * 60, sMin));
                  const clampedEnd = Math.max(clampedStart + 15, Math.min(END_HOUR * 60, eMin));

                  const topPct = ((clampedStart - START_MINUTES) / TOTAL_MINUTES) * 100;
                  const heightPct = Math.max(
                    4,
                    ((clampedEnd - clampedStart) / TOTAL_MINUTES) * 100
                  );

                  const kindStyle = KIND_STYLES[block.kind] || KIND_STYLES.work;
                  const title = block.title || block.task?.title || "Time Block";

                  return (
                    <div
                      key={block.id}
                      className={`absolute left-2 right-1 rounded-xl p-2 border shadow-2xs flex flex-col justify-between overflow-hidden transition-all group z-10 ${kindStyle.bg} ${kindStyle.border}`}
                      style={{
                        top: `${topPct}%`,
                        height: `${heightPct}%`,
                        minHeight: "32px",
                      }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[9px] font-bold px-1 py-0.2 rounded uppercase ${kindStyle.badge}`}>
                            {block.kind}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500">
                            {formatTimeString(startDate)}
                          </span>
                        </div>
                        <p
                          className={`text-[11px] font-semibold leading-tight truncate mt-0.5 ${kindStyle.text}`}
                          title={title}
                        >
                          {title}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 space-y-1">
                    <CalendarIcon className="w-5 h-5 mx-auto text-slate-300" />
                    <p className="text-[11px] font-medium text-slate-600">
                      No blocks today
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Use Calendar to time-block your focus tasks.
                    </p>
                    <Link
                      href="/calendar"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 pt-1"
                    >
                      <span>Open Calendar</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DayStrip;
