import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { toggleTaskStatus, deleteTask, createTask } from "@/server/actions/tasks";
import { CheckSquare, Square, Trash2 } from "lucide-react";

export default async function TasksPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch all tasks for the user
    const allTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.userId, user.id))
        .orderBy(desc(tasks.createdAt));

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
                <div className="space-y-3">
                    {pendingTasks.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">No pending tasks.</p>
                    ) : (
                        pendingTasks.map((task) => (
                            <div key={task.id} className="group h-14 border border-slate-200 rounded-lg bg-white flex items-center justify-between px-4 hover:border-slate-300 transition-colors">
                                <div className="flex items-center flex-1">
                                    <form action={toggleTaskStatus.bind(null, task.id, task.status)}>
                                        <button type="submit" className="text-slate-300 hover:text-slate-600 mr-4 mt-1 transition-colors">
                                            <Square className="w-5 h-5" />
                                        </button>
                                    </form>
                                    <span className="text-slate-700 font-medium">{task.title}</span>
                                </div>
                                <form action={deleteTask.bind(null, task.id)}>
                                    <button type="submit" className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Completed Tasks */}
            <section>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Completed</h2>
                <div className="space-y-3">
                    {completedTasks.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">No completed tasks yet.</p>
                    ) : (
                        completedTasks.map((task) => (
                            <div key={task.id} className="group h-14 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between px-4">
                                <div className="flex items-center flex-1 opacity-60">
                                    <form action={toggleTaskStatus.bind(null, task.id, task.status)}>
                                        <button type="submit" className="text-slate-900 mr-4 mt-1">
                                            <CheckSquare className="w-5 h-5" />
                                        </button>
                                    </form>
                                    <span className="text-slate-700 font-medium line-through">{task.title}</span>
                                </div>
                                <form action={deleteTask.bind(null, task.id)}>
                                    <button type="submit" className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}