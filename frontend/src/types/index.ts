export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type SprintStatus = 'planning' | 'active' | 'completed';
export type TeamRole = 'admin' | 'member';

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface TeamMember {
  id: number;
  user_id: number;
  team_id: number;
  role: TeamRole;
  user: User;
}

export interface Team {
  id: number;
  name: string;
  created_at: string;
  members?: TeamMember[];
}

export interface Task {
  id: number;
  sprint_id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  story_points: number;
  position: number;
  assignee_id?: number | null;
  assignee?: User | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  task_id: number;
  user_id?: number;
  change_type: string;
  old_value?: string;
  new_value?: string;
  message?: string;
  created_at: string;
  user?: User;
}

export interface TaskDetail extends Task {
  activities: ActivityLog[];
}

export interface Sprint {
  id: number;
  team_id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  created_at: string;
  total_tasks?: number;
  total_points?: number;
  completed_points?: number;
}

export interface SprintBoard {
  sprint: Sprint;
  columns: Record<TaskStatus, Task[]>;
  cached: boolean;
  cache_source?: string;
}

export interface StandupReport {
  id: number;
  sprint_id: number;
  user_id?: number | null;
  report_date: string;
  summary: string;
  yesterday?: string;
  today?: string;
  blockers?: string;
  model_used: string;
  created_at: string;
  user?: User | null;
}

export interface BurndownPoint {
  date: string;
  label: string;
  ideal_points: number;
  actual_points: number;
  completed_points: number;
}

export interface MemberWorkload {
  user_id?: number | null;
  name: string;
  total_tasks: number;
  completed_tasks: number;
  story_points: number;
}

export interface SprintAnalytics {
  sprint_id: number;
  sprint_name: string;
  start_date: string;
  end_date: string;
  total_tasks: number;
  total_points: number;
  completed_points: number;
  remaining_points: number;
  completion_rate_percent: number;
  burndown: BurndownPoint[];
  status_distribution: Record<string, number>;
  priority_distribution: Record<string, number>;
  member_workload: MemberWorkload[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  writes: number;
  invalidations: number;
  mode: string;
  is_connected: boolean;
  total_requests: number;
  hit_ratio_percent: number;
}
