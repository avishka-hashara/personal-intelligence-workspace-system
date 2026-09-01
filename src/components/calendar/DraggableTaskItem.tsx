"use client";

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Clock, Zap, Flag } from "lucide-react";

export interface TaskItemData {
  id: string;
  title: string;
  status: string;
  priority: number | null;
  estimateMinutes: number | null;
  dueAt: Date | null;
  energy: string | null;
}

interface DraggableTaskItemProps {
  task: TaskItemData;
  isOverlay?: boolean;
}

export function DraggableTaskItem({ task, isOverlay = false }: DraggableTaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: {
      type: "task",
      task,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const priorityColor =
    task.priority === 3
      ? "text-rose-600 bg-rose-50 border-rose-200"
      : task.priority === 2
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : "text-slate-600 bg-slate-100 border-slate-200";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group select-none p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs hover:border-indigo-300 transition-all cursor-grab active:cursor-grabbing ${
        isDragging && !isOverlay ? "opacity-30 border-dashed border-indigo-400 bg-indigo-50/30" : ""
      } ${isOverlay ? "shadow-xl border-indigo-500 ring-2 ring-indigo-400/20 rotate-1 scale-102" : ""}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug">
            {task.title}
          </p>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {task.priority !== null && task.priority > 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border flex items-center gap-0.5 ${priorityColor}`}
              >
                <Flag className="w-2.5 h-2.5" />
                <span>P{task.priority}</span>
              </span>
            )}

            <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.2 rounded border border-slate-200/70 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              <span>{task.estimateMinutes || 60}m</span>
            </span>

            {task.energy && (
              <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" />
                <span className="capitalize">{task.energy}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
