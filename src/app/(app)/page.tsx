import { db } from "@/server/db";
import { tasks, users } from "@/server/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { createTask } from "@/server/actions/tasks";
import TaskList from "@/components/TaskList";

export default async function Today() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // --- NEW: Sync auth user to our public.users table ---
  const existingUser = await db.select().from(users).where(eq(users.id, user.id));
  if (existingUser.length === 0) {
    await db.insert(users).values({
      id: user.id,
      email: user.email!,
    });
  }
  // -----------------------------------------------------

  // Fetch tasks for the current user ordered by sortKey
  const userTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .orderBy(asc(tasks.sortKey), desc(tasks.createdAt));

  const pendingTasks = userTasks.filter((t) => t.status !== "done");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Today</h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          {pendingTasks.length} tasks · 0 h blocked
        </p>
      </header>

      {/* Quick Capture Form */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
        <form action={createTask} className="flex gap-4">
          <input
            type="text"
            name="title"
            placeholder="What needs to be done?"
            required
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow text-slate-900"
          />
          <button
            type="submit"
            className="bg-slate-900 text-white font-medium rounded-lg px-6 py-2 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors"
          >
            Add Task
          </button>
        </form>
      </section>

      {/* Task List */}
      <section>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Your Tasks</h2>
        <TaskList tasks={pendingTasks} />
      </section>
    </div>
  );
}