"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useUIStore } from "@/store/uiStore";
import { useTaskStore, type Task } from "@/store/taskStore";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckSquare, Square, Trash2, ListTree, Plus } from "lucide-react";

interface TaskDrawerProps {
  tasks?: Task[];
}

export function TaskDrawer({ tasks: propTasks }: TaskDrawerProps) {
  const { selectedTaskId, setSelectedTaskId } = useUIStore();
  const { tasks: storeTasks, addTask, toggleTask, deleteTask, updateTask } = useTaskStore();
  
  // Prefer store tasks, fallback to prop tasks if store not yet populated
  const tasks = storeTasks.length > 0 ? storeTasks : (propTasks ?? []);
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");

  useEffect(() => {
    if (selectedTask) {
      setTitle(selectedTask.title ?? "");
      setNotes(selectedTask.notes ?? "");
    }
  }, [selectedTask?.id, selectedTask?.title, selectedTask?.notes]);

  const handleTitleBlur = () => {
    if (!selectedTask) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle === selectedTask.title) return;

    updateTask(selectedTask.id, { title: trimmedTitle });
  };

  const handleNotesBlur = () => {
    if (!selectedTask) return;
    const currentNotes = selectedTask.notes ?? "";
    if (notes === currentNotes) return;

    updateTask(selectedTask.id, { notes });
  };

  const handleAddSubtask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = subtaskTitle.trim();
    if (!trimmed || !selectedTask) return;

    setSubtaskTitle("");
    await addTask({ title: trimmed, parentTaskId: selectedTask.id });
  };

  const subtasks = useMemo(() => {
    return selectedTask
      ? tasks.filter((t) => t.parentTaskId === selectedTask.id)
      : [];
  }, [tasks, selectedTask]);

  return (
    <Sheet
      open={!!selectedTask}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedTaskId(null);
        }
      }}
    >
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col gap-6 p-6 overflow-y-auto bg-white">
        <SheetHeader className="p-0 space-y-1">
          <SheetTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Task Details
          </SheetTitle>
          <SheetDescription className="sr-only">
            Edit task details, notes, and manage subtasks.
          </SheetDescription>
        </SheetHeader>

        {selectedTask && (
          <div className="flex flex-col gap-6">
            {/* Title Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                placeholder="Task title..."
                className="h-10 text-base font-semibold text-slate-900 border-slate-200 focus-visible:ring-slate-900"
              />
            </div>

            {/* Notes Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Notes
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add notes or detailed descriptions..."
                rows={4}
                className="min-h-28 text-sm text-slate-800 border-slate-200 focus-visible:ring-slate-900"
              />
            </div>

            {/* Subtasks Section */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ListTree className="w-3.5 h-3.5 text-slate-400" />
                  Subtasks ({subtasks.length})
                </h3>
              </div>

              {/* Subtask Quick Capture */}
              <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  placeholder="Add a subtask..."
                  className="h-9 flex-1 text-sm border-slate-200 focus-visible:ring-slate-900"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!subtaskTitle.trim()}
                  className="h-9 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 shrink-0 disabled:opacity-40"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </form>

              {/* Subtasks List */}
              <div className="space-y-2 mt-3">
                {subtasks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No subtasks yet. Add one above.
                  </p>
                ) : (
                  subtasks.map((subtask) => {
                    const isDone = subtask.status === "done";
                    return (
                      <div
                        key={subtask.id}
                        className="group flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleTask(subtask.id)}
                            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 focus:outline-none cursor-pointer"
                            aria-label={isDone ? "Mark subtask incomplete" : "Mark subtask complete"}
                          >
                            {isDone ? (
                              <CheckSquare className="w-4 h-4 text-slate-900" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedTaskId(subtask.id)}
                            className={`text-sm text-left truncate hover:underline cursor-pointer ${
                              isDone
                                ? "line-through text-slate-400"
                                : "text-slate-800 font-medium"
                            }`}
                          >
                            {subtask.title}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteTask(subtask.id)}
                          className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 cursor-pointer"
                          aria-label="Delete subtask"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default TaskDrawer;

