import { addDays, differenceInDays, format, isPast, isToday, parseISO, subDays } from 'date-fns';
import { generateKeyBetween } from 'fractional-indexing';
import { RRule } from 'rrule';
import { getAll, type Habit, type HabitLog, type HabitPause, type Task } from './db';
import { createEntity, deleteEntity, updateEntity } from './sync';

// Business rules ported from the web app so both clients behave identically.

export const dayKey = (d: Date = new Date()) => format(d, 'yyyy-MM-dd');

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/** Port of src/lib/scoring.ts calculateTaskScore */
export function calculateTaskScore(task: Task): number {
  let score = (task.priority ?? 0) * 10;
  if (task.dueAt) {
    const due = new Date(task.dueAt);
    if (isToday(due)) score += 20;
    else if (isPast(due)) score += 30;
  }
  if (task.createdAt) {
    const daysOld = differenceInDays(new Date(), new Date(task.createdAt));
    if (daysOld > 0) score -= Math.min(daysOld, 15);
  }
  return score;
}

export const isOpen = (t: Task) => t.status !== 'done' && t.status !== 'cancelled';

export function bySortKey(a: Task, b: Task) {
  const ka = a.sortKey ?? '';
  const kb = b.sortKey ?? '';
  if (ka && kb && ka !== kb) return ka < kb ? -1 : 1;
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
}

function topSortKey(): string {
  const keys = getAll('tasks')
    .map((t) => t.sortKey)
    .filter((k): k is string => !!k)
    .sort();
  try {
    return generateKeyBetween(null, keys[0] ?? null);
  } catch {
    return generateKeyBetween(null, null);
  }
}

export function createTask(input: Partial<Task> & { title: string }): Task {
  return createEntity('tasks', {
    status: 'next',
    priority: 0,
    sortKey: topSortKey(),
    ...input,
    title: input.title.trim(),
  });
}

export function updateTask(id: string, patch: Partial<Task>) {
  updateEntity('tasks', id, patch);
}

/** Port of toggleTaskStatus: completing a recurring task spawns its next instance. */
export function toggleTask(task: Task) {
  const completing = task.status !== 'done';
  if (completing && task.rrule) {
    const hasChild = getAll('tasks').some((t) => t.recurrenceParentId === task.id && t.rrule === task.rrule);
    if (!hasChild) {
      try {
        const rule = RRule.fromString(task.rrule);
        const next = rule.after(task.dueAt ? new Date(task.dueAt) : new Date());
        if (next) {
          createTask({
            title: task.title,
            notes: task.notes,
            priority: task.priority,
            energy: task.energy,
            rrule: task.rrule,
            dueAt: next.toISOString(),
            status: 'next',
            recurrenceParentId: task.id,
          });
        }
      } catch (err) {
        console.warn('Failed to spawn next recurrence', err);
      }
    }
  }
  updateEntity('tasks', task.id, { status: completing ? 'done' : 'next' });
}

export function deleteTask(id: string) {
  // Web deleteTask cascades to subtasks
  getAll('tasks')
    .filter((t) => t.parentTaskId === id)
    .forEach((t) => deleteEntity('tasks', t.id));
  deleteEntity('tasks', id);
}

export const RECURRENCE_PRESETS: { label: string; rrule: string | null }[] = [
  { label: 'None', rrule: null },
  { label: 'Daily', rrule: 'FREQ=DAILY' },
  { label: 'Weekdays', rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Weekly', rrule: 'FREQ=WEEKLY' },
  { label: 'Monthly', rrule: 'FREQ=MONTHLY' },
];

export function describeRrule(rrule: string | null | undefined): string | null {
  if (!rrule) return null;
  const preset = RECURRENCE_PRESETS.find((p) => p.rrule === rrule);
  if (preset) return preset.label;
  try {
    return RRule.fromString(rrule).toText();
  } catch {
    return 'Repeats';
  }
}

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

export function toggleHabitCheckIn(habitId: string, dateStr: string) {
  const existing = getAll('habit_logs').find((l) => l.habitId === habitId && l.loggedOn === dateStr);
  if (existing) {
    deleteEntity('habit_logs', existing.id, { habitId, loggedOn: dateStr });
    return false;
  }
  createEntity('habit_logs', {
    habitId,
    loggedOn: dateStr,
    value: '1',
    backfilled: dateStr < dayKey(),
  });
  return true;
}

export interface StreakInfo {
  currentStreak: number;
  bestStreak: number;
  isPaused: boolean;
}

/** Port of calculateHabitStreak (src/server/actions/habits.ts) */
export function calculateStreak(habitId: string, logs: HabitLog[], pauses: HabitPause[]): StreakInfo {
  const todayStr = dayKey();
  const habitPauses = pauses.filter((p) => p.habitId === habitId);
  const inPause = (d: string) => habitPauses.some((p) => p.startOn <= d && (!p.endOn || p.endOn >= d));
  const logged = new Set(logs.filter((l) => l.habitId === habitId).map((l) => l.loggedOn));

  let current = 0;
  let check = parseISO(todayStr);
  if (logged.has(todayStr)) current++;
  check = subDays(check, 1);

  for (let i = 0; i < 365; i++) {
    const d = format(check, 'yyyy-MM-dd');
    if (logged.has(d)) current++;
    else if (!inPause(d)) break;
    check = subDays(check, 1);
  }

  let best = current;
  if (logged.size > 0) {
    let running = 0;
    let iter = parseISO([...logged].sort()[0]);
    const end = parseISO(todayStr);
    while (iter <= end) {
      const d = format(iter, 'yyyy-MM-dd');
      if (logged.has(d)) best = Math.max(best, ++running);
      else if (!inPause(d)) running = 0;
      iter = addDays(iter, 1);
    }
  }

  return { currentStreak: current, bestStreak: best, isPaused: inPause(todayStr) };
}

export function createHabit(input: Partial<Habit> & { title: string }) {
  return createEntity('habits', {
    cadence: 'daily',
    targetCount: 1,
    gracePerWeek: 0,
    active: true,
    ...input,
    title: input.title.trim(),
  });
}

export function pauseHabit(habitId: string) {
  createEntity('habit_pauses', { habitId, startOn: dayKey(), endOn: null });
}

export function resumeHabit(habitId: string) {
  const today = dayKey();
  getAll('habit_pauses')
    .filter((p) => p.habitId === habitId && p.startOn <= today && (!p.endOn || p.endOn >= today))
    .forEach((p) => deleteEntity('habit_pauses', p.id));
}
