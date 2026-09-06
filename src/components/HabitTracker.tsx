"use client";

import { useOptimistic, useTransition, useState, useEffect } from "react";
import type { habits, habitLogs, habitPauses } from "@/server/db/schema";
import { toggleHabitCheckIn, createHabit, pauseHabit, resumeHabit, getActiveHabitPauses } from "@/server/actions/habits";
import {
  Check,
  Plus,
  Flame,
  Sparkles,
  X,
  PauseCircle,
  Play,
  Calendar,
  ShieldCheck,
} from "lucide-react";

export type Habit = typeof habits.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;
export type HabitPause = typeof habitPauses.$inferSelect;

interface HabitTrackerProps {
  habits: Habit[];
  todayLogs: HabitLog[];
  todayDateStr?: string;
  initialPauses?: HabitPause[];
}

const PRESET_COLORS = [
  { name: "Emerald", value: "emerald", bg: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200", activeBg: "bg-emerald-500 text-white" },
  { name: "Indigo", value: "indigo", bg: "bg-indigo-500", text: "text-indigo-700", border: "border-indigo-200", activeBg: "bg-indigo-500 text-white" },
  { name: "Amber", value: "amber", bg: "bg-amber-500", text: "text-amber-700", border: "border-amber-200", activeBg: "bg-amber-500 text-white" },
  { name: "Rose", value: "rose", bg: "bg-rose-500", text: "text-rose-700", border: "border-rose-200", activeBg: "bg-rose-500 text-white" },
  { name: "Sky", value: "sky", bg: "bg-sky-500", text: "text-sky-700", border: "border-sky-200", activeBg: "bg-sky-500 text-white" },
  { name: "Violet", value: "violet", bg: "bg-violet-500", text: "text-violet-700", border: "border-violet-200", activeBg: "bg-violet-500 text-white" },
];

const PRESET_HABITS = [
  { title: "Read 20 pages", colour: "indigo", targetCount: 20, unit: "pages" },
  { title: "Workout", colour: "emerald", targetCount: 1, unit: "session" },
  { title: "Meditate 10 mins", colour: "sky", targetCount: 10, unit: "mins" },
  { title: "Drink 2L Water", colour: "sky", targetCount: 2, unit: "L" },
  { title: "Deep Work block", colour: "amber", targetCount: 1, unit: "session" },
];

export function HabitTracker({ habits: initialHabits, todayLogs, todayDateStr, initialPauses }: HabitTrackerProps) {
  const [, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState("emerald");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pause Habit dialog state
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [selectedHabitId, setSelectedHabitId] = useState("");
  const [pauseStartOn, setPauseStartOn] = useState("");
  const [pauseEndOn, setPauseEndOn] = useState("");
  const [pauseReason, setPauseReason] = useState("");
  const [pauses, setPauses] = useState<HabitPause[]>(initialPauses || []);

  // Compute today's date string if not provided
  const currentDateStr = todayDateStr || new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (initialPauses) {
      setPauses(initialPauses);
    } else {
      getActiveHabitPauses().then(setPauses).catch(console.error);
    }
  }, [initialPauses]);

  const defaultEndOn = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  };

  const handleOpenPauseDialog = (habitId?: string) => {
    const targetId = habitId || (initialHabits.length > 0 ? initialHabits[0].id : "");
    setSelectedHabitId(targetId);
    setPauseStartOn(currentDateStr);
    setPauseEndOn(defaultEndOn());
    setPauseReason("");
    setIsPauseDialogOpen(true);
  };

  const handleSavePause = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHabitId || !pauseStartOn) return;

    setIsSubmitting(true);
    try {
      const res = await pauseHabit({
        habitId: selectedHabitId,
        startOn: pauseStartOn,
        endOn: pauseEndOn || null,
        reason: pauseReason.trim() || null,
      });
      if (res.success && res.pause) {
        setPauses((prev) => [res.pause as HabitPause, ...prev]);
        setIsPauseDialogOpen(false);
      }
    } catch (err) {
      console.error("Failed to pause habit:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumePause = async (pauseId: string) => {
    try {
      const res = await resumeHabit(pauseId);
      if (res.success) {
        setPauses((prev) => prev.filter((p) => p.id !== pauseId));
      }
    } catch (err) {
      console.error("Failed to resume habit:", err);
    }
  };

  // Optimistic list of checked habit IDs
  const [optimisticCheckedIds, setOptimisticCheckedIds] = useOptimistic<string[], string>(
    todayLogs.map((log) => log.habitId),
    (currentCheckedIds, habitIdToToggle) => {
      if (currentCheckedIds.includes(habitIdToToggle)) {
        return currentCheckedIds.filter((id) => id !== habitIdToToggle);
      } else {
        return [...currentCheckedIds, habitIdToToggle];
      }
    }
  );

  const handleToggleHabit = (habitId: string) => {
    startTransition(async () => {
      setOptimisticCheckedIds(habitId);
      await toggleHabitCheckIn(habitId, currentDateStr);
    });
  };

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newTitle.trim();
    if (!cleanTitle || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createHabit({
        title: cleanTitle,
        colour: newColor,
        cadence: "daily",
        targetCount: 1,
        active: true,
      });
      setNewTitle("");
      setIsCreating(false);
    } catch (err) {
      console.error("Failed to create habit:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAdd = async (preset: typeof PRESET_HABITS[0]) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createHabit({
        title: preset.title,
        colour: preset.colour,
        targetCount: preset.targetCount,
        unit: preset.unit,
        cadence: "daily",
        active: true,
      });
      setIsCreating(false);
    } catch (err) {
      console.error("Failed to quick add habit:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isHabitPausedToday = (habitId: string) => {
    return pauses.some(
      (p) =>
        p.habitId === habitId &&
        p.startOn <= currentDateStr &&
        (!p.endOn || p.endOn >= currentDateStr)
    );
  };

  const completedCount = optimisticCheckedIds.length;
  const totalCount = initialHabits.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <section id="habits" className="space-y-3.5 scroll-mt-6">
      {/* Header & Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            Habits & Daily Streaks
          </h2>
          {totalCount > 0 && (
            <span className="text-xs font-medium text-slate-400">
              ({completedCount}/{totalCount})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {initialHabits.length > 0 && (
            <button
              type="button"
              onClick={() => handleOpenPauseDialog()}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Pause habit check-ins without breaking streak"
            >
              <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Pause Habit</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            {isCreating ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>New Habit</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      )}

      {/* Pause Habit Modal Dialog */}
      {isPauseDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <PauseCircle className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Pause Habit (Freeze Streak)</h3>
                  <p className="text-[11px] text-slate-500">
                    Suspends streak requirements during exams, illness, or travel.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPauseDialogOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePause} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Habit
                </label>
                <select
                  value={selectedHabitId}
                  onChange={(e) => setSelectedHabitId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {initialHabits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={pauseStartOn}
                    onChange={(e) => setPauseStartOn(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={pauseEndOn}
                    onChange={(e) => setPauseEndOn(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason / Context
                </label>
                <input
                  type="text"
                  placeholder="e.g. Exam revision week, Flu recovery, Vacation..."
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPauseDialogOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedHabitId || !pauseStartOn || isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Confirm Pause
                </button>
              </div>
            </form>

            {/* Currently Active Pauses */}
            {pauses.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Active / Scheduled Pauses ({pauses.length})
                </h4>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {pauses.map((p) => {
                    const habitTitle =
                      initialHabits.find((h) => h.id === p.habitId)?.title || "Habit";
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 border border-amber-200/60 text-xs"
                      >
                        <div className="space-y-0.5">
                          <p className="font-medium text-amber-900">{habitTitle}</p>
                          <p className="text-[11px] text-amber-700 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {p.startOn} {p.endOn ? `to ${p.endOn}` : "(indefinite)"}
                            {p.reason && ` · ${p.reason}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleResumePause(p.id)}
                          className="px-2 py-1 text-[11px] font-medium text-amber-800 hover:text-white bg-amber-200/70 hover:bg-amber-600 rounded-md transition-colors cursor-pointer"
                          title="Resume this habit now"
                        >
                          Resume
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Habit Creation Tray */}
      {isCreating && (
        <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-3 animate-in fade-in zoom-in-98 duration-150 shadow-xs">
          <form onSubmit={handleCreateHabit} className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Habit title (e.g. 'Read 20 pages', 'Morning stretch')..."
              autoFocus
              className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />

            {/* Color select pills */}
            <div className="flex items-center gap-1.5 px-2 bg-white border border-slate-200 rounded-lg">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setNewColor(c.value)}
                  className={`w-4 h-4 rounded-full ${c.bg} transition-transform ${
                    newColor === c.value ? "scale-125 ring-2 ring-slate-900" : "opacity-60 hover:opacity-100"
                  }`}
                  title={c.name}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={!newTitle.trim() || isSubmitting}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Add
            </button>
          </form>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Quick presets:
            </span>
            {PRESET_HABITS.map((preset) => (
              <button
                key={preset.title}
                type="button"
                onClick={() => handleQuickAdd(preset)}
                className="text-xs px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
              >
                + {preset.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Habit Chips Row */}
      {initialHabits.length > 0 ? (
        <div className="flex flex-wrap gap-2.5">
          {initialHabits.map((habit) => {
            const isChecked = optimisticCheckedIds.includes(habit.id);
            const isPaused = isHabitPausedToday(habit.id);
            const colorMeta =
              PRESET_COLORS.find((c) => c.value === habit.colour) || PRESET_COLORS[0];

            return (
              <div key={habit.id} className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleToggleHabit(habit.id)}
                  className={`group relative inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all duration-150 select-none cursor-pointer shadow-xs ${
                    isChecked
                      ? `${colorMeta.activeBg} border-transparent shadow-emerald-500/10 scale-[0.99]`
                      : isPaused
                      ? "bg-amber-50/70 text-amber-900 border-amber-300 hover:bg-amber-100/80"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                  }`}
                  title={isChecked ? "Click to uncheck" : isPaused ? "Habit is currently paused (streak safe)" : "Click to check-in for today"}
                >
                  {/* Circular checkbox indicator */}
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                      isChecked
                        ? "bg-white/30 text-white"
                        : "border border-slate-300 group-hover:border-slate-400 bg-white"
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>

                  {/* Habit Title & Target */}
                  <span className={isChecked ? "line-through opacity-90 font-medium" : "font-medium"}>
                    {habit.title}
                  </span>

                  {isPaused && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-200/80 text-amber-800 font-medium">
                      <ShieldCheck className="w-3 h-3 text-amber-600" />
                      Paused
                    </span>
                  )}

                  {habit.unit && habit.targetCount && habit.targetCount > 1 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                        isChecked ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {habit.targetCount} {habit.unit}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

      ) : (
        <div className="border border-dashed border-slate-200 rounded-xl p-5 text-center bg-slate-50/30 flex flex-col items-center justify-center gap-1.5">
          <Flame className="w-5 h-5 text-slate-300" />
          <p className="text-xs font-medium text-slate-500">No habits tracked yet.</p>
          <p className="text-[11px] text-slate-400">
            Click &quot;New Habit&quot; above to set up daily streaks like &quot;Read 20 pages&quot;.
          </p>
        </div>
      )}
    </section>
  );
}

export default HabitTracker;
