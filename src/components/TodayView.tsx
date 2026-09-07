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
  Calendar,
  CheckCircle2,
  Square,
  ArrowUpRight,
  Play,
  GraduationCap,
  ArrowRight,
} from "lucide-react";
import { HabitTracker, type Habit, type HabitLog, type HabitPause } from "@/components/HabitTracker";
import { NudgeBanner, type NudgeData } from "@/components/NudgeBanner";
import { OnboardingPrompts } from "@/components/OnboardingPrompts";

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
  initialHabitPauses?: HabitPause[];
  initialUpcomingExams?: UpcomingExamItem[];
  initialNudge?: NudgeData | null;
  todayDateStr?: string;
  showOnboardingPrompts?: boolean;
  userName?: string | null;
}

export function TodayView({
  initialTasks,
  initialHabits = [],
  initialTodayLogs = [],
  initialHabitPauses = [],
  initialUpcomingExams = [],
  initialNudge = null,
  todayDateStr,
  showOnboardingPrompts = false,
  userName = null,
}: TodayViewProps) {
  const { tasks, isInitialized, initTasks, addTask, toggleTask } = useTaskStore();
  const { setSelectedTaskId, setActiveFocusTask, setTimerOpen, setTimerStatus, startTimer } = useUIStore();
  const [title, setTitle] = useState("");

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [timeZoneLabel, setTimeZoneLabel] = useState<string>("");

  useEffect(() => {
    initTasks(initialTasks);
  }, [initialTasks, initTasks]);

  useEffect(() => {
    setCurrentTime(new Date());
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offsetMinutes = -new Date().getTimezoneOffset();
      const sign = offsetMinutes >= 0 ? "+" : "-";
      const hours = Math.floor(Math.abs(offsetMinutes) / 60);
      const mins = Math.abs(offsetMinutes) % 60;
      const offsetStr = `GMT${sign}${hours}${mins > 0 ? `:${mins.toString().padStart(2, "0")}` : ""}`;
      const city = tz.split("/").pop()?.replace(/_/g, " ") || tz;
      setTimeZoneLabel(`${city} (${offsetStr})`);
    } catch {
      setTimeZoneLabel("Local Time");
    }

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

      {/* First-Run Onboarding Prompts */}
      {showOnboardingPrompts && <OnboardingPrompts userName={userName} />}

      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Today</h1>
          <p className="text-zinc-500 mt-1 text-sm font-normal">
            {pendingTasks.length} pending · {nowTask ? "1 focus task active" : "All caught up"}
          </p>
        </div>

        {/* Live Bento Clock & Date Card */}
        <div className="flex items-center gap-3.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-subtle self-start sm:self-auto">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200/50 dark:border-zinc-700/50 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0">
            <Clock className="w-4 h-4" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base sm:text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums leading-tight">
                {currentTime ? format(currentTime, "hh:mm:ss a") : "--:--:-- --"}
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                LIVE
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">
              <Calendar className="w-3 h-3 text-zinc-400 shrink-0" />
              <span>
                {currentTime
                  ? format(currentTime, "EEEE, MMMM d, yyyy")
                  : todayDateStr || "Loading date..."}
              </span>
              {timeZoneLabel && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] truncate max-w-[130px]" title={timeZoneLabel}>
                    {timeZoneLabel}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Instant Quick Capture Form */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/60 rounded-2xl p-2.5 shadow-subtle">
        <form onSubmit={handleCreateTask} className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done? (e.g. 'Review PR tomorrow 10am')"
            required
            className="flex-1 px-3.5 py-2 text-sm bg-transparent border-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium text-xs rounded-xl px-4 py-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all duration-150 shadow-subtle disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed active:scale-[0.985]"
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
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              NOW
            </h2>
            {nowTask && (
              <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                Score: {calculateTaskScore(nowTask)}
              </span>
            )}
          </div>

          {nowTask ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-subtle hover:shadow-float flex items-center justify-between gap-4 transition-all duration-200">
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleTask(nowTask.id)}
                  className="w-6 h-6 rounded-full border-2 border-zinc-300 dark:border-zinc-600 hover:border-zinc-900 dark:hover:border-zinc-200 flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer active:scale-90 group/btn"
                  aria-label="Mark task complete"
                >
                  <span className="w-3 h-3 rounded-full bg-zinc-900 dark:bg-zinc-100 opacity-0 group-hover/btn:opacity-20 transition-opacity" />
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(nowTask.id)}
                    className="text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100 text-left hover:underline truncate block cursor-pointer"
                  >
                    {nowTask.title}
                  </button>
                  {nowTask.dueAt && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-normal text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        {isToday(new Date(nowTask.dueAt)) ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Due Today</span>
                        ) : isPast(new Date(nowTask.dueAt)) ? (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">Overdue</span>
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
                    startTimer(nowTask.id, nowTask.title);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white text-xs font-medium rounded-xl shadow-subtle transition-all cursor-pointer active:scale-[0.985]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start focus</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(nowTask.id)}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Details</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center bg-zinc-50/30 dark:bg-zinc-900/20 flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">You&apos;re all caught up.</p>
              <p className="text-xs text-zinc-400">Capture a new task above to get started.</p>
            </div>
          )}
        </section>

        {/* NEXT UP Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
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
        initialPauses={initialHabitPauses}
      />

      {/* Study Due / Upcoming Exams Section */}
      {initialUpcomingExams && initialUpcomingExams.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
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
                  className="group bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-4 shadow-subtle hover:shadow-float transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/70 dark:border-zinc-700/60">
                        {exam.courseCode}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                        Ramp-up active
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                      {exam.title} in {daysLeft === 0 ? "Today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                    </h3>

                    <p className="text-xs text-zinc-400 mt-0.5">
                      {format(examDate, "MMM d, yyyy 'at' p")}
                      {exam.weight && ` · ${exam.weight}% weight`}
                    </p>
                  </div>

                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-all shrink-0" />
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
