"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
interface HourSlotCellProps {
  dateKey: string;
  hour: number;
  onSlotClick?: (date: Date, hour: number) => void;
  dateObj: Date;
}

const HourSlotCell = React.memo(function HourSlotCell({
  dateKey,
  hour,
  onSlotClick,
  dateObj,
}: HourSlotCellProps) {
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
      className={`border-b border-zinc-100 dark:border-zinc-800/80 transition-colors ${
        isOver
          ? "bg-zinc-200/50 dark:bg-zinc-800/60 border-zinc-300 dark:border-zinc-700"
          : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40"
      }`}
      style={{ height: `${HOUR_HEIGHT_PX}px` }}
    />
  );
});

// Memoized Day Column Header
interface DayColumnHeaderProps {
  dateKey: string;
  dayName: string;
  dayNum: number;
  monthName: string;
  isToday: boolean;
  blockedMinutes: number;
  availableMinutes: number;
}

const DayColumnHeader = React.memo(function DayColumnHeader({
  dateKey,
  dayName,
  dayNum,
  monthName,
  isToday,
  blockedMinutes,
  availableMinutes,
}: DayColumnHeaderProps) {
  return (
    <div key={dateKey} className="p-2 sm:p-2.5 text-center space-y-1.5 min-w-0">
      <div className="flex items-center justify-center gap-1.5 min-w-0">
        <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-300 uppercase tracking-wider shrink-0">
          {dayName}
        </span>
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 transition-colors ${
            isToday
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-subtle font-bold"
              : "text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 font-semibold"
          }`}
        >
          {dayNum}
        </span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-400 font-medium hidden sm:inline truncate font-mono">
          {monthName}
        </span>
      </div>

      {/* Capacity Bar */}
      <CapacityBar
        blockedMinutes={blockedMinutes}
        availableMinutes={availableMinutes}
      />
    </div>
  );
});

// Memoized Day Column with custom arePropsEqual
interface DayColumnProps {
  day: Date;
  dateKey: string;
  isToday: boolean;
  dayBlocks: TimeBlockWithTask[];
  hourHeightPx: number;
  onDeleteBlock: (id: string) => void;
  onSlotClick?: (date: Date, hour: number) => void;
  currentTimeMinutes: number | null;
  mounted: boolean;
  currentTopPx: number;
}

const areDayColumnPropsEqual = (prev: DayColumnProps, next: DayColumnProps) => {
  if (prev.dateKey !== next.dateKey) return false;
  if (prev.isToday !== next.isToday) return false;
  if (prev.hourHeightPx !== next.hourHeightPx) return false;
  if (prev.currentTopPx !== next.currentTopPx) return false;
  if (prev.mounted !== next.mounted) return false;
  if (prev.onDeleteBlock !== next.onDeleteBlock) return false;
  if (prev.onSlotClick !== next.onSlotClick) return false;
  if (prev.dayBlocks.length !== next.dayBlocks.length) return false;
  for (let i = 0; i < prev.dayBlocks.length; i++) {
    const pb = prev.dayBlocks[i];
    const nb = next.dayBlocks[i];
    if (
      pb.id !== nb.id ||
      pb.startAt !== nb.startAt ||
      pb.endAt !== nb.endAt ||
      pb.title !== nb.title ||
      pb.kind !== nb.kind ||
      pb.locked !== nb.locked
    ) {
      return false;
    }
  }
  return true;
};

const DayColumn = React.memo(function DayColumn({
  day,
  dateKey,
  isToday,
  dayBlocks,
  hourHeightPx,
  onDeleteBlock,
  onSlotClick,
  currentTimeMinutes,
  mounted,
  currentTopPx,
}: DayColumnProps) {
  return (
    <div className="relative bg-white dark:bg-zinc-900 min-w-0">
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
          <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1 shadow-subtle" />
          <div className="flex-1 h-[1.5px] bg-rose-500 shadow-subtle" />
        </div>
      )}

      {/* Absolutely Positioned Time Blocks */}
      {dayBlocks.map((block) => (
        <TimeBlockCard
          key={block.id}
          block={block}
          hourHeightPx={hourHeightPx}
          onDelete={onDeleteBlock}
        />
      ))}
    </div>
  );
}, areDayColumnPropsEqual);

export function CalendarGrid({
  days,
  timeBlocks,
  availableMinutesPerDay,
  onDeleteBlock,
  onSlotClick,
}: CalendarGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number | null>(null);

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
    for (const day of days) {
      map[formatDateKey(day)] = [];
    }
    for (const block of timeBlocks) {
      const blockDate = new Date(block.startAt);
      const key = formatDateKey(blockDate);
      if (map[key]) {
        map[key].push(block);
      }
    }
    return map;
  }, [days, timeBlocks]);

  // Calculate sum of blocked minutes per day (recomputed in the same frame as state updates)
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
  const MIN_COL_WIDTH = days.length === 1 ? 200 : 96;
  const requiredMinWidth = GUTTER_WIDTH + days.length * MIN_COL_WIDTH;

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/80 rounded-2xl shadow-subtle overflow-hidden select-none w-full transition-all duration-300 ease-in-out"
    >
      {/* Unified Horizontal Scroll Container */}
      <div className="overflow-x-auto w-full">
        <div style={{ minWidth: `${requiredMinWidth}px`, width: "100%" }}>
          {/* Day Columns Header */}
          <div className="grid grid-cols-[64px_1fr] border-b border-zinc-200/70 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-20">
            {/* Time Gutter Header */}
            <div className="p-3 border-r border-zinc-200/70 dark:border-zinc-800/80 text-center text-[10px] font-mono font-medium uppercase text-zinc-400 dark:text-zinc-400 flex items-center justify-center">
              GMT
            </div>

            {/* Day Column Headers */}
            <div
              className="grid divide-x divide-zinc-200/70 dark:divide-zinc-800/80"
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
                  <DayColumnHeader
                    key={dateKey}
                    dateKey={dateKey}
                    dayName={dayName}
                    dayNum={dayNum}
                    monthName={monthName}
                    isToday={isToday}
                    blockedMinutes={dayBlockedMinutes}
                    availableMinutes={availableMinutesPerDay}
                  />
                );
              })}
            </div>
          </div>

          {/* 24-Hour Scrollable Grid Body */}
          <div className="overflow-y-auto max-h-[calc(100vh-250px)] relative">
            <div className="grid grid-cols-[64px_1fr] w-full">
              {/* Time Gutter Labels */}
              <div className="border-r border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/40 text-right pr-2 select-none">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="text-[10px] font-mono text-zinc-400 dark:text-zinc-400 font-medium relative -top-2 flex items-start justify-end"
                    style={{ height: `${HOUR_HEIGHT_PX}px` }}
                  >
                    <span>{formatHour(hour)}</span>
                  </div>
                ))}
              </div>

              {/* Columns Grid */}
              <div
                className="grid divide-x divide-zinc-200/70 dark:divide-zinc-800/80 relative"
                style={{
                  gridTemplateColumns: `repeat(${days.length}, minmax(${MIN_COL_WIDTH}px, 1fr))`,
                }}
              >
                {days.map((day) => {
                  const dateKey = formatDateKey(day);
                  const isToday = dateKey === todayStr;
                  const dayBlocks = blocksByDay[dateKey] || [];

                  return (
                    <DayColumn
                      key={dateKey}
                      day={day}
                      dateKey={dateKey}
                      isToday={isToday}
                      dayBlocks={dayBlocks}
                      hourHeightPx={HOUR_HEIGHT_PX}
                      onDeleteBlock={onDeleteBlock}
                      onSlotClick={onSlotClick}
                      currentTimeMinutes={currentTimeMinutes}
                      mounted={mounted}
                      currentTopPx={currentTopPx}
                    />
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
