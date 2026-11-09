import React, { useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useAnalyticsStore } from '../../store/useAnalyticsStore';
import { useSprintStore } from '../../store/useSprintStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';

export const BurndownView: React.FC = () => {
  const { activeSprint } = useSprintStore();
  const { analytics, isLoading, fetchAnalytics } = useAnalyticsStore();
  const { user } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    if (activeSprint) {
      fetchAnalytics(activeSprint.id);
    }
  }, [activeSprint]);

  if (isLoading || !analytics) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400 dark:text-zinc-500 text-xs">
        Loading analytics...
      </div>
    );
  }

  const todayPoint = analytics.burndown[analytics.burndown.length - 1];
  const isHealthy = todayPoint ? todayPoint.actual_points <= todayPoint.ideal_points + 2 : true;
  const gridColor = theme === 'dark' ? '#27272a' : '#e4e4e7';
  const axisColor = theme === 'dark' ? '#71717a' : '#a1a1aa';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800/80 transition-colors">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Sprint Analytics & Burndown
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Story points completion vs ideal linear projection.
        </p>
      </div>

      {/* 4 Simple Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 transition-colors">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Total Scope</div>
          <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
            {analytics.total_points} <span className="text-xs text-zinc-500 font-sans">pts</span>
          </div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{analytics.total_tasks} tasks</div>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 transition-colors">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Completed</div>
          <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {analytics.completed_points} <span className="text-xs text-zinc-500 font-sans">pts</span>
          </div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{analytics.completion_rate_percent}% done</div>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 transition-colors">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Remaining</div>
          <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
            {analytics.remaining_points} <span className="text-xs text-zinc-500 font-sans">pts</span>
          </div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">To finish</div>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 transition-colors">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Pace</div>
          <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            {isHealthy ? 'On Track' : 'Behind'}
          </div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Against ideal burn</div>
        </div>
      </div>

      {/* Clean Burndown Chart */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/30 p-5 space-y-3 transition-colors">
        <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Burndown Trajectory</span>
          <div className="flex items-center gap-4 text-[11px] text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-zinc-400 dark:bg-zinc-500 border-dashed"></span>
              <span>Ideal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-blue-500"></span>
              <span>Actual Remaining</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.burndown} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="date" stroke={axisColor} tick={{ fontSize: 10 }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 10 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs space-y-1 shadow-md">
                        <div className="font-medium text-zinc-900 dark:text-zinc-200">{data.label}</div>
                        <div className="text-zinc-500 dark:text-zinc-400 flex justify-between gap-3 text-[11px]">
                          <span>Ideal:</span>
                          <span className="font-mono">{data.ideal_points} pt</span>
                        </div>
                        <div className="text-blue-600 dark:text-blue-400 flex justify-between gap-3 text-[11px] font-medium">
                          <span>Actual:</span>
                          <span className="font-mono">{data.actual_points} pt</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="actual_points"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="#3b82f6"
                fillOpacity={theme === 'dark' ? 0.1 : 0.05}
              />
              <Line
                type="linear"
                dataKey="ideal_points"
                stroke="#a1a1aa"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Member Workload Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/30 p-5 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            Team Capacity & Workload
          </h4>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
            Active Sprint Allocation
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 text-[11px]">
                <th className="pb-2 font-medium">Teammate</th>
                <th className="pb-2 text-center font-medium">Tasks</th>
                <th className="pb-2 text-center font-medium">Done</th>
                <th className="pb-2 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {analytics.member_workload.map((m) => {
                const isMe = m.user_id === user?.id;
                return (
                  <tr
                    key={m.name}
                    className={`transition-colors ${
                      isMe
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/20 font-medium'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'
                    }`}
                  >
                    <td className="py-2.5 text-zinc-800 dark:text-zinc-300">
                      <span className="flex items-center gap-1.5">
                        {m.name}
                        {isMe && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold">
                            You
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 text-center text-zinc-500 dark:text-zinc-400">{m.total_tasks}</td>
                    <td className="py-2.5 text-center text-emerald-600 dark:text-emerald-400 font-medium">{m.completed_tasks}</td>
                    <td className="py-2.5 text-right font-mono text-zinc-700 dark:text-zinc-300">{m.story_points}pt</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
