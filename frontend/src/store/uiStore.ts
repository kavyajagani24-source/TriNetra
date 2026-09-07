/**
 * UrbanEye AI — UI State (Zustand)
 *
 * Tracks sidebar collapse state, toast notifications, active modal dialogs.
 */

import { create } from "zustand";

interface UiState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  busModalOpen: boolean;
  setBusModalOpen: (open: boolean) => void;
  videoUploadModalOpen: boolean;
  setVideoUploadModalOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed:
    typeof window !== "undefined" && localStorage.getItem("urbaneye_sidebar_collapsed") !== null
      ? localStorage.getItem("urbaneye_sidebar_collapsed") === "true"
      : false,
  setSidebarCollapsed: (collapsed: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("urbaneye_sidebar_collapsed", String(collapsed));
    }
    set({ sidebarCollapsed: collapsed });
  },
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      if (typeof window !== "undefined") {
        localStorage.setItem("urbaneye_sidebar_collapsed", String(next));
      }
      return { sidebarCollapsed: next };
    }),
  busModalOpen: false,
  setBusModalOpen: (open) => set({ busModalOpen: open }),
  videoUploadModalOpen: false,
  setVideoUploadModalOpen: (open) => set({ videoUploadModalOpen: open }),
}));
