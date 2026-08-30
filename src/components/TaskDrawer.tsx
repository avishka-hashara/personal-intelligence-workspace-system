"use client";

import { useEffect, useState, useMemo, useTransition } from "react";
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
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Square, Trash2, ListTree, Plus, Tag, X, Loader2, Repeat, Flag } from "lucide-react";
import { assignTag, removeTag, fetchTagsForTask, updateTask as serverUpdateTask, fetchActiveMilestones } from "@/server/actions/tasks";
import { RecurrencePicker } from "@/components/RecurrencePicker";

interface TaskDrawerProps {
  tasks?: Task[];
}

interface TagItem {
  id: string;
  name: string;
  colour?: string | null;
}

interface ActiveMilestoneItem {
  id: string;
  title: string;
  dueDate: Date | null;
  stageTitle: string;
  goalTitle: string;
  goalId: string;
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

  // Milestone linking state
  const [activeMilestones, setActiveMilestones] = useState<ActiveMilestoneItem[]>([]);
  const [isLoadingMilestones, setIsLoadingMilestones] = useState(false);
  const [isMilestonePending, startMilestoneTransition] = useTransition();

  // Tag state
  const [tagsList, setTagsList] = useState<TagItem[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [isTagPending, startTagTransition] = useTransition();

  useEffect(() => {
    if (selectedTask) {
      setTitle(selectedTask.title ?? "");
      setNotes(selectedTask.notes ?? "");
    }
  }, [selectedTask?.id, selectedTask?.title, selectedTask?.notes]);

  // Load tags dynamically when drawer opens or selected task changes
  useEffect(() => {
    if (selectedTask?.id) {
      let isCancelled = false;
      setIsLoadingTags(true);
      fetchTagsForTask(selectedTask.id).then((res) => {
        if (!isCancelled) {
          if (res && res.tags) {
            setTagsList(res.tags);
          } else {
            setTagsList([]);
          }
          setIsLoadingTags(false);
        }
      });

      return () => {
        isCancelled = true;
      };
    } else {
      setTagsList([]);
      setNewTagName("");
    }
  }, [selectedTask?.id]);

  // Load active milestones dynamically when drawer opens or selected task changes
  useEffect(() => {
    if (selectedTask?.id) {
      let isCancelled = false;
      setIsLoadingMilestones(true);
      fetchActiveMilestones().then((res) => {
        if (!isCancelled) {
          if (res && res.milestones) {
            setActiveMilestones(res.milestones);
          } else {
            setActiveMilestones([]);
          }
          setIsLoadingMilestones(false);
        }
      });

      return () => {
        isCancelled = true;
      };
    } else {
      setActiveMilestones([]);
    }
  }, [selectedTask?.id]);

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

  const [isRecurrencePending, startRecurrenceTransition] = useTransition();

  const handleMilestoneChange = (val: string | null) => {
    if (!selectedTask) return;
    const newMilestoneId = val === "none" || !val ? null : val;
    updateTask(selectedTask.id, { milestoneId: newMilestoneId });
    startMilestoneTransition(async () => {
      await serverUpdateTask(selectedTask.id, { milestoneId: newMilestoneId });
    });
  };

  const handleRuleChange = (newRule: string | null) => {
    if (!selectedTask) return;
    updateTask(selectedTask.id, { rrule: newRule });
    startRecurrenceTransition(async () => {
      await serverUpdateTask(selectedTask.id, { rrule: newRule });
    });
  };

  const handleAddTag = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed || !selectedTask) return;

    // Avoid duplicate display
    const alreadyPresent = tagsList.some(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyPresent) {
      setNewTagName("");
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticTag: TagItem = { id: tempId, name: trimmed };
    setTagsList((prev) => [...prev, optimisticTag]);
    setNewTagName("");

    startTagTransition(async () => {
      const res = await assignTag(selectedTask.id, trimmed);
      if (res && res.success && res.tag) {
        setTagsList((prev) =>
          prev.map((t) => (t.id === tempId ? (res.tag as TagItem) : t))
        );
      } else {
        // Rollback
        setTagsList((prev) => prev.filter((t) => t.id !== tempId));
      }
    });
  };

  const handleRemoveTag = (tagId: string) => {
    if (!selectedTask) return;
    const previousTags = tagsList;
    setTagsList((prev) => prev.filter((t) => t.id !== tagId));

    startTagTransition(async () => {
      const res = await removeTag(selectedTask.id, tagId);
      if (res && res.error) {
        // Rollback
        setTagsList(previousTags);
      }
    });
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
            Edit task details, notes, tags, and manage subtasks.
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

            {/* Repeat Section */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-slate-400" />
                Repeat
              </label>
              <RecurrencePicker
                value={selectedTask.rrule}
                onChange={(newRule) => handleRuleChange(newRule)}
                disabled={isRecurrencePending}
              />
            </div>

            {/* Milestone Section */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-indigo-500" />
                Milestone
              </label>
              <select
                value={selectedTask.milestoneId || "none"}
                onChange={(e) => handleMilestoneChange(e.target.value)}
                disabled={isMilestonePending}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer disabled:opacity-50"
              >
                <option value="none">No milestone linked</option>
                {activeMilestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.goalTitle} → {m.stageTitle} → {m.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags Section */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                Tags
              </label>

              {/* Tag Badges List */}
              <div className="flex flex-wrap items-center gap-1.5 min-h-6">
                {tagsList.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200/80 hover:bg-slate-200/70 transition-colors rounded-md"
                  >
                    <span>{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.id)}
                      className="text-slate-400 hover:text-red-500 rounded-full p-0.5 hover:bg-slate-200 transition-colors focus:outline-none cursor-pointer"
                      aria-label={`Remove tag ${tag.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}

                {isLoadingTags && tagsList.length === 0 && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading tags...
                  </span>
                )}

                {!isLoadingTags && tagsList.length === 0 && (
                  <span className="text-xs text-slate-400 italic">No tags assigned yet.</span>
                )}
              </div>

              {/* Tag Input Form */}
              <form onSubmit={handleAddTag} className="flex items-center gap-2 pt-1">
                <Input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Add a tag (e.g. 'urgent', 'dev') and press Enter..."
                  className="h-9 text-xs border-slate-200 focus-visible:ring-slate-900 flex-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={!newTagName.trim() || isTagPending}
                  className="h-9 px-3 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 shrink-0 cursor-pointer disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </form>
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
