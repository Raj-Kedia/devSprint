import { create } from 'zustand';
import { Sprint, Task, TaskDetail, TaskStatus, TaskPriority } from '../types';
import { api } from '../services/api';

interface SprintState {
  sprints: Sprint[];
  activeSprint: Sprint | null;
  boardColumns: Record<TaskStatus, Task[]>;
  isLoadingBoard: boolean;
  boardCached: boolean;
  cacheSource: string;
  cacheHeader: string;
  cacheLatencyMs: number;
  selectedTaskId: number | null;
  selectedTaskDetail: TaskDetail | null;
  isLoadingTaskDetail: boolean;

  fetchSprints: (teamId: number) => Promise<void>;
  setActiveSprint: (sprint: Sprint) => void;
  fetchBoard: (sprintId: number) => Promise<void>;
  moveTaskOptimistic: (taskId: number, sourceStatus: TaskStatus, destStatus: TaskStatus, sourceIdx: number, destIdx: number) => Promise<void>;
  createSprint: (teamId: number, name: string, startDate: string, endDate: string) => Promise<Sprint>;
  createTask: (data: {
    sprint_id: number;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    story_points: number;
    assignee_id?: number | null;
  }) => Promise<void>;
  updateTask: (taskId: number, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  openTaskDetail: (taskId: number) => Promise<void>;
  closeTaskDetail: () => void;
  addTaskComment: (taskId: number, comment: string) => Promise<void>;
}

export const useSprintStore = create<SprintState>((set, get) => ({
  sprints: [],
  activeSprint: null,
  boardColumns: {
    TODO: [],
    IN_PROGRESS: [],
    IN_REVIEW: [],
    DONE: []
  },
  isLoadingBoard: false,
  boardCached: false,
  cacheSource: '',
  cacheHeader: 'MISS',
  cacheLatencyMs: 0,
  selectedTaskId: null,
  selectedTaskDetail: null,
  isLoadingTaskDetail: false,

  fetchSprints: async (teamId: number) => {
    try {
      const sprints = await api.getSprints(teamId);
      set({ sprints });
      const currentActive = get().activeSprint;
      if (!currentActive && sprints.length > 0) {
        get().setActiveSprint(sprints[0]);
      } else if (currentActive) {
        const refreshed = sprints.find(s => s.id === currentActive.id) || sprints[0];
        if (refreshed) get().setActiveSprint(refreshed);
      }
    } catch (err) {
      console.error('Failed to fetch sprints', err);
    }
  },

  setActiveSprint: (sprint: Sprint) => {
    set({ activeSprint: sprint });
    get().fetchBoard(sprint.id);
  },

  fetchBoard: async (sprintId: number) => {
    set({ isLoadingBoard: true });
    const startTime = performance.now();
    try {
      const board = await api.getSprintBoard(sprintId);
      const latency = Math.round(performance.now() - startTime);

      set({
        boardColumns: {
          TODO: board.columns.TODO || [],
          IN_PROGRESS: board.columns.IN_PROGRESS || [],
          IN_REVIEW: board.columns.IN_REVIEW || [],
          DONE: board.columns.DONE || []
        },
        boardCached: board.cached,
        cacheSource: board.cache_source || (board.cached ? 'Redis Cache' : 'PostgreSQL Database'),
        cacheHeader: board.cacheHeader || (board.cached ? 'HIT' : 'MISS'),
        cacheLatencyMs: latency,
        isLoadingBoard: false
      });
    } catch (err) {
      console.error('Failed to fetch sprint board', err);
      set({ isLoadingBoard: false });
    }
  },

  moveTaskOptimistic: async (taskId, sourceStatus, destStatus, sourceIdx, destIdx) => {
    const prevColumns = { ...get().boardColumns };
    const sourceCol = [...(prevColumns[sourceStatus] || [])];
    const destCol = sourceStatus === destStatus ? sourceCol : [...(prevColumns[destStatus] || [])];

    const [movedTask] = sourceCol.splice(sourceIdx, 1);
    if (!movedTask) return;

    movedTask.status = destStatus;
    destCol.splice(destIdx, 0, movedTask);

    const newColumns = {
      ...prevColumns,
      [sourceStatus]: sourceCol,
      [destStatus]: destCol
    };

    // Optimistic UI update
    set({ boardColumns: newColumns });

    try {
      await api.moveTask(taskId, destStatus, destIdx);
    } catch (err) {
      console.error('Failed to move task, rolling back', err);
      // Rollback
      set({ boardColumns: prevColumns });
    }
  },

  createSprint: async (teamId, name, startDate, endDate) => {
    const sprint = await api.createSprint(teamId, name, startDate, endDate);
    await get().fetchSprints(teamId);
    get().setActiveSprint(sprint);
    return sprint;
  },

  createTask: async (taskData) => {
    await api.createTask(taskData);
    if (get().activeSprint) {
      await get().fetchBoard(get().activeSprint!.id);
    }
  },

  updateTask: async (taskId, updates) => {
    await api.updateTask(taskId, updates);
    if (get().selectedTaskId === taskId) {
      await get().openTaskDetail(taskId);
    }
    if (get().activeSprint) {
      await get().fetchBoard(get().activeSprint!.id);
    }
  },

  deleteTask: async (taskId) => {
    await api.deleteTask(taskId);
    get().closeTaskDetail();
    if (get().activeSprint) {
      await get().fetchBoard(get().activeSprint!.id);
    }
  },

  openTaskDetail: async (taskId: number) => {
    set({ selectedTaskId: taskId, isLoadingTaskDetail: true });
    try {
      const detail = await api.getTask(taskId);
      set({ selectedTaskDetail: detail, isLoadingTaskDetail: false });
    } catch (err) {
      console.error('Failed to load task detail', err);
      set({ isLoadingTaskDetail: false });
    }
  },

  closeTaskDetail: () => {
    set({ selectedTaskId: null, selectedTaskDetail: null });
  },

  addTaskComment: async (taskId: number, comment: string) => {
    const detail = await api.addTaskComment(taskId, comment);
    set({ selectedTaskDetail: detail });
  }
}));
