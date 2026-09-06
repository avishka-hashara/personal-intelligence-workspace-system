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
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">All Tasks</h1>
        <p className="text-zinc-500 mt-1 text-sm font-normal">
          {pendingTasks.length} pending · {completedTasks.length} completed
        </p>
      </header>

      {/* Instant Capture Bar */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/60 rounded-2xl p-2.5 shadow-subtle">
        <form onSubmit={handleCreateTask} className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a new task... (e.g. 'Submit report tomorrow 2pm')"
            required
            className="flex-1 px-3.5 py-2 text-sm bg-transparent border-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium text-xs rounded-xl px-4 py-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all duration-150 shadow-subtle disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed active:scale-[0.985]"
          >
            Add Task
          </button>
        </form>
      </section>

      {/* Pending Tasks */}
      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Pending</h2>
        <TaskList tasks={pendingTasks} />
      </section>

      {/* Completed Tasks */}
      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Completed</h2>
        <TaskList isCompletedList={true} tasks={completedTasks} />
      </section>

      <TaskDrawer />
    </div>
  );
}

export default TasksView;
