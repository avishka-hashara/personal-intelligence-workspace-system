import { db } from "@/server/db";
import { tasks, users } from "@/server/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import TodayView from "@/components/TodayView";

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
  const allTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .orderBy(asc(tasks.sortKey), desc(tasks.createdAt));

  return <TodayView initialTasks={allTasks} />;
}