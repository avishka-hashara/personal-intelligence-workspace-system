"use client";

import React, { useState, useEffect, useMemo, useId, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  TimeBlockWithTask,
  createTimeBlock,
  updateTimeBlock,
  deleteTimeBlock,
  TimeBlockKind,
} from "@/server/actions/calendar";
import { toggleTaskStatus } from "@/server/actions/tasks";
import { CalendarGrid } from "@/components/CalendarGrid";
import { DraggableTaskItem, TaskItemData } from "@/components/calendar/DraggableTaskItem";
import { TimeBlockCard } from "@/components/calendar/TimeBlockCard";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Sparkles,
} from "lucide-react";

interface CalendarViewProps {
  initialTimeBlocks: TimeBlockWithTask[];
  availableMinutesPerDay: number;
  unscheduledTasks: TaskItemData[];
  currentDateStr: string; // YYYY-MM-DD
  currentView: "week" | "day";
}

function parseDateStr(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CalendarView({
  initialTimeBlocks,
  availableMinutesPerDay,
  unscheduledTasks,
  currentDateStr,
  currentView,
}: CalendarViewProps) {
  const router = useRouter();
  const dndId = useId();
  const [mounted, setMounted] = useState(false);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockWithTask[]>(initialTimeBlocks);
  const [taskList, setTaskList] = useState<TaskItemData[]>(unscheduledTasks);
  const [activeTaskDrag, setActiveTaskDrag] = useState<TaskItemData | null>(null);
  const [activeBlockDrag, setActiveBlockDrag] = useState<TimeBlockWithTask | null>(null);
  const [taskSearch, setTaskSearch] = useState("");
  const [toastMessage, setToastMessage] = useState<{ id: number; message: string; type: "error" | "info" } | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // Load showCompleted preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("piw_calendar_show_completed");
      if (saved !== null) {
        setShowCompleted(saved === "true");
      }
    } catch {}
  }, []);

  const handleToggleShowCompleted = useCallback(() => {
    setShowCompleted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("piw_calendar_show_completed", String(next));
      } catch {}
      return next;
    });
  }, []);

  const completedBlocksCount = useMemo(() => {
    return timeBlocks.filter((b) => b.task?.status === "done").length;
  }, [timeBlocks]);

  const visibleTimeBlocks = useMemo(() => {
    if (showCompleted) return timeBlocks;
    return timeBlocks.filter((b) => b.task?.status !== "done");
  }, [timeBlocks, showCompleted]);

  const showToast = useCallback((message: string, type: "error" | "info" = "error") => {
    const id = Date.now();
    setToastMessage({ id, message, type });
    setTimeout(() => {
      setToastMessage((curr) => (curr?.id === id ? null : curr));
    }, 4000);
  }, []);

  const handleToggleTaskStatus = useCallback(
    async (taskId: string, currentStatus: string) => {
      const nextStatus = currentStatus === "done" ? "next" : "done";

      // Optimistically update timeBlocks state
      setTimeBlocks((prev) =>
        prev.map((b) =>
          b.taskId === taskId && b.task
            ? { ...b, task: { ...b.task, status: nextStatus } }
            : b
        )
      );

      try {
        const res = await toggleTaskStatus(taskId, currentStatus);
        if (res && "error" in res && res.error) {
          // Rollback on error
          setTimeBlocks((prev) =>
            prev.map((b) =>
              b.taskId === taskId && b.task
                ? { ...b, task: { ...b.task, status: currentStatus } }
                : b
            )
          );
          showToast(res.error, "error");
        } else {
          router.refresh();
        }
      } catch (err) {
        console.error("Failed to toggle task status:", err);
        setTimeBlocks((prev) =>
          prev.map((b) =>
            b.taskId === taskId && b.task
              ? { ...b, task: { ...b.task, status: currentStatus } }
              : b
          )
        );
        showToast("Failed to update task status", "error");
      }
    },
    [showToast, router]
  );

  const taskMapRef = React.useRef<Map<string, TaskItemData>>(new Map());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setTimeBlocks(initialTimeBlocks);
    for (const b of initialTimeBlocks) {
      if (b.taskId && b.task) {
        taskMapRef.current.set(b.taskId, {
          id: b.task.id,
          title: b.task.title,
          status: b.task.status,
          priority: b.task.priority,
          estimateMinutes: b.task.estimateMinutes,
          dueAt: null,
          energy: b.task.energy,
        });
      }
    }
  }, [initialTimeBlocks]);

  useEffect(() => {
    for (const t of unscheduledTasks) {
      taskMapRef.current.set(t.id, t);
    }
    const localScheduledIds = new Set(timeBlocks.map((b) => b.taskId).filter(Boolean) as string[]);
    setTaskList(unscheduledTasks.filter((t) => !localScheduledIds.has(t.id)));
  }, [unscheduledTasks]);

  // Overlap conflict state
  const [conflictModal, setConflictModal] = useState<{
    isOpen: boolean;
    pendingData: any;
    isUpdate?: boolean;
    message: string;
  }>({
    isOpen: false,
    pendingData: null,
    isUpdate: false,
    message: "",
  });

  // Quick Create Modal State
  const [quickCreateModal, setQuickCreateModal] = useState<{
    isOpen: boolean;
    date: Date;
    hour: number;
  }>({
    isOpen: false,
    date: new Date(),
    hour: 9,
  });
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<TimeBlockKind>("work");
  const [newDuration, setNewDuration] = useState(60);

  // DnD Sensors: 5px pointer activation distance so regular clicks work smoothly
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const parsedCurrentDate = useMemo(() => parseDateStr(currentDateStr), [currentDateStr]);

  // Compute days array based on view mode
  const displayedDays = useMemo(() => {
    if (currentView === "day") {
      return [parsedCurrentDate];
    }
    // Week view: compute 7 days starting from Monday (or Sunday)
    const curr = new Date(parsedCurrentDate);
    const dayOfWeek = curr.getDay(); // 0 is Sunday, 1 is Monday
    const distanceToMonday = (dayOfWeek + 6) % 7; // distance from Monday
    const monday = new Date(curr);
    monday.setDate(curr.getDate() - distanceToMonday);

    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDays.push(d);
    }
    return weekDays;
  }, [parsedCurrentDate, currentView]);

  // Navigation handlers
  const handleNavigate = (deltaDays: number) => {
    const next = new Date(parsedCurrentDate);
    next.setDate(parsedCurrentDate.getDate() + deltaDays);
    const dateStr = formatDateStr(next);
    router.push(`/calendar?d=${dateStr}&view=${currentView}`);
  };

  const handleToday = () => {
    const todayStr = formatDateStr(new Date());
    router.push(`/calendar?d=${todayStr}&view=${currentView}`);
  };

  const handleViewChange = (view: "week" | "day") => {
    router.push(`/calendar?d=${currentDateStr}&view=${view}`);
  };

  // Drag & Drop Handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "task") {
      setActiveTaskDrag(data.task);
      setActiveBlockDrag(null);
    } else if (data?.type === "block") {
      setActiveBlockDrag(data.block);
      setActiveTaskDrag(null);
    }
  }, []);

  const scheduleBlock = useCallback((payload: any, allowOverlap: boolean) => {
    const tempId = `temp-${Date.now()}`;
    const taskObj = payload.taskData
      ? {
          id: payload.taskData.id,
          title: payload.taskData.title,
          priority: payload.taskData.priority ?? 0,
          status: payload.taskData.status || "inbox",
          estimateMinutes: payload.taskData.estimateMinutes ?? 60,
          energy: payload.taskData.energy ?? null,
        }
      : null;

    const optimisticBlock: TimeBlockWithTask = {
      id: tempId,
      userId: "",
      title: payload.title || "Scheduled Block",
      startAt: new Date(payload.startAt),
      endAt: new Date(payload.endAt),
      taskId: payload.taskId || null,
      studySessionId: payload.studySessionId || null,
      kind: payload.kind || "work",
      locked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      task: taskObj,
    };

    const previousBlocks = timeBlocks;
    const previousTasks = taskList;

    // 1. Instant optimistic state update
    setTimeBlocks((prev) => [...prev, optimisticBlock]);
    if (payload.taskId) {
      setTaskList((prev) => prev.filter((t) => t.id !== payload.taskId));
    }
    setConflictModal({ isOpen: false, pendingData: null, message: "" });

    // 2. Persist in background
    const { taskData, ...apiPayload } = payload;
    createTimeBlock({ ...apiPayload, allowOverlap })
      .then((res) => {
        if (res.success && res.timeBlock) {
          setTimeBlocks((prev) =>
            prev.map((b) => (b.id === tempId ? res.timeBlock! : b))
          );
          router.refresh();
        } else if (res.error === "OVERLAP_CONFLICT") {
          setTimeBlocks(previousBlocks);
          setTaskList(previousTasks);
          setConflictModal({
            isOpen: true,
            pendingData: payload,
            isUpdate: false,
            message: res.message || "This time block overlaps with an existing scheduled block.",
          });
        } else {
          setTimeBlocks(previousBlocks);
          setTaskList(previousTasks);
          showToast(res.message || "Failed to create time block", "error");
        }
      })
      .catch((err) => {
        console.error("Failed to create time block:", err);
        setTimeBlocks(previousBlocks);
        setTaskList(previousTasks);
        showToast("Failed to create time block", "error");
      });
  }, [timeBlocks, taskList, showToast, router]);

  const updateBlock = useCallback((payload: { id: string; data: any }, allowOverlap: boolean) => {
    const previousBlocks = timeBlocks;
    // 1. Instant optimistic state update
    setTimeBlocks((prev) =>
      prev.map((b) =>
        b.id === payload.id ? { ...b, ...payload.data } : b
      )
    );
    setConflictModal({ isOpen: false, pendingData: null, message: "" });

    // 2. Persist in background
    updateTimeBlock(payload.id, { ...payload.data, allowOverlap })
      .then((res) => {
        if (res.success && res.timeBlock) {
          setTimeBlocks((prev) =>
            prev.map((b) => (b.id === payload.id ? res.timeBlock! : b))
          );
          router.refresh();
        } else if (res.error === "OVERLAP_CONFLICT") {
          setTimeBlocks(previousBlocks);
          setConflictModal({
            isOpen: true,
            pendingData: payload,
            isUpdate: true,
            message: res.message || "This time block overlaps with an existing scheduled block.",
          });
        } else {
          setTimeBlocks(previousBlocks);
          showToast(res.message || "Failed to update time block", "error");
        }
      })
      .catch((err) => {
        console.error("Failed to update time block:", err);
        setTimeBlocks(previousBlocks);
        showToast("Failed to update time block", "error");
      });
  }, [timeBlocks, showToast, router]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskDrag(null);
    setActiveBlockDrag(null);

    if (!over) return;

    const overData = over.data.current;
    if (overData?.type !== "slot") return;

    const { dateKey, hour } = overData;
    const activeData = active.data.current;

    if (activeData?.type === "task") {
      const task: TaskItemData = activeData.task;
      taskMapRef.current.set(task.id, task);
      const startAt = new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00`);
      const durationMins = task.estimateMinutes || 60;
      const endAt = new Date(startAt.getTime() + durationMins * 60000);

      const blockPayload = {
        title: task.title,
        taskId: task.id,
        startAt,
        endAt,
        kind: "work" as TimeBlockKind,
        taskData: task,
      };

      scheduleBlock(blockPayload, false);
    } else if (activeData?.type === "block") {
      const block: TimeBlockWithTask = activeData.block;
      const oldStart = new Date(block.startAt);
      const oldEnd = new Date(block.endAt);
      const durationMins = Math.max((oldEnd.getTime() - oldStart.getTime()) / 60000, 15);

      const newStartAt = new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00`);
      const newEndAt = new Date(newStartAt.getTime() + durationMins * 60000);

      // If position hasn't changed, do nothing
      if (newStartAt.getTime() === oldStart.getTime()) {
        return;
      }

      const updatePayload = {
        id: block.id,
        data: {
          startAt: newStartAt,
          endAt: newEndAt,
        },
      };

      updateBlock(updatePayload, false);
    }
  }, [scheduleBlock, updateBlock]);

  const handleDeleteBlock = useCallback((id: string) => {
    const blockToDelete = timeBlocks.find((b) => b.id === id);
    const previousBlocks = timeBlocks;
    const previousTasks = taskList;

    setTimeBlocks((prev) => prev.filter((b) => b.id !== id));

    if (blockToDelete?.taskId) {
      const cached = taskMapRef.current.get(blockToDelete.taskId);
      const restoredTask: TaskItemData = cached || {
        id: blockToDelete.taskId,
        title: blockToDelete.task?.title || blockToDelete.title || "Untitled Task",
        status: blockToDelete.task?.status || "inbox",
        priority: blockToDelete.task?.priority ?? 0,
        estimateMinutes: blockToDelete.task?.estimateMinutes ?? 60,
        dueAt: null,
        energy: blockToDelete.task?.energy ?? null,
      };

      setTaskList((prev) => {
        if (prev.some((t) => t.id === restoredTask.id)) return prev;
        return [restoredTask, ...prev];
      });
    }

    deleteTimeBlock(id).then((res) => {
      if (!res.success) {
        setTimeBlocks(previousBlocks);
        setTaskList(previousTasks);
        showToast(res.error || "Failed to delete time block", "error");
      } else {
        router.refresh();
      }
    }).catch((err) => {
      console.error("Failed to delete time block:", err);
      setTimeBlocks(previousBlocks);
      setTaskList(previousTasks);
      showToast("Failed to delete time block", "error");
    });
  }, [timeBlocks, taskList, showToast, router]);

  const handleSlotClick = useCallback((date: Date, hour: number) => {
    setQuickCreateModal({
      isOpen: true,
      date,
      hour,
    });
    setNewTitle("");
    setNewKind("work");
    setNewDuration(60);
  }, []);

  const handleQuickCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const dateKey = formatDateStr(quickCreateModal.date);
    const startAt = new Date(
      `${dateKey}T${String(quickCreateModal.hour).padStart(2, "0")}:00:00`
    );
    const endAt = new Date(startAt.getTime() + newDuration * 60000);

    const payload = {
      title: newTitle.trim(),
      startAt,
      endAt,
      kind: newKind,
    };

    scheduleBlock(payload, false);
    setQuickCreateModal({ isOpen: false, date: new Date(), hour: 9 });
  };

  // Filter unscheduled tasks
  const filteredTasks = useMemo(() => {
    if (!taskSearch.trim()) return taskList;
    const q = taskSearch.toLowerCase();
    return taskList.filter((t) => t.title.toLowerCase().includes(q));
  }, [taskList, taskSearch]);

  const dateHeaderTitle = useMemo(() => {
    if (currentView === "day") {
      return parsedCurrentDate.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    const first = displayedDays[0];
    const last = displayedDays[displayedDays.length - 1];
    return `${first.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    })} – ${last.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }, [parsedCurrentDate, displayedDays, currentView]);

  return (
    <DndContext
      id="calendar-dnd-context"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6 w-full max-w-7xl mx-auto pb-12 transition-all duration-300 ease-in-out">
        {/* Top Header & Navigation Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shadow-2xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-zinc-100 leading-tight">
                {dateHeaderTitle}
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                Time-Blocking & Capacity Management
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => handleNavigate(currentView === "week" ? -7 : -1)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700 hover:text-slate-900 dark:hover:text-zinc-100 transition-all cursor-pointer"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-all cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleNavigate(currentView === "week" ? 7 : 1)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700 hover:text-slate-900 dark:hover:text-zinc-100 transition-all cursor-pointer"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* View Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleViewChange("week")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  currentView === "week"
                    ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-xs font-bold"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => handleViewChange("day")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  currentView === "day"
                    ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-xs font-bold"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                }`}
              >
                Day
              </button>
            </div>

            {/* Completed Tasks Toggle */}
            <button
              type="button"
              onClick={handleToggleShowCompleted}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                showCompleted
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                  : "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
              }`}
              title={showCompleted ? "Hide completed tasks" : "Show completed tasks"}
            >
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  showCompleted
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400 dark:text-zinc-500"
                }`}
              />
              <span>Completed</span>
              {completedBlocksCount > 0 && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    showCompleted
                      ? "bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold"
                      : "bg-slate-200/80 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-medium"
                  }`}
                >
                  {completedBlocksCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Main Workspace Layout (Sidebar + CalendarGrid) */}
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full transition-all duration-300 ease-in-out">
          {/* Left Sidebar: Unscheduled Tasks */}
          <div className="w-full lg:w-[22%] shrink-0 lg:min-w-[210px] lg:max-w-[240px] bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Unscheduled Tasks</h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-900/50">
                {filteredTasks.length}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
              Drag tasks into any time slot on the calendar grid to block time.
            </p>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Filter tasks..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/60 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Task Draggable Cards List */}
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No unscheduled tasks found.
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <DraggableTaskItem key={task.id} task={task} />
                ))
              )}
            </div>
          </div>

          {/* Center Main Area: Calendar Grid */}
          <div className="flex-1 min-w-0 w-full">
            <CalendarGrid
              days={displayedDays}
              timeBlocks={visibleTimeBlocks}
              availableMinutesPerDay={availableMinutesPerDay}
              onDeleteBlock={handleDeleteBlock}
              onToggleTaskStatus={handleToggleTaskStatus}
              onSlotClick={handleSlotClick}
            />
          </div>
        </div>
      </div>

      {/* Drag Overlay Preview */}
      <DragOverlay>
        {activeTaskDrag ? (
          <DraggableTaskItem task={activeTaskDrag} isOverlay />
        ) : activeBlockDrag ? (
          <TimeBlockCard
            block={activeBlockDrag}
            hourHeightPx={56}
            onDelete={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>

      {/* Overlap Conflict Modal */}
      {conflictModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-900 dark:text-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-base">Schedule Overlap Detected</h3>
                <span className="text-xs text-slate-500 dark:text-zinc-400">Conflict Business Rule</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              {conflictModal.message}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setConflictModal({ isOpen: false, pendingData: null, message: "" })
                }
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (conflictModal.isUpdate) {
                    updateBlock(conflictModal.pendingData, true);
                  } else {
                    scheduleBlock(conflictModal.pendingData, true);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Schedule Anyway (Allow Overlap)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Time Block Modal */}
      {quickCreateModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-900 dark:text-zinc-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">Schedule Time Block</h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {quickCreateModal.date.toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    at {quickCreateModal.hour}:00
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setQuickCreateModal({ isOpen: false, date: new Date(), hour: 9 })
                }
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Block Title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Deep Work on Algorithms"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/60 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Category</label>
                  <select
                    value={newKind}
                    onChange={(e) => setNewKind(e.target.value as TimeBlockKind)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="work">Work (Indigo)</option>
                    <option value="study">Study (Purple)</option>
                    <option value="rest">Rest (Emerald)</option>
                    <option value="admin">Admin (Slate)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Duration</label>
                  <select
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value={30}>30 mins</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setQuickCreateModal({ isOpen: false, date: new Date(), hour: 9 })
                  }
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Save Time Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toast Notification for rollback/error feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 text-xs font-medium backdrop-blur-md">
          {toastMessage.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage.message}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </DndContext>
  );
}
