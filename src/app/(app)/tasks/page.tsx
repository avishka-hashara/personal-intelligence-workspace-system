import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import TasksView from "@/components/TasksView";

export default async function TasksPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch all tasks for the user ordered by sortKey
    const allTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.userId, user.id))
        .orderBy(asc(tasks.sortKey), desc(tasks.createdAt));

    return <TasksView initialTasks={allTasks} />;
}