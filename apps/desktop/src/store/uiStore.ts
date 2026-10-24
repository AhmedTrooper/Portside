import { create } from 'zustand';

export type DockPosition = "top" | "right" | "bottom";

interface UIState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isOpsPanelOpen: boolean;
  toggleOpsPanel: () => void;
  setOpsPanelOpen: (open: boolean) => void;
  dockPos: DockPosition;
  cycleDockPos: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  isOpsPanelOpen: false,
  toggleOpsPanel: () => set((state) => ({ isOpsPanelOpen: !state.isOpsPanelOpen })),
  setOpsPanelOpen: (open) => set({ isOpsPanelOpen: open }),
  dockPos: "top",
  cycleDockPos: () => set((state) => ({
    dockPos: state.dockPos === "top" ? "right" : state.dockPos === "right" ? "bottom" : "top"
  }))
}));
