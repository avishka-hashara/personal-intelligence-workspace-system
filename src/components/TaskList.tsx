"use client";

import { useMemo, useState, useEffect } from "react";
import { CheckSquare, Square, Trash2, GripVertical } from "lucide-react";
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
                        onClick={() => onToggle(task.id)}
                        className="text-slate-900 mr-3 mt-0.5 focus:outline-none cursor-pointer"
                        aria-label="Mark task as incomplete"
                    >
                        <CheckSquare className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedTaskId(task.id)}
                        className="text-slate-700 font-medium line-through text-left hover:text-slate-900 transition-colors focus:outline-none cursor-pointer"
                    >
                        {task.title}
                    </button>
                </div>
                <button
                    type="button"
                    onClick={() => onDelete(task.id)}
                    className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-50 cursor-pointer"
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
                    onClick={() => onToggle(task.id)}
                    className="text-slate-400 hover:text-slate-600 mr-3 mt-0.5 transition-colors focus:outline-none cursor-pointer"
                    aria-label="Mark task as complete"
                >
                    <Square className="w-5 h-5" />
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className="text-slate-800 font-medium text-left hover:text-slate-950 hover:underline transition-colors focus:outline-none cursor-pointer"
                >
                    {task.title}
                </button>
            </div>
            <button
                type="button"
                onClick={() => onDelete(task.id)}
                className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-50 cursor-pointer"
                aria-label="Delete task"
            >
                <Trash2 className="w-4 h-4" />
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
            <div className="space-y-3">
                {sortedTasks.map((task) => (
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
                            <button
                                type="button"
                                onClick={() => setSelectedTaskId(task.id)}
                                className="text-slate-800 font-medium text-left hover:underline cursor-pointer"
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

