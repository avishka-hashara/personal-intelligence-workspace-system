"use client";

import { useEffect, useState, useMemo } from "react";
import { useTaskStore, type Task } from "@/store/taskStore";
import { useUIStore } from "@/store/uiStore";
import { TaskList } from "@/components/TaskList";
import { TaskDrawer } from "@/components/TaskDrawer";
import { calculateTaskScore } from "@/lib/scoring";
import { isToday, isPast, differenceInCalendarDays, format } from "date-fns";
import Link from "next/link";
import {
  Zap,
  Clock,
  CheckCircle2,
  Square,
  ArrowUpRight,
  Play,
  GraduationCap,
  ArrowRight,
} from "lucide-react";
import { HabitTracker, type Habit, type HabitLog } from "@/components/HabitTracker";
import { NudgeBanner, type NudgeData } from "@/components/NudgeBanner";

export interface UpcomingExamItem {
  id: string;
  title: string;
  startsAt: Date | string | null;
  venue?: string | null;
  weight?: string | null;
  rampDays?: number | null;
  courseId: string;
  courseCode: string;
  courseTitle: string;
}

interface TodayViewProps {
  initialTasks: Task[];
  initialNowTask?: Task | null;
  initialNextUpTasks?: Task[];
  initialHabits?: Habit[];
  initialTodayLogs?: HabitLog[];
  initialUpcomingExams?: UpcomingExamItem[];
  initialNudge?: NudgeData | null;
  todayDateStr?: string;
}

export function TodayView({
  initialTasks,
  initialHabits = [],
  initialTodayLogs = [],
  initialUpcomingExams = [],
  initialNudge = null,
  todayDateStr,
}: TodayViewProps) {
  const { tasks, isInitialized, initTasks, addTask, toggleTask } = useTaskStore();
  const { setSelectedTaskId, setActiveFocusTask, setTimerOpen, setTimerStatus } = useUIStore();
  const [title, setTitle] = useState("");

  useEffect(() => {
    initTasks(initialTasks);
  }, [initialTasks, initTasks]);

  const activeTasks = isInitialized ? tasks : initialTasks;
  const pendingTasks = activeTasks.filter((t) => t.status !== "done" && !t.parentTaskId);

  // Sort pending tasks by deterministic priority score in descending order
  const sortedTasks = useMemo(() => {
    return [...pendingTasks].sort((a, b) => {
      const scoreA = calculateTaskScore(a);
      const scoreB = calculateTaskScore(b);
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      // Tie-breaker: sortKey or createdAt
      const keyA = a.sortKey ?? "";
      const keyB = b.sortKey ?? "";
      if (keyA && keyB) return keyA.localeCompare(keyB);
      return (
        (b.createdAt ? new Date(b.createdAt).getTime() : 0) -
        (a.createdAt ? new Date(a.createdAt).getTime() : 0)
      );
    });
  }, [pendingTasks]);

  const nowTask = sortedTasks[0] ?? null;
  const nextUpTasks = sortedTasks.slice(1, 6);

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setTitle("");
    await addTask({ title: trimmed });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* AI-10 Coaching Nudge Banner at the very top */}
      {initialNudge && <NudgeBanner nudge={initialNudge} />}

      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Today</h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          {pendingTasks.length} pending · {nowTask ? "1 focus task active" : "All caught up"}
        </p>
      </header>

      {/* Instant Quick Capture Form */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
        <form onSubmit={handleCreateTask} className="flex gap-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done? (e.g. 'Review PR tomorrow 10am')"
            required
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow text-slate-900 bg-white"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="bg-slate-900 text-white font-medium rounded-lg px-6 py-2 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            Add Task
          </button>
        </form>
      </section>

      {/* Now / Next Stack */}
      <div className="flex flex-col gap-8">
        {/* NOW Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              NOW
            </h2>
            {nowTask && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Score: {calculateTaskScore(nowTask)}
              </span>
            )}
          </div>

          {nowTask ? (
            <div className="border-2 border-slate-900 bg-gradient-to-br from-white to-slate-50/50 rounded-xl p-5 shadow-sm flex items-center justify-between gap-4 transition-all hover:shadow-md">
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleTask(nowTask.id)}
                  className="text-slate-400 hover:text-slate-900 transition-colors p-1 rounded-md hover:bg-slate-100 shrink-0 cursor-pointer"
                  aria-label="Mark task complete"
                >
                  <Square className="w-6 h-6 text-slate-800 hover:text-slate-950" />
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(nowTask.id)}
                    className="text-base sm:text-lg font-semibold text-slate-900 text-left hover:underline truncate block cursor-pointer"
                  >
                    {nowTask.title}
                  </button>
                  {nowTask.dueAt && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {isToday(new Date(nowTask.dueAt)) ? (
                          <span className="text-emerald-600 font-semibold">Due Today</span>
                        ) : isPast(new Date(nowTask.dueAt)) ? (
                          <span className="text-rose-600 font-semibold">Overdue</span>
                        ) : (
                          `Due ${new Date(nowTask.dueAt).toLocaleDateString()}`
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveFocusTask(nowTask.id);
                    setTimerOpen(true);
                    setTimerStatus("running");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all hover:shadow cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start focus</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(nowTask.id)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Details</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-700">You&apos;re all caught up.</p>
              <p className="text-xs text-slate-400">Capture a new task above to get started.</p>
            </div>
          )}
        </section>

        {/* NEXT UP Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              NEXT UP ({nextUpTasks.length})
            </h2>
          </div>
          <TaskList tasks={nextUpTasks} />
        </section>
      </div>

      {/* Habits & Streaks Section */}
      <HabitTracker
        habits={initialHabits}
        todayLogs={initialTodayLogs}
        todayDateStr={todayDateStr}
      />

      {/* Study Due / Upcoming Exams Section */}
      {initialUpcomingExams && initialUpcomingExams.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
              STUDY DUE & UPCOMING EXAMS ({initialUpcomingExams.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {initialUpcomingExams.map((exam) => {
              const examDate = exam.startsAt ? new Date(exam.startsAt) : new Date();
              const daysLeft = differenceInCalendarDays(examDate, new Date());

              return (
                <Link
                  key={exam.id}
                  href={`/study/courses/${exam.courseId}`}
                  className="group bg-white border border-amber-200/90 hover:border-amber-300 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {exam.courseCode}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                        <Zap className="w-3 h-3 text-amber-600 fill-amber-600" />
                        Ramp-up active
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      🚨 {exam.title} in {daysLeft === 0 ? "Today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                    </h3>

                    <p className="text-xs text-slate-500 mt-0.5">
                      {format(examDate, "MMM d, yyyy 'at' p")}
                      {exam.weight && ` · ${exam.weight}% weight`}
                    </p>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <TaskDrawer />
    </div>
  );
}

export default TodayView;
