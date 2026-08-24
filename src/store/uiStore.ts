import { create } from "zustand";

interface UIState {
  isCommandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCommandOpen: false,
  setCommandOpen: (open: boolean) => set({ isCommandOpen: open }),
  toggleCommand: () => set((state) => ({ isCommandOpen: !state.isCommandOpen })),
}));
