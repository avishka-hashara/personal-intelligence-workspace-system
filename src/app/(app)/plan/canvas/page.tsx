import { db } from "@/server/db";
import { goals } from "@/server/db/schema";
import { eq, and, isNull, inArray, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Compass,
  Target,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingUp,
  PauseCircle,
  PlayCircle,
  Briefcase,
  GraduationCap,
  HeartPulse,
  User,
  Wallet,
  FolderGit2,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  addMonths,
  startOfQuarter,
  format,
  differenceInDays,
  differenceInMonths,
  isBefore,
  isAfter,
} from "date-fns";

interface LifeAreaConfig {
  label: string;
  icon: any;
  colorBg: string;
  colorBorder: string;
  colorText: string;
  barBg: string;
  barBorder: string;
  barRing: string;
  dotColor: string;
}

const LIFE_AREA_CONFIGS: Record<string, LifeAreaConfig> = {
  study: {
    label: "Study & Academics",
    icon: GraduationCap,
    colorBg: "bg-amber-500/10",
    colorBorder: "border-amber-500/20",
    colorText: "text-amber-700",
    barBg: "bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/25",
    barBorder: "border-amber-400/50",
    barRing: "#f59e0b",
    dotColor: "bg-amber-500",
  },
  work: {
    label: "Work & Career",
    icon: Briefcase,
    colorBg: "bg-blue-500/10",
    colorBorder: "border-blue-500/20",
    colorText: "text-blue-700",
    barBg: "bg-gradient-to-r from-blue-500/15 via-blue-500/10 to-blue-500/25",
    barBorder: "border-blue-400/50",
    barRing: "#3b82f6",
    dotColor: "bg-blue-500",
  },
  health: {
    label: "Health & Vitality",
    icon: HeartPulse,
    colorBg: "bg-emerald-500/10",
    colorBorder: "border-emerald-500/20",
    colorText: "text-emerald-700",
    barBg: "bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-emerald-500/25",
    barBorder: "border-emerald-400/50",
    barRing: "#10b981",
    dotColor: "bg-emerald-500",
  },
  personal: {
    label: "Personal & Growth",
    icon: User,
    colorBg: "bg-rose-500/10",
    colorBorder: "border-rose-500/20",
    colorText: "text-rose-700",
    barBg: "bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-rose-500/25",
    barBorder: "border-rose-400/50",
    barRing: "#f43f5e",
    dotColor: "bg-rose-500",
  },
  finance: {
    label: "Finance & Wealth",
    icon: Wallet,
    colorBg: "bg-purple-500/10",
    colorBorder: "border-purple-500/20",
    colorText: "text-purple-700",
    barBg: "bg-gradient-to-r from-purple-500/15 via-purple-500/10 to-purple-500/25",
    barBorder: "border-purple-400/50",
    barRing: "#a855f7",
    dotColor: "bg-purple-500",
  },
  project: {
    label: "Projects & Side Hustles",
    icon: FolderGit2,
    colorBg: "bg-indigo-500/10",
    colorBorder: "border-indigo-500/20",
    colorText: "text-indigo-700",
    barBg: "bg-gradient-to-r from-indigo-500/15 via-indigo-500/10 to-indigo-500/25",
    barBorder: "border-indigo-400/50",
    barRing: "#6366f1",
    dotColor: "bg-indigo-500",
  },
};

function getAreaConfig(areaName: string | null): LifeAreaConfig {
  const key = (areaName || "personal").toLowerCase().trim();
  return (
    LIFE_AREA_CONFIGS[key] || {
      label: areaName ? areaName.charAt(0).toUpperCase() + areaName.slice(1) : "General",
      icon: Target,
      colorBg: "bg-slate-500/10",
      colorBorder: "border-slate-500/20",
      colorText: "text-slate-700",
      barBg: "bg-gradient-to-r from-slate-500/15 via-slate-500/10 to-slate-500/25",
      barBorder: "border-slate-400/50",
      barRing: "#64748b",
      dotColor: "bg-slate-500",
    }
  );
}

/**
 * Renders an SVG progress ring
 */
function ProgressRing({
  percent,
  strokeColor,
  size = 28,
  strokeWidth = 3,
}: {
  percent: number;
  strokeColor: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clampedPercent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-[9px] font-bold text-slate-700 font-mono">
        {clampedPercent}
      </span>
    </div>
  );
}

export default async function PlanCanvasPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Fetch active and paused goals
  const allGoals = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.userId, user.id),
        isNull(goals.deletedAt),
        inArray(goals.status, ["active", "paused"])
      )
    )
    .orderBy(desc(goals.createdAt));

  // 2. Compute 24-Month Timeline Parameters
  const now = new Date();
  const timelineStart = startOfQuarter(now);
  const timelineEnd = addMonths(timelineStart, 24);
  const totalDays = differenceInDays(timelineEnd, timelineStart);

  // Build the 8 quarters and 24 months
  const quarters: {
    label: string;
    year: number;
    quarter: number;
    start: Date;
    months: { label: string; date: Date }[];
  }[] = [];

  for (let q = 0; q < 8; q++) {
    const qStart = addMonths(timelineStart, q * 3);
    const qYear = qStart.getFullYear();
    const qNumber = Math.floor(qStart.getMonth() / 3) + 1;

    const qMonths = [0, 1, 2].map((mOffset) => {
      const mDate = addMonths(qStart, mOffset);
      return {
        label: format(mDate, "MMM"),
        date: mDate,
      };
    });

    quarters.push({
      label: `Q${qNumber} ${qYear}`,
      year: qYear,
      quarter: qNumber,
      start: qStart,
      months: qMonths,
    });
  }

  // Calculate "Today" percentage position on timeline
  const todayOffsetDays = differenceInDays(now, timelineStart);
  const todayPercent = Math.max(0, Math.min(100, (todayOffsetDays / totalDays) * 100));

  // 3. Group goals by life area
  const groupedGoals = new Map<string, typeof allGoals>();

  // Ensure standard life areas exist in order
  const standardAreas = ["study", "work", "health", "personal", "finance", "project"];
  for (const area of standardAreas) {
    groupedGoals.set(area, []);
  }

  for (const goal of allGoals) {
    const area = (goal.lifeArea || "personal").toLowerCase().trim();
    if (!groupedGoals.has(area)) {
      groupedGoals.set(area, []);
    }
    groupedGoals.get(area)!.push(goal);
  }

  // Filter out empty standard areas only if there are other areas, but keep at least standard ones
  const activeAreas = Array.from(groupedGoals.entries()).filter(
    ([_, areaGoals]) => areaGoals.length > 0
  );

  const displayAreas =
    activeAreas.length > 0
      ? activeAreas
      : standardAreas.slice(0, 4).map((a) => [a, []] as [string, typeof allGoals]);

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Page Header */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <Compass className="w-3.5 h-3.5 text-indigo-500" />
            <span>24-Month Life Plan Canvas</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Strategic Horizon Canvas
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Continuous 2-year visual timeline of your active goals, roadmaps, and progress across all life areas.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
          {/* View Toggle */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs">
            <Link
              href="/plan/goals"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5"
            >
              <Target className="w-3.5 h-3.5 text-slate-400" />
              <span>Goals Grid</span>
            </Link>
            <Link
              href="/plan/canvas"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-900 shadow-xs flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>24-Month Canvas</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/70 border border-indigo-100/80 text-indigo-700 text-xs font-semibold rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>
              {allGoals.length} {allGoals.length === 1 ? "Goal" : "Goals"} Plotted
            </span>
          </div>
        </div>
      </header>

      {/* Timeline Controls & Legend Bar */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/60 rounded-2xl p-4 shadow-subtle flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium uppercase tracking-wider text-zinc-400 text-[10px]">
            Timeline Window:
          </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {format(timelineStart, "MMMM yyyy")} &mdash; {format(timelineEnd, "MMMM yyyy")} (24 Months / 8 Quarters)
          </span>
        </div>

        {/* Life Area Legend Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {standardAreas.map((areaKey) => {
            const config = LIFE_AREA_CONFIGS[areaKey];
            if (!config) return null;
            return (
              <span
                key={areaKey}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
                <span>{config.label.split(" ")[0]}</span>
              </span>
            );
          })}
        </div>
      </section>

      {/* Main 24-Month Timeline Canvas Container */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/60 rounded-2xl shadow-subtle overflow-hidden">
        {/* Horizontally scrollable wrapper */}
        <div className="overflow-x-auto min-w-full">
          <div className="min-w-[1280px] relative pb-6">
            {/* Timeline Header: Quarters & Months (Frosted Glass Sticky) */}
            <div className="sticky top-0 z-20 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl border-b border-zinc-200/70 dark:border-zinc-800/60">
              {/* Quarters Row */}
              <div className="grid grid-cols-8 border-b border-zinc-200/60 dark:border-zinc-800/60 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {quarters.map((q, idx) => (
                  <div
                    key={idx}
                    className={`py-2.5 px-3 text-center border-r border-zinc-200/60 dark:border-zinc-800/60 last:border-r-0 ${
                      idx % 2 === 0 ? "bg-zinc-50/40 dark:bg-zinc-850/40" : "bg-transparent"
                    }`}
                  >
                    <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400">
                      {q.year}
                    </span>
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Q{q.quarter}
                    </div>
                  </div>
                ))}
              </div>

              {/* Months Row */}
              <div className="grid grid-cols-24 text-[10px] text-zinc-400 font-mono">
                {quarters.flatMap((q) =>
                  q.months.map((m, mIdx) => (
                    <div
                      key={`${q.label}-${mIdx}`}
                      className="py-1 px-1 text-center border-r border-zinc-100 dark:border-zinc-800/40 last:border-r-0"
                    >
                      {m.label}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Vertical "Today" Indicator Line */}
            <div
              className="absolute top-0 bottom-0 z-10 pointer-events-none flex flex-col items-center"
              style={{ left: `${todayPercent}%` }}
            >
              <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[9px] font-semibold px-2 py-0.5 rounded-full shadow-subtle uppercase tracking-wider -translate-y-1">
                Today
              </div>
              <div className="w-[1px] h-full bg-zinc-900/60 dark:bg-zinc-100/60 border-l border-dashed border-zinc-400/50" />
            </div>

            {/* Life Area Lanes */}
            <div className="divide-y divide-slate-100">
              {displayAreas.map(([areaKey, areaGoals]) => {
                const config = getAreaConfig(areaKey);
                const AreaIcon = config.icon;

                return (
                  <div
                    key={areaKey}
                    className="group relative hover:bg-slate-50/40 transition-colors py-4 px-4"
                  >
                    {/* Area Lane Title Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-1.5 rounded-lg ${config.colorBg} ${config.colorBorder} border`}>
                        <AreaIcon className={`w-4 h-4 ${config.colorText}`} />
                      </div>
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {config.label}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-md">
                        {areaGoals.length} {areaGoals.length === 1 ? "goal" : "goals"}
                      </span>
                    </div>

                    {/* Timeline Canvas Row Grid Background */}
                    <div className="relative min-h-[60px] flex flex-col gap-2.5">
                      {/* Background Grid Lines (24 Columns) */}
                      <div className="absolute inset-0 grid grid-cols-24 pointer-events-none opacity-40">
                        {Array.from({ length: 24 }).map((_, colIdx) => (
                          <div
                            key={colIdx}
                            className={`border-r border-slate-200/50 ${
                              colIdx % 3 === 2 ? "border-r-slate-300" : ""
                            }`}
                          />
                        ))}
                      </div>

                      {/* Goal Spans in Lane */}
                      {areaGoals.length > 0 ? (
                        areaGoals.map((goal) => {
                          const goalCreated = goal.createdAt ? new Date(goal.createdAt) : now;
                          const goalTarget = goal.targetDate
                            ? new Date(goal.targetDate)
                            : addMonths(goalCreated, 6);

                          // Calculate span start & end clamped to the 24-month horizon
                          const startDays = differenceInDays(goalCreated, timelineStart);
                          const targetDays = differenceInDays(goalTarget, timelineStart);

                          const rawStartPct = (startDays / totalDays) * 100;
                          const rawEndPct = (targetDays / totalDays) * 100;

                          const leftPercent = Math.max(0, Math.min(95, rawStartPct));
                          const endPercent = Math.min(100, Math.max(leftPercent + 4, rawEndPct));
                          const widthPercent = Math.max(6, endPercent - leftPercent);

                          // Calculate progress percentage
                          const targetVal = goal.targetValue ? Number(goal.targetValue) : 0;
                          const currentVal = goal.currentValue ? Number(goal.currentValue) : 0;
                          const progressPercent =
                            targetVal > 0
                              ? Math.min(100, Math.round((currentVal / targetVal) * 100))
                              : goal.status === "completed"
                              ? 100
                              : 0;

                          const isPaused = goal.status === "paused";

                          return (
                            <div
                              key={goal.id}
                              className="relative h-12 flex items-center z-1"
                            >
                              <div
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                }}
                                className={`absolute h-10 rounded-xl border ${config.barBorder} ${config.barBg} px-2.5 flex items-center justify-between gap-2 shadow-2xs hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer group/card backdrop-blur-[2px]`}
                              >
                                {/* Left side: Progress Ring & Title */}
                                <div className="flex items-center gap-2 min-w-0">
                                  <ProgressRing
                                    percent={progressPercent}
                                    strokeColor={config.barRing}
                                    size={26}
                                    strokeWidth={3}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-900 truncate">
                                        {goal.title}
                                      </span>
                                      {isPaused && (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                                          <PauseCircle className="w-2.5 h-2.5 text-amber-600" />
                                          Paused
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1">
                                      <span>Target: {format(goalTarget, "MMM yyyy")}</span>
                                      {targetVal > 0 && (
                                        <span>
                                          &bull; {currentVal} / {targetVal} {goal.unit || ""}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Right Side Link */}
                                <Link
                                  href={`/plan/roadmaps?goalId=${goal.id}`}
                                  className="opacity-0 group-hover/card:opacity-100 transition-opacity p-1 bg-white/90 rounded-md border border-slate-200/80 text-slate-600 hover:text-indigo-600 shadow-2xs shrink-0"
                                  title="View Roadmaps"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="h-10 flex items-center text-xs text-slate-400 italic pl-2">
                          No active goals in {config.label.toLowerCase()} for this period.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Footer Navigation Tip */}
      <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>
            Goals with specified target dates automatically scale and align across their scheduled quarter.
          </span>
        </div>
        <Link
          href="/plan/goals"
          className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1"
        >
          <span>Manage Goals in Grid</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </footer>
    </div>
  );
}
