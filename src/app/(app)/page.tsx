import { db } from "@/server/db";
import { tasks, users } from "@/server/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import TodayView from "@/components/TodayView";
import { calculateTaskScore } from "@/lib/scoring";
import { TaskList } from "@/components/TaskList";

export default async function Today() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Ensure user row exists with non-blocking onConflictDoNothing
  await db
    .insert(users)
    .values({
      id: user.id,
      email: user.email!,
    })
    .onConflictDoNothing();

  // Fetch all tasks for the current user ordered by sortKey
  const userTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .orderBy(asc(tasks.sortKey), desc(tasks.createdAt));

  // Filter pending tasks and sort by deterministic score descending
  const pendingTasks = userTasks.filter((t) => t.status !== "done" && !t.parentTaskId);
  const sortedTasks = [...pendingTasks].sort((a, b) => calculateTaskScore(b) - calculateTaskScore(a));

  const nowTask = sortedTasks[0] ?? null;
  const nextUpTasks = sortedTasks.slice(1, 6);

  return <TodayView initialTasks={userTasks} initialNowTask={nowTask} initialNextUpTasks={nextUpTasks} />;
}