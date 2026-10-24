import { create } from 'zustand';

interface UIState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isOpsPanelOpen: boolean;
  toggleOpsPanel: () => void;
  setOpsPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  isOpsPanelOpen: false,
  toggleOpsPanel: () => set((state) => ({ isOpsPanelOpen: !state.isOpsPanelOpen })),
  setOpsPanelOpen: (open) => set({ isOpsPanelOpen: open }),
}));
