"use client";

import React, { useState, useTransition } from "react";
import {
  Sparkles,
  Calendar,
  CheckCircle2,
  BookOpen,
  TrendingUp,
  Target,
  Flame,
  Clock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Award,
  Layers,
  ListTodo,
  ExternalLink,
  ChevronRight,
  History,
} from "lucide-react";
import {
  generateReview,
  applyReviewAdjustment,
  type ReviewItem,
  type ReviewPeriod,
  type ProposedAdjustment,
} from "@/server/actions/reviews";

interface JournalReviewDashboardProps {
  initialReviews: ReviewItem[];
}

export function JournalReviewDashboard({ initialReviews }: JournalReviewDashboardProps) {
  const [reviewsList, setReviewsList] = useState<ReviewItem[]>(initialReviews);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(
    initialReviews.length > 0 ? initialReviews[0].id : null
  );
  const [activeTab, setActiveTab] = useState<"all" | "quarterly" | "weekly">("all");
  const [isPending, startTransition] = useTransition();
  const [generatingPeriod, setGeneratingPeriod] = useState<ReviewPeriod | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [applyingAdjId, setApplyingAdjId] = useState<string | null>(null);

  const selectedReview = reviewsList.find((r) => r.id === selectedReviewId) || reviewsList[0];

  const filteredReviews = reviewsList.filter((r) => {
    if (activeTab === "all") return true;
    return r.period === activeTab;
  });

  const handleRunReview = (period: ReviewPeriod) => {
    setGeneratingPeriod(period);
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const res = await generateReview({ period, save: true });
        if (res.success && res.review) {
          setReviewsList((prev) => [res.review!, ...prev]);
          setSelectedReviewId(res.review.id);
          setSuccessMessage(
            `Successfully generated and recorded your ${
              period === "quarterly" ? "90-Day Quarterly" : "7-Day Weekly"
            } Review!`
          );
        } else {
          setErrorMessage(res.error || "Failed to generate review.");
        }
      } catch (err: any) {
        setErrorMessage(err?.message || "An unexpected error occurred.");
      } finally {
        setGeneratingPeriod(null);
      }
    });
  };

  const handleApplyAdjustment = (adjustmentId: string) => {
    if (!selectedReview) return;
    setApplyingAdjId(adjustmentId);

    startTransition(async () => {
      try {
        const res = await applyReviewAdjustment(selectedReview.id, adjustmentId);
        if (res.success) {
          setReviewsList((prev) =>
            prev.map((r) => {
              if (r.id === selectedReview.id) {
                return {
                  ...r,
                  proposedAdjustments: r.proposedAdjustments.map((a) =>
                    a.id === adjustmentId ? { ...a, applied: true } : a
                  ),
                };
              }
              return r;
            })
          );
        }
      } catch (err: any) {
        console.error("Failed to apply adjustment:", err);
      } finally {
        setApplyingAdjId(null);
      }
    });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              AI-08 Synthesis Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Journal & Periodic Reviews
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Consolidate execution metrics across tasks, study hours, and habits into an objective, grounded
              narrative with actionable roadmap recalibrations.
            </p>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
            {/* Weekly Trigger */}
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleRunReview("weekly")}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm border border-white/20 backdrop-blur-md transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {generatingPeriod === "weekly" ? (
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-300" />
              ) : (
                <Clock className="w-4 h-4 text-indigo-300" />
              )}
              <span>{generatingPeriod === "weekly" ? "Synthesizing 7d..." : "Run Weekly Review"}</span>
            </button>

            {/* Quarterly Trigger */}
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleRunReview("quarterly")}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {generatingPeriod === "quarterly" ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-white" />
              )}
              <span>{generatingPeriod === "quarterly" ? "Aggregating 90d..." : "Run Quarterly Review"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {reviewsList.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100">
            <Calendar className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No Reviews Generated Yet</h2>
          <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
            Run your first Weekly Review (7 days) or Quarterly Review (90 days) to aggregate multi-module activity
            and receive an AI-08 high-level synthesis with proposed adjustments.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => handleRunReview("weekly")}
              disabled={isPending}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-sm transition-colors cursor-pointer"
            >
              Run Weekly (7d)
            </button>
            <button
              onClick={() => handleRunReview("quarterly")}
              disabled={isPending}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-xs cursor-pointer"
            >
              Run Quarterly (90d)
            </button>
          </div>
        </div>
      ) : (
        /* Review View & Historical Archives */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Review Display (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-6">
            {selectedReview && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Review Header Banner */}
                <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-indigo-50/30">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                          selectedReview.period === "quarterly"
                            ? "bg-purple-100 text-purple-800 border-purple-200"
                            : "bg-blue-100 text-blue-800 border-blue-200"
                        }`}
                      >
                        {selectedReview.period === "quarterly"
                          ? "90-Day Quarterly Review"
                          : "7-Day Weekly Review"}
                      </span>
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(selectedReview.periodStart).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        –{" "}
                        {new Date(selectedReview.periodEnd).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <span className="text-xs text-slate-400">
                      Generated {new Date(selectedReview.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold text-slate-900">
                    {selectedReview.period === "quarterly"
                      ? "Quarterly Executive Retrospective"
                      : "Weekly Synthesis & Calibration"}
                  </h2>
                </div>

                {/* 90-Day / 7-Day Multi-Metric Aggregate Cards */}
                <div className="p-6 sm:p-8 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                    Aggregated Metrics ({selectedReview.stats.daysWindow} Days Window)
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {/* Task Card */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500">Tasks</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        {selectedReview.stats.tasks.completed}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {selectedReview.stats.tasks.completionRate}% of {selectedReview.stats.tasks.total} planned
                      </div>
                    </div>

                    {/* Study Card */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500">Study</span>
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        {Math.round((selectedReview.stats.study.totalMinutes / 60) * 10) / 10}h
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {selectedReview.stats.study.sessionCount} sessions ({selectedReview.stats.study.totalMinutes}m)
                      </div>
                    </div>

                    {/* Habits Card */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500">Habits</span>
                        <Flame className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        {selectedReview.stats.habits.averageAdherence}%
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {selectedReview.stats.habits.totalLogs} check-ins logged
                      </div>
                    </div>

                    {/* Flashcards Retention */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500">Retention</span>
                        <TrendingUp className="w-4 h-4 text-teal-600" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        {selectedReview.stats.study.retentionPct}%
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {selectedReview.stats.study.cardsReviewed} cards reviewed
                      </div>
                    </div>
                  </div>

                  {/* Course & Habit Detailed Progress Rows */}
                  {(selectedReview.stats.study.studyMinutesByCourse.length > 0 ||
                    selectedReview.stats.habits.habitBreakdown.length > 0) && (
                    <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Course Time Breakdown */}
                      {selectedReview.stats.study.studyMinutesByCourse.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                            Study Time by Course
                          </h4>
                          <div className="space-y-2">
                            {selectedReview.stats.study.studyMinutesByCourse.map((c) => (
                              <div
                                key={c.courseId}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-xs font-medium text-slate-700 border border-slate-100"
                              >
                                <span className="font-semibold text-slate-900">
                                  {c.courseCode}: {c.courseTitle}
                                </span>
                                <span className="text-indigo-600 font-bold">
                                  {c.minutes} mins ({c.sessionCount} sessions)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Habit Adherence Breakdown */}
                      {selectedReview.stats.habits.habitBreakdown.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-amber-500" />
                            Habit Consistency
                          </h4>
                          <div className="space-y-2">
                            {selectedReview.stats.habits.habitBreakdown.slice(0, 4).map((h) => (
                              <div key={h.habitId} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium text-slate-700">
                                  <span>{h.title}</span>
                                  <span className="font-semibold text-slate-900">
                                    {h.adherencePct}% ({h.loggedCount}/{h.expectedDays}d)
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      h.adherencePct >= 75
                                        ? "bg-emerald-500"
                                        : h.adherencePct >= 40
                                        ? "bg-indigo-500"
                                        : "bg-amber-500"
                                    }`}
                                    style={{ width: `${h.adherencePct}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* AI-08 Narrative Section */}
                <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      AI-08 High-Level Narrative
                    </h3>
                  </div>

                  <div className="prose prose-sm text-slate-700 leading-relaxed max-w-none bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs font-sans">
                    <p className="whitespace-pre-line text-sm sm:text-base leading-relaxed text-slate-800">
                      {selectedReview.narrative}
                    </p>
                  </div>
                </div>

                {/* Proposed Adjustments Section */}
                <div className="p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-purple-600" />
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Proposed Quarterly Adjustments
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500">
                      {selectedReview.proposedAdjustments.filter((a) => a.applied).length} of{" "}
                      {selectedReview.proposedAdjustments.length} applied
                    </span>
                  </div>

                  {selectedReview.proposedAdjustments.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No adjustments needed for this cycle.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedReview.proposedAdjustments.map((adj) => (
                        <div
                          key={adj.id}
                          className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            adj.applied
                              ? "bg-slate-50 border-slate-200 text-slate-400"
                              : "bg-white border-purple-200/70 hover:border-purple-300 shadow-2xs"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  adj.applied
                                    ? "bg-slate-200 text-slate-600"
                                    : "bg-purple-100 text-purple-800"
                                }`}
                              >
                                {adj.entityType}
                              </span>
                              <span className="font-semibold text-sm text-slate-900">{adj.entityTitle}</span>
                            </div>
                            <p className="text-xs text-slate-600">{adj.description}</p>
                          </div>

                          <button
                            type="button"
                            disabled={adj.applied || isPending || applyingAdjId === adj.id}
                            onClick={() => handleApplyAdjustment(adj.id)}
                            className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              adj.applied
                                ? "bg-emerald-100 text-emerald-700 cursor-default"
                                : "bg-purple-600 hover:bg-purple-700 text-white shadow-2xs"
                            }`}
                          >
                            {adj.applied ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Applied
                              </span>
                            ) : applyingAdjId === adj.id ? (
                              "Applying..."
                            ) : (
                              "Apply Adjustment"
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Review Archives & History Sidebar (4 cols on lg) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Review Archives</h3>
                </div>

                {/* Filter Pills */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                  <button
                    onClick={() => setActiveTab("all")}
                    className={`px-2 py-1 rounded-md transition-all ${
                      activeTab === "all" ? "bg-white text-slate-900 font-semibold shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setActiveTab("quarterly")}
                    className={`px-2 py-1 rounded-md transition-all ${
                      activeTab === "quarterly"
                        ? "bg-white text-purple-900 font-semibold shadow-2xs"
                        : "text-slate-600"
                    }`}
                  >
                    Quarterly
                  </button>
                  <button
                    onClick={() => setActiveTab("weekly")}
                    className={`px-2 py-1 rounded-md transition-all ${
                      activeTab === "weekly"
                        ? "bg-white text-blue-900 font-semibold shadow-2xs"
                        : "text-slate-600"
                    }`}
                  >
                    Weekly
                  </button>
                </div>
              </div>

              {filteredReviews.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No reviews found in this filter.</p>
              ) : (
                <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                  {filteredReviews.map((rev) => {
                    const isSelected = rev.id === selectedReview?.id;
                    return (
                      <button
                        key={rev.id}
                        type="button"
                        onClick={() => setSelectedReviewId(rev.id)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50/80 border-indigo-300 shadow-2xs"
                            : "bg-slate-50 hover:bg-slate-100/80 border-slate-200/80"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              rev.period === "quarterly"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {rev.period}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(rev.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-slate-900 truncate mb-1">
                          {rev.period === "quarterly" ? "Quarterly Review (90d)" : "Weekly Review (7d)"}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span>{rev.stats.tasks.completed} tasks</span>
                          <span>•</span>
                          <span>{Math.round(rev.stats.study.totalMinutes / 60)}h study</span>
                          <span>•</span>
                          <span>{rev.stats.habits.averageAdherence}% habits</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
