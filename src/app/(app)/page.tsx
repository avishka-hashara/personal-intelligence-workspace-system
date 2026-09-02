import { db } from "@/server/db";
import { tasks, users, habits, habitLogs, exams, courses, goals } from "@/server/db/schema";
import { eq, and, isNull, asc, desc, gt } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import TodayView from "@/components/TodayView";
import { calculateTaskScore } from "@/lib/scoring";
import { differenceInCalendarDays } from "date-fns";

import { getTodayNudge, checkAndTriggerNudge } from "@/server/actions/coaching";

export default async function Today() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Run user upsert and all reads concurrently to avoid blocking the critical path
  const userUpsertPromise = db
    .insert(users)
    .values({
      id: user.id,
      email: user.email!,
    })
    .onConflictDoNothing()
    .catch((err) => console.warn("User upsert error:", err));

  const [
    userProfile,
    activeGoals,
    activeCoursesList,
    userTasks,
    userHabits,
    userTodayLogs,
    userExams,
    todayNudgeResult,
  ] = await Promise.all([
    // 0. Fetch user profile for onboarding state and greeting
    db
      .select({
        displayName: users.displayName,
        onboardingState: users.onboardingState,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .then((rows) => rows[0]),

    // Check count of active goals
    db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.userId, user.id), isNull(goals.deletedAt)))
      .limit(1),

    // Check count of active courses
    db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.userId, user.id), eq(courses.active, true), isNull(courses.deletedAt)))
      .limit(1),

    // 1. Fetch all tasks for the current user ordered by sortKey
    db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, user.id))
      .orderBy(asc(tasks.sortKey), desc(tasks.createdAt)),

    // 2. Fetch all active habits for the user
    db
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.userId, user.id),
          eq(habits.active, true),
          isNull(habits.deletedAt)
        )
      )
      .orderBy(asc(habits.createdAt)),

    // 3. Fetch habit logs for today
    db
      .select()
      .from(habitLogs)
      .where(
        and(
          eq(habitLogs.userId, user.id),
          eq(habitLogs.loggedOn, todayStr),
          isNull(habitLogs.deletedAt)
        )
      ),

    // 4. Fetch upcoming exams approaching within their ramp-up window
    db
      .select({
        id: exams.id,
        title: exams.title,
        startsAt: exams.startsAt,
        venue: exams.venue,
        weight: exams.weight,
        rampDays: exams.rampDays,
        courseId: exams.courseId,
        courseCode: courses.code,
        courseTitle: courses.title,
      })
      .from(exams)
      .innerJoin(courses, eq(exams.courseId, courses.id))
      .where(
        and(
          eq(exams.userId, user.id),
          gt(exams.startsAt, now),
          isNull(exams.deletedAt),
          isNull(courses.deletedAt)
        )
      )
      .orderBy(asc(exams.startsAt)),

    // 5. Fetch or Trigger AI-10 Coaching Nudge for Today
    getTodayNudge().catch(() => null),
    userUpsertPromise,
  ]);

  let todayNudge = todayNudgeResult;
  if (!todayNudge) {
    try {
      todayNudge = await checkAndTriggerNudge();
    } catch (e) {
      console.warn("Failed to evaluate AI-10 coaching nudge triggers:", e);
    }
  }

  const upcomingExams = userExams.filter((exam) => {
    if (!exam.startsAt) return false;
    const examDate = new Date(exam.startsAt);
    const daysUntil = differenceInCalendarDays(examDate, now);
    const ramp = exam.rampDays || 14;
    return daysUntil >= 0 && daysUntil <= ramp;
  });

  // Filter pending tasks and sort by deterministic score descending
  const pendingTasks = userTasks.filter((t) => t.status !== "done" && !t.parentTaskId);
  const sortedTasks = [...pendingTasks].sort((a, b) => calculateTaskScore(b) - calculateTaskScore(a));

  const nowTask = sortedTasks[0] ?? null;
  const nextUpTasks = sortedTasks.slice(1, 6);

  const onboardingState = (userProfile?.onboardingState as Record<string, any>) || {};
  const isFirstRun =
    pendingTasks.length === 0 &&
    activeGoals.length === 0 &&
    activeCoursesList.length === 0 &&
    !onboardingState.skipped_prompts &&
    !onboardingState.completed_prompts;

  return (
    <TodayView
      initialTasks={userTasks}
      initialNowTask={nowTask}
      initialNextUpTasks={nextUpTasks}
      initialHabits={userHabits}
      initialTodayLogs={userTodayLogs}
      initialUpcomingExams={upcomingExams}
      initialNudge={todayNudge}
      todayDateStr={todayStr}
      showOnboardingPrompts={isFirstRun}
      userName={userProfile?.displayName}
    />
  );
}