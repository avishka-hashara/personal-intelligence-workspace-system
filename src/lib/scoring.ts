import { differenceInDays, isToday, isPast } from "date-fns";

export interface TaskScoreInput {
  priority?: number | null;
  dueAt?: Date | string | null;
  createdAt?: Date | string | null;
  [key: string]: any;
}

/**
 * Calculates a deterministic priority score for a task based on:
 * - Priority level (10 points per level)
 * - Due date urgency (+30 for overdue, +20 for due today)
 * - Staleness penalty (-1 point per day old, capped at -15)
 */
export function calculateTaskScore(task: TaskScoreInput): number {
  if (!task) return 0;

  // 1. Base Priority: (priority || 0) * 10
  let score = (task.priority ?? 0) * 10;

  // 2. Due Date Modifier: +30 for overdue, +20 for due today
  if (task.dueAt) {
    const due = new Date(task.dueAt);
    if (isToday(due)) {
      score += 20;
    } else if (isPast(due)) {
      score += 30;
    }
  }

  // 3. Staleness penalty: -1 for every day since createdAt (capped at -15)
  if (task.createdAt) {
    const created = new Date(task.createdAt);
    const daysOld = differenceInDays(new Date(), created);
    if (daysOld > 0) {
      const penalty = Math.min(daysOld, 15);
      score -= penalty;
    }
  }

  return score;
}
