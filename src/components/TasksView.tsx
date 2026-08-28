"use client";

import { useEffect, useState } from "react";
import { useTaskStore, type Task } from "@/store/taskStore";
import TaskList from "@/components/TaskList";
import TaskDrawer from "@/components/TaskDrawer";

interface TasksViewProps {
  initialTasks: Task[];
}

export function TasksView({ initialTasks }: TasksViewProps) {
  const { tasks, isInitialized, initTasks, addTask } = useTaskStore();
  const [title, setTitle] = useState("");

  useEffect(() => {
    initTasks(initialTasks);
  }, [initialTasks, initTasks]);

  const activeTasks = isInitialized ? tasks : initialTasks;
  const pendingTasks = activeTasks.filter((t) => t.status !== "done" && !t.parentTaskId);
  const completedTasks = activeTasks.filter((t) => t.status === "done" && !t.parentTaskId);

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setTitle("");
    await addTask({ title: trimmed });
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">All Tasks</h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          {pendingTasks.length} pending · {completedTasks.length} completed
        </p>
      </header>

      {/* Instant Capture Bar */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
        <form onSubmit={handleCreateTask} className="flex gap-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a new task... (e.g. 'Submit report tomorrow 2pm')"
            required
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition-shadow text-slate-900 bg-white"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="bg-slate-900 text-white font-medium rounded-lg px-6 py-2 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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

      <TaskDrawer />
    </div>
  );
}

export default TasksView;
