"use client";

import React, { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { TimeBlockWithTask, TimeBlockKind } from "@/server/actions/calendar";
import { Clock, Lock, Trash2, CheckSquare, GripVertical, MoreVertical } from "lucide-react";

interface TimeBlockCardProps {
  block: TimeBlockWithTask;
  hourHeightPx: number; // e.g. 56px per hour
  onDelete: (id: string) => void;
  isOverlay?: boolean;
}

const KIND_THEMES: Record<
  TimeBlockKind,
  {
    bg: string;
    border: string;
    text: string;
    timeText: string;
    badgeBg: string;
    badgeText: string;
    accent: string;
  }
> = {
  work: {
    bg: "bg-indigo-50/90 dark:bg-indigo-950/40",
    border: "border-indigo-200/60 dark:border-indigo-800/50",
    text: "text-indigo-950 dark:text-indigo-200",
    timeText: "text-indigo-700 dark:text-indigo-300",
    badgeBg: "bg-indigo-100/80 dark:bg-indigo-900/60",
    badgeText: "text-indigo-800 dark:text-indigo-300",
    accent: "border-l-indigo-600 dark:border-l-indigo-500",
  },
  study: {
    bg: "bg-purple-50/90 dark:bg-purple-950/40",
    border: "border-purple-200/60 dark:border-purple-800/50",
    text: "text-purple-950 dark:text-purple-200",
    timeText: "text-purple-700 dark:text-purple-300",
    badgeBg: "bg-purple-100/80 dark:bg-purple-900/60",
    badgeText: "text-purple-800 dark:text-purple-300",
    accent: "border-l-purple-600 dark:border-l-purple-500",
  },
  rest: {
    bg: "bg-emerald-50/90 dark:bg-emerald-950/40",
    border: "border-emerald-200/60 dark:border-emerald-800/50",
    text: "text-emerald-950 dark:text-emerald-200",
    timeText: "text-emerald-700 dark:text-emerald-300",
    badgeBg: "bg-emerald-100/80 dark:bg-emerald-900/60",
    badgeText: "text-emerald-800 dark:text-emerald-300",
    accent: "border-l-emerald-600 dark:border-l-emerald-500",
  },
  admin: {
    bg: "bg-zinc-100/90 dark:bg-zinc-800/60",
    border: "border-zinc-300/60 dark:border-zinc-700/60",
    text: "text-zinc-900 dark:text-zinc-100",
    timeText: "text-zinc-600 dark:text-zinc-400",
    badgeBg: "bg-zinc-200/80 dark:bg-zinc-700/70",
    badgeText: "text-zinc-800 dark:text-zinc-300",
    accent: "border-l-zinc-600 dark:border-l-zinc-400",
  },
};

export const TimeBlockCard = React.memo(function TimeBlockCard({
  block,
  hourHeightPx,
  onDelete,
  isOverlay = false,
}: TimeBlockCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `block-${block.id}`,
    data: {
      type: "block",
      block,
    },
    disabled: block.locked,
  });

  const startDate = new Date(block.startAt);
  const endDate = new Date(block.endAt);

  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
  const durationMinutes = Math.max(endMinutes - startMinutes, 15);

  const topPx = (startMinutes / 60) * hourHeightPx;
  const heightPx = Math.max((durationMinutes / 60) * hourHeightPx, 26);

  const theme = KIND_THEMES[block.kind] || KIND_THEMES.work;

  const formattedStart = startDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const formattedEnd = endDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const style: React.CSSProperties = {
    top: isOverlay ? undefined : `${topPx}px`,
    height: `${heightPx}px`,
    ...(transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          zIndex: 40,
        }
      : {}),
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    onDelete(block.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group absolute left-1 right-1 rounded-xl border border-l-4 shadow-subtle overflow-hidden transition-all select-none p-1.5 flex flex-col justify-between ${
        theme.bg
      } ${theme.border} ${theme.accent} ${
        block.locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      } ${isDragging && !isOverlay ? "opacity-30 border-dashed ring-2 ring-zinc-400" : ""} ${
        isOverlay ? "relative w-full shadow-float ring-2 ring-zinc-500 z-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {!block.locked && (
            <GripVertical className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 shrink-0" />
          )}
          <span className={`text-[11px] font-semibold truncate leading-tight ${theme.text}`}>
            {block.title || "Scheduled Block"}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {block.locked && <Lock className="w-3 h-3 text-zinc-400" />}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete time block"
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/80 dark:hover:bg-zinc-800/80 transition-opacity cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {heightPx > 36 && (
        <div className="flex items-center justify-between gap-1 mt-0.5 text-[10px]">
          <span className={`font-mono tabular-nums font-medium text-[10px] ${theme.timeText}`}>
            {formattedStart} - {formattedEnd}
          </span>
          <span className={`px-1.5 py-0.5 rounded-md font-medium text-[9px] uppercase tracking-wider ${theme.badgeBg} ${theme.badgeText}`}>
            {block.kind}
          </span>
        </div>
      )}
    </div>
  );
});
