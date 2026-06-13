'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FRMConfig, ProdStatItem } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';
import { useTimeBuffer, averageProdStats, type ProdStatSnapshot } from '@/lib/useTimeBuffer';
import { TIME_WINDOWS, type TimeWindowMs } from '@/components/TimeWindowSelector';

interface Props {
  config: FRMConfig;
  timeWindow: TimeWindowMs;
}

function formatRate(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (Math.abs(v) < 1) return Math.round(v).toString();
  return v.toFixed(1);
}

/* ─── hash colour from item name for fallback badge ─── */
function nameToColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360}, 45%, 38%)`;
}

/* ─── ItemIcon — loads local icon from public/Icons/, badge turns green/red based on balance ─── */
function ItemIcon({ className, name, prod, cons }: { config: FRMConfig; className: string; name: string; prod: number; cons: number }) {
  const [errored, setErrored] = useState(false);
  const short = name.replace(/^Desc_/, '').replace(/_C$/, '');
  const initials = (short.match(/[A-Z]/g) || short.slice(0, 2).split('')).slice(0, 2).join('');

  const bg = prod > cons ? '#1a4d2e' : cons > prod ? '#5c1a1a' : nameToColor(className);

  return (
    <div
      className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden"
      style={{ backgroundColor: errored ? nameToColor(className) : bg }}
    >
      {!errored && (
        <img
          src={`/Icons/${className}.png`}
          alt={name}
          className="w-10 h-10 object-contain"
          onError={() => setErrored(true)}
        />
      )}
      {errored && (
        <span className="text-white font-bold text-sm drop-shadow-md select-none">
          {initials}
        </span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LEDBar — soundboard-style digital balance meter
   10 red segments left  ← centre →  10 green segments right
   Lights fill from centre outward proportional to each side
   ══════════════════════════════════════════════════════════════ */
function LEDBar({
  prod,
  cons,
  theme,
}: {
  prod: number;
  cons: number;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  // Auto-scale: find the magnitude and each bar = 1/10th of that
  const diff = Math.abs(prod - cons);
  const scale = diff <= 0 ? 1 : Math.pow(10, Math.floor(Math.log10(diff)));
  const bars = Math.min(10, Math.floor(diff / scale));
  const isGreen = prod > cons;
  const isRed = cons > prod;

  const greenLit = isGreen ? bars : 0;
  const redLit = isRed ? bars : 0;

  // LED segment: a thin vertical rectangle with rounded corners
  const segW = 6;
  const segH = 14;
  const gap = 3;
  const centreGap = 6; // extra gap at centre

  // Total width: 10 red + centre gap + 10 green
  const totalW = 10 * (segW + gap) - gap + centreGap + 10 * (segW + gap) - gap;
  const h = 48;
  const labelY = h - 2;

  const redColour = theme.danger;
  const greenColour = theme.success;
  const offColour = theme.borderColor;

  // Red segments (left side) — index 0 closest to centre
  const redStartX = 0;
  // Green segments (right side) — index 0 closest to centre
  const greenStartX = 10 * (segW + gap) - gap + centreGap;

  return (
    <svg
      width={totalW}
      height={h}
      viewBox={`0 0 ${totalW} ${h}`}
      className="mx-auto overflow-visible"
    >
      {/* Red segments — drawn right-to-left so index 0 is nearest centre */}
      {Array.from({ length: 10 }, (_, i) => {
        const idx = 9 - i; // reverse so idx 0 is rightmost (nearest centre)
        const lit = idx < redLit;
        const x = redStartX + i * (segW + gap);
        return (
          <rect
            key={`r${i}`}
            x={x}
            y={8}
            width={segW}
            height={segH}
            rx={2.5}
            ry={2.5}
            fill={lit ? redColour : offColour}
            opacity={lit ? 1 : 0.22}
          />
        );
      })}

      {/* Green segments — index 0 nearest centre */}
      {Array.from({ length: 10 }, (_, i) => {
        const lit = i < greenLit;
        const x = greenStartX + i * (segW + gap);
        return (
          <rect
            key={`g${i}`}
            x={x}
            y={8}
            width={segW}
            height={segH}
            rx={2.5}
            ry={2.5}
            fill={lit ? greenColour : offColour}
            opacity={lit ? 1 : 0.22}
          />
        );
      })}

      {/* Centre dividing line */}
      <line
        x1={totalW / 2}
        y1={4}
        x2={totalW / 2}
        y2={segH + 12}
        stroke={theme.textSecondary}
        strokeWidth={1}
        opacity={0.4}
      />

      {/* Scale label — what each bar represents */}
      <text x={totalW / 2} y={segH + 16} textAnchor="middle" fontSize={7} fill={theme.textSecondary} opacity={0.6}>
        ×{scale}
      </text>

      {/* Bottom labels */}
      <text x={redStartX + 5 * (segW + gap) - gap / 2} y={labelY} textAnchor="middle" fontSize={9} fill={redColour} fontWeight={500}>
        {formatRate(cons)}
      </text>
      <text x={greenStartX + 5 * (segW + gap) - gap / 2} y={labelY} textAnchor="middle" fontSize={9} fill={greenColour} fontWeight={500}>
        {formatRate(prod)}
      </text>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   ProductionMonitor
   ══════════════════════════════════════════════════════════════ */
export function ProductionMonitor({ config, timeWindow }: Props) {
  const { theme } = useTheme();
  const [items, setItems] = useState<ProdStatItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Time-series buffer
  const { getWindowData } = useTimeBuffer(items);

  // Sort & filter state
  const [sortMode, setSortMode] = useState<'throughput' | 'prod' | 'cons' | 'name' | 'balance' | 'max'>('throughput');
  const [filterMode, setFilterMode] = useState<'all' | 'surplus' | 'deficit' | 'balanced'>('all');

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchEndpoint<ProdStatItem[]>(config, 'getProdStats');
      setItems(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch production stats');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, config.refreshRate || 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Compute averaged items over selected time window (or use live data if timeWindow=0)
  const displayItems: ProdStatItem[] = useMemo(() => {
    if (timeWindow === 0 || !items) return items ?? [];
    const snapshots = getWindowData(timeWindow) as unknown as ProdStatSnapshot[][];
    if (snapshots.length < 2) return items ?? []; // not enough data yet, fall back to live
    return averageProdStats(snapshots) as ProdStatItem[];
  }, [items, timeWindow, getWindowData]);

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

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: theme.textSecondary }}>
        <p className="text-lg font-medium">No production data</p>
        <p className="text-sm mt-1">Start some factories to see production rates</p>
      </div>
    );
  }

  // Filter
  const filtered = displayItems.filter((i) => {
    if (filterMode === 'surplus') return i.CurrentProd > i.CurrentConsumed;
    if (filterMode === 'deficit') return i.CurrentConsumed > i.CurrentProd;
    if (filterMode === 'balanced') return i.CurrentProd === i.CurrentConsumed;
    return true; // all
  });

  // Sort
  const sorters: Record<typeof sortMode, (a: ProdStatItem, b: ProdStatItem) => number> = {
    throughput: (a, b) => (b.CurrentProd + b.CurrentConsumed) - (a.CurrentProd + a.CurrentConsumed),
    prod: (a, b) => b.CurrentProd - a.CurrentProd,
    cons: (a, b) => b.CurrentConsumed - a.CurrentConsumed,
    name: (a, b) => a.Name.localeCompare(b.Name),
    balance: (a, b) => (b.CurrentProd - b.CurrentConsumed) - (a.CurrentProd - a.CurrentConsumed),
    max: (a, b) => b.MaxProd - a.MaxProd,
  };
  const sorted = [...filtered].sort(sorters[sortMode]);

  const totalProd = displayItems.reduce((s, i) => s + i.CurrentProd, 0);
  const totalCons = displayItems.reduce((s, i) => s + i.CurrentConsumed, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Total Items</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.textPrimary }}>{displayItems.length}</p>
          {timeWindow > 0 && (
            <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>
          )}
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Total Prod/min</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.success }}>
            {formatRate(totalProd)}
          </p>
          {timeWindow > 0 && (
            <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>
          )}
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Total Cons/min</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.danger }}>
            {formatRate(totalCons)}
          </p>
          {timeWindow > 0 && (
            <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>
          )}
        </div>
      </div>

      {/* Item Grid */}
      <div className="rounded-xl p-6" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
        {/* Header row: title + sort + filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: theme.textPrimary }}>
            Production Balance
            {timeWindow > 0 && (
              <span className="text-[10px] font-normal normal-case" style={{ color: theme.accent }}>· {periodLabel} avg</span>
            )}
            {filtered.length !== displayItems.length && (
              <span className="text-[10px] font-normal normal-case opacity-60">
                ({filtered.length} of {displayItems.length})
              </span>
            )}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {/* Sort dropdown */}
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
              className="text-xs rounded-lg px-2 py-1.5 border cursor-pointer appearance-none pr-6"
              style={{
                backgroundColor: theme.bgSecondary,
                color: theme.textPrimary,
                borderColor: theme.borderColor,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%23888' d='M0 2l4 4 4-4z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 6px center',
              }}
            >
              <option value="throughput">Sort: Throughput</option>
              <option value="prod">Sort: Production</option>
              <option value="cons">Sort: Consumption</option>
              <option value="name">Sort: Name</option>
              <option value="balance">Sort: Balance</option>
              <option value="max">Sort: Max Capacity</option>
            </select>

            {/* Filter pills */}
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: theme.borderColor }}>
              {(['all', 'surplus', 'deficit', 'balanced'] as const).map((mode) => {
                const active = filterMode === mode;
                const labels: Record<string, string> = { all: 'All', surplus: 'Surplus', deficit: 'Deficit', balanced: 'Even' };
                const colors: Record<string, string> = { all: theme.textSecondary, surplus: theme.success, deficit: theme.danger, balanced: theme.textSecondary };
                return (
                  <button
                    key={mode}
                    onClick={() => setFilterMode(mode)}
                    className="text-[10px] font-medium px-2.5 py-1 transition-colors uppercase tracking-wide"
                    style={{
                      backgroundColor: active ? colors[mode] + '22' : 'transparent',
                      color: active ? colors[mode] : theme.textSecondary,
                      borderRight: mode !== 'balanced' ? `1px solid ${theme.borderColor}` : 'none',
                    }}
                  >
                    {labels[mode]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {sorted.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: theme.textSecondary }}>
            No items match the current filter
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sorted.map((item, i) => (
            <div
              key={item.ClassName || i}
              className="rounded-lg p-3 flex flex-col items-center gap-2 transition-colors"
              style={{ backgroundColor: theme.bgSecondary, border: `1px solid ${theme.borderColor}` }}
            >
              {/* Item Icon */}
              <ItemIcon config={config} className={item.ClassName} name={item.Name} prod={item.CurrentProd} cons={item.CurrentConsumed} />

              {/* Item Name */}
              <p
                className="text-xs font-medium text-center leading-tight line-clamp-2"
                style={{ color: theme.textPrimary }}
                title={item.Name}
              >
                {item.Name.replace(/^Desc_/, '').replace(/_C$/, '')}
              </p>

              {/* LED Balance Bar */}
              <LEDBar
                prod={item.CurrentProd}
                cons={item.CurrentConsumed}
                theme={theme}
              />

              {/* Detail lines */}
              <div className="w-full text-[10px] space-y-0.5" style={{ color: theme.textSecondary }}>
                <div className="flex justify-between">
                  <span>Prod{timeWindow > 0 ? ' avg' : ''}</span>
                  <span className="font-mono" style={{ color: theme.success }}>{formatRate(item.CurrentProd)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max</span>
                  <span className="font-mono">{formatRate(item.MaxProd)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cons{timeWindow > 0 ? ' avg' : ''}</span>
                  <span className="font-mono" style={{ color: theme.danger }}>{formatRate(item.CurrentConsumed)}</span>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    </div>
  );
}
