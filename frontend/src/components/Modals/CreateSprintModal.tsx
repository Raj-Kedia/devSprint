import React, { useState } from 'react';
import { X, Calendar, Plus } from 'lucide-react';
import { useSprintStore } from '../../store/useSprintStore';
import { useAuthStore } from '../../store/useAuthStore';

interface CreateSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateSprintModal: React.FC<CreateSprintModalProps> = ({ isOpen, onClose }) => {
  const { createSprint } = useSprintStore();
  const { activeTeam } = useAuthStore();

  const todayStr = new Date().toISOString().split('T')[0];
  const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(twoWeeksLater);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeam || !name.trim()) return;
    setIsSubmitting(true);
    try {
      await createSprint(activeTeam.id, name.trim(), startDate, endDate);
      onClose();
      setName('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-md p-6 shadow-2xl transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-500" />
            Create New Sprint
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
              Sprint Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Sprint 25 — Mobile Responsive & Webhooks"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-3.5 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-black dark:hover:bg-white disabled:opacity-50 text-white dark:text-zinc-950 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {isSubmitting ? 'Creating...' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
