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

const LIFE_AREA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  work: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  project: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  health: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  study: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  finance: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  personal: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

function getAreaBadge(area: string | null) {
  if (!area) return { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" };
  const key = area.toLowerCase().trim();
  return LIFE_AREA_COLORS[key] || { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" };
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
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <Compass className="w-3.5 h-3.5 text-indigo-500" />
            <span>Intent & Planning</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Goals & Life Plans</h1>
          <p className="text-slate-500 text-sm mt-1">
            Define high-level objectives, link roadmaps, and track long-term progress.
          </p>
        </div>

        {userGoals.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg">
            <Target className="w-3.5 h-3.5 text-indigo-600" />
            <span>{userGoals.length} {userGoals.length === 1 ? "Active Goal" : "Active Goals"}</span>
          </div>
        )}
      </header>

      {/* Quick Add Goal Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Plus className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">Set a New Goal</h2>
        </div>

        <form action={handleCreateGoal} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6">
            <label htmlFor="goal-title" className="block text-xs font-medium text-slate-600 mb-1">
              Goal Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="goal-title"
              type="text"
              name="title"
              required
              placeholder="e.g. 'Ship MVP & Acquire 100 Users'"
              className="w-full px-3.5 py-2 text-sm bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="goal-life-area" className="block text-xs font-medium text-slate-600 mb-1">
              Life Area
            </label>
            <input
              id="goal-life-area"
              type="text"
              name="lifeArea"
              placeholder="e.g. Work, Health, Study"
              className="w-full px-3.5 py-2 text-sm bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="goal-target-date" className="block text-xs font-medium text-slate-600 mb-1">
              Target Date
            </label>
            <input
              id="goal-target-date"
              type="date"
              name="targetDate"
              className="w-full px-3.5 py-2 text-sm bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>

          <div className="sm:col-span-12 flex justify-end mt-1">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all hover:shadow cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Create Goal</span>
            </button>
          </div>
        </form>
      </section>

      {/* Goals Grid */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-indigo-500" />
          Active Goals ({userGoals.length})
        </h2>

        {userGoals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userGoals.map((goal) => {
              const badgeStyle = getAreaBadge(goal.lifeArea);
              const targetDateObj = goal.targetDate ? new Date(goal.targetDate) : null;

              return (
                <Link
                  key={goal.id}
                  href={`/plan/goals/${goal.id}`}
                  className="group block p-5 bg-white border border-slate-200 hover:border-slate-900/30 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    {goal.lifeArea ? (
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                      >
                        {goal.lifeArea}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        General
                      </span>
                    )}

                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {goal.status || "active"}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-2">
                    {goal.title}
                  </h3>

                  {goal.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                      {goal.description}
                    </p>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 mt-auto">
                    {targetDateObj ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{format(targetDateObj, "MMM d, yyyy")}</span>
                        <span className="text-[10px] text-slate-400">
                          ({isPast(targetDateObj) ? "Overdue" : `${formatDistanceToNow(targetDateObj)} left`})
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">No target date</span>
                    )}

                    <span className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-slate-200 rounded-2xl p-10 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-3">
            <div className="p-3 rounded-full bg-white shadow-xs text-slate-400 border border-slate-200">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">No goals created yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Set your first high-level goal above (e.g., &quot;Ship MVP&quot;, &quot;Run a Marathon&quot;) to start structuring roadmaps and milestones.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
