import React, { useState } from 'react';
import {
  ChevronDown,
  Plus,
  Users,
  LogOut,
  Sun,
  Moon,
  Activity,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

interface NavbarProps {
  currentTab: 'board' | 'standup' | 'analytics';
  setCurrentTab: (tab: 'board' | 'standup' | 'analytics') => void;
  onOpenInviteModal: () => void;
  onOpenNewTeamModal: () => void;
  onOpenCacheStats: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenInviteModal,
  onOpenNewTeamModal,
  onOpenCacheStats,
}) => {
  const { user, teams, activeTeam, setActiveTeam, logout, isAdmin, currentUserRole } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Brand + Team */}
        <div className="flex items-center gap-5">
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => setCurrentTab('board')}
          >
            <div className="w-6 h-6 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold flex items-center justify-center text-xs">
              D
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              DevSprint
            </span>
          </div>

          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">/</span>

          {/* Workspace Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowTeamMenu(!showTeamMenu)}
              className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              <span className="font-medium max-w-[150px] truncate">
                {activeTeam?.name || 'Workspace'}
              </span>
              <ChevronDown className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
            </button>

            {showTeamMenu && (
              <div className="absolute left-0 mt-1.5 w-56 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl p-1 z-50 animate-in fade-in">
                <div className="px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Workspaces
                </div>
                <div className="max-h-48 overflow-y-auto py-0.5">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTeam(t);
                        setShowTeamMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between ${
                        activeTeam?.id === t.id
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                          : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
                <div className="pt-1 mt-1 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      setShowTeamMenu(false);
                      onOpenNewTeamModal();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Workspace
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setShowTeamMenu(false);
                        onOpenInviteModal();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex items-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" /> Invite Teammates
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Clean Minimal Tabs */}
        <nav className="flex items-center gap-1">
          <button
            onClick={() => setCurrentTab('board')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              currentTab === 'board'
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
            }`}
          >
            Board
          </button>

          <button
            onClick={() => setCurrentTab('standup')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              currentTab === 'standup'
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
            }`}
          >
            Daily Standup
          </button>

          <button
            onClick={() => setCurrentTab('analytics')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              currentTab === 'analytics'
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
            }`}
          >
            Burndown
          </button>
        </nav>

        {/* Right: Theme Toggle + User Profile */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-700" />
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium flex items-center justify-center">
                {user?.name?.slice(0, 2).toUpperCase() || 'DS'}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                  isAdmin
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700'
                }`}
              >
                {isAdmin ? 'Admin' : 'Member'}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl p-2 z-50 animate-in fade-in">
                <div className="px-2.5 py-1.5 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-900 dark:text-white truncate">
                      {user?.name}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${isAdmin ? 'text-amber-500' : 'text-zinc-400'}`}>
                      {isAdmin ? 'Team Lead' : 'Engineer'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">{user?.email}</div>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenCacheStats();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 flex items-center gap-2 mb-1"
                  >
                    <Activity className="w-3.5 h-3.5 text-indigo-500" /> System Diagnostics
                  </button>
                )}

                <button
                  onClick={logout}
                  className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
