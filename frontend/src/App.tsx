import React, { useState, useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useSprintStore } from './store/useSprintStore';
import { useThemeStore } from './store/useThemeStore';
import { Navbar } from './components/Navbar';
import { KanbanBoard } from './components/Board/KanbanBoard';
import { StandupView } from './components/Standup/StandupView';
import { BurndownView } from './components/Analytics/BurndownView';
import { CacheStatsModal } from './components/CacheMonitor/CacheStatsModal';
import { TaskDetailModal } from './components/TaskModal/TaskDetailModal';
import { CreateSprintModal } from './components/Modals/CreateSprintModal';
import { CreateTaskModal } from './components/Modals/CreateTaskModal';
import { InviteModal } from './components/Modals/InviteModal';
import { NewTeamModal } from './components/Modals/NewTeamModal';
import { AuthModal, AuthModalMode } from './components/Modals/AuthModal';
import { ChangePasswordModal } from './components/Modals/ChangePasswordModal';
import { TaskStatus } from './types';
import { Loader2 } from 'lucide-react';

export function App() {
  const { user, isLoading, checkAuth, loadAuthConfig, verifyEmail, activeTeam } = useAuthStore();
  const { fetchSprints } = useSprintStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const [currentTab, setCurrentTab] = useState<'board' | 'standup' | 'analytics'>('board');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<AuthModalMode>('signin');
  const [authInitialEmail, setAuthInitialEmail] = useState('');
  const [authResetToken, setAuthResetToken] = useState('');
  const [authExternalNotice, setAuthExternalNotice] = useState<string | null>(null);
  const [authExternalError, setAuthExternalError] = useState<string | null>(null);
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [defaultTaskStatus, setDefaultTaskStatus] = useState<TaskStatus>('TODO');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isNewTeamModalOpen, setIsNewTeamModalOpen] = useState(false);
  const [isCacheStatsOpen, setIsCacheStatsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      await loadAuthConfig();

      const params = new URLSearchParams(window.location.search);
      const verifyToken = params.get('verify_token');
      const resetTokenParam = params.get('reset_token');
      const inviteEmail = params.get('invite_email');

      if (verifyToken) {
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
          await verifyEmail(verifyToken);
          setAuthExternalNotice('Email verified successfully!');
        } catch (err: any) {
          setAuthExternalError(err.message || 'Verification link is invalid or expired.');
          await checkAuth();
          return;
        }
      }

      if (resetTokenParam) {
        useAuthStore.getState().logout();
        window.history.replaceState({}, document.title, window.location.pathname);
        setAuthResetToken(resetTokenParam);
        setAuthInitialMode('reset-password');
        setIsAuthModalOpen(true);
      } else if (inviteEmail) {
        setAuthInitialEmail(inviteEmail);
        setAuthExternalNotice(`Sign in with the temporary password sent to ${inviteEmail}, or continue with Google.`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      await checkAuth();
    };

    initApp();
  }, []);

  useEffect(() => {
    if (activeTeam) {
      fetchSprints(activeTeam.id);
    }
  }, [activeTeam]);

  // If user not authenticated after check, prompt login modal (also keep open on reset-password links)
  useEffect(() => {
    if (!isLoading && (!user || authInitialMode === 'reset-password')) {
      setIsAuthModalOpen(true);
    } else if (user && authInitialMode !== 'reset-password') {
      setIsAuthModalOpen(false);
    }
  }, [isLoading, user, authInitialMode]);

  const handleOpenCreateTask = (status: TaskStatus = 'TODO') => {
    setDefaultTaskStatus(status);
    setIsCreateTaskOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center text-zinc-500">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-600 dark:text-zinc-400 mb-3" />
        <span className="text-sm font-medium">Booting DevSprint Workspace...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col selection:bg-zinc-200 dark:selection:bg-zinc-800 transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
        onOpenNewTeamModal={() => setIsNewTeamModalOpen(true)}
        onOpenCacheStats={() => setIsCacheStatsOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
      />

      {user?.must_change_password && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-4 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-center gap-3">
          <span>You are using a temporary invite password.</span>
          <button
            onClick={() => setIsChangePasswordOpen(true)}
            className="font-semibold underline hover:opacity-80 cursor-pointer"
          >
            Set your own password
          </button>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'board' && (
          <KanbanBoard
            onOpenCreateSprint={() => setIsCreateSprintOpen(true)}
            onOpenCreateTaskWithStatus={handleOpenCreateTask}
          />
        )}

        {currentTab === 'standup' && <StandupView />}

        {currentTab === 'analytics' && <BurndownView />}
      </main>

      {/* System Diagnostics Modal (Admin only) */}
      {isCacheStatsOpen && (
        <CacheStatsModal
          isOpen={isCacheStatsOpen}
          onClose={() => setIsCacheStatsOpen(false)}
        />
      )}

      {/* Modals & Overlays */}
      <TaskDetailModal />
      <CreateSprintModal
        isOpen={isCreateSprintOpen}
        onClose={() => setIsCreateSprintOpen(false)}
      />
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        defaultStatus={defaultTaskStatus}
      />
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
      <NewTeamModal
        isOpen={isNewTeamModalOpen}
        onClose={() => setIsNewTeamModalOpen(false)}
      />
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
      <AuthModal
        isOpen={isAuthModalOpen && (!user || authInitialMode === 'reset-password')}
        onClose={() => {
          setAuthInitialMode('signin');
          setIsAuthModalOpen(false);
        }}
        initialMode={authInitialMode}
        initialEmail={authInitialEmail}
        initialResetToken={authResetToken}
        externalNotice={authExternalNotice}
        externalError={authExternalError}
      />
    </div>
  );
}

export default App;
