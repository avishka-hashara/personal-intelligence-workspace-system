import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { createTask } from "@/server/actions/tasks";
import TaskList from "@/components/TaskList";

export default async function TasksPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch all tasks for the user ordered by sortKey
    const allTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.userId, user.id))
        .orderBy(asc(tasks.sortKey), desc(tasks.createdAt));

    const pendingTasks = allTasks.filter(t => t.status !== "done");
    const completedTasks = allTasks.filter(t => t.status === "done");

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">All Tasks</h1>
                <p className="text-slate-500 mt-2 text-sm font-medium">
                    {pendingTasks.length} pending · {completedTasks.length} completed
                </p>
            </header>

            {/* Capture Bar */}
            <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                <form action={createTask} className="flex gap-4">
                    <input
                        type="text"
                        name="title"
                        placeholder="Add a new task..."
                        required
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition-shadow text-slate-900"
                    />
                    <button
                        type="submit"
                        className="bg-slate-900 text-white font-medium rounded-lg px-6 py-2 hover:bg-slate-800 transition-colors"
                    >
                        Add Task
                    </button>
                </form>
            </section>

            {/* Pending Tasks */}
            <section>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Pending</h2>
                <TaskList tasks={pendingTasks} />
            </section>

            {/* Completed Tasks */}
            <section>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Completed</h2>
                <TaskList isCompletedList={true} tasks={completedTasks} />
            </section>
        </div>
    );
}