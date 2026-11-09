import { create } from 'zustand';
import { StandupReport } from '../types';
import { api } from '../services/api';

interface StandupState {
  standups: StandupReport[];
  activeReport: StandupReport | null;
  isGenerating: boolean;
  isLoadingHistory: boolean;
  error: string | null;

  fetchStandups: (sprintId: number, userId?: number | null) => Promise<void>;
  generateStandup: (sprintId: number, userId?: number | null, customContext?: string) => Promise<StandupReport>;
  setActiveReport: (report: StandupReport | null) => void;
}

export const useStandupStore = create<StandupState>((set, get) => ({
  standups: [],
  activeReport: null,
  isGenerating: false,
  isLoadingHistory: false,
  error: null,

  fetchStandups: async (sprintId: number, userId?: number | null) => {
    set({ isLoadingHistory: true, error: null });
    try {
      const standups = await api.getSprintStandups(sprintId, userId);
      set({
        standups,
        activeReport: standups.length > 0 ? standups[0] : null,
        isLoadingHistory: false
      });
    } catch (err: any) {
      set({ error: err.message, isLoadingHistory: false });
    }
  },

  generateStandup: async (sprintId: number, userId?: number | null, customContext?: string) => {
    set({ isGenerating: true, error: null });
    try {
      const report = await api.generateStandup(sprintId, userId, customContext);
      set(state => ({
        standups: [report, ...state.standups],
        activeReport: report,
        isGenerating: false
      }));
      return report;
    } catch (err: any) {
      set({ error: err.message, isGenerating: false });
      throw err;
    }
  },

  setActiveReport: (report) => {
    set({ activeReport: report });
  }
}));
