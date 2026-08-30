"use client";

import { useState, useTransition, useMemo } from "react";
import {
  createRoadmap,
  createStage,
  createMilestone,
  toggleMilestone,
  addMilestoneDependency,
  removeMilestoneDependency,
  updateMilestoneDueDate,
  shiftDownstreamMilestones,
  applyReplan,
} from "@/server/actions/plan";
import type { roadmaps, stages, goals } from "@/server/db/schema";
import {
  Map as MapIcon,
  Plus,
  CheckCircle2,
  Circle,
  Layers,
  Sparkles,
  ChevronRight,
  Flag,
  Check,
  Calendar,
  AlertTriangle,
  Lock,
  Flame,
  ArrowRight,
  RefreshCw,
  FastForward,
  Link as LinkIcon,
  Trash2,
  X,
  Info,
  Clock,
  ExternalLink,
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { useRouter } from "next/navigation";

export type Roadmap = typeof roadmaps.$inferSelect;
export type Stage = typeof stages.$inferSelect;
export type Goal = typeof goals.$inferSelect;

export interface MilestoneWithStatus {
  id: string;
  userId: string;
  stageId: string;
  objectiveId: string | null;
  title: string;
  definitionOfDone: string | null;
  dueDate: Date | string | null;
  completedAt: Date | string | null;
  estHours: string | null;
  ordinal: number;
  statusOverride: string | null;
  totalTasks: number;
  completedTasks: number;
  blockedByCount: number;
  incompletePredecessorIds: string[];
  incompletePredecessorTitles: string[];
  derivedStatus: string;
}

export interface DependencyLink {
  predecessorId: string;
  successorId: string;
  kind?: string | null;
}

export interface StageWithMilestones extends Stage {
  milestones: MilestoneWithStatus[];
}

interface RoadmapViewProps {
  goalId: string;
  goal?: Goal | null;
  roadmap: Roadmap | null;
  stages: StageWithMilestones[];
  dependencies?: DependencyLink[];
}

interface ReplanProposal {
  milestones: {
    milestone_id: string;
    new_date: string;
    reason: string;
  }[];
  target_date_breached: boolean;
  suggested_scope_cut?: string | null;
  summary: string;
}

/**
 * Computes Critical Path using longest path DAG dynamic programming based on estHours.
 */
function computeCriticalPath(
  milestonesList: MilestoneWithStatus[],
  deps: DependencyLink[]
): Set<string> {
  const milestoneMap = new Map(milestonesList.map((m) => [m.id, m]));
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const m of milestonesList) {
    adj.set(m.id, []);
    inDegree.set(m.id, 0);
  }

  for (const d of deps) {
    if (milestoneMap.has(d.predecessorId) && milestoneMap.has(d.successorId)) {
      adj.get(d.predecessorId)?.push(d.successorId);
      inDegree.set(d.successorId, (inDegree.get(d.successorId) || 0) + 1);
    }
  }

  // Topological queue
  const queue: string[] = [];
  const dist = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const m of milestonesList) {
    const weight = Number(m.estHours) || 4;
    dist.set(m.id, weight);
    parent.set(m.id, null);
    if ((inDegree.get(m.id) || 0) === 0) {
      queue.push(m.id);
    }
  }

  while (queue.length > 0) {
    const u = queue.shift()!;
    const uDist = dist.get(u) || 0;

    for (const v of adj.get(u) || []) {
      const vWeight = Number(milestoneMap.get(v)?.estHours) || 4;
      if (uDist + vWeight > (dist.get(v) || 0)) {
        dist.set(v, uDist + vWeight);
        parent.set(v, u);
      }

      inDegree.set(v, (inDegree.get(v) || 0) - 1);
      if (inDegree.get(v) === 0) {
        queue.push(v);
      }
    }
  }

  // Find node with max distance
  let maxDist = -1;
  let endNode: string | null = null;
  for (const [id, d] of dist.entries()) {
    if (d > maxDist) {
      maxDist = d;
      endNode = id;
    }
  }

  const criticalPathSet = new Set<string>();
  if (deps.length === 0 || maxDist <= 4) {
    return criticalPathSet; // No critical path without dependencies
  }

  let curr = endNode;
  while (curr) {
    criticalPathSet.add(curr);
    curr = parent.get(curr) || null;
  }

  return criticalPathSet;
}

/**
 * Checks if adding predecessorId -> successorId creates a cycle client-side.
 */
function wouldCreateCycle(
  predId: string,
  succId: string,
  deps: DependencyLink[]
): boolean {
  if (predId === succId) return true;

  const adj = new Map<string, string[]>();
  for (const d of deps) {
    const list = adj.get(d.predecessorId) || [];
    list.push(d.successorId);
    adj.set(d.predecessorId, list);
  }

  const visited = new Set<string>();
  const queue: string[] = [succId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === predId) return true;
    if (!visited.has(curr)) {
      visited.add(curr);
      for (const next of adj.get(curr) || []) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }
  }

  return false;
}

export function RoadmapView({
  goalId,
  goal,
  roadmap,
  stages,
  dependencies = [],
}: RoadmapViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newStageTitle, setNewStageTitle] = useState("");
  const [newMilestoneTitles, setNewMilestoneTitles] = useState<Record<string, string>>({});
  const [activeMilestoneInputStageId, setActiveMilestoneInputStageId] = useState<string | null>(null);

  // Dependency Management State
  const [activeDepMilestoneId, setActiveDepMilestoneId] = useState<string | null>(null);
  const [depError, setDepError] = useState<string | null>(null);

  // Re-plan Modal State
  const [isReplanModalOpen, setIsReplanModalOpen] = useState(false);
  const [isGeneratingReplan, setIsGeneratingReplan] = useState(false);
  const [replanProposal, setReplanProposal] = useState<ReplanProposal | null>(null);
  const [replanError, setReplanError] = useState<string | null>(null);

  // Shift Fallback Modal State
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftMilestoneId, setShiftMilestoneId] = useState<string | null>(null);
  const [shiftDays, setShiftDays] = useState<number>(7);

  // Flat list of all milestones
  const allMilestones = useMemo(() => stages.flatMap((s) => s.milestones), [stages]);
  const milestoneMap = useMemo(() => new Map(allMilestones.map((m) => [m.id, m])), [allMilestones]);

  // Critical Path calculation
  const criticalPath = useMemo(
    () => computeCriticalPath(allMilestones, dependencies),
    [allMilestones, dependencies]
  );

  // Metrics
  const totalMilestones = allMilestones.length;
  const completedMilestones = allMilestones.filter((m) => m.derivedStatus === "done" || !!m.completedAt).length;
  const slippedMilestones = allMilestones.filter((m) => m.derivedStatus === "slipped");
  const blockedMilestones = allMilestones.filter((m) => m.derivedStatus === "blocked");
  const atRiskMilestones = allMilestones.filter((m) => m.derivedStatus === "at_risk");

  const overallProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  // Handlers
  const handleInitializeRoadmap = () => {
    startTransition(async () => {
      await createRoadmap(goalId, "Project Roadmap");
      router.refresh();
    });
  };

  const handleAddStage = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newStageTitle.trim();
    if (!title || !roadmap || isPending) return;

    startTransition(async () => {
      await createStage(roadmap.id, title, goalId);
      setNewStageTitle("");
      router.refresh();
    });
  };

  const handleAddMilestone = (stageId: string, e: React.FormEvent) => {
    e.preventDefault();
    const title = (newMilestoneTitles[stageId] || "").trim();
    if (!title || isPending) return;

    startTransition(async () => {
      await createMilestone(stageId, title, goalId);
      setNewMilestoneTitles((prev) => ({ ...prev, [stageId]: "" }));
      setActiveMilestoneInputStageId(null);
      router.refresh();
    });
  };

  const handleToggleMilestone = (milestoneId: string, currentCompletedAt: Date | string | null) => {
    startTransition(async () => {
      await toggleMilestone(milestoneId, currentCompletedAt, goalId);
      router.refresh();
    });
  };

  const handleAddDependency = (predecessorId: string, successorId: string) => {
    setDepError(null);
    if (wouldCreateCycle(predecessorId, successorId, dependencies)) {
      setDepError("Cannot create dependency: this creates a circular loop in the roadmap.");
      return;
    }

    startTransition(async () => {
      const res = await addMilestoneDependency(predecessorId, successorId, goalId);
      if (res?.error) {
        setDepError(res.error);
      } else {
        setActiveDepMilestoneId(null);
        router.refresh();
      }
    });
  };

  const handleRemoveDependency = (predecessorId: string, successorId: string) => {
    startTransition(async () => {
      await removeMilestoneDependency(predecessorId, successorId, goalId);
      router.refresh();
    });
  };

  const handleUpdateDueDate = (milestoneId: string, newDateStr: string) => {
    startTransition(async () => {
      await updateMilestoneDueDate(milestoneId, newDateStr ? new Date(newDateStr) : null, goalId);
      router.refresh();
    });
  };

  // AI-09 Re-plan Trigger
  const handleOpenAIReplan = async () => {
    setIsReplanModalOpen(true);
    setIsGeneratingReplan(true);
    setReplanError(null);
    setReplanProposal(null);

    try {
      const res = await fetch("/api/ai/replan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to generate AI re-planning schedule");
      }

      setReplanProposal(data.replan);
    } catch (err: any) {
      setReplanError(err.message || "Failed to contact AI-09 Re-planner service.");
    } finally {
      setIsGeneratingReplan(false);
    }
  };

  const handleApplyReplan = () => {
    if (!replanProposal) return;
    startTransition(async () => {
      await applyReplan(replanProposal.milestones, goalId);
      setIsReplanModalOpen(false);
      router.refresh();
    });
  };

  const handleApplyShift = () => {
    if (!shiftMilestoneId) return;
    startTransition(async () => {
      await shiftDownstreamMilestones(shiftMilestoneId, shiftDays, goalId);
      setIsShiftModalOpen(false);
      router.refresh();
    });
  };

  // 1. Empty State
  if (!roadmap) {
    return (
      <section className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
          <MapIcon className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto">
          <h2 className="text-lg font-bold text-slate-900">Break this goal down into a Roadmap</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Create sequential stages, verifiable milestones, and dependencies to track critical paths and dynamically detect slipped tasks.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={handleInitializeRoadmap}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{isPending ? "Initializing..." : "Initialize Roadmap"}</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
      {/* Roadmap Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <MapIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{roadmap.title || "Roadmap & Execution Plan"}</h2>
              {criticalPath.size > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <Flame className="w-3 h-3 text-amber-600" />
                  {criticalPath.size} Critical
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {stages.length} Stages · {completedMilestones}/{totalMilestones} completed ({overallProgress}%)
              {slippedMilestones.length > 0 && ` · ${slippedMilestones.length} slipped`}
              {blockedMilestones.length > 0 && ` · ${blockedMilestones.length} blocked`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:self-center">
          <button
            type="button"
            onClick={handleOpenAIReplan}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI Re-plan (AI-09)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (slippedMilestones.length > 0) {
                setShiftMilestoneId(slippedMilestones[0].id);
              } else if (allMilestones.length > 0) {
                setShiftMilestoneId(allMilestones[0].id);
              }
              setIsShiftModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <FastForward className="w-3.5 h-3.5 text-slate-500" />
            <span>Quick Shift</span>
          </button>
        </div>
      </div>

      {/* Slipped Alert Banner - only shows when milestones have actually slipped past their due dates */}
      {slippedMilestones.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Schedule Slippage Detected ({slippedMilestones.length} Slipped Milestone{slippedMilestones.length > 1 ? "s" : ""})
              </h4>
              <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                One or more milestones have passed their due dates. Use AI-09 to recalculate realistic dates based on your velocity and dependency graph, or use Quick Shift.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenAIReplan}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              Re-plan Schedule
            </button>
          </div>
        </div>
      )}

      {/* Global Dependency Error Alert */}
      {depError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{depError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDepError(null)}
            className="text-rose-500 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stages List */}
      <div className="space-y-5">
        {stages.map((stage, index) => {
          const stageTotal = stage.milestones.length;
          const stageDone = stage.milestones.filter((m) => m.derivedStatus === "done" || !!m.completedAt).length;
          const isInputActive = activeMilestoneInputStageId === stage.id;

          return (
            <div
              key={stage.id}
              className="border border-slate-200/90 rounded-xl bg-slate-50/40 p-4 sm:p-5 space-y-3.5 transition-all hover:border-slate-300"
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-200/80 text-slate-700 font-mono text-[11px] font-bold shrink-0">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {stage.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {stageTotal > 0 && (
                    <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                      {stageDone}/{stageTotal} done
                    </span>
                  )}
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {stage.status || "active"}
                  </span>
                </div>
              </div>

              {/* Milestones Checklist */}
              <div className="space-y-2 pl-1">
                {stage.milestones.map((milestone) => {
                  const isDone = milestone.derivedStatus === "done" || !!milestone.completedAt;
                  const isSlipped = milestone.derivedStatus === "slipped";
                  const isBlocked = milestone.derivedStatus === "blocked";
                  const isAtRisk = milestone.derivedStatus === "at_risk";
                  const isOnCriticalPath = criticalPath.has(milestone.id);

                  // Predecessor dependencies for this milestone
                  const incomingDeps = dependencies.filter((d) => d.successorId === milestone.id);
                  const outgoingDeps = dependencies.filter((d) => d.predecessorId === milestone.id);

                  return (
                    <div
                      key={milestone.id}
                      className={`group flex flex-col p-3 rounded-xl border transition-all select-none ${
                        isDone
                          ? "bg-slate-100/70 border-slate-200/60 text-slate-400"
                          : isSlipped
                          ? "bg-amber-50/50 border-amber-300/80 text-slate-800 shadow-2xs"
                          : isBlocked
                          ? "bg-rose-50/40 border-rose-200 text-slate-800 shadow-2xs"
                          : isAtRisk
                          ? "bg-amber-50/30 border-amber-200 text-slate-800 shadow-2xs"
                          : "bg-white border-slate-200 text-slate-800 hover:border-slate-300 shadow-2xs"
                      } ${isOnCriticalPath && !isDone ? "ring-1 ring-amber-400/50" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleMilestone(milestone.id, milestone.completedAt)}
                          disabled={isPending}
                          className="mt-0.5 text-slate-400 hover:text-slate-900 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                          title={isDone ? "Mark as pending" : "Mark as completed"}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                          ) : (
                            <Circle className="w-4 h-4 hover:text-slate-700" />
                          )}
                        </button>

                        {/* Title & Status Badges */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className={`text-xs font-semibold ${isDone ? "line-through text-slate-400" : "text-slate-800"}`}>
                              {milestone.title}
                            </p>

                            {/* Status Badges */}
                            {isSlipped && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <span className="text-amber-600">◆</span>
                                Slipped
                              </span>
                            )}

                            {isBlocked && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <Lock className="w-2.5 h-2.5 text-rose-600" />
                                Blocked ({milestone.blockedByCount})
                              </span>
                            )}

                            {isAtRisk && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-2.5 h-2.5 text-amber-600" />
                                At Risk
                              </span>
                            )}

                            {isOnCriticalPath && !isDone && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Flame className="w-2.5 h-2.5 text-indigo-600" />
                                Critical Path
                              </span>
                            )}
                          </div>

                          {milestone.definitionOfDone && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              DoD: {milestone.definitionOfDone}
                            </p>
                          )}

                          {/* Blocked by reason list */}
                          {isBlocked && milestone.incompletePredecessorTitles.length > 0 && (
                            <p className="text-[10px] font-medium text-rose-600 mt-1 flex items-center gap-1">
                              <span>Waiting on:</span>
                              <span className="font-semibold">{milestone.incompletePredecessorTitles.join(", ")}</span>
                            </p>
                          )}

                          {/* Dependencies Badges */}
                          {incomingDeps.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="text-[10px] font-medium text-slate-400">Depends on:</span>
                              {incomingDeps.map((d) => {
                                const pred = milestoneMap.get(d.predecessorId);
                                return (
                                  <span
                                    key={d.predecessorId}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px]"
                                  >
                                    <LinkIcon className="w-2.5 h-2.5 text-slate-400" />
                                    <span className="truncate max-w-[120px]">{pred?.title || "Predecessor"}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveDependency(d.predecessorId, milestone.id)}
                                      className="hover:text-rose-600 cursor-pointer ml-0.5"
                                      title="Remove dependency"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Date & Action Controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Date input / display */}
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <input
                              type="date"
                              defaultValue={milestone.dueDate ? format(new Date(milestone.dueDate), "yyyy-MM-dd") : ""}
                              onChange={(e) => handleUpdateDueDate(milestone.id, e.target.value)}
                              className="px-2 py-0.5 rounded border border-slate-200 text-[11px] bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                              title="Set or update milestone due date"
                            />
                          </div>

                          {/* Link Dependency Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setDepError(null);
                              setActiveDepMilestoneId(activeDepMilestoneId === milestone.id ? null : milestone.id);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Add predecessor dependency"
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Add Predecessor Selector (Dropdown) */}
                      {activeDepMilestoneId === milestone.id && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-700">Select a predecessor that must complete first:</span>
                            <button
                              type="button"
                              onClick={() => setActiveDepMilestoneId(null)}
                              className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-200">
                            {allMilestones
                              .filter((m) => m.id !== milestone.id)
                              .map((other) => {
                                const isAlreadyLinked = incomingDeps.some((d) => d.predecessorId === other.id);
                                const causesCycle = wouldCreateCycle(other.id, milestone.id, dependencies);

                                return (
                                  <button
                                    key={other.id}
                                    type="button"
                                    disabled={isAlreadyLinked || causesCycle || isPending}
                                    onClick={() => handleAddDependency(other.id, milestone.id)}
                                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all text-left truncate max-w-[200px] cursor-pointer ${
                                      isAlreadyLinked
                                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                        : causesCycle
                                        ? "bg-rose-50 text-rose-400 border border-rose-100 cursor-not-allowed"
                                        : "bg-white text-slate-700 border border-slate-200 hover:border-slate-900 hover:bg-slate-900 hover:text-white"
                                    }`}
                                    title={causesCycle ? "Cannot link: would create a loop cycle" : isAlreadyLinked ? "Already linked" : "Link as predecessor"}
                                  >
                                    {other.title} {causesCycle && "(Cycle)"}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Milestone Form */}
              <div className="pt-1">
                {isInputActive ? (
                  <form onSubmit={(e) => handleAddMilestone(stage.id, e)} className="flex gap-2">
                    <input
                      type="text"
                      value={newMilestoneTitles[stage.id] || ""}
                      onChange={(e) =>
                        setNewMilestoneTitles((prev) => ({ ...prev, [stage.id]: e.target.value }))
                      }
                      placeholder="Milestone title (e.g. 'Complete API integration')..."
                      autoFocus
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={!(newMilestoneTitles[stage.id] || "").trim() || isPending}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMilestoneInputStageId(null)}
                      className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveMilestoneInputStageId(stage.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 py-1 px-2 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Milestone</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty Stages message */}
        {stages.length === 0 && (
          <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-1.5">
            <Layers className="w-6 h-6 text-slate-300" />
            <p className="text-xs font-medium text-slate-600">No stages created yet.</p>
            <p className="text-[11px] text-slate-400">Add your first stage below (e.g. &quot;Stage 1: Discovery & Architecture&quot;).</p>
          </div>
        )}
      </div>

      {/* Add Stage Form */}
      <div className="pt-3 border-t border-slate-100">
        <form onSubmit={handleAddStage} className="flex gap-2">
          <input
            type="text"
            value={newStageTitle}
            onChange={(e) => setNewStageTitle(e.target.value)}
            placeholder="Add new stage (e.g. 'Phase 2: Beta Launch & Polish')..."
            className="flex-1 px-3.5 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
          />
          <button
            type="submit"
            disabled={!newStageTitle.trim() || isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stage</span>
          </button>
        </form>
      </div>

      {/* AI-09 Re-plan Proposal Modal */}
      {isReplanModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">AI-09 Progress-based Re-planning</h3>
                  <p className="text-[11px] text-slate-500">Calculated with Claude Sonnet using velocity and dependency graph</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReplanModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isGeneratingReplan ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-xs font-semibold text-slate-700">Analyzing roadmap graph & completion velocity...</p>
                <p className="text-[11px] text-slate-400 max-w-xs">AI-09 is optimizing milestone dates to resolve bottlenecks.</p>
              </div>
            ) : replanError ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Re-planning Failed</span>
                </div>
                <p>{replanError}</p>
                <button
                  type="button"
                  onClick={handleOpenAIReplan}
                  className="px-3 py-1.5 bg-rose-600 text-white font-semibold rounded-lg text-xs hover:bg-rose-700"
                >
                  Retry
                </button>
              </div>
            ) : replanProposal ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {/* Summary banner */}
                <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1">
                  <p className="font-semibold">Strategy Summary:</p>
                  <p className="text-indigo-900 leading-relaxed">{replanProposal.summary}</p>
                </div>

                {/* Target Date Breach Warning */}
                {replanProposal.target_date_breached && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-rose-700">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Goal Target Date Breached</span>
                    </div>
                    <p className="text-[11px] text-rose-800">
                      The re-planned schedule extends beyond your goal target date ({goal?.targetDate ? format(new Date(goal.targetDate), "MMMM d, yyyy") : "None"}).
                    </p>
                    {replanProposal.suggested_scope_cut && (
                      <p className="text-[11px] font-medium text-rose-950 bg-white/80 p-2 rounded border border-rose-200/60">
                        💡 Suggested Scope Cut: {replanProposal.suggested_scope_cut}
                      </p>
                    )}
                  </div>
                )}

                {/* Proposed Date Adjustments Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                      <tr>
                        <th className="p-2.5">Milestone</th>
                        <th className="p-2.5">Current Date</th>
                        <th className="p-2.5">Proposed Date</th>
                        <th className="p-2.5">Rationale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {replanProposal.milestones.map((item) => {
                        const m = milestoneMap.get(item.milestone_id);
                        const currDate = m?.dueDate ? format(new Date(m.dueDate), "yyyy-MM-dd") : "None";
                        const isChanged = currDate !== item.new_date;

                        return (
                          <tr key={item.milestone_id} className={isChanged ? "bg-amber-50/30" : ""}>
                            <td className="p-2.5 font-semibold text-slate-800">{m?.title || "Milestone"}</td>
                            <td className="p-2.5 text-slate-500 font-mono text-[11px]">{currDate}</td>
                            <td className="p-2.5 font-bold font-mono text-[11px] text-indigo-700">{item.new_date}</td>
                            <td className="p-2.5 text-slate-600 text-[11px] leading-snug">{item.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsReplanModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyReplan}
                    disabled={isPending}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                  >
                    {isPending ? "Applying..." : "Apply Re-planned Schedule"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Deterministic Quick Shift Fallback Modal */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FastForward className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Deterministic Quick Shift</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Shift a milestone and all its downstream dependent successors by a fixed number of days.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Starting Milestone:</label>
                <select
                  value={shiftMilestoneId || ""}
                  onChange={(e) => setShiftMilestoneId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {allMilestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} {m.dueDate ? `(${format(new Date(m.dueDate), "MMM d")})` : "(No date)"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Shift By (Days):</label>
                <div className="flex items-center gap-2">
                  {[3, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setShiftDays(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                        shiftDays === d
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      +{d}d
                    </button>
                  ))}
                  <input
                    type="number"
                    value={shiftDays}
                    onChange={(e) => setShiftDays(parseInt(e.target.value, 10) || 0)}
                    className="w-16 px-2 py-1.5 text-xs text-center border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyShift}
                disabled={!shiftMilestoneId || isPending}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                {isPending ? "Shifting..." : `Shift Downstream by +${shiftDays} Days`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default RoadmapView;
