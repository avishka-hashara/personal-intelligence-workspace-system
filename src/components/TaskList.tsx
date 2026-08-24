"use client";

import { useOptimistic, startTransition, useMemo, useState, useEffect } from "react";
import { CheckSquare, Square, Trash2, GripVertical } from "lucide-react";
import { toggleTaskStatus, deleteTask, updateTaskOrder } from "@/server/actions/tasks";
import type { tasks } from "@/server/db/schema";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateKeyBetween } from "fractional-indexing";

export type Task = typeof tasks.$inferSelect;

interface TaskListProps {
    tasks: Task[];
    isCompletedList?: boolean;
}

type OptimisticAction =
    | { type: "toggle_status"; id: string }
    | { type: "delete"; id: string }
    | { type: "reorder"; oldIndex: number; newIndex: number; newSortKey: string };

interface SortableTaskItemProps {
    task: Task;
    onToggle: (id: string, currentStatus: string) => void;
    onDelete: (id: string) => void;
    isCompletedList?: boolean;
}

export function SortableTaskItem({
    task,
    onToggle,
    onDelete,
    isCompletedList = false,
}: SortableTaskItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    if (isCompletedList) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className={`group h-14 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between px-4 transition-all ${
                    isDragging ? "opacity-40 shadow-lg ring-2 ring-slate-400 bg-white" : ""
                }`}
            >
                <div className="flex items-center flex-1 opacity-60">
                    <div
                        {...attributes}
                        {...listeners}
                        className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing mr-2 p-1.5 rounded hover:bg-slate-200/50 transition-colors flex items-center justify-center select-none"
                        style={{ touchAction: "none" }}
                        title="Drag to reorder"
                        aria-label="Drag to reorder task"
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>
                    <button
                        type="button"
                        onClick={() => onToggle(task.id, task.status)}
                        className="text-slate-900 mr-3 mt-0.5 focus:outline-none"
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
                    onClick={() => onDelete(task.id)}
                    className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-50"
                    aria-label="Delete task"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group h-14 border border-slate-200 rounded-lg bg-white flex items-center justify-between px-4 hover:border-slate-300 transition-all ${
                isDragging ? "opacity-40 shadow-lg ring-2 ring-slate-400 scale-[1.01]" : ""
            }`}
        >
            <div className="flex items-center flex-1">
                <div
                    {...attributes}
                    {...listeners}
                    className="text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing mr-2 p-1.5 rounded hover:bg-slate-100 transition-colors flex items-center justify-center select-none"
                    style={{ touchAction: "none" }}
                    title="Drag to reorder"
                    aria-label="Drag to reorder task"
                >
                    <GripVertical className="w-4 h-4" />
                </div>
                <button
                    type="button"
                    onClick={() => onToggle(task.id, task.status)}
                    className="text-slate-400 hover:text-slate-600 mr-3 mt-0.5 transition-colors focus:outline-none"
                    aria-label="Mark task as complete"
                >
                    <Square className="w-5 h-5" />
                </button>
                <span className="text-slate-800 font-medium">{task.title}</span>
            </div>
            <button
                type="button"
                onClick={() => onDelete(task.id)}
                className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-50"
                aria-label="Delete task"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
}

export default function TaskList({ tasks, isCompletedList = false }: TaskListProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const sortedTasks = useMemo(() => {
        return [...tasks].sort((a, b) => {
            const keyA = a.sortKey ?? "";
            const keyB = b.sortKey ?? "";
            if (keyA && keyB) {
                return keyA.localeCompare(keyB);
            }
            if (keyA) return -1;
            if (keyB) return 1;
            const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bCreated - aCreated;
        });
    }, [tasks]);

    const [optimisticTasks, setOptimisticTasks] = useOptimistic(
        sortedTasks,
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
                case "reorder": {
                    const moved = arrayMove(state, action.oldIndex, action.newIndex);
                    return moved.map((task, idx) =>
                        idx === action.newIndex ? { ...task, sortKey: action.newSortKey } : task
                    );
                }
                default:
                    return state;
            }
        }
    );

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 3,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = optimisticTasks.findIndex((t) => t.id === active.id);
        const newIndex = optimisticTasks.findIndex((t) => t.id === over.id);

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            return;
        }

        // Calculate the new array layout
        const reordered = arrayMove(optimisticTasks, oldIndex, newIndex);

        // Find sortKeys of neighbors in the newly sorted array
        const prevTask = newIndex > 0 ? reordered[newIndex - 1] : null;
        const nextTask = newIndex < reordered.length - 1 ? reordered[newIndex + 1] : null;

        const prevKey = prevTask?.sortKey || null;
        const nextKey = nextTask?.sortKey || null;

        let newSortKey: string;
        try {
            newSortKey = generateKeyBetween(prevKey, nextKey);
        } catch (e) {
            console.error("Error generating fractional sortKey:", e);
            newSortKey = generateKeyBetween(null, null);
        }

        startTransition(async () => {
            setOptimisticTasks({
                type: "reorder",
                oldIndex,
                newIndex,
                newSortKey,
            });
            await updateTaskOrder(String(active.id), newSortKey);
        });
    };

    if (optimisticTasks.length === 0) {
        return (
            <p className="text-sm text-slate-500 italic">
                {isCompletedList ? "No completed tasks yet." : "No pending tasks."}
            </p>
        );
    }

    if (!mounted) {
        return (
            <div className="space-y-3">
                {optimisticTasks.map((task) => (
                    <div
                        key={task.id}
                        className="h-14 border border-slate-200 rounded-lg bg-white flex items-center justify-between px-4"
                    >
                        <div className="flex items-center flex-1">
                            <div className="text-slate-400 mr-2 p-1.5">
                                <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="text-slate-400 mr-3 mt-0.5">
                                <Square className="w-5 h-5" />
                            </div>
                            <span className="text-slate-800 font-medium">{task.title}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            sensors={sensors}
        >
            <SortableContext
                items={optimisticTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-3">
                    {optimisticTasks.map((task) => (
                        <SortableTaskItem
                            key={task.id}
                            task={task}
                            onToggle={handleToggle}
                            onDelete={handleDelete}
                            isCompletedList={isCompletedList}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}

export { TaskList };
