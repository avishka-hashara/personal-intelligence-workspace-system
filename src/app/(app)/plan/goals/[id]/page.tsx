import { db } from "@/server/db";
import { goals } from "@/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Target,
  Calendar,
  Layers,
  CheckSquare,
  Sparkles,
  Map,
  Clock,
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

interface GoalDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function GoalDetailPage({ params }: GoalDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  const [goal] = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.id, id),
        eq(goals.userId, user.id),
        isNull(goals.deletedAt)
      )
    )
    .limit(1);

  if (!goal) {
    redirect("/plan/goals");
  }

  const badgeStyle = getAreaBadge(goal.lifeArea);
  const targetDateObj = goal.targetDate ? new Date(goal.targetDate) : null;

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Back Link */}
      <div>
        <Link
          href="/plan/goals"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Goals</span>
        </Link>
      </div>

      {/* Goal Header */}
      <header className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          {goal.lifeArea ? (
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
            >
              {goal.lifeArea}
            </span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
              General
            </span>
          )}

          <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {goal.status || "active"}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {goal.title}
        </h1>

        {goal.description && (
          <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-2xl">
            {goal.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
          {targetDateObj && (
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>Target: {format(targetDateObj, "MMMM d, yyyy")}</span>
              <span className="text-slate-400 font-normal">
                ({isPast(targetDateObj) ? "Overdue" : `${formatDistanceToNow(targetDateObj)} remaining`})
              </span>
            </span>
          )}

          {goal.metricName && (
            <span className="flex items-center gap-1 text-slate-600">
              <Target className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Metric: {goal.targetValue ?? 1} {goal.metricName}</span>
            </span>
          )}
        </div>
      </header>

      {/* Main Content Sections */}
      <div className="space-y-6">
        {/* Placeholder 1: Roadmap & Stages */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Map className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Roadmap & Stages</h2>
                <p className="text-xs text-slate-500">Sequential milestones and phases for this goal.</p>
              </div>
            </div>

            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              Coming Next
            </span>
          </div>

          <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-2">
            <Layers className="w-8 h-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">Roadmap & Stages (Coming Next)</p>
            <p className="text-xs text-slate-400 max-w-md">
              Attach structured phases, automated AI-generated work breakdown structures, and sequential milestones.
            </p>
          </div>
        </section>

        {/* Placeholder 2: Contributing Tasks */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Contributing Tasks</h2>
                <p className="text-xs text-slate-500">Execution tasks aligned directly to this goal.</p>
              </div>
            </div>
          </div>

          <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-2">
            <Clock className="w-8 h-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No linked tasks yet</p>
            <p className="text-xs text-slate-400 max-w-md">
              Tasks linked to this goal or its milestones will appear here with live execution metrics.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
