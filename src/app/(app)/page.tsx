import { db } from "@/server/db";
import { tasks, users } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { createTask } from "@/server/actions/tasks";
import { CheckSquare } from "lucide-react";

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

  // Fetch tasks for the current user, newest first
  const userTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .orderBy(desc(tasks.createdAt));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Today</h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          {userTasks.length} tasks · 0 h blocked
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

        {userTasks.length === 0 ? (
          <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-500 text-sm">
            Your task list is empty. Add a task above to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {userTasks.map((task) => (
              <div
                key={task.id}
                className="h-14 border border-slate-200 rounded-lg bg-white flex items-center px-4 hover:border-slate-300 transition-colors cursor-pointer"
              >
                <div className="w-5 h-5 border-2 border-slate-300 rounded mr-4 flex items-center justify-center text-transparent hover:text-slate-400 hover:border-slate-400 transition-colors">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <span className="text-slate-700 font-medium">{task.title}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}