"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, X, HeartHandshake } from "lucide-react";

export interface NudgeData {
  id: string;
  text: string;
  ctaUrl?: string | null;
  createdAt?: Date | string;
}

interface NudgeBannerProps {
  nudge?: NudgeData | null;
}

export function NudgeBanner({ nudge }: NudgeBannerProps) {
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (!nudge) return;
    try {
      const isDismissed = localStorage.getItem(`dismissed_nudge_${nudge.id}`);
      if (isDismissed === "true") {
        setDismissed(true);
      }
    } catch {
      // localStorage may not be available in private mode
    }
  }, [nudge]);

  if (!nudge || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(`dismissed_nudge_${nudge.id}`, "true");
    } catch {
      // ignore
    }
  };

  const handleActionClick = (e: React.MouseEvent) => {
    if (!nudge?.ctaUrl) return;

    // If targeting the habits section on the page, smoothly scroll to it
    if (
      nudge.ctaUrl === "/#habits" ||
      nudge.ctaUrl === "#habits" ||
      nudge.ctaUrl === "/habits"
    ) {
      const habitsEl = document.getElementById("habits");
      if (habitsEl) {
        e.preventDefault();
        habitsEl.scrollIntoView({ behavior: "smooth", block: "start" });
        
        // Gentle highlight animation
        habitsEl.classList.add("ring-2", "ring-indigo-400/80", "ring-offset-4", "rounded-2xl", "transition-all", "duration-300");
        setTimeout(() => {
          habitsEl.classList.remove("ring-2", "ring-indigo-400/80", "ring-offset-4");
        }, 1800);
      }
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-amber-50/40 border border-indigo-100/90 shadow-2xs p-4 sm:p-4.5 transition-all animate-in fade-in-50 duration-300">
      {/* Decorative subtle background aura */}
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-indigo-200/20 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start sm:items-center justify-between gap-3.5 relative z-10">
        <div className="flex items-start sm:items-center gap-3">
          {/* Glowing AI Coach Icon */}
          <div className="w-8 h-8 rounded-xl bg-indigo-100/90 text-indigo-600 border border-indigo-200/80 flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
          </div>

          {/* Coaching Content */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/60 px-1.5 py-0.2 rounded-md">
                Coaching Nudge
              </span>
            </div>
            <p className="text-xs sm:text-[13px] font-medium text-slate-800 leading-relaxed">
              {nudge.text}
            </p>
          </div>
        </div>

        {/* Action Button & Dismiss Button */}
        <div className="flex items-center gap-2 shrink-0 pt-0.5 sm:pt-0">
          {nudge.ctaUrl && (
            <Link
              href={nudge.ctaUrl}
              onClick={handleActionClick}
              className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>View</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Dismiss coaching nudge"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default NudgeBanner;
