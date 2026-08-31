"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useUIStore } from "@/store/uiStore";
import { updateOnboardingState } from "@/server/actions/user";
import {
  Target,
  GraduationCap,
  CheckSquare,
  ArrowRight,
  Sparkles,
  X,
  Compass,
  Zap,
} from "lucide-react";

interface OnboardingPromptsProps {
  userName?: string | null;
}

export function OnboardingPrompts({ userName }: OnboardingPromptsProps) {
  const { setCaptureOpen } = useUIStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const handleDismiss = async () => {
    setIsDismissed(true);
    setIsDismissing(true);
    try {
      await updateOnboardingState("skipped_prompts");
    } catch (err) {
      console.error("Failed to dismiss onboarding prompts:", err);
    } finally {
      setIsDismissing(false);
    }
  };

  if (isDismissed) {
    return null;
  }

  const promptCards = [
    {
      id: "goal",
      title: "Set a Goal",
      description: "Turn your ambition into a staged plan.",
      icon: Target,
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20",
      accentBg: "from-blue-50/50 via-indigo-50/30 to-white",
      borderColor: "border-blue-100 hover:border-blue-300",
      badge: "Vision",
      badgeStyle: "bg-blue-50 text-blue-700 border-blue-200",
      href: "/plan/goals",
      buttonText: "Create Goal",
      isAction: false,
    },
    {
      id: "course",
      title: "Add a Course",
      description: "Track your syllabus and study sessions.",
      icon: GraduationCap,
      iconBg: "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20",
      accentBg: "from-indigo-50/50 via-purple-50/30 to-white",
      borderColor: "border-indigo-100 hover:border-indigo-300",
      badge: "Academics",
      badgeStyle: "bg-indigo-50 text-indigo-700 border-indigo-200",
      href: "/study/courses",
      buttonText: "Add Course",
      isAction: false,
    },
    {
      id: "task",
      title: "Capture a Task",
      description: "Get something done today.",
      icon: CheckSquare,
      iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20",
      accentBg: "from-emerald-50/50 via-teal-50/30 to-white",
      borderColor: "border-emerald-100 hover:border-emerald-300",
      badge: "Action",
      badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
      href: "#",
      buttonText: "Quick Capture",
      isAction: true,
      shortcut: "Q",
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900/[0.03] to-slate-900/[0.01] border border-slate-200/80 p-6 sm:p-8 backdrop-blur-xs mb-8 shadow-xs">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Welcome to PIW</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {userName ? `Welcome, ${userName}!` : "Let's set up your workspace"}
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Choose your starting point below to build your intentional life graph. Intention flows down to tasks; execution flows up to goals.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          disabled={isDismissing}
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors border border-slate-200/80 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span>Skip for now</span>
        </button>
      </div>

      {/* 3 Onboarding Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {promptCards.map((card) => {
          const Icon = card.icon;

          const CardContent = (
            <div
              className={`h-full flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-b ${card.accentBg} border ${card.borderColor} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group cursor-pointer`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className={`p-2.5 rounded-xl ${card.iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${card.badgeStyle}`}
                  >
                    {card.badge}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {card.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {card.description}
                </p>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-slate-700 group-hover:text-indigo-600">
                <span className="flex items-center gap-1.5">
                  <span>{card.buttonText}</span>
                  {card.shortcut && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200 shadow-2xs">
                      {card.shortcut}
                    </span>
                  )}
                </span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );

          if (card.isAction) {
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setCaptureOpen(true)}
                className="text-left w-full focus:outline-none"
              >
                {CardContent}
              </button>
            );
          }

          return (
            <Link key={card.id} href={card.href} className="block focus:outline-none">
              {CardContent}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default OnboardingPrompts;
