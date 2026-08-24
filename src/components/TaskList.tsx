"use client";

import { useOptimistic, startTransition } from "react";
import { CheckSquare, Square, Trash2 } from "lucide-react";
import { toggleTaskStatus, deleteTask } from "@/server/actions/tasks";
import type { tasks } from "@/server/db/schema";

export type Task = typeof tasks.$inferSelect;

interface TaskListProps {
    tasks: Task[];
    isCompletedList?: boolean;
}

type OptimisticAction =
    | { type: "toggle_status"; id: string }
    | { type: "delete"; id: string };

export default function TaskList({ tasks, isCompletedList = false }: TaskListProps) {
    const [optimisticTasks, setOptimisticTasks] = useOptimistic(
        tasks,
        (state: Task[], action: OptimisticAction) => {
            switch (action.type) {
                case "toggle_status":
                    return state
                        .map((task) => {
                            if (task.id === action.id) {
                                const newStatus = task.status === "done" ? "next" : "done";
                                return { ...task, status: newStatus };
                            }
                            return task;
                        })
                        .filter((task) => (isCompletedList ? task.status === "done" : task.status !== "done"));
                case "delete":
                    return state.filter((task) => task.id !== action.id);
                default:
                    return state;
            }
        }
    );

    const handleToggle = (id: string, currentStatus: string) => {
        startTransition(async () => {
            setOptimisticTasks({ type: "toggle_status", id });
            await toggleTaskStatus(id, currentStatus);
        });
    };

    const handleDelete = (id: string) => {
        startTransition(async () => {
            setOptimisticTasks({ type: "delete", id });
            await deleteTask(id);
        });
    };

    if (optimisticTasks.length === 0) {
        return (
            <p className="text-sm text-slate-500 italic">
                {isCompletedList ? "No completed tasks yet." : "No pending tasks."}
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {optimisticTasks.map((task) =>
                isCompletedList ? (
                    <div
                        key={task.id}
                        className="group h-14 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between px-4"
                    >
                        <div className="flex items-center flex-1 opacity-60">
                            <button
                                type="button"
                                onClick={() => handleToggle(task.id, task.status)}
                                className="text-slate-900 mr-4 mt-1"
                                aria-label="Mark task as incomplete"
                            >
                                <CheckSquare className="w-5 h-5" />
                            </button>
                            <span className="text-slate-700 font-medium line-through">
                                {task.title}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleDelete(task.id)}
                            className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Delete task"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                ) : (
                    <div
                        key={task.id}
                        className="group h-14 border border-slate-200 rounded-lg bg-white flex items-center justify-between px-4 hover:border-slate-300 transition-colors"
                    >
                        <div className="flex items-center flex-1">
                            <button
                                type="button"
                                onClick={() => handleToggle(task.id, task.status)}
                                className="text-slate-300 hover:text-slate-600 mr-4 mt-1 transition-colors"
                                aria-label="Mark task as complete"
                            >
                                <Square className="w-5 h-5" />
                            </button>
                            <span className="text-slate-700 font-medium">{task.title}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleDelete(task.id)}
                            className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Delete task"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                )
            )}
        </div>
    );
}

export { TaskList };
