'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FRMConfig, PowerCircuit } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';
import { useTimeBuffer } from '@/lib/useTimeBuffer';
import { TIME_WINDOWS, type TimeWindowMs } from '@/components/TimeWindowSelector';
import { formatPower } from '@/lib/formatters';

interface Props {
  config: FRMConfig;
  timeWindow: TimeWindowMs;
}

/**
 * Horizontal gauge bar showing a value relative to a maximum.
 * Used for power production, consumption, and battery levels.
 */
function GaugeBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="text-[var(--text-primary)] font-mono">{formatPower(value)}</span>
      </div>
      <div className="h-3 bg-[var(--bg-primary)] rounded-full overflow-hidden border border-[var(--border-color)]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/**
 * Power grid dashboard showing all circuits with production,
 * consumption, capacity, and battery status. Supports
 * time-buffered averaging when a time window is selected.
 */
export function PowerDashboard({ config, timeWindow }: Props) {
  const { theme } = useTheme();
  const [circuits, setCircuits] = useState<PowerCircuit[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Time-series buffer
  const { getWindowData } = useTimeBuffer(circuits);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchEndpoint<PowerCircuit[]>(config, 'getPower');
      setCircuits(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch power data');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Compute summary values (averaged over time window when active)
  const { totalProd, totalConsumed, totalCapacity, totalMaxConsumed } = useMemo(() => {
    const source = timeWindow === 0 || !circuits
      ? circuits
      : (() => {
          const snaps = getWindowData(timeWindow);
          if (snaps.length < 2) return circuits;
          // Average each circuit's values across snapshots
          const n = snaps.length;
          const circuitMap = new Map<string, { prod: number; cons: number; cap: number; maxCons: number; count: number }>();
          for (const batch of snaps) {
            if (!batch) continue;
            for (const c of batch) {
              const key = `${c.CircuitGroupID}-${c.CircuitID}`;
              const entry = circuitMap.get(key) || { prod: 0, cons: 0, cap: 0, maxCons: 0, count: 0 };
              entry.prod += c.PowerProduction;
              entry.cons += c.PowerConsumed;
              entry.cap += c.PowerCapacity;
              entry.maxCons += c.PowerMaxConsumed;
              entry.count++;
              circuitMap.set(key, entry);
            }
          }
          return Array.from(circuitMap.values()).map(e => ({
            PowerProduction: e.prod / e.count,
            PowerConsumed: e.cons / e.count,
            PowerCapacity: e.cap / e.count,
            PowerMaxConsumed: e.maxCons / e.count,
          })) as PowerCircuit[];
        })();

    return {
      totalProd: source?.reduce((s, c) => s + c.PowerProduction, 0) ?? 0,
      totalConsumed: source?.reduce((s, c) => s + c.PowerConsumed, 0) ?? 0,
      totalCapacity: source?.reduce((s, c) => s + c.PowerCapacity, 0) ?? 0,
      totalMaxConsumed: source?.reduce((s, c) => s + c.PowerMaxConsumed, 0) ?? 0,
    };
  }, [circuits, timeWindow, getWindowData]);

  const periodLabel = TIME_WINDOWS.find(w => w.value === timeWindow)?.label ?? 'Live';

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

  // Use original circuits for battery & circuit list (not averaged)
  const batteryTotal = circuits?.reduce((sum, c) => sum + c.BatteryCapacity, 0) ?? 0;
  const batteryPct = circuits && circuits.length > 0
    ? circuits.reduce((sum, c) => sum + c.BatteryPercent, 0) / circuits.length
    : 0;
  const anyFuse = circuits?.some(c => c.FuseTriggered) ?? false;
  const batteryDiff = circuits?.reduce((sum, c) => sum + c.BatteryDifferential, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Production</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.success }}>{formatPower(totalProd)}</p>
          {timeWindow > 0 && <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>}
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Consumption</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.textPrimary }}>{formatPower(totalConsumed)}</p>
          {timeWindow > 0 && <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>}
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Capacity</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.info }}>{formatPower(totalCapacity)}</p>
          {timeWindow > 0 && <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>}
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Max Consumption</p>
          <p className="text-2xl font-bold font-mono" style={{ color: totalMaxConsumed > totalCapacity ? theme.danger : theme.accent }}>
            {formatPower(totalMaxConsumed)}
          </p>
          {timeWindow > 0 && <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>}
        </div>
      </div>

      {/* Gauges */}
      <div className="rounded-xl p-6 space-y-5" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: theme.textPrimary }}>Power Gauges</h3>
        <GaugeBar value={totalProd} max={totalCapacity} color={theme.success} label="Production vs Capacity" />
        <GaugeBar value={totalConsumed} max={totalCapacity} color={theme.accent} label="Consumption vs Capacity" />
        <GaugeBar value={totalMaxConsumed} max={totalCapacity} color={totalMaxConsumed > totalCapacity ? theme.danger : theme.accent} label="Max Consumption vs Capacity" />
      </div>

      {/* Battery */}
      {batteryTotal > 0 && (
        <div className="rounded-xl p-6 space-y-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: theme.textPrimary }}>Battery Storage</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <GaugeBar
                value={batteryPct * batteryTotal / 100}
                max={batteryTotal}
                color={batteryDiff > 0 ? theme.success : theme.danger}
                label="Charge Level"
              />
            </div>
            <div className="text-right">
              <p className="text-sm font-mono" style={{ color: theme.textPrimary }}>{batteryPct.toFixed(1)}%</p>
              <p className="text-xs" style={{ color: theme.textSecondary }}>{formatPower(batteryTotal)} total</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: theme.textSecondary }}>Status:</span>
            {batteryDiff > 0 ? (
              <span className="flex items-center gap-1" style={{ color: theme.success }}>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>
                Charging ({formatPower(batteryDiff)})
              </span>
            ) : batteryDiff < 0 ? (
              <span className="flex items-center gap-1" style={{ color: theme.danger }}>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                Draining ({formatPower(Math.abs(batteryDiff))})
              </span>
            ) : (
              <span style={{ color: theme.textSecondary }}>Idle</span>
            )}
          </div>
        </div>
      )}

      {/* Fuse Warning */}
      {anyFuse && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: theme.danger + '18', border: `1px solid ${theme.danger}40` }}>
          <svg className="w-6 h-6" style={{ color: theme.danger }} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span className="font-semibold" style={{ color: theme.danger }}>Fuse Triggered!</span>
          <span className="text-sm" style={{ color: theme.danger, opacity: 0.7 }}>One or more circuits have blown a fuse.</span>
        </div>
      )}

      {/* Circuit List */}
      {circuits && circuits.length > 0 && (
        <div className="rounded-xl p-6" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: theme.textPrimary }}>
            Circuits ({circuits.length})
          </h3>
          <div className="space-y-2">
            {circuits.map((c) => (
              <div
                key={`${c.CircuitGroupID}-${c.CircuitID}`}
                className="flex items-center justify-between p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: c.FuseTriggered ? theme.danger + '18' : theme.bgPrimary,
                  border: `1px solid ${c.FuseTriggered ? theme.danger + '33' : theme.borderColor}`,
                }}
              >
                <div>
                  <span className="font-mono" style={{ color: theme.textPrimary }}>
                    Circuit {c.CircuitID}
                  </span>
                  <span className="text-xs ml-2" style={{ color: theme.textSecondary }}>
                    Group {c.CircuitGroupID}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span style={{ color: theme.success }}>{formatPower(c.PowerProduction)} prod</span>
                  <span style={{ color: theme.textPrimary }}>{formatPower(c.PowerConsumed)} cons</span>
                  <span style={{ color: theme.info }}>{formatPower(c.PowerCapacity)} cap</span>
                  {c.BatteryCapacity > 0 && (
                    <span style={{ color: theme.accent }}>{c.BatteryPercent.toFixed(0)}% bat</span>
                  )}
                  {c.FuseTriggered && (
                    <span className="font-bold" style={{ color: theme.danger }}>FUSE</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
