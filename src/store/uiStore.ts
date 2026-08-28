import { create } from "zustand";

interface UIState {
  isCommandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  isCaptureOpen: boolean;
  setCaptureOpen: (open: boolean) => void;
  toggleCapture: () => void;
  selectedTaskId: string | null;
  selectedTask: any | null;
  setSelectedTaskId: (id: string | null) => void;
  setSelectedTask: (task: any | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCommandOpen: false,
  setCommandOpen: (open: boolean) => set({ isCommandOpen: open }),
  toggleCommand: () => set((state) => ({ isCommandOpen: !state.isCommandOpen })),
  isCaptureOpen: false,
  setCaptureOpen: (open: boolean) => set({ isCaptureOpen: open }),
  toggleCapture: () => set((state) => ({ isCaptureOpen: !state.isCaptureOpen })),
  selectedTaskId: null,
  selectedTask: null,
  setSelectedTaskId: (id: string | null) => set({ selectedTaskId: id, selectedTask: id ? { id } : null }),
  setSelectedTask: (task: any | null) =>
    set({
      selectedTask: task,
      selectedTaskId: task ? (typeof task === "string" ? task : task.id) : null,
    }),
}));


