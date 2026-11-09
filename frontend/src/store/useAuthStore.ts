import { create } from 'zustand';
import { User, Team, TeamMember, TeamRole } from '../types';
import { api } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  teams: Team[];
  activeTeam: Team | null;
  teamMembers: TeamMember[];
  currentUserRole: TeamRole;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  fetchTeams: () => Promise<void>;
  setActiveTeam: (team: Team) => Promise<void>;
  inviteMember: (email: string, role?: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('devsprint_token'),
  teams: [],
  activeTeam: null,
  teamMembers: [],
  currentUserRole: 'member',
  isAdmin: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.login(email, password);
      set({ user: data.user, token: data.access_token, isLoading: false });
      await get().fetchTeams();
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.register(name, email, password);
      set({ user: data.user, token: data.access_token, isLoading: false });
      await get().fetchTeams();
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
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
    if (!activeTeam) return;
    await api.inviteMember(activeTeam.id, email, role);
    await get().setActiveTeam(activeTeam);
  }
}));
