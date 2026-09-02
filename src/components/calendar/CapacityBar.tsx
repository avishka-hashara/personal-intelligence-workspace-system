"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface CapacityBarProps {
  blockedMinutes: number;
  availableMinutes: number; // e.g. 300
}

export function CapacityBar({ blockedMinutes, availableMinutes }: CapacityBarProps) {
  const cap = availableMinutes > 0 ? availableMinutes : 300;
  const percentage = Math.round((blockedMinutes / cap) * 100);
  const isOverCapacity = percentage > 110;
  const isNearCapacity = percentage >= 90 && percentage <= 110;

  const hours = Math.floor(blockedMinutes / 60);
  const mins = blockedMinutes % 60;
  const formattedTime = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ""}` : `${mins}m`;

  const capHours = Math.floor(cap / 60);
  const capMins = cap % 60;
  const formattedCap = capHours > 0 ? `${capHours}h ${capMins > 0 ? `${capMins}m` : ""}` : `${capMins}m`;

  return (
    <div className="w-full space-y-1 px-2 py-1.5 bg-slate-50/80 rounded-lg border border-slate-200/80 text-[10px]">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center justify-between gap-1 text-slate-500 font-medium">
          <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-400 shrink-0">
            <Clock className="w-2.5 h-2.5" />
            <span>Capacity</span>
          </span>
          <span className="text-[10px] font-bold text-slate-600 shrink-0">
            {percentage}%
          </span>
        </div>
        <div
          className={`font-semibold flex items-center gap-1 text-[10px] truncate ${
            isOverCapacity
              ? "text-amber-600 font-bold"
              : isNearCapacity
              ? "text-indigo-600"
              : "text-slate-700"
          }`}
          title={`${formattedTime} / ${formattedCap} (${percentage}%)`}
        >
          {isOverCapacity && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 animate-pulse" />}
          <span className="truncate">
            {formattedTime} / {formattedCap}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isOverCapacity
              ? "bg-amber-500 shadow-xs shadow-amber-200"
              : isNearCapacity
              ? "bg-indigo-600"
              : "bg-emerald-500"
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {isOverCapacity && (
        <div className="text-[9px] text-amber-600 font-medium leading-tight truncate">
          Over capacity (&gt;110%)
        </div>
      )}
    </div>
  );
}
