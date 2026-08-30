"use client";

import { useState, useTransition } from "react";
import {
  createRoadmap,
  createStage,
  createMilestone,
  toggleMilestone,
} from "@/server/actions/plan";
import type { roadmaps, stages, milestones } from "@/server/db/schema";
import {
  Map,
  Plus,
  CheckCircle2,
  Circle,
  Layers,
  Sparkles,
  ChevronRight,
  Flag,
  Check,
  Calendar,
} from "lucide-react";

export type Roadmap = typeof roadmaps.$inferSelect;
export type Stage = typeof stages.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;

export interface StageWithMilestones extends Stage {
  milestones: Milestone[];
}

interface RoadmapViewProps {
  goalId: string;
  roadmap: Roadmap | null;
  stages: StageWithMilestones[];
}

export function RoadmapView({ goalId, roadmap, stages }: RoadmapViewProps) {
  const [isPending, startTransition] = useTransition();
  const [newStageTitle, setNewStageTitle] = useState("");
  const [newMilestoneTitles, setNewMilestoneTitles] = useState<Record<string, string>>({});
  const [activeMilestoneInputStageId, setActiveMilestoneInputStageId] = useState<string | null>(null);

  // Initialize Roadmap handler
  const handleInitializeRoadmap = () => {
    startTransition(async () => {
      await createRoadmap(goalId, "Project Roadmap");
    });
  };

  // Add Stage handler
  const handleAddStage = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newStageTitle.trim();
    if (!title || !roadmap || isPending) return;

    startTransition(async () => {
      await createStage(roadmap.id, title, goalId);
      setNewStageTitle("");
    });
  };

  // Add Milestone handler
  const handleAddMilestone = (stageId: string, e: React.FormEvent) => {
    e.preventDefault();
    const title = (newMilestoneTitles[stageId] || "").trim();
    if (!title || isPending) return;

    startTransition(async () => {
      await createMilestone(stageId, title, goalId);
      setNewMilestoneTitles((prev) => ({ ...prev, [stageId]: "" }));
      setActiveMilestoneInputStageId(null);
    });
  };

  // Toggle Milestone handler
  const handleToggleMilestone = (milestoneId: string, currentCompletedAt: Date | null) => {
    startTransition(async () => {
      await toggleMilestone(milestoneId, currentCompletedAt, goalId);
    });
  };

  // 1. Empty State: No Roadmap Initialized
  if (!roadmap) {
    return (
      <section className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
          <Map className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto">
          <h2 className="text-lg font-bold text-slate-900">Break this goal down into a Roadmap</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Create sequential stages and verifiable milestones to turn this ambitious goal into actionable progress.
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

  // Calculate overall metrics
  const allMilestones = stages.flatMap((s) => s.milestones);
  const totalMilestones = allMilestones.length;
  const completedMilestones = allMilestones.filter((m) => !!m.completedAt).length;
  const overallProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
      {/* Roadmap Header & Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Map className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{roadmap.title || "Roadmap & Execution Plan"}</h2>
            <p className="text-xs text-slate-500">
              {stages.length} {stages.length === 1 ? "Stage" : "Stages"} · {completedMilestones} of {totalMilestones} milestones completed ({overallProgress}%)
            </p>
          </div>
        </div>

        {totalMilestones > 0 && (
          <div className="w-full sm:w-48 self-center space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>Overall Progress</span>
              <span className="font-semibold text-slate-900">{overallProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stages List */}
      <div className="space-y-4">
        {stages.map((stage, index) => {
          const stageTotal = stage.milestones.length;
          const stageDone = stage.milestones.filter((m) => !!m.completedAt).length;
          const isInputActive = activeMilestoneInputStageId === stage.id;

          return (
            <div
              key={stage.id}
              className="border border-slate-200/90 rounded-xl bg-slate-50/40 p-4 sm:p-5 space-y-3.5 transition-all hover:border-slate-300"
            >
              {/* Stage Top Bar */}
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
              <div className="space-y-1.5 pl-1">
                {stage.milestones.map((milestone) => {
                  const isDone = !!milestone.completedAt;

                  return (
                    <div
                      key={milestone.id}
                      className={`group flex items-start gap-3 p-2.5 rounded-lg border transition-all select-none ${
                        isDone
                          ? "bg-slate-100/70 border-slate-200/60 text-slate-400"
                          : "bg-white border-slate-200 text-slate-800 hover:border-slate-300 shadow-2xs"
                      }`}
                    >
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

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${isDone ? "line-through text-slate-400" : "text-slate-800"}`}>
                          {milestone.title}
                        </p>
                        {milestone.definitionOfDone && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            DoD: {milestone.definitionOfDone}
                          </p>
                        )}
                      </div>

                      {milestone.dueDate && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                          <Calendar className="w-3 h-3" />
                          {new Date(milestone.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Milestone Inline Form / Button */}
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
    </section>
  );
}

export default RoadmapView;
