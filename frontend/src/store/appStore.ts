/**
 * UrbanEye AI — Global Application State (Zustand)
 *
 * Tracks Demo Mode status, selected bus, selected video, and active inspection items.
 */

import { create } from "zustand";
import { env } from "@/config/env";

interface AppState {
  demoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  toggleDemoMode: () => void;
  selectedBusId: string | null;
  setSelectedBusId: (id: string | null) => void;
  selectedVideoId: string | null;
  setSelectedVideoId: (id: string | null) => void;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  backendOnline: boolean | null;
  setBackendOnline: (status: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  demoMode:
    typeof window !== "undefined" && localStorage.getItem("urbaneye_demo_mode") !== null
      ? localStorage.getItem("urbaneye_demo_mode") === "true"
      : env.demoModeDefault,
  setDemoMode: (enabled: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("urbaneye_demo_mode", String(enabled));
    }
    set({ demoMode: enabled });
  },
  toggleDemoMode: () =>
    set((state) => {
      const next = !state.demoMode;
      if (typeof window !== "undefined") {
        localStorage.setItem("urbaneye_demo_mode", String(next));
      }
      return { demoMode: next };
    }),
  selectedBusId: null,
  setSelectedBusId: (id) => set({ selectedBusId: id }),
  selectedVideoId: null,
  setSelectedVideoId: (id) => set({ selectedVideoId: id }),
  selectedEventId: null,
  setSelectedEventId: (id) => set({ selectedEventId: id }),
  backendOnline: null,
  setBackendOnline: (status) => set({ backendOnline: status }),
}));
