import { create } from "zustand";

export type TimerStatus = "idle" | "running" | "paused";

export type PageContextType = "Note" | "Goal" | "Course";

export interface PageContext {
  type: PageContextType;
  id: string;
  title: string;
  data?: string;
}

interface UIState {
  isCommandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  isCaptureOpen: boolean;
  setCaptureOpen: (open: boolean) => void;
  toggleCapture: () => void;
  selectedTaskId: string | null;
  selectedTask: Record<string, unknown> | null;
  setSelectedTaskId: (id: string | null) => void;
  setSelectedTask: (task: Record<string, unknown> | null) => void;

  // Page-Aware Ephemeral Context
  pageContext: PageContext | null;
  setPageContext: (ctx: PageContext | null) => void;
  clearPageContext: (id: string) => void;

  // Focus Timer State
  isTimerOpen: boolean;
  setTimerOpen: (open: boolean) => void;
  toggleTimer: () => void;
  activeFocusTaskId: string | null;
  setActiveFocusTask: (id: string | null) => void;
  timerStatus: TimerStatus;
  setTimerStatus: (status: TimerStatus) => void;
  elapsedSeconds: number;
  setElapsedSeconds: (seconds: number | ((prev: number) => number)) => void;
  resetTimer: () => void;

  // AI Copilot State
  isCopilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  toggleCopilot: () => void;

  // Day Strip State
  isDayStripOpen: boolean;
  setDayStripOpen: (open: boolean) => void;
  toggleDayStrip: () => void;
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
  setSelectedTask: (task: Record<string, unknown> | null) =>
    set({
      selectedTask: task,
      selectedTaskId: task ? (typeof task.id === "string" ? task.id : null) : null,
    }),

  // Page-Aware Ephemeral Context implementation
  pageContext: null,
  setPageContext: (ctx: PageContext | null) => set({ pageContext: ctx }),
  clearPageContext: (id: string) =>
    set((state) => (state.pageContext?.id === id ? { pageContext: null } : {})),

  // Focus Timer implementation
  isTimerOpen: false,
  setTimerOpen: (open: boolean) => set({ isTimerOpen: open }),
  toggleTimer: () => set((state) => ({ isTimerOpen: !state.isTimerOpen })),
  activeFocusTaskId: null,
  setActiveFocusTask: (id: string | null) => set({ activeFocusTaskId: id }),
  timerStatus: "idle",
  setTimerStatus: (status: TimerStatus) => set({ timerStatus: status }),
  elapsedSeconds: 0,
  setElapsedSeconds: (seconds: number | ((prev: number) => number)) =>
    set((state) => ({
      elapsedSeconds: typeof seconds === "function" ? seconds(state.elapsedSeconds) : seconds,
    })),
  resetTimer: () =>
    set({
      timerStatus: "idle",
      elapsedSeconds: 0,
    }),

  // AI Copilot implementation
  isCopilotOpen: false,
  setCopilotOpen: (open: boolean) => set({ isCopilotOpen: open }),
  toggleCopilot: () => set((state) => ({ isCopilotOpen: !state.isCopilotOpen })),

  // Day Strip implementation (defaults to open)
  isDayStripOpen: true,
  setDayStripOpen: (open: boolean) => set({ isDayStripOpen: open }),
  toggleDayStrip: () => set((state) => ({ isDayStripOpen: !state.isDayStripOpen })),
}));

