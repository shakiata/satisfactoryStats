'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FRMConfig, Extractor } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';
import { useTimeBuffer } from '@/lib/useTimeBuffer';
import { TIME_WINDOWS, type TimeWindowMs } from '@/components/TimeWindowSelector';

interface Props {
  config: FRMConfig;
  timeWindow: TimeWindowMs;
}

export function ResourceTracker({ config, timeWindow }: Props) {
  const { theme } = useTheme();
  const [extractors, setExtractors] = useState<Extractor[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { getWindowAverage } = useTimeBuffer(extractors);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchEndpoint<Extractor[]>(config, 'getExtractor');
      setExtractors(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch extractors');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const periodLabel = TIME_WINDOWS.find(w => w.value === timeWindow)?.label ?? 'Live';

  const productionTotal = useMemo(() => {
    const compute = (batch: Extractor[]) => batch.reduce((sum, e) => sum + (e.production?.reduce((s, p) => s + p.CurrentProd, 0) ?? 0), 0);
    if (timeWindow === 0 || !extractors) return compute(extractors ?? []);
    return getWindowAverage(timeWindow, (batch) => batch ? compute(batch) : 0);
  }, [extractors, timeWindow, getWindowAverage]);

  const filtered = useMemo(() =>
    (extractors ?? []).filter((e) =>
      !search ||
      e.Name.toLowerCase().includes(search.toLowerCase()) ||
      (e.Recipe && e.Recipe.toLowerCase().includes(search.toLowerCase())) ||
      e.production?.some(p => p.Name.toLowerCase().includes(search.toLowerCase()))
    ),
  [extractors, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Extractor[]>();
    for (const e of filtered) {
      const type = e.ClassName
        .replace('Build_', '')
        .replace('_C', '')
        .replace('Miner', '')
        .replace('Resource', '')
        .replace('Extractor', '')
        || e.Recipe?.split(':')[0] || 'Other';
      const list = map.get(type) || [];
      list.push(e);
      map.set(type, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin w-8 h-8" style={{ color: theme.accent }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ backgroundColor: theme.danger + '18', border: `1px solid ${theme.danger}33` }}>
        <p className="text-sm" style={{ color: theme.danger }}>{error}</p>
        <button onClick={fetchData} className="mt-3 text-xs hover:underline" style={{ color: theme.accent }}>Retry</button>
      </div>
    );
  }

  if (!extractors || extractors.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: theme.textSecondary }}>
        <p className="text-lg font-medium">No extractors found</p>
        <p className="text-sm mt-1">Place miners or extractors to see resource data</p>
      </div>
    );
  }

  const activeCount = extractors.filter(e => e.IsProducing).length;
  const pausedCount = extractors.filter(e => e.IsPaused).length;
  const idleCount = extractors.filter(e => !e.IsProducing && !e.IsPaused).length;

  const toggleGroup = (type: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Total Extractors</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.textPrimary }}>{extractors.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.success}33` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Active</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.success }}>{activeCount}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.accent}33` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Paused / Idle</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.accent }}>{pausedCount + idleCount}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.info}33` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Total Prod/min</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.info }}>{Math.abs(productionTotal) < 1 ? Math.round(productionTotal) : productionTotal.toFixed(1)}</p>
          {timeWindow > 0 && <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>}
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter by name or resource..."
        className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors"
        style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}`, color: theme.textPrimary }}
        onFocus={(e) => (e.target.style.borderColor = theme.accent)}
        onBlur={(e) => (e.target.style.borderColor = theme.borderColor)}
      />

      {/* Extractor List — grouped by type */}
      <div className="space-y-3">
        {grouped.map(([type, extractors]) => {
          const isOpen = expanded.has(type);
          const typeProd = extractors.reduce((s, e) => s + (e.production?.reduce((sum, p) => sum + p.CurrentProd, 0) ?? 0), 0);
          return (
            <div key={type} className="rounded-xl overflow-hidden" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(type)}
                className="w-full flex items-center justify-between p-4 text-left hover:brightness-110 transition-colors"
                style={{ backgroundColor: theme.bgCard }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs transition-transform" style={{ color: theme.textSecondary }}>
                    {isOpen ? '▼' : '▶'}
                  </span>
                  <div>
                    <span className="text-sm font-semibold" style={{ color: theme.textPrimary }}>{type.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-xs ml-2" style={{ color: theme.textSecondary }}>
                      {extractors.length} extractor{extractors.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-mono" style={{ color: theme.info }}>
                  {Math.abs(typeProd) < 1 ? Math.round(typeProd) : typeProd.toFixed(1)}/min
                </span>
              </button>
              {/* Expanded list */}
              {isOpen && (
                <div className="grid gap-2 p-3 pt-0">
                  {extractors.map((e, i) => (
                    <div
                      key={e.ID || i}
                      className="rounded-lg p-3"
                      style={{
                        backgroundColor: theme.bgPrimary,
                        border: `1px solid ${e.IsProducing ? theme.success + '33' : e.IsPaused ? theme.accent + '33' : theme.borderColor}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-sm font-medium" style={{ color: theme.textPrimary }}>{e.Name}</span>
                          {e.Recipe && (
                            <span className="text-xs ml-2" style={{ color: theme.textSecondary }}>— {e.Recipe}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {e.IsProducing ? (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: theme.success + '18', color: theme.success, border: `1px solid ${theme.success}33` }}>Active</span>
                          ) : e.IsPaused ? (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: theme.accent + '18', color: theme.accent, border: `1px solid ${theme.accent}33` }}>Paused</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#3a3a3e18', color: theme.textSecondary, border: `1px solid ${theme.borderColor}` }}>Idle</span>
                          )}
                          {e.PowerShards > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              {e.PowerShards}x Shard
                            </span>
                          )}
                        </div>
                      </div>
                      {e.production && e.production.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {e.production.map((p, j) => (
                            <span key={j} className="text-xs rounded-lg px-2 py-1 font-mono" style={{ backgroundColor: theme.bgSecondary, border: `1px solid ${theme.borderColor}` }}>
                              <span style={{ color: theme.textPrimary }}>{p.Name}</span>
                              <span className="ml-1.5" style={{ color: theme.success }}>{Math.abs(p.CurrentProd) < 1 ? Math.round(p.CurrentProd) : p.CurrentProd.toFixed(1)}/min</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: theme.textSecondary }}>
                        <span>Speed: {e.ManuSpeed}%</span>
                        {e.location && (
                          <span>📍 {e.location.x.toFixed(0)}, {e.location.y.toFixed(0)}, {e.location.z.toFixed(0)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
