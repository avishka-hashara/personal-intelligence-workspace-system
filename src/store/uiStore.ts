import { create } from "zustand";

interface UIState {
  isCommandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  isCaptureOpen: boolean;
  setCaptureOpen: (open: boolean) => void;
  toggleCapture: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCommandOpen: false,
  setCommandOpen: (open: boolean) => set({ isCommandOpen: open }),
  toggleCommand: () => set((state) => ({ isCommandOpen: !state.isCommandOpen })),
  isCaptureOpen: false,
  setCaptureOpen: (open: boolean) => set({ isCaptureOpen: open }),
  toggleCapture: () => set((state) => ({ isCaptureOpen: !state.isCaptureOpen })),
}));
