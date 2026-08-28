"use client";

import { useEffect, useState } from "react";
import { useTaskStore, type Task } from "@/store/taskStore";
import TaskList from "@/components/TaskList";
import TaskDrawer from "@/components/TaskDrawer";

interface TodayViewProps {
  initialTasks: Task[];
}

export function TodayView({ initialTasks }: TodayViewProps) {
  const { tasks, isInitialized, initTasks, addTask } = useTaskStore();
  const [title, setTitle] = useState("");

  useEffect(() => {
    initTasks(initialTasks);
  }, [initialTasks, initTasks]);

  const activeTasks = isInitialized ? tasks : initialTasks;
  const pendingTasks = activeTasks.filter((t) => t.status !== "done" && !t.parentTaskId);

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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Today</h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          {pendingTasks.length} tasks · 0 h blocked
        </p>
      </header>

      {/* Instant Quick Capture Form */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
        <form onSubmit={handleCreateTask} className="flex gap-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done? (e.g. 'Review PR tomorrow 10am')"
            required
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow text-slate-900 bg-white"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="bg-slate-900 text-white font-medium rounded-lg px-6 py-2 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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

      <TaskDrawer />
    </div>
  );
}

export default TodayView;
