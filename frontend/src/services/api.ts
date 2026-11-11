import {
  User,
  AuthConfig,
  RegisterResponse,
  MessageResponse,
  Team,
  Sprint,
  SprintBoard,
  Task,
  TaskDetail,
  TaskStatus,
  TaskPriority,
  StandupReport,
  SprintAnalytics,
  CacheStats
} from '../types';

const API_BASE = '/api/v1';

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('devsprint_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; cacheHeader?: string | null }> {
    const token = this.getToken();
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const cacheHeader = res.headers.get('X-Cache');

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: 'An unexpected network error occurred' }));
      const detailMsg = Array.isArray(errorData.detail)
        ? errorData.detail.map((d: any) => d.msg || String(d)).join(', ')
        : errorData.detail;
      const err: any = new Error(detailMsg || `Request failed with status ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    return { data, cacheHeader };
  }

  // Auth
  async getAuthConfig() {
    const res = await this.request<AuthConfig>('/auth/config');
    return res.data;
  }

  async login(email: string, password: string) {
    const res = await this.request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('devsprint_token', res.data.access_token);
    return res.data;
  }

  async loginWithGoogle(credential: string) {
    const res = await this.request<{ access_token: string; user: User }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });
    localStorage.setItem('devsprint_token', res.data.access_token);
    return res.data;
  }

  async register(name: string, email: string, password: string) {
    const res = await this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    return res.data;
  }

  async verifyEmail(token: string) {
    const res = await this.request<{ access_token: string; user: User }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
    localStorage.setItem('devsprint_token', res.data.access_token);
    return res.data;
  }

  async resendVerification(email: string) {
    const res = await this.request<MessageResponse>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    return res.data;
  }

  async forgotPassword(email: string) {
    const res = await this.request<MessageResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    return res.data;
  }

  async resetPassword(token: string, newPassword: string) {
    const res = await this.request<MessageResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword })
    });
    return res.data;
  }

  async changePassword(currentPassword: string | null, newPassword: string) {
    const res = await this.request<MessageResponse>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });
    return res.data;
  }

  async getCurrentUser() {
    const res = await this.request<User>('/auth/me');
    return res.data;
  }

  logout() {
    localStorage.removeItem('devsprint_token');
  }

  // Teams
  async getTeams() {
    const res = await this.request<Team[]>('/teams/');
    return res.data;
  }

  async createTeam(name: string) {
    const res = await this.request<Team>('/teams/', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    return res.data;
  }

  async getTeamDetails(teamId: number) {
    const res = await this.request<Team>(`/teams/${teamId}`);
    return res.data;
  }

  async inviteMember(teamId: number, email: string, role: string = 'member') {
    const res = await this.request<any>(`/teams/${teamId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role })
    });
    return res.data;
  }

  // Sprints
  async getSprints(teamId: number) {
    const res = await this.request<Sprint[]>(`/sprints/team/${teamId}`);
    return res.data;
  }

  async createSprint(teamId: number, name: string, startDate: string, endDate: string) {
    const res = await this.request<Sprint>('/sprints/', {
      method: 'POST',
      body: JSON.stringify({ team_id: teamId, name, start_date: startDate, end_date: endDate, status: 'active' })
    });
    return res.data;
  }

  async getSprintBoard(sprintId: number) {
    const res = await this.request<SprintBoard>(`/sprints/${sprintId}/board`);
    return {
      ...res.data,
      cacheHeader: res.cacheHeader || (res.data.cached ? 'HIT' : 'MISS')
    };
  }

  // Tasks
  async createTask(taskData: {
    sprint_id: number;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    story_points: number;
    assignee_id?: number | null;
  }) {
    const res = await this.request<Task>('/tasks/', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
    return res.data;
  }

  async getTask(taskId: number) {
    const res = await this.request<TaskDetail>(`/tasks/${taskId}`);
    return res.data;
  }

  async updateTask(taskId: number, updates: Partial<Task>) {
    const res = await this.request<Task>(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return res.data;
  }

  async moveTask(taskId: number, newStatus: TaskStatus, newPosition: number = 0) {
    const res = await this.request<Task>(`/tasks/${taskId}/move`, {
      method: 'POST',
      body: JSON.stringify({ new_status: newStatus, new_position: newPosition })
    });
    return res.data;
  }

  async addTaskComment(taskId: number, comment: string) {
    const res = await this.request<TaskDetail>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    });
    return res.data;
  }

  async deleteTask(taskId: number) {
    const res = await this.request<{ message: string }>(`/tasks/${taskId}`, {
      method: 'DELETE'
    });
    return res.data;
  }

  // Daily AI Standup
  async generateStandup(sprintId: number, userId?: number | null, customContext?: string) {
    const res = await this.request<StandupReport>('/standup/generate', {
      method: 'POST',
      body: JSON.stringify({
        sprint_id: sprintId,
        user_id: userId,
        custom_prompt_context: customContext
      })
    });
    return res.data;
  }

  async getSprintStandups(sprintId: number, userId?: number | null) {
    const query = userId ? `?user_id=${userId}` : '';
    const res = await this.request<StandupReport[]>(`/standup/sprint/${sprintId}${query}`);
    return res.data;
  }

  // Analytics & Burndown
  async getSprintAnalytics(sprintId: number) {
    const res = await this.request<SprintAnalytics>(`/analytics/sprint/${sprintId}`);
    return res.data;
  }

  // System & Cache Diagnostics
  async getCacheStats() {
    const res = await this.request<CacheStats>('/system/cache-stats');
    return res.data;
  }

  async clearCache() {
    const res = await this.request<{ message: string; stats: CacheStats }>('/system/cache-clear', {
      method: 'POST'
    });
    return res.data;
  }
}

export const api = new ApiService();
