import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CaptureInfo } from "../lib/api";

interface UIState {
  activeCaptureId: string | null;
  setActiveCapture: (id: string | null) => void;
  captureCache: Record<string, CaptureInfo>;
  upsertCapture: (info: CaptureInfo) => void;
  removeCapture: (id: string) => void;
  // Selection context
  selectedPacket: number | null;
  selectedFlow: string | null;
  selectedHost: string | null;
  setSelectedPacket: (idx: number | null) => void;
  setSelectedFlow: (id: string | null) => void;
  setSelectedHost: (ip: string | null) => void;
  // Filter
  globalFilter: string;
  setGlobalFilter: (s: string) => void;
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  // Command palette
  paletteOpen: boolean;
  setPaletteOpen: (b: boolean) => void;
}

export const useStore = create<UIState>()(
  persist(
    (set) => ({
      activeCaptureId: null,
      setActiveCapture: (id) => set({ activeCaptureId: id, selectedPacket: null, selectedFlow: null, selectedHost: null }),
      captureCache: {},
      upsertCapture: (info) =>
        set((s) => ({ captureCache: { ...s.captureCache, [info.id]: info } })),
      removeCapture: (id) =>
        set((s) => {
          const next = { ...s.captureCache };
          delete next[id];
          return {
            captureCache: next,
            activeCaptureId: s.activeCaptureId === id ? null : s.activeCaptureId,
          };
        }),
      selectedPacket: null,
      selectedFlow: null,
      selectedHost: null,
      setSelectedPacket: (idx) => set({ selectedPacket: idx }),
      setSelectedFlow: (id) => set({ selectedFlow: id }),
      setSelectedHost: (ip) => set({ selectedHost: ip }),
      globalFilter: "",
      setGlobalFilter: (s) => set({ globalFilter: s }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      paletteOpen: false,
      setPaletteOpen: (b) => set({ paletteOpen: b }),
    }),
    {
      name: "tartalo-ui",
      partialize: (state) => ({
        activeCaptureId: state.activeCaptureId,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
