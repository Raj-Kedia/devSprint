import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, X, Activity } from 'lucide-react';
import { api } from '../../services/api';
import { CacheStats } from '../../types';
import { useSprintStore } from '../../store/useSprintStore';

interface CacheStatsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const CacheStatsModal: React.FC<CacheStatsModalProps> = ({ isOpen = true, onClose }) => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [testResults, setTestResults] = useState<{ step1: string; step2: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const { activeSprint, fetchBoard } = useSprintStore();

  const fetchStats = async () => {
    try {
      const data = await api.getCacheStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClearCache = async () => {
    await api.clearCache();
    await fetchStats();
    if (activeSprint) {
      await fetchBoard(activeSprint.id);
    }
  };

  const runBenchmarkDemo = async () => {
    if (!activeSprint) return;
    setIsTesting(true);
    setTestResults(null);

    try {
      // 1. Purge cache first to guarantee fresh miss
      await api.clearCache();

      // 2. First call (should MISS)
      const t0 = performance.now();
      const res1 = await api.getSprintBoard(activeSprint.id);
      const latency1 = Math.round(performance.now() - t0);

      // 3. Second call (should HIT)
      const t1 = performance.now();
      const res2 = await api.getSprintBoard(activeSprint.id);
      const latency2 = Math.round(performance.now() - t1);

      setTestResults({
        step1: `1st request: ${res1.cacheHeader} (${latency1}ms) — Loaded from database and stored in cache.`,
        step2: `2nd request: ${res2.cacheHeader} (${latency2}ms) — Instant retrieval from Redis memory!`,
      });

      await fetchStats();
      await fetchBoard(activeSprint.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTesting(false);
    }
  };

  const content = (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800/80 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              System Diagnostics
            </h2>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              {stats?.mode || 'Active'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Read-through caching telemetry and live latency benchmark.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runBenchmarkDemo}
            disabled={isTesting || !activeSprint}
            className="px-3.5 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-black dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Testing...
              </>
            ) : (
              'Run Latency Test'
            )}
          </button>

          <button
            onClick={handleClearCache}
            className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            Flush Cache
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Benchmark feedback */}
      {testResults && (
        <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-xs font-mono space-y-1">
          <div className="text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 font-sans font-medium mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Result:
          </div>
          <div className="text-amber-600 dark:text-amber-400">{testResults.step1}</div>
          <div className="text-emerald-600 dark:text-emerald-400">{testResults.step2}</div>
        </div>
      )}

      {/* Clean 4 Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 transition-colors">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Hit Ratio</div>
          <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {stats ? `${stats.hit_ratio_percent}%` : '--'}
          </div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Hits / Total Reads</div>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 transition-colors">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Total Hits</div>
          <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
            {stats?.hits ?? 0}
          </div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Direct from Memory</div>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 transition-colors">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Misses</div>
          <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
            {stats?.misses ?? 0}
          </div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">From database</div>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 transition-colors">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Invalidations</div>
          <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
            {stats?.invalidations ?? 0}
          </div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">On task write/move</div>
        </div>
      </div>

      {/* Explanation */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/30 p-5 space-y-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed transition-colors">
        <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
          Architecture Note
        </h4>
        <p>
          Sprint boards are read frequently by all team members and modified intermittently. DevSprint caches the full serialized board state with a 120-second TTL.
        </p>
        <p>
          Whenever any task is moved, created, edited, commented on, or deleted, DevSprint automatically invalidates the cache for that sprint to guarantee data accuracy.
        </p>
      </div>
    </div>
  );

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-4xl p-6 shadow-2xl transition-colors max-h-[90vh] overflow-y-auto">
          {content}
        </div>
      </div>
    );
  }

  return <div className="w-full max-w-4xl mx-auto space-y-6">{content}</div>;
};
