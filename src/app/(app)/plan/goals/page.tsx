import { db } from "@/server/db";
import { goals } from "@/server/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { createGoal } from "@/server/actions/plan";
import Link from "next/link";
import {
  Target,
  Plus,
  Calendar,
  Compass,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";

function ProgressRing({
  percent,
  strokeColor,
  size = 32,
  strokeWidth = 3,
}: {
  percent: number;
  strokeColor?: string;
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
          stroke="currentColor"
          className="text-zinc-100 dark:text-zinc-800"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor || "currentColor"}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className={`transition-all duration-500 ease-out ${
            !strokeColor ? "text-zinc-900 dark:text-zinc-100" : ""
          }`}
        />
      </svg>
      <span className="absolute text-[9px] font-medium text-zinc-700 dark:text-zinc-300 font-mono">
        {clampedPercent}
      </span>
    </div>
  );
}

const LIFE_AREA_COLORS: Record<string, { dot: string }> = {
  work: { dot: "bg-blue-500" },
  project: { dot: "bg-indigo-500" },
  health: { dot: "bg-emerald-500" },
  study: { dot: "bg-amber-500" },
  finance: { dot: "bg-purple-500" },
  personal: { dot: "bg-rose-500" },
};

function getAreaBadge(area: string | null) {
  if (!area) return { label: "General", dot: "bg-zinc-400" };
  const key = area.toLowerCase().trim();
  return {
    label: area,
    dot: LIFE_AREA_COLORS[key]?.dot || "bg-zinc-400",
  };
}

export default async function GoalsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  async function handleCreateGoal(formData: FormData) {
    "use server";
    await createGoal(formData);
  }

  const userGoals = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, user.id), isNull(goals.deletedAt)))
    .orderBy(desc(goals.createdAt));

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Compass className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            <span>Intent & Planning</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Goals & Life Plans</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Define high-level objectives, link roadmaps, and track long-term progress.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* View Toggle */}
          <div className="inline-flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60">
            <Link
              href="/plan/goals"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-subtle flex items-center gap-1.5"
            >
              <Target className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
              <span>Goals Grid</span>
            </Link>
            <Link
              href="/plan/canvas"
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>24-Month Canvas</span>
            </Link>
          </div>

          {userGoals.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100/80 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 text-xs font-medium rounded-xl border border-zinc-200/50 dark:border-zinc-700/50">
              <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
              <span>{userGoals.length} {userGoals.length === 1 ? "Goal" : "Goals"}</span>
            </div>
          )}
        </div>
      </header>

      {/* Quick Add Goal Card */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/60 rounded-2xl p-5 shadow-subtle">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            <Plus className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Set a New Goal</h2>
        </div>

        <form action={handleCreateGoal} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6">
            <label htmlFor="goal-title" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Goal Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="goal-title"
              type="text"
              name="title"
              required
              placeholder="e.g. 'Ship MVP & Acquire 100 Users'"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-zinc-50/50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="goal-life-area" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Life Area
            </label>
            <input
              id="goal-life-area"
              type="text"
              name="lifeArea"
              placeholder="e.g. Work, Health, Study"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-zinc-50/50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="goal-target-date" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Target Date
            </label>
            <input
              id="goal-target-date"
              type="date"
              name="targetDate"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-zinc-50/50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
            />
          </div>

          <div className="sm:col-span-12 flex justify-end mt-1">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium rounded-xl shadow-subtle transition-all cursor-pointer active:scale-[0.985]"
            >
              <Sparkles className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
              <span>Create Goal</span>
            </button>
          </div>
        </form>
      </section>

      {/* Goals Grid */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
          Active Goals ({userGoals.length})
        </h2>

        {userGoals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userGoals.map((goal) => {
              const area = getAreaBadge(goal.lifeArea);
              const targetDateObj = goal.targetDate ? new Date(goal.targetDate) : null;
              const targetVal = goal.targetValue ? Number(goal.targetValue) : 0;
              const currentVal = goal.currentValue ? Number(goal.currentValue) : 0;
              const progress = targetVal > 0 ? Math.round((currentVal / targetVal) * 100) : goal.status === "completed" ? 100 : 0;

              return (
                <Link
                  key={goal.id}
                  href={`/plan/goals/${goal.id}`}
                  className="group block p-5 bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl shadow-subtle hover:shadow-float transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-zinc-100/70 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/50">
                      <span className={`w-1.5 h-1.5 rounded-full ${area.dot}`} />
                      <span>{area.label}</span>
                    </span>

                    <ProgressRing percent={progress} size={30} strokeWidth={2.5} strokeColor="#18181b" />
                  </div>

                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors line-clamp-2 mb-1.5">
                    {goal.title}
                  </h3>

                  {goal.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2 mb-4 font-normal">
                      {goal.description}
                    </p>
                  )}

                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400 mt-auto">
                    {targetDateObj ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{format(targetDateObj, "MMM d, yyyy")}</span>
                        <span className="text-[10px] text-zinc-400">
                          ({isPast(targetDateObj) ? "Overdue" : `${formatDistanceToNow(targetDateObj)} left`})
                        </span>
                      </span>
                    ) : (
                      <span className="text-zinc-400 italic text-[11px]">No target date</span>
                    )}

                    <span className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-gradient-to-b from-blue-50/40 via-white to-slate-50/50 border-2 border-dashed border-blue-200/80 rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Target className="w-8 h-8" />
            </div>

            <div className="max-w-lg space-y-2">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Turn your ambition into a staged plan
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Goals anchor your intentional life. A single high-level goal can be automatically decomposed into chronological stages, concrete milestones, and daily tasks with our AI Roadmap generator.
              </p>
            </div>

            {/* 3 Step Goal-to-Execution Flow */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl text-left pt-2">
              <div className="p-3.5 rounded-2xl bg-white border border-blue-100 shadow-2xs">
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">1. Intention</div>
                <div className="text-xs font-semibold text-slate-900">Define the Goal</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Set a clear outcome, life area, and target horizon.</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-blue-100 shadow-2xs">
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">2. Decomposition</div>
                <div className="text-xs font-semibold text-slate-900">Generate Roadmap</div>
                <div className="text-[11px] text-slate-500 mt-0.5">AI builds ordered stages and critical-path milestones.</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-blue-100 shadow-2xs">
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">3. Execution</div>
                <div className="text-xs font-semibold text-slate-900">Daily Tasks & Logs</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Milestone tasks flow straight to your Today screen.</div>
              </div>
            </div>

            <div className="pt-2 text-xs text-slate-500 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Use the form above to set your first goal</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
