import React from 'react';
import { Plus } from 'lucide-react';
import { useSprintStore } from '../../store/useSprintStore';
import { useAuthStore } from '../../store/useAuthStore';

interface SprintHeaderProps {
  onOpenCreateSprint: () => void;
  onOpenCreateTask: () => void;
}

export const SprintHeader: React.FC<SprintHeaderProps> = ({
  onOpenCreateSprint,
  onOpenCreateTask,
}) => {
  const {
    sprints,
    activeSprint,
    setActiveSprint,
  } = useSprintStore();
  const { isAdmin } = useAuthStore();

  const totalPoints = activeSprint?.total_points || 0;
  const completedPoints = activeSprint?.completed_points || 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800/80 transition-colors">
      {/* Left: Sprint selector & metadata */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={activeSprint?.id || ''}
          onChange={(e) => {
            const s = sprints.find((item) => item.id === Number(e.target.value));
            if (s) setActiveSprint(s);
          }}
          className="bg-transparent border-none text-base font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer pr-4 hover:text-black dark:hover:text-white"
        >
          {sprints.map((s) => (
            <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200">
              {s.name}
            </option>
          ))}
          {sprints.length === 0 && <option value="">No Active Sprint</option>}
        </select>

        {activeSprint && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>•</span>
            <span>
              {formatDate(activeSprint.start_date)} – {formatDate(activeSprint.end_date)}
            </span>
            <span>•</span>
            <span className="text-zinc-600 dark:text-zinc-300 font-medium">
              {completedPoints}/{totalPoints} pts done
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {isAdmin && (
          <button
            onClick={onOpenCreateSprint}
            className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            New Sprint
          </button>
        )}

        <button
          onClick={onOpenCreateTask}
          className="px-3.5 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New Task
        </button>
      </div>
    </div>
  );
};
