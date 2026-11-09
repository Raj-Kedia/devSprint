import { create } from 'zustand';
import { SprintAnalytics } from '../types';
import { api } from '../services/api';

interface AnalyticsState {
  analytics: SprintAnalytics | null;
  isLoading: boolean;
  error: string | null;

  fetchAnalytics: (sprintId: number) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  analytics: null,
  isLoading: false,
  error: null,

  fetchAnalytics: async (sprintId: number) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.getSprintAnalytics(sprintId);
      set({ analytics: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  }
}));
