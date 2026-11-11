import { create } from 'zustand';
import { AuthConfig, MessageResponse, RegisterResponse, Team, TeamMember, TeamRole, User } from '../types';
import { api } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  authConfig: AuthConfig | null;
  teams: Team[];
  activeTeam: Team | null;
  teamMembers: TeamMember[];
  currentUserRole: TeamRole;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;

  loadAuthConfig: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<RegisterResponse>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<MessageResponse>;
  forgotPassword: (email: string) => Promise<MessageResponse>;
  resetPassword: (token: string, newPassword: string) => Promise<MessageResponse>;
  changePassword: (currentPassword: string | null, newPassword: string) => Promise<MessageResponse>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  fetchTeams: () => Promise<void>;
  setActiveTeam: (team: Team) => Promise<void>;
  inviteMember: (email: string, role?: string) => Promise<{ email_sent?: boolean }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('devsprint_token'),
  authConfig: null,
  teams: [],
  activeTeam: null,
  teamMembers: [],
  currentUserRole: 'member',
  isAdmin: false,
  isLoading: true,
  error: null,

  loadAuthConfig: async () => {
    try {
      const authConfig = await api.getAuthConfig();
      set({ authConfig });
    } catch (err) {
      console.error('Failed to load auth config', err);
    }
  },

  login: async (email, password) => {
    set({ error: null });
    try {
      const data = await api.login(email, password);
      set({ user: data.user, token: data.access_token });
      await get().fetchTeams();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  loginWithGoogle: async (credential) => {
    set({ error: null });
    try {
      const data = await api.loginWithGoogle(credential);
      set({ user: data.user, token: data.access_token });
      await get().fetchTeams();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  register: async (name, email, password) => {
    set({ error: null });
    try {
      return await api.register(name, email, password);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  verifyEmail: async (token) => {
    set({ error: null });
    try {
      const data = await api.verifyEmail(token);
      set({ user: data.user, token: data.access_token });
      await get().fetchTeams();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  resendVerification: async (email) => {
    return await api.resendVerification(email);
  },

  forgotPassword: async (email) => {
    return await api.forgotPassword(email);
  },

  resetPassword: async (token, newPassword) => {
    return await api.resetPassword(token, newPassword);
  },

  changePassword: async (currentPassword, newPassword) => {
    const res = await api.changePassword(currentPassword, newPassword);
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, must_change_password: false } });
    }
    return res;
  },

  logout: () => {
    api.logout();
    set({
      user: null,
      token: null,
      teams: [],
      activeTeam: null,
      teamMembers: [],
      currentUserRole: 'member',
      isAdmin: false
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('devsprint_token');
    if (!token) {
      set({ isLoading: false, user: null });
      return;
    }
    set({ isLoading: true });
    try {
      const user = await api.getCurrentUser();
      set({ user, token, isLoading: false });
      await get().fetchTeams();
    } catch {
      api.logout();
      set({ user: null, token: null, isLoading: false });
    }
  },

  fetchTeams: async () => {
    try {
      const teams = await api.getTeams();
      set({ teams });
      const currentActive = get().activeTeam;
      if (!currentActive && teams.length > 0) {
        await get().setActiveTeam(teams[0]);
      } else if (currentActive) {
        const refreshed = teams.find(t => t.id === currentActive.id) || teams[0];
        if (refreshed) await get().setActiveTeam(refreshed);
      }
    } catch (err: any) {
      console.error('Failed to fetch teams', err);
    }
  },

  setActiveTeam: async (team: Team) => {
    set({ activeTeam: team });
    try {
      const detailed = await api.getTeamDetails(team.id);
      const members = detailed.members || [];
      const currentUserId = get().user?.id;
      const myMembership = members.find((m: TeamMember) => m.user_id === currentUserId);
      const role = myMembership?.role || 'member';
      set({
        teamMembers: members,
        currentUserRole: role,
        isAdmin: role === 'admin'
      });
    } catch (err) {
      console.error('Failed to load team members', err);
    }
  },

  inviteMember: async (email: string, role: string = 'member') => {
    const activeTeam = get().activeTeam;
    if (!activeTeam) return {};
    const member = await api.inviteMember(activeTeam.id, email, role);
    await get().setActiveTeam(activeTeam);
    return { email_sent: member?.email_sent };
  }
}));
