import { create } from 'zustand';

interface UIState {
  isOpsPanelOpen: boolean;
  toggleOpsPanel: () => void;
  setOpsPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isOpsPanelOpen: false,
  toggleOpsPanel: () => set((state) => ({ isOpsPanelOpen: !state.isOpsPanelOpen })),
  setOpsPanelOpen: (open) => set({ isOpsPanelOpen: open }),
}));
