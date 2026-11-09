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
import { AuthModal } from './components/Modals/AuthModal';
import { TaskStatus } from './types';
import { Loader2 } from 'lucide-react';

export function App() {
  const { user, isLoading, checkAuth, activeTeam, isAdmin } = useAuthStore();
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
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [defaultTaskStatus, setDefaultTaskStatus] = useState<TaskStatus>('TODO');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isNewTeamModalOpen, setIsNewTeamModalOpen] = useState(false);
  const [isCacheStatsOpen, setIsCacheStatsOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (activeTeam) {
      fetchSprints(activeTeam.id);
    }
  }, [activeTeam]);

  // If user not authenticated after check, prompt login modal
  useEffect(() => {
    if (!isLoading && !user) {
      setIsAuthModalOpen(true);
    } else if (user) {
      setIsAuthModalOpen(false);
    }
  }, [isLoading, user]);

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
      />

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
      <AuthModal
        isOpen={isAuthModalOpen && !user}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default App;
