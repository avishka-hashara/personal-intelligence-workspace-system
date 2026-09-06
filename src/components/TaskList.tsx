"use client";

import { useMemo, useState, useEffect } from "react";
import { Check, Trash2, GripVertical } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useTaskStore, type Task } from "@/store/taskStore";
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
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TaskListProps {
    tasks: Task[];
    isCompletedList?: boolean;
}

interface SortableTaskItemProps {
    task: Task;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    isCompletedList?: boolean;
}

function getPriorityDot(priority?: number | null) {
    if (priority === 1) return "bg-rose-500";
    if (priority === 2) return "bg-amber-500";
    if (priority === 3) return "bg-blue-500";
    return null;
}

export function SortableTaskItem({
    task,
    onToggle,
    onDelete,
    isCompletedList = false,
}: SortableTaskItemProps) {
    const { setSelectedTaskId } = useUIStore();
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

    const priorityDot = getPriorityDot(task.priority);

    if (isCompletedList) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className={`group h-13 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between px-3.5 transition-all shadow-subtle ${
                    isDragging ? "opacity-40 shadow-float ring-2 ring-zinc-400 bg-white dark:bg-zinc-900" : ""
                }`}
            >
                <div className="flex items-center flex-1 min-w-0">
                    <div
                        {...attributes}
                        {...listeners}
                        className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing mr-2.5 p-1 rounded-md transition-colors flex items-center justify-center select-none"
                        style={{ touchAction: "none" }}
                        title="Drag to reorder"
                        aria-label="Drag to reorder task"
                    >
                        <GripVertical className="w-3.5 h-3.5" />
                    </div>
                    <button
                        type="button"
                        onClick={() => onToggle(task.id)}
                        className="w-5 h-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center mr-3 shrink-0 focus:outline-none cursor-pointer transition-all duration-150 active:scale-90"
                        aria-label="Mark task as incomplete"
                    >
                        <Check className="w-3 h-3 stroke-[2.5]" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedTaskId(task.id)}
                        className="text-zinc-400 dark:text-zinc-500 font-normal line-through text-left hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors text-sm truncate focus:outline-none cursor-pointer"
                    >
                        {task.title}
                    </button>
                </div>
                <button
                    type="button"
                    onClick={() => onDelete(task.id)}
                    className="text-zinc-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer shrink-0 ml-2"
                    aria-label="Delete task"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group h-13 border border-zinc-200/70 dark:border-zinc-800/60 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-between px-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-subtle transition-all ${
                isDragging ? "opacity-40 shadow-float ring-2 ring-zinc-400 scale-[1.01]" : ""
            }`}
        >
            <div className="flex items-center flex-1 min-w-0">
                <div
                    {...attributes}
                    {...listeners}
                    className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing mr-2.5 p-1 rounded-md transition-colors flex items-center justify-center select-none"
                    style={{ touchAction: "none" }}
                    title="Drag to reorder"
                    aria-label="Drag to reorder task"
                >
                    <GripVertical className="w-3.5 h-3.5" />
                </div>
                <button
                    type="button"
                    onClick={() => onToggle(task.id)}
                    className="w-5 h-5 rounded-full border-2 border-zinc-300 dark:border-zinc-600 hover:border-zinc-900 dark:hover:border-zinc-300 flex items-center justify-center mr-3 shrink-0 transition-all duration-150 focus:outline-none cursor-pointer active:scale-90 group/btn"
                    aria-label="Mark task as complete"
                >
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100 opacity-0 group-hover/btn:opacity-20 transition-opacity" />
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className="text-zinc-800 dark:text-zinc-200 font-medium text-left hover:text-zinc-950 dark:hover:text-white transition-colors text-sm truncate focus:outline-none cursor-pointer flex items-center gap-2"
                >
                    {priorityDot && (
                        <span className={`w-1.5 h-1.5 rounded-full ${priorityDot} shrink-0`} />
                    )}
                    <span className="truncate">{task.title}</span>
                </button>
            </div>
            <button
                type="button"
                onClick={() => onDelete(task.id)}
                className="text-zinc-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer shrink-0 ml-2"
                aria-label="Delete task"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

export default function TaskList({ tasks, isCompletedList = false }: TaskListProps) {
    const [mounted, setMounted] = useState(false);
    const { toggleTask, deleteTask, reorderTasks } = useTaskStore();
    const { setSelectedTaskId } = useUIStore();

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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) {
            return;
        }

        reorderTasks(String(active.id), String(over.id), sortedTasks);
    };

    if (sortedTasks.length === 0) {
        return (
            <p className="text-sm text-slate-500 italic">
                {isCompletedList ? "No completed tasks yet." : "No pending tasks."}
            </p>
        );
    }

    if (!mounted) {
        return (
            <div className="space-y-2.5">
                {sortedTasks.map((task) => (
                    <div
                        key={task.id}
                        className="h-13 border border-zinc-200/70 dark:border-zinc-800/60 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-between px-3.5 shadow-subtle"
                    >
                        <div className="flex items-center flex-1">
                            <div className="text-zinc-300 dark:text-zinc-600 mr-2.5 p-1">
                                <GripVertical className="w-3.5 h-3.5" />
                            </div>
                            <div className="w-5 h-5 rounded-full border-2 border-zinc-300 dark:border-zinc-600 mr-3" />
                            <button
                                type="button"
                                onClick={() => setSelectedTaskId(task.id)}
                                className="text-zinc-800 dark:text-zinc-200 font-medium text-left text-sm cursor-pointer"
                            >
                                {task.title}
                            </button>
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
                items={sortedTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-3">
                    {sortedTasks.map((task) => (
                        <SortableTaskItem
                            key={task.id}
                            task={task}
                            onToggle={toggleTask}
                            onDelete={deleteTask}
                            isCompletedList={isCompletedList}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}

export { TaskList };

