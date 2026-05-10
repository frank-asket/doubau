import { create } from "zustand";

/**
 * Phase 4 client UI shell — extend for planner panels, discovery filters, composer state, etc.
 */
type AppUiState = {
  denseTables: boolean;
  setDenseTables: (v: boolean) => void;
};

export const useAppUiStore = create<AppUiState>((set) => ({
  denseTables: false,
  setDenseTables: (denseTables) => set({ denseTables }),
}));
