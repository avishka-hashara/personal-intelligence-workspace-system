"use client";

import { create } from "zustand";
import * as chrono from "chrono-node";
import { generateKeyBetween } from "fractional-indexing";
import type { tasks } from "@/server/db/schema";
import {
  createTask as serverCreateTask,
  toggleTaskStatus as serverToggleTaskStatus,
  deleteTask as serverDeleteTask,
  updateTask as serverUpdateTask,
  updateTaskOrder as serverUpdateTaskOrder,
} from "@/server/actions/tasks";

export type Task = typeof tasks.$inferSelect;

interface TaskState {
  tasks: Task[];
  isInitialized: boolean;
  initTasks: (initialTasks: Task[]) => void;
  addTask: (input: { title: string; parentTaskId?: string | null }) => Promise<Task | null>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTask: (id: string, data: { title?: string; notes?: string }) => Promise<void>;
  reorderTasks: (activeId: string, overId: string, customList?: Task[]) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isInitialized: false,

  initTasks: (initialTasks: Task[]) => {
    set({ tasks: initialTasks, isInitialized: true });
  },

  addTask: async ({ title: rawTitle, parentTaskId = null }) => {
    const trimmedRaw = rawTitle.trim();
    if (!trimmedRaw) return null;

    // 1. Natural language date parsing on client for 0ms feedback
    const parsed = chrono.parse(trimmedRaw);
    let dueAt: Date | null = null;
    let title = trimmedRaw;

    if (parsed.length > 0) {
      dueAt = parsed[0].start.date();
      const cleaned = title.replace(parsed[0].text, "").replace(/\s+/g, " ").trim();
      if (cleaned.length > 0) {
        title = cleaned;
      }
    }

    // 2. Generate fractional indexing sortKey relative to existing tasks
    const currentTasks = get().tasks;
    const siblingTasks = currentTasks.filter((t) =>
      parentTaskId ? t.parentTaskId === parentTaskId : (!t.parentTaskId && t.status !== "done")
    );
    const topSibling = siblingTasks.length > 0 ? siblingTasks[0] : null;
    const sortKey = generateKeyBetween(null, topSibling?.sortKey ?? null);

    const clientTaskId = crypto.randomUUID();
    const optimisticTask: Task = {
      id: clientTaskId,
      userId: "optimistic",
      title,
      notes: null,
      status: "next",
      priority: 0,
      dueAt,
      deferUntil: null,
      estimateMinutes: null,
      actualMinutes: null,
      rrule: null,
      recurrenceParentId: null,
      isContainer: false,
      sortKey,
      energy: null,
      milestoneId: null,
      parentTaskId: parentTaskId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      hlc: null,
      version: 1,
    };

    // Synchronous optimistic insert (0ms UI feedback!)
    set((state) => ({
      tasks: [optimisticTask, ...state.tasks],
    }));

    // Background server call
    try {
      const res = await serverCreateTask({
        id: clientTaskId,
        title,
        parentTaskId,
        dueAt,
        sortKey,
      });

      if (res && res.success && res.task) {
        const serverTask = res.task as Task;
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === clientTaskId ? serverTask : t)),
        }));
        return serverTask;
      } else if (res && res.error) {
        // Rollback on server error
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== clientTaskId),
        }));
        return null;
      }
    } catch (err) {
      console.error("Failed to create task on server:", err);
      // Rollback
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== clientTaskId),
      }));
      return null;
    }

    return optimisticTask;
  },

  toggleTask: async (id: string) => {
    const currentTasks = get().tasks;
    const target = currentTasks.find((t) => t.id === id);
    if (!target) return;

    const previousStatus = target.status;
    const newStatus = previousStatus === "done" ? "next" : "done";

    // Synchronous optimistic toggle (0ms UI feedback!)
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status: newStatus, updatedAt: new Date() } : t
      ),
    }));

    try {
      const res = await serverToggleTaskStatus(id, previousStatus);
      if (res && res.error) {
        // Rollback
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, status: previousStatus } : t
          ),
        }));
      }
    } catch (err) {
      console.error("Failed to toggle task status:", err);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, status: previousStatus } : t
        ),
      }));
    }
  },

  deleteTask: async (id: string) => {
    const previousTasks = get().tasks;

    // Synchronous optimistic deletion (0ms UI feedback!)
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id && t.parentTaskId !== id),
    }));

    try {
      const res = await serverDeleteTask(id);
      if (res && res.error) {
        // Rollback
        set({ tasks: previousTasks });
      }
    } catch (err) {
      console.error("Failed to delete task on server:", err);
      set({ tasks: previousTasks });
    }
  },

  updateTask: async (id: string, data: { title?: string; notes?: string }) => {
    const previousTasks = get().tasks;
    const target = previousTasks.find((t) => t.id === id);
    if (!target) return;

    // Synchronous optimistic update (0ms UI feedback!)
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...data, updatedAt: new Date() } : t
      ),
    }));

    try {
      const res = await serverUpdateTask(id, data);
      if (res && res.error) {
        // Rollback
        set({ tasks: previousTasks });
      }
    } catch (err) {
      console.error("Failed to update task on server:", err);
      set({ tasks: previousTasks });
    }
  },

  reorderTasks: async (activeId: string, overId: string, customList?: Task[]) => {
    const currentTasks = get().tasks;
    const listToReorder = customList ? [...customList] : [...currentTasks];
    const activeIndex = listToReorder.findIndex((t) => t.id === activeId);
    const overIndex = listToReorder.findIndex((t) => t.id === overId);

    if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
      return;
    }

    // Move in array
    const [movedTask] = listToReorder.splice(activeIndex, 1);
    listToReorder.splice(overIndex, 0, movedTask);

    // Calculate fractional sortKey
    const prevTask = overIndex > 0 ? listToReorder[overIndex - 1] : null;
    const nextTask = overIndex < listToReorder.length - 1 ? listToReorder[overIndex + 1] : null;

    let newSortKey: string;
    try {
      newSortKey = generateKeyBetween(prevTask?.sortKey ?? null, nextTask?.sortKey ?? null);
    } catch {
      newSortKey = generateKeyBetween(null, null);
    }

    // Update state immediately
    const updated = currentTasks.map((t) =>
      t.id === activeId ? { ...t, sortKey: newSortKey } : t
    );

    set({ tasks: updated });

    try {
      await serverUpdateTaskOrder(activeId, newSortKey);
    } catch (err) {
      console.error("Failed to update task order on server:", err);
    }
  },
}));
