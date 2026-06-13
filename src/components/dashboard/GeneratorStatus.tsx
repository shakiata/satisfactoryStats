'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FRMConfig, Generator } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';
import { useTimeBuffer } from '@/lib/useTimeBuffer';
import { TIME_WINDOWS, type TimeWindowMs } from '@/components/TimeWindowSelector';

interface Props {
  config: FRMConfig;
  timeWindow: TimeWindowMs;
}

export function GeneratorStatus({ config, timeWindow }: Props) {
  const { theme } = useTheme();
  const [generators, setGenerators] = useState<Generator[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getWindowAverage } = useTimeBuffer(generators);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchEndpoint<Generator[]>(config, 'getGenerators');
      setGenerators(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch generators');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const periodLabel = TIME_WINDOWS.find(w => w.value === timeWindow)?.label ?? 'Live';

  const { totalProduction, totalCapacity, avgLoad } = useMemo(() => {
    if (timeWindow === 0 || !generators) {
      return {
        totalProduction: generators?.reduce((s, g) => s + g.PowerProductionPotential, 0) ?? 0,
        totalCapacity: generators?.reduce((s, g) => s + g.ProductionCapacity, 0) ?? 0,
        avgLoad: generators ? generators.reduce((s, g) => s + g.LoadPercentage, 0) / generators.length : 0,
      };
    }
    return {
      totalProduction: getWindowAverage(timeWindow, (batch) => batch?.reduce((s, g) => s + g.PowerProductionPotential, 0) ?? 0),
      totalCapacity: getWindowAverage(timeWindow, (batch) => batch?.reduce((s, g) => s + g.ProductionCapacity, 0) ?? 0),
      avgLoad: getWindowAverage(timeWindow, (batch) => batch ? batch.reduce((s, g) => s + g.LoadPercentage, 0) / batch.length : 0),
    };
  }, [generators, timeWindow, getWindowAverage]);

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

  if (!generators || generators.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: theme.textSecondary }}>
        <p className="text-lg font-medium">No generators found</p>
        <p className="text-sm mt-1">Build some power generators to see stats</p>
      </div>
    );
  }

  const byType = new Map<string, { count: number; production: number; capacity: number }>();
  for (const g of generators) {
    const type = g.ClassName.replace('Build_', '').replace('_C', '').replace('Generator', '');
    const entry = byType.get(type) || { count: 0, production: 0, capacity: 0 };
    entry.count++;
    entry.production += g.PowerProductionPotential;
    entry.capacity += g.ProductionCapacity;
    byType.set(type, entry);
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Total Generators</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.textPrimary }}>{generators.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.success}33` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Current Output</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.success }}>
            {totalProduction >= 1000 ? `${(totalProduction / 1000).toFixed(1)} GW` : `${totalProduction.toFixed(0)} MW`}
          </p>
          {timeWindow > 0 && <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>}
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.info}33` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Max Capacity</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.info }}>
            {totalCapacity >= 1000 ? `${(totalCapacity / 1000).toFixed(1)} GW` : `${totalCapacity.toFixed(0)} MW`}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.accent}33` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Avg Load</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.accent }}>{avgLoad.toFixed(0)}%</p>
          {timeWindow > 0 && <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>}
        </div>
      </div>

      {/* Type Breakdown */}
      <div className="rounded-xl p-6" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: theme.textPrimary }}>
          Generator Types ({byType.size})
        </h3>
        <div className="grid gap-2">
          {Array.from(byType.entries()).map(([type, data]) => (
            <div key={type} className="rounded-lg p-3" style={{ backgroundColor: theme.bgPrimary, border: `1px solid ${theme.borderColor}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium" style={{ color: theme.textPrimary }}>{type}</span>
                <span className="text-xs" style={{ color: theme.textSecondary }}>{data.count} units</span>
              </div>
              <div className="flex gap-4 text-xs font-mono">
                <span style={{ color: theme.success }}>Output: {data.production >= 1000 ? `${(data.production / 1000).toFixed(1)} GW` : `${data.production.toFixed(0)} MW`}</span>
                <span style={{ color: theme.info }}>Capacity: {data.capacity >= 1000 ? `${(data.capacity / 1000).toFixed(1)} GW` : `${data.capacity.toFixed(0)} MW`}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Individual Generators */}
      <div className="rounded-xl p-6" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: theme.textPrimary }}>
          All Generators ({generators.length})
        </h3>
        <div className="grid gap-2">
          {generators.slice(0, 50).map((g, i) => (
            <div key={g.ID || i} className="rounded-lg p-3" style={{ backgroundColor: theme.bgPrimary, border: `1px solid ${theme.borderColor}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: theme.textPrimary }}>{g.Name}</span>
                  {!g.IsFullSpeed && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: theme.danger + '18', color: theme.danger, border: `1px solid ${theme.danger}33` }}>
                      Not at speed
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono" style={{ color: theme.textSecondary }}>
                  Load: {g.LoadPercentage.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden border" style={{ backgroundColor: theme.bgSecondary, borderColor: theme.borderColor }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${g.LoadPercentage}%`,
                    backgroundColor: g.LoadPercentage > 90 ? theme.success : g.LoadPercentage > 50 ? theme.accent : theme.info,
                  }}
                />
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs" style={{ color: theme.textSecondary }}>
                {g.FuelResource && <span>⛽ {g.FuelResource}: {g.FuelAmount?.toFixed(0)}</span>}
                <span>⚡ {g.PowerProductionPotential >= 1000 ? `${(g.PowerProductionPotential / 1000).toFixed(1)} GW` : `${g.PowerProductionPotential.toFixed(0)} MW`}</span>
              </div>
            </div>
          ))}
          {generators.length > 50 && (
            <p className="text-xs text-center mt-2" style={{ color: theme.textSecondary }}>
              Showing 50 of {generators.length} generators
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
