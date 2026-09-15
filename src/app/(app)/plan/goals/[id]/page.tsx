import { db } from "@/server/db";
import { goals, roadmaps, stages, milestones, tasks, vMilestoneStatus, milestoneDependencies } from "@/server/db/schema";
import { eq, and, isNull, inArray, asc, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Target,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  Activity,
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { RoadmapView, type StageWithMilestones, type MilestoneWithStatus, type DependencyLink } from "@/components/RoadmapView";
import { Progress } from "@/components/ui/progress";
import { ContextSetter } from "@/components/ContextSetter";

function summarizeGoal(goal: any, stagesList: StageWithMilestones[]): string {
  const parts: string[] = [];
  if (goal.description) parts.push(`Description: ${goal.description}`);
  if (goal.lifeArea) parts.push(`Life Area: ${goal.lifeArea}`);
  if (goal.targetDate) parts.push(`Target Date: ${format(new Date(goal.targetDate), "yyyy-MM-dd")}`);
  if (goal.targetValue) parts.push(`Target Metric: ${goal.currentValue || 0}/${goal.targetValue} ${goal.unit || ""}`);
  if (stagesList && stagesList.length > 0) {
    const stageSummary = stagesList
      .map((s) => `${s.title} (${s.status || "pending"}, ${s.milestones.length} milestones)`)
      .join(", ");
    parts.push(`Roadmap Stages: ${stageSummary}`);
  }
  return parts.join("\n");
}

const LIFE_AREA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  work: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800/60" },
  project: { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800/60" },
  health: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800/60" },
  study: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800/60" },
  finance: { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800/60" },
  personal: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800/60" },
};

function getAreaBadge(area: string | null) {
  if (!area) return { bg: "bg-slate-100 dark:bg-zinc-800", text: "text-slate-700 dark:text-zinc-300", border: "border-slate-200 dark:border-zinc-700" };
  const key = area.toLowerCase().trim();
  return LIFE_AREA_COLORS[key] || { bg: "bg-slate-100 dark:bg-zinc-800", text: "text-slate-700 dark:text-zinc-300", border: "border-slate-200 dark:border-zinc-700" };
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

  // 1. Fetch the Goal
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

  // 2. Fetch Roadmap (if one exists for this goal)
  const [roadmap] = await db
    .select()
    .from(roadmaps)
    .where(
      and(
        eq(roadmaps.goalId, id),
        eq(roadmaps.userId, user.id),
        isNull(roadmaps.deletedAt)
      )
    )
    .limit(1);

  let stagesWithMilestones: StageWithMilestones[] = [];
  let allMilestoneRows: MilestoneWithStatus[] = [];
  let dependencies: DependencyLink[] = [];

  // 3. If roadmap exists, fetch its stages, derived milestone statuses, and dependencies
  if (roadmap) {
    const stageRows = await db
      .select()
      .from(stages)
      .where(
        and(
          eq(stages.roadmapId, roadmap.id),
          eq(stages.userId, user.id),
          isNull(stages.deletedAt)
        )
      )
      .orderBy(asc(stages.ordinal), asc(stages.createdAt));

    const stageIds = stageRows.map((s) => s.id);

    if (stageIds.length > 0) {
      allMilestoneRows = (await db
        .select()
        .from(vMilestoneStatus)
        .where(
          and(
            inArray(vMilestoneStatus.stageId, stageIds),
            eq(vMilestoneStatus.userId, user.id)
          )
        )
        .orderBy(asc(vMilestoneStatus.ordinal), asc(vMilestoneStatus.createdAt))) as MilestoneWithStatus[];

      const milestoneIds = allMilestoneRows.map((m) => m.id);
      if (milestoneIds.length > 0) {
        dependencies = await db
          .select({
            predecessorId: milestoneDependencies.predecessorId,
            successorId: milestoneDependencies.successorId,
            kind: milestoneDependencies.kind,
          })
          .from(milestoneDependencies)
          .where(inArray(milestoneDependencies.predecessorId, milestoneIds));
      }
    }

    stagesWithMilestones = stageRows.map((stage) => ({
      ...stage,
      milestones: allMilestoneRows.filter((m) => m.stageId === stage.id),
    }));
  }

  // 4. Calculate Weighted Progress Roll-up
  let totalWeight = 0;
  let completedWeight = 0;

  for (const milestone of allMilestoneRows) {
    const weight = Number(milestone.estHours) || 1;
    totalWeight += weight;
    if (milestone.completedAt !== null) {
      completedWeight += weight;
    }
  }

  const progressPercentage =
    totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  // 5. Query Evidence Feed (Completed tasks linked to milestones)
  const milestoneIds = allMilestoneRows.map((m) => m.id);
  let evidenceTasks: (typeof tasks.$inferSelect)[] = [];

  if (milestoneIds.length > 0) {
    evidenceTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          inArray(tasks.milestoneId, milestoneIds),
          eq(tasks.status, "done"),
          eq(tasks.userId, user.id),
          isNull(tasks.deletedAt)
        )
      )
      .orderBy(desc(tasks.updatedAt))
      .limit(10);
  }

  const badgeStyle = getAreaBadge(goal.lifeArea);
  const targetDateObj = goal.targetDate ? new Date(goal.targetDate) : null;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <ContextSetter
        type="Goal"
        id={goal.id}
        title={goal.title}
        data={summarizeGoal(goal, stagesWithMilestones)}
      />
      {/* Back Link */}
      <div>
        <Link
          href="/plan/goals"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Goals</span>
        </Link>
      </div>

      {/* Goal Header with Weighted Progress Roll-up */}
      <header className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          {goal.lifeArea ? (
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
            >
              {goal.lifeArea}
            </span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
              General
            </span>
          )}

          <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            {goal.status || "active"}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-zinc-50 tracking-tight">
          {goal.title}
        </h1>

        {goal.description && (
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed max-w-2xl">
            {goal.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-5 text-xs text-slate-500 dark:text-zinc-400">
          {targetDateObj && (
            <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-zinc-300">
              <Calendar className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <span>Target: {format(targetDateObj, "MMMM d, yyyy")}</span>
              <span className="text-slate-400 dark:text-zinc-500 font-normal">
                ({isPast(targetDateObj) ? "Overdue" : `${formatDistanceToNow(targetDateObj)} remaining`})
              </span>
            </span>
          )}

          {goal.metricName && (
            <span className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
              <Target className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              <span>Target Metric: {goal.targetValue ?? 1} {goal.metricName}</span>
            </span>
          )}
        </div>

        {/* Weighted Progress Roll-up Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Weighted Goal Progress
            </span>
            <span className="font-bold text-slate-900 dark:text-zinc-100 font-mono text-sm">
              {progressPercentage}%
            </span>
          </div>

          <Progress value={progressPercentage} className="h-2.5 bg-slate-100 dark:bg-zinc-800" />

          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
            <span>
              {allMilestoneRows.filter((m) => !!m.completedAt).length} of {allMilestoneRows.length} milestones complete
            </span>
            <span>
              {completedWeight} / {totalWeight} weighted hours
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Sections */}
      <div className="space-y-6">
        {/* Roadmap & Stages View */}
        <RoadmapView
          goalId={goal.id}
          goal={goal}
          roadmap={roadmap ?? null}
          stages={stagesWithMilestones}
          dependencies={dependencies}
        />

        {/* Evidence Feed Section */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Evidence of Progress</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Completed tasks verifying milestones for this goal.</p>
              </div>
            </div>

            {evidenceTasks.length > 0 && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                {evidenceTasks.length} {evidenceTasks.length === 1 ? "Evidence Item" : "Evidence Items"}
              </span>
            )}
          </div>

          {evidenceTasks.length > 0 ? (
            <div className="space-y-2">
              {evidenceTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-800/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                        {task.title}
                      </p>
                      {task.notes && (
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate mt-0.5">
                          {task.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs text-slate-400 dark:text-zinc-400">
                    {task.actualMinutes && (
                      <span className="text-[11px] px-2 py-0.5 bg-white dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-mono">
                        {task.actualMinutes}m focus
                      </span>
                    )}
                    <span className="text-[11px]">
                      {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl p-8 text-center bg-slate-50/50 dark:bg-zinc-900/20 flex flex-col items-center justify-center gap-2">
              <Clock className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">No evidence accumulated yet</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-md">
                Complete tasks linked to this goal&apos;s milestones to see them here as proof of execution.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
