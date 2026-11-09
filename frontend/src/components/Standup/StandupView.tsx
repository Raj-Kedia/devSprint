import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  History,
} from 'lucide-react';
import { useStandupStore } from '../../store/useStandupStore';
import { useSprintStore } from '../../store/useSprintStore';
import { useAuthStore } from '../../store/useAuthStore';

export const StandupView: React.FC = () => {
  const { activeSprint } = useSprintStore();
  const { teamMembers, user, isAdmin } = useAuthStore();
  const {
    standups,
    activeReport,
    isGenerating,
    fetchStandups,
    generateStandup,
    setActiveReport,
  } = useStandupStore();

  const [selectedUserId, setSelectedUserId] = useState<string>('team');
  const [customContext, setCustomContext] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeSprint) {
      fetchStandups(activeSprint.id);
    }
  }, [activeSprint]);

  const handleGenerate = async () => {
    if (!activeSprint) return;
    const uid = selectedUserId === 'team' ? null : Number(selectedUserId);
    await generateStandup(activeSprint.id, uid, customContext);
    setCustomContext('');
  };

  const handleCopy = () => {
    if (!activeReport) return;
    const text = `*DevSprint Daily Standup — ${activeReport.report_date}*\n\n` +
      `*Summary:*\n${activeReport.summary}\n\n` +
      `*Yesterday:* \n${activeReport.yesterday || 'None'}\n\n` +
      `*Today:* \n${activeReport.today || 'None'}\n\n` +
      `*Blockers:* \n${activeReport.blockers || 'None'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Clean Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800/80 transition-colors">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Daily Standup
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            AI-synthesized daily progress, priorities, and blockers from 24h sprint activity.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer"
            >
              <option value="team">All Team Members</option>
              {teamMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user?.name || `Teammate #${m.user_id}`}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer"
            >
              <option value="team">All Team Members</option>
              {user && (
                <option value={user.id}>
                  My Standup ({user.name})
                </option>
              )}
            </select>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !activeSprint}
            className="px-3.5 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-black dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" /> Generate Standup
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 cols: Current Standup */}
        <div className="md:col-span-2 space-y-4">
          {activeReport ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-5 space-y-5 transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {formatDate(activeReport.report_date)}
                  </h3>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    Scope: {activeReport.user?.name || 'All Team Members'}
                  </span>
                </div>

                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>

              {/* Summary */}
              <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-900/80 p-3.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800/60">
                {activeReport.summary}
              </div>

              {/* Sections */}
              <div className="space-y-4 text-xs">
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Yesterday
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 pl-3 leading-relaxed">
                    {activeReport.yesterday || 'No closed tickets.'}
                  </p>
                </div>

                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    Today
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 pl-3 leading-relaxed">
                    {activeReport.today || 'Working on backlog tasks.'}
                  </p>
                </div>

                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Blockers
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 pl-3 leading-relaxed">
                    {activeReport.blockers || 'None.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
              No report generated yet. Click 'Generate Standup' to summarize recent activity.
            </div>
          )}
        </div>

        {/* Right: History Archive */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/30 p-4 transition-colors">
          <div className="flex items-center gap-2 pb-2 mb-3 border-b border-zinc-100 dark:border-zinc-800/60 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <History className="w-3.5 h-3.5" />
            Previous Standups
          </div>

          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {standups.map((rep) => (
              <button
                key={rep.id}
                onClick={() => setActiveReport(rep)}
                className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  activeReport?.id === rep.id
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                }`}
              >
                <div className="text-[11px] font-medium truncate">
                  {formatDate(rep.report_date)}
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                  {rep.user?.name || 'Team Summary'}
                </div>
              </button>
            ))}
            {standups.length === 0 && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 py-4 text-center">No past records.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
