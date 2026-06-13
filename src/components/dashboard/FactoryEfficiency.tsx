'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FRMConfig, FactoryBuilding } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';
import { useTimeBuffer } from '@/lib/useTimeBuffer';
import { TIME_WINDOWS, type TimeWindowMs } from '@/components/TimeWindowSelector';

interface Props {
  config: FRMConfig;
  timeWindow: TimeWindowMs;
}

interface BuildingSummary {
  type: string;
  total: number;
  producing: number;
  paused: number;
  idle: number;
  avgProductivity: number;
  avgPower: number;
}

function summarizeBuildings(buildings: FactoryBuilding[]): BuildingSummary[] {
  const map = new Map<string, { producing: number; paused: number; idle: number; prodSum: number; powerSum: number }>();

  for (const b of buildings) {
    const type = b.ClassName.replace('Build_', '').replace('_C', '');
    const entry = map.get(type) || { producing: 0, paused: 0, idle: 0, prodSum: 0, powerSum: 0 };

    if (b.IsProducing) entry.producing++;
    else if (b.IsPaused) entry.paused++;
    else entry.idle++;

    entry.prodSum += b.Productivity;
    entry.powerSum += b.PowerInfo?.PowerConsumed ?? 0;

    map.set(type, entry);
  }

  return Array.from(map.entries()).map(([type, data]) => ({
    type,
    total: data.producing + data.paused + data.idle,
    producing: data.producing,
    paused: data.paused,
    idle: data.idle,
    avgProductivity: data.total > 0 ? data.prodSum / data.total : 0,
    avgPower: data.powerSum,
  }));
}

export function FactoryEfficiency({ config, timeWindow }: Props) {
  const { theme } = useTheme();
  const [buildings, setBuildings] = useState<FactoryBuilding[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { getWindowAverage } = useTimeBuffer(buildings);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchEndpoint<FactoryBuilding[]>(config, 'getFactory');
      setBuildings(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch factory data');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const periodLabel = TIME_WINDOWS.find(w => w.value === timeWindow)?.label ?? 'Live';

  const totalPower = useMemo(() => {
    const compute = (batch: FactoryBuilding[]) =>
      summarizeBuildings(batch).reduce((s, g) => s + g.avgPower, 0);
    if (timeWindow === 0 || !buildings) return compute(buildings ?? []);
    return getWindowAverage(timeWindow, (batch) => batch ? compute(batch) : 0);
  }, [buildings, timeWindow, getWindowAverage]);

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

  if (!buildings || buildings.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: theme.textSecondary }}>
        <p className="text-lg font-medium">No factory buildings</p>
        <p className="text-sm mt-1">Build some machines to see stats</p>
      </div>
    );
  }

  const summary = summarizeBuildings(buildings);
  const totalBuildings = summary.reduce((s, g) => s + g.total, 0);
  const totalProducing = summary.reduce((s, g) => s + g.producing, 0);
  const totalPaused = summary.reduce((s, g) => s + g.paused, 0);
  const totalIdle = summary.reduce((s, g) => s + g.idle, 0);

  const filtered = summary.filter((g) =>
    !search || g.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Total Buildings</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.textPrimary }}>{totalBuildings}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.success}33` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Producing</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.success }}>{totalProducing}</p>
          <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>{totalBuildings > 0 ? ((totalProducing / totalBuildings) * 100).toFixed(0) : 0}% active</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.accent}33` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Paused</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.accent }}>{totalPaused}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.danger}33` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Idle / No Recipe</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.danger }}>{totalIdle}</p>
        </div>
      </div>

      {/* Total Power */}
      <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
        <div className="flex justify-between items-center">
          <span className="text-xs uppercase tracking-wider" style={{ color: theme.textSecondary }}>Total Power Draw</span>
          <span className="text-lg font-bold font-mono" style={{ color: theme.accent }}>
            {totalPower >= 1000 ? `${(totalPower / 1000).toFixed(1)} GW` : `${totalPower.toFixed(0)} MW`}
          </span>
          {timeWindow > 0 && <span className="text-[10px]" style={{ color: theme.accent }}>avg · {periodLabel}</span>}
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter building types..."
        className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors"
        style={{
          backgroundColor: theme.bgCard,
          border: `1px solid ${theme.borderColor}`,
          color: theme.textPrimary,
        }}
        onFocus={(e) => (e.target.style.borderColor = theme.accent)}
        onBlur={(e) => (e.target.style.borderColor = theme.borderColor)}
      />

      {/* Building Type List */}
      <div className="rounded-xl p-6" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: theme.textPrimary }}>
          Building Types ({filtered.length})
        </h3>
        <div className="space-y-2">
          {filtered.map((g) => {
            const efficiency = g.total > 0 ? (g.producing / g.total) * 100 : 0;
            return (
              <div key={g.type} className="rounded-lg p-3" style={{ backgroundColor: theme.bgPrimary, border: `1px solid ${theme.borderColor}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium" style={{ color: theme.textPrimary }}>{g.type}</span>
                    <span className="text-xs ml-2" style={{ color: theme.textSecondary }}>{g.total} total</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span style={{ color: theme.success }}>{g.producing} on</span>
                    <span style={{ color: theme.accent }}>{g.paused} paused</span>
                    <span style={{ color: theme.danger }}>{g.idle} idle</span>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex" style={{ backgroundColor: theme.bgSecondary }}>
                  {g.producing > 0 && (
                    <div className="h-full transition-all" style={{ width: `${(g.producing / g.total) * 100}%`, backgroundColor: theme.success }} />
                  )}
                  {g.paused > 0 && (
                    <div className="h-full transition-all" style={{ width: `${(g.paused / g.total) * 100}%`, backgroundColor: theme.accent }} />
                  )}
                  {g.idle > 0 && (
                    <div className="h-full transition-all" style={{ width: `${(g.idle / g.total) * 100}%`, backgroundColor: '#3a3a3e' }} />
                  )}
                </div>
                <div className="flex justify-between mt-1.5 text-xs" style={{ color: theme.textSecondary }}>
                  <span>{efficiency.toFixed(0)}% efficiency</span>
                  <span>Avg productivity: {g.avgProductivity.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
