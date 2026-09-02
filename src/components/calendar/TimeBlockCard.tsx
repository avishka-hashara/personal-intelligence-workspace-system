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
    bg: "bg-indigo-50/95",
    border: "border-indigo-200",
    text: "text-indigo-950",
    timeText: "text-indigo-700",
    badgeBg: "bg-indigo-100/80",
    badgeText: "text-indigo-800",
    accent: "border-l-indigo-600",
  },
  study: {
    bg: "bg-purple-50/95",
    border: "border-purple-200",
    text: "text-purple-950",
    timeText: "text-purple-700",
    badgeBg: "bg-purple-100/80",
    badgeText: "text-purple-800",
    accent: "border-l-purple-600",
  },
  rest: {
    bg: "bg-emerald-50/95",
    border: "border-emerald-200",
    text: "text-emerald-950",
    timeText: "text-emerald-700",
    badgeBg: "bg-emerald-100/80",
    badgeText: "text-emerald-800",
    accent: "border-l-emerald-600",
  },
  admin: {
    bg: "bg-slate-100/95",
    border: "border-slate-300",
    text: "text-slate-900",
    timeText: "text-slate-600",
    badgeBg: "bg-slate-200/80",
    badgeText: "text-slate-800",
    accent: "border-l-slate-600",
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
      className={`group absolute left-1 right-1 rounded-lg border border-l-4 shadow-2xs overflow-hidden transition-all select-none p-1.5 flex flex-col justify-between ${
        theme.bg
      } ${theme.border} ${theme.accent} ${
        block.locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      } ${isDragging && !isOverlay ? "opacity-30 border-dashed ring-2 ring-indigo-300" : ""} ${
        isOverlay ? "relative w-full shadow-xl ring-2 ring-indigo-500 z-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {!block.locked && (
            <GripVertical className="w-3 h-3 text-slate-400 group-hover:text-slate-600 shrink-0" />
          )}
          <span className={`text-[11px] font-bold truncate leading-tight ${theme.text}`}>
            {block.title || "Scheduled Block"}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {block.locked && <Lock className="w-3 h-3 text-slate-400" />}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete time block"
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-white/80 transition-opacity cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {heightPx > 36 && (
        <div className="flex items-center justify-between gap-1 mt-0.5 text-[10px]">
          <span className={`font-semibold ${theme.timeText}`}>
            {formattedStart} - {formattedEnd}
          </span>
          <span className={`px-1 py-0.2 rounded font-medium text-[9px] uppercase ${theme.badgeBg} ${theme.badgeText}`}>
            {block.kind}
          </span>
        </div>
      )}
    </div>
  );
});
