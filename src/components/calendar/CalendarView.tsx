"use client";

import React, { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
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
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockWithTask[]>(initialTimeBlocks);
  const [activeTaskDrag, setActiveTaskDrag] = useState<TaskItemData | null>(null);
  const [activeBlockDrag, setActiveBlockDrag] = useState<TimeBlockWithTask | null>(null);
  const [taskSearch, setTaskSearch] = useState("");
  const [isPending, startTransition] = useTransition();

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
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "task") {
      setActiveTaskDrag(data.task);
      setActiveBlockDrag(null);
    } else if (data?.type === "block") {
      setActiveBlockDrag(data.block);
      setActiveTaskDrag(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
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
      const startAt = new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00`);
      const durationMins = task.estimateMinutes || 60;
      const endAt = new Date(startAt.getTime() + durationMins * 60000);

      const blockPayload = {
        title: task.title,
        taskId: task.id,
        startAt,
        endAt,
        kind: "work" as TimeBlockKind,
      };

      scheduleBlock(blockPayload, false);
    } else if (activeData?.type === "block") {
      const block: TimeBlockWithTask = activeData.block;
      const oldStart = new Date(block.startAt);
      const oldEnd = new Date(block.endAt);
      const durationMins = Math.max((oldEnd.getTime() - oldStart.getTime()) / 60000, 15);

      const newStartAt = new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00`);
      const newEndAt = new Date(newStartAt.getTime() + durationMins * 60000);

      const updatePayload = {
        id: block.id,
        data: {
          startAt: newStartAt,
          endAt: newEndAt,
        },
      };

      updateBlock(updatePayload, false);
    }
  };

  const scheduleBlock = (payload: any, allowOverlap: boolean) => {
    startTransition(async () => {
      const res = await createTimeBlock({ ...payload, allowOverlap });
      if (res.success && res.timeBlock) {
        setTimeBlocks((prev) => [...prev, res.timeBlock!]);
        setConflictModal({ isOpen: false, pendingData: null, message: "" });
      } else if (res.error === "OVERLAP_CONFLICT") {
        setConflictModal({
          isOpen: true,
          pendingData: payload,
          isUpdate: false,
          message: res.message || "This time block overlaps with an existing scheduled block.",
        });
      }
    });
  };

  const updateBlock = (payload: { id: string; data: any }, allowOverlap: boolean) => {
    startTransition(async () => {
      const res = await updateTimeBlock(payload.id, { ...payload.data, allowOverlap });
      if (res.success && res.timeBlock) {
        setTimeBlocks((prev) =>
          prev.map((b) => (b.id === payload.id ? res.timeBlock! : b))
        );
        setConflictModal({ isOpen: false, pendingData: null, message: "" });
      } else if (res.error === "OVERLAP_CONFLICT") {
        setConflictModal({
          isOpen: true,
          pendingData: payload,
          isUpdate: true,
          message: res.message || "This time block overlaps with an existing scheduled block.",
        });
      }
    });
  };

  const handleDeleteBlock = (id: string) => {
    startTransition(async () => {
      setTimeBlocks((prev) => prev.filter((b) => b.id !== id));
      await deleteTimeBlock(id);
    });
  };

  const handleSlotClick = (date: Date, hour: number) => {
    setQuickCreateModal({
      isOpen: true,
      date,
      hour,
    });
    setNewTitle("");
    setNewKind("work");
    setNewDuration(60);
  };

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
    if (!taskSearch.trim()) return unscheduledTasks;
    const q = taskSearch.toLowerCase();
    return unscheduledTasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [unscheduledTasks, taskSearch]);

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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header & Navigation Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                {dateHeaderTitle}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Time-Blocking & Capacity Management
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleNavigate(currentView === "week" ? -7 : -1)}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-all cursor-pointer"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 hover:bg-white transition-all cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleNavigate(currentView === "week" ? 7 : 1)}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-all cursor-pointer"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* View Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleViewChange("week")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  currentView === "week"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => handleViewChange("day")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  currentView === "day"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Day
              </button>
            </div>
          </div>
        </div>

        {/* Main Workspace Layout (Sidebar + CalendarGrid) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left Sidebar: Unscheduled Tasks */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900">Unscheduled Tasks</h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                {filteredTasks.length}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-snug">
              Drag tasks into any time slot on the calendar grid to block time.
            </p>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Filter tasks..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
          <div className="lg:col-span-3 min-w-0">
            <CalendarGrid
              days={displayedDays}
              timeBlocks={timeBlocks}
              availableMinutesPerDay={availableMinutesPerDay}
              onDeleteBlock={handleDeleteBlock}
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Schedule Overlap Detected</h3>
                <span className="text-xs text-slate-500">Conflict Business Rule</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {conflictModal.message}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setConflictModal({ isOpen: false, pendingData: null, message: "" })
                }
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Schedule Time Block</h3>
                  <p className="text-[11px] text-slate-500">
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
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Block Title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Deep Work on Algorithms"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Category</label>
                  <select
                    value={newKind}
                    onChange={(e) => setNewKind(e.target.value as TimeBlockKind)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="work">Work (Indigo)</option>
                    <option value="study">Study (Purple)</option>
                    <option value="rest">Rest (Emerald)</option>
                    <option value="admin">Admin (Slate)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Duration</label>
                  <select
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  Save Time Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DndContext>
  );
}
