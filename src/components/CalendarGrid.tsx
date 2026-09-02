"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { TimeBlockWithTask } from "@/server/actions/calendar";
import { CapacityBar } from "@/components/calendar/CapacityBar";
import { TimeBlockCard } from "@/components/calendar/TimeBlockCard";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT_PX = 56; // 56px per hour row

interface CalendarGridProps {
  days: Date[]; // array of dates (7 for week, 1 for day)
  timeBlocks: TimeBlockWithTask[];
  availableMinutesPerDay: number;
  onDeleteBlock: (id: string) => void;
  onSlotClick?: (date: Date, hour: number) => void;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Droppable individual hour slot cell
function HourSlotCell({
  dateKey,
  hour,
  onSlotClick,
  dateObj,
}: {
  dateKey: string;
  hour: number;
  onSlotClick?: (date: Date, hour: number) => void;
  dateObj: Date;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${dateKey}-${hour}`,
    data: {
      type: "slot",
      dateKey,
      hour,
    },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSlotClick?.(dateObj, hour)}
      className={`border-b border-slate-100 transition-colors ${
        isOver ? "bg-indigo-100/60 border-indigo-300" : "hover:bg-slate-50/50"
      }`}
      style={{ height: `${HOUR_HEIGHT_PX}px` }}
    />
  );
}

export function CalendarGrid({
  days,
  timeBlocks,
  availableMinutesPerDay,
  onDeleteBlock,
  onSlotClick,
}: CalendarGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [mounted, setMounted] = useState(false);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number | null>(null);

  // ResizeObserver to track container width dynamically
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerWidth(Math.round(entry.contentRect.width));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const d = new Date();
      setCurrentTimeMinutes(d.getHours() * 60 + d.getMinutes());
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = useMemo(() => formatDateKey(new Date()), []);
  const currentTopPx = currentTimeMinutes !== null ? (currentTimeMinutes / 60) * HOUR_HEIGHT_PX : 0;

  // Group blocks by date key (YYYY-MM-DD)
  const blocksByDay = useMemo(() => {
    const map: Record<string, TimeBlockWithTask[]> = {};
    for (const block of timeBlocks) {
      const blockDate = new Date(block.startAt);
      const key = formatDateKey(blockDate);
      if (!map[key]) map[key] = [];
      map[key].push(block);
    }
    return map;
  }, [timeBlocks]);

  // Calculate sum of blocked minutes per day
  const minutesByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const day of days) {
      const key = formatDateKey(day);
      const dayBlocks = blocksByDay[key] || [];
      let total = 0;
      for (const b of dayBlocks) {
        const start = new Date(b.startAt).getTime();
        const end = new Date(b.endAt).getTime();
        total += Math.round(Math.max((end - start) / 60000, 0));
      }
      map[key] = total;
    }
    return map;
  }, [days, blocksByDay]);

  const GUTTER_WIDTH = 64;
  const MIN_COL_WIDTH = days.length === 1 ? 200 : 110;
  const requiredMinWidth = GUTTER_WIDTH + days.length * MIN_COL_WIDTH;

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden select-none w-full transition-all duration-300 ease-in-out"
    >
      {/* Unified Horizontal Scroll Container so Header and Body columns are always 1:1 in sync */}
      <div className="overflow-x-auto w-full">
        <div style={{ minWidth: `${requiredMinWidth}px`, width: "100%" }}>
          {/* Day Columns Header */}
          <div className="grid grid-cols-[64px_1fr] border-b border-slate-200 bg-slate-50/90 backdrop-blur-xs sticky top-0 z-20">
            {/* Time Gutter Header */}
            <div className="p-3 border-r border-slate-200 text-center text-[10px] font-bold uppercase text-slate-400 flex items-center justify-center">
              GMT
            </div>

            {/* Day Column Headers */}
            <div
              className="grid divide-x divide-slate-200"
              style={{
                gridTemplateColumns: `repeat(${days.length}, minmax(${MIN_COL_WIDTH}px, 1fr))`,
              }}
            >
              {days.map((day) => {
                const dateKey = formatDateKey(day);
                const isToday = dateKey === todayStr;
                const dayBlockedMinutes = minutesByDay[dateKey] || 0;

                const dayName = day.toLocaleDateString([], { weekday: "short" });
                const dayNum = day.getDate();
                const monthName = day.toLocaleDateString([], { month: "short" });

                return (
                  <div key={dateKey} className="p-2 sm:p-2.5 text-center space-y-1.5 min-w-0">
                    <div className="flex items-center justify-center gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                        {dayName}
                      </span>
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                          isToday
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "text-slate-900 bg-slate-200/60"
                        }`}
                      >
                        {dayNum}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium hidden sm:inline truncate">
                        {monthName}
                      </span>
                    </div>

                    {/* Capacity Bar */}
                    <CapacityBar
                      blockedMinutes={dayBlockedMinutes}
                      availableMinutes={availableMinutesPerDay}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 24-Hour Scrollable Grid Body */}
          <div className="overflow-y-auto max-h-[calc(100vh-250px)] relative">
            <div className="grid grid-cols-[64px_1fr] w-full">
              {/* Time Gutter Labels */}
              <div className="border-r border-slate-200 bg-slate-50/50 text-right pr-2 select-none">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="text-[11px] font-semibold text-slate-400 relative -top-2 flex items-start justify-end"
                    style={{ height: `${HOUR_HEIGHT_PX}px` }}
                  >
                    <span>{formatHour(hour)}</span>
                  </div>
                ))}
              </div>

              {/* Columns Grid */}
              <div
                className="grid divide-x divide-slate-200 relative"
                style={{
                  gridTemplateColumns: `repeat(${days.length}, minmax(${MIN_COL_WIDTH}px, 1fr))`,
                }}
              >
                {days.map((day) => {
                  const dateKey = formatDateKey(day);
                  const isToday = dateKey === todayStr;
                  const dayBlocks = blocksByDay[dateKey] || [];

                  return (
                    <div key={dateKey} className="relative bg-white min-w-0">
                      {/* Hourly Droppable Slots */}
                      {HOURS.map((hour) => (
                        <HourSlotCell
                          key={hour}
                          dateKey={dateKey}
                          hour={hour}
                          onSlotClick={onSlotClick}
                          dateObj={day}
                        />
                      ))}

                      {/* Red Current Time Line Indicator (if today & mounted) */}
                      {mounted && isToday && currentTimeMinutes !== null && (
                        <div
                          className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                          style={{ top: `${currentTopPx}px` }}
                        >
                          <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1 shadow-xs" />
                          <div className="flex-1 h-[2px] bg-rose-500 shadow-xs" />
                        </div>
                      )}

                      {/* Absolutely Positioned Time Blocks */}
                      {dayBlocks.map((block) => (
                        <TimeBlockCard
                          key={block.id}
                          block={block}
                          hourHeightPx={HOUR_HEIGHT_PX}
                          onDelete={onDeleteBlock}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarGrid;
