'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FRMConfig, ProdStatItem, AppSettings, FactoryBuilding, LocationData } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';
import { useTimeBuffer, averageProdStats, extractItemTimeSeries, type ProdStatSnapshot, type ProdTimePoint } from '@/lib/useTimeBuffer';
import { TIME_WINDOWS, type TimeWindowMs } from '@/components/TimeWindowSelector';
import { formatNumber } from '@/lib/formatters';
import { ItemIcon } from '@/components/ui/ItemIcon';

interface Props {
  config: FRMConfig;
  timeWindow: TimeWindowMs;
  settings: AppSettings;
}

/* ══════════════════════════════════════════════════════════════
   LEDBar — soundboard-style digital balance meter
   10 red segments left  ← centre →  10 green segments right
   Lights fill from centre outward proportional to each side
   ══════════════════════════════════════════════════════════════ */
/**
 * LED-style bar for visualizing a percentage value.
 * Colors shift from green → yellow → red as the value increases.
 */
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
  const magnitude = diff <= 0 ? 1 : Math.pow(10, Math.floor(Math.log10(diff)));
  const scale = Math.max(1, magnitude);
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
      width="100%"
      height={h}
      viewBox={`0 0 ${totalW} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      className="mx-auto"
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
      <rect x={totalW / 2 - 14} y={segH + 9} width={28} height={14} rx={4} fill={theme.bgSecondary} opacity={0.8} />
      <text x={totalW / 2} y={segH + 20} textAnchor="middle" fontSize={9} fontWeight={700} fill={theme.textSecondary}>
        ×{scale}
      </text>

      {/* Bottom labels */}
      <text x={redStartX + 5 * (segW + gap) - gap / 2} y={labelY} textAnchor="middle" fontSize={9} fill={redColour} fontWeight={500}>
        {formatNumber(cons)}
      </text>
      <text x={greenStartX + 5 * (segW + gap) - gap / 2} y={labelY} textAnchor="middle" fontSize={9} fill={greenColour} fontWeight={500}>
        {formatNumber(prod)}
      </text>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   ProdConsChart — SVG time-series line chart
   Plots prod (green) and cons (red) over time for a single item.
   ══════════════════════════════════════════════════════════════ */
/**
 * Inline SVG line chart showing production vs consumption over time.
 * Points are drawn from the buffered ProdTimePoint[] array. If fewer
 * than 2 points exist, a placeholder message is shown instead.
 */
function ProdConsChart({
  points,
  theme,
  height = 160,
}: {
  points: ProdTimePoint[];
  theme: ReturnType<typeof useTheme>['theme'];
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-lg" style={{ height, backgroundColor: theme.bgSecondary }}>
        <p className="text-xs" style={{ color: theme.textSecondary }}>Collecting data…</p>
      </div>
    );
  }

  const pad = { top: 16, right: 16, bottom: 28, left: 48 };
  const chartW = 600;
  const chartH = height;
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;

  // Compute global min/max across both series for a unified Y axis
  const allVals = points.flatMap((p) => [p.prod, p.cons]);
  let yMin = Math.min(0, ...allVals);
  let yMax = Math.max(...allVals);
  // Add 10% headroom so lines don't touch the edge
  const yRange = yMax - yMin || 1;
  yMin -= yRange * 0.05;
  yMax += yRange * 0.05;

  const xScale = (i: number) => pad.left + (i / (points.length - 1)) * innerW;
  const yScale = (v: number) => pad.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  /** Build an SVG polyline points string from the data array, using the given value accessor. */
  const linePoints = (accessor: (p: ProdTimePoint) => number) =>
    points.map((p, i) => `${xScale(i)},${yScale(accessor(p))}`).join(' ');

  /** Build an area polygon (for subtle fill under the line) by adding bottom corners. */
  const areaPoints = (accessor: (p: ProdTimePoint) => number) => {
    const top = points.map((p, i) => `${xScale(i)},${yScale(accessor(p))}`).join(' ');
    const bottom = `${xScale(points.length - 1)},${yScale(yMin)} ${xScale(0)},${yScale(yMin)}`;
    return `${top} ${bottom}`;
  };

  // Y-axis tick marks
  const tickCount = 3;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const val = yMin + (i / (tickCount - 1)) * (yMax - yMin);
    return { val, y: yScale(val), label: formatNumber(val) };
  });

  return (
    <svg
      width="100%"
      height={chartH}
      viewBox={`0 0 ${chartW} ${chartH}`}
      preserveAspectRatio="xMidYMid meet"
      className="overflow-visible"
    >
      {/* Grid lines */}
      {ticks.map((t) => (
        <line
          key={`grid-${t.val}`}
          x1={pad.left}
          y1={t.y}
          x2={chartW - pad.right}
          y2={t.y}
          stroke={theme.borderColor}
          strokeWidth={0.5}
          opacity={0.5}
        />
      ))}

      {/* Y-axis labels */}
      {ticks.map((t) => (
        <text
          key={`tick-${t.val}`}
          x={pad.left - 6}
          y={t.y + 3}
          textAnchor="end"
          fontSize={9}
          fill={theme.textSecondary}
        >
          {t.label}
        </text>
      ))}

      {/* Production area fill */}
      <polygon points={areaPoints((p) => p.prod)} fill={theme.success} opacity={0.08} />

      {/* Consumption area fill */}
      <polygon points={areaPoints((p) => p.cons)} fill={theme.danger} opacity={0.08} />

      {/* Production line */}
      <polyline
        points={linePoints((p) => p.prod)}
        fill="none"
        stroke={theme.success}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Consumption line */}
      <polyline
        points={linePoints((p) => p.cons)}
        fill="none"
        stroke={theme.danger}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* X-axis labels */}
      <text x={pad.left} y={chartH - 6} textAnchor="start" fontSize={9} fill={theme.textSecondary}>
        {points.length} snapshots
      </text>
      <text x={chartW - pad.right} y={chartH - 6} textAnchor="end" fontSize={9} fill={theme.textSecondary}>
        now
      </text>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   ItemDetailPanel — expanded detail for a single selected item
   Shows time-series chart, machine breakdown, and efficiency metrics.
   ══════════════════════════════════════════════════════════════ */
/**
 * Detail panel rendered below the item grid when a user clicks a card.
 * Displays: a prod vs cons time-series chart, max capacity metrics,
 * efficiency percentage, and a machine breakdown table listing every
 * building that produces or consumes this item with power draw and
 * location coordinates.
 */
function ItemDetailPanel({
  item,
  timePoints,
  factories,
  theme,
}: {
  item: ProdStatItem;
  timePoints: ProdTimePoint[];
  factories: FactoryBuilding[] | null;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  // ── Efficiency ──────────────────────────────────────────────
  const prodEff = item.MaxProd > 0 ? (item.CurrentProd / item.MaxProd) * 100 : 0;
  const consEff = item.MaxConsumed > 0 ? (item.CurrentConsumed / item.MaxConsumed) * 100 : 0;

  // ── Machine breakdown ───────────────────────────────────────
  // Find all factory buildings that produce this item or consume it as an ingredient.
  const producers: { building: string; recipe: string; current: number; max: number; eff: number; shards: number; sloops: number; power: number; clock: number; location: LocationData }[] = [];
  const consumers: { building: string; recipe: string; current: number; max: number; eff: number; shards: number; sloops: number; power: number; clock: number; location: LocationData }[] = [];

  if (factories) {
    for (const fb of factories) {
      // Check production output
      for (const p of fb.production) {
        if (p.ClassName === item.ClassName) {
          producers.push({
            building: fb.Name,
            recipe: fb.Recipe,
            current: p.CurrentProd,
            max: p.MaxProd,
            eff: p.ProdPercent,
            shards: fb.PowerShards,
            sloops: fb.Somersloops,
            power: fb.PowerInfo?.PowerConsumed ?? 0,
            clock: fb.ManuSpeed,
            location: fb.location,
          });
        }
      }
      // Check ingredient consumption
      for (const ing of fb.ingredients) {
        if (ing.ClassName === item.ClassName) {
          consumers.push({
            building: fb.Name,
            recipe: fb.Recipe,
            current: ing.CurrentConsumed,
            max: ing.MaxConsumed,
            eff: ing.ConsPercent,
            shards: fb.PowerShards,
            sloops: fb.Somersloops,
            power: fb.PowerInfo?.PowerConsumed ?? 0,
            clock: fb.ManuSpeed,
            location: fb.location,
          });
        }
      }
    }
  }

  const totalProducers = producers.length;
  const totalConsumers = consumers.length;

  return (
    <div className="rounded-xl p-5 space-y-5" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <ItemIcon className={item.ClassName} name={item.Name} prod={item.CurrentProd} cons={item.CurrentConsumed} size="md" />
        <div>
          <h3 className="text-base font-semibold" style={{ color: theme.textPrimary }}>
            {item.Name.replace(/^Desc_/, '').replace(/_C$/, '')}
          </h3>
          <p className="text-[11px] font-mono opacity-60" style={{ color: theme.textSecondary }}>{item.ClassName}</p>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricBadge label="Prod Rate" value={formatNumber(item.CurrentProd)} color={theme.success} theme={theme} />
        <MetricBadge label="Cons Rate" value={formatNumber(item.CurrentConsumed)} color={theme.danger} theme={theme} />
        <MetricBadge label="Net" value={(item.CurrentProd >= item.CurrentConsumed ? '+' : '') + formatNumber(item.CurrentProd - item.CurrentConsumed)} color={item.CurrentProd >= item.CurrentConsumed ? theme.success : theme.danger} theme={theme} />
        <MetricBadge label="Max Prod" value={formatNumber(item.MaxProd)} color={theme.textPrimary} theme={theme} />
        <MetricBadge label="Max Cons" value={formatNumber(item.MaxConsumed)} color={theme.textPrimary} theme={theme} />
        <MetricBadge label="Prod Efficiency" value={prodEff.toFixed(1) + '%'} color={prodEff >= 90 ? theme.success : prodEff >= 50 ? theme.accent : theme.danger} theme={theme} />
        <MetricBadge label="Producers" value={factories ? String(totalProducers) : '…'} color={theme.info} theme={theme} />
        <MetricBadge label="Consumers" value={factories ? String(totalConsumers) : '…'} color={theme.info} theme={theme} />
      </div>

      {/* Time-series chart */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
          Production vs Consumption over time
        </h4>
        <div className="rounded-lg p-2" style={{ backgroundColor: theme.bgSecondary }}>
          <ProdConsChart points={timePoints} theme={theme} />
        </div>
        {/* Legend */}
        <div className="flex justify-center gap-6 mt-1.5">
          <span className="flex items-center gap-1.5 text-[10px]" style={{ color: theme.success }}>
            <span className="inline-block w-2.5 h-0.5 rounded-full" style={{ backgroundColor: theme.success }} />
            Production
          </span>
          <span className="flex items-center gap-1.5 text-[10px]" style={{ color: theme.danger }}>
            <span className="inline-block w-2.5 h-0.5 rounded-full" style={{ backgroundColor: theme.danger }} />
            Consumption
          </span>
        </div>
      </div>

      {/* Machine breakdown tables */}
      {factories && (totalProducers > 0 || totalConsumers > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Producer machines */}
          {totalProducers > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: theme.success }}>
                Producing Machines ({totalProducers})
              </h4>
              <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${theme.borderColor}` }}>
                <table className="w-full text-[10px]">
                  <thead style={{ backgroundColor: theme.bgSecondary }}>
                    <tr>
                      <th className="text-left py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Building</th>
                      <th className="text-left py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Recipe</th>
                      <th className="text-right py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Rate</th>
                      <th className="text-right py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Power</th>
                      <th className="text-right py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Clock</th>
                      <th className="text-right py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Eff</th>
                      <th className="text-right py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Location</th>
                      <th className="text-center py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>⏣</th>
                    </tr>
                  </thead>
                  <tbody>
                    {producers.map((p, i) => (
                      <tr key={`prod-${i}`} style={{ borderTop: i > 0 ? `1px solid ${theme.borderColor}` : 'none' }}>
                        <td className="py-1.5 px-2" style={{ color: theme.textPrimary }}>{p.building}</td>
                        <td className="py-1.5 px-2 font-mono opacity-70" style={{ color: theme.textSecondary }}>{p.recipe}</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: theme.success }}>{formatNumber(p.current)}/{formatNumber(p.max)}</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: theme.textSecondary }}>{formatNumber(p.power, { decimals: 3, unit: 'MW', compact: false })}</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: theme.textSecondary }}>{p.clock.toFixed(3)}%</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: p.eff >= 90 ? theme.success : p.eff >= 50 ? theme.accent : theme.danger }}>{p.eff.toFixed(0)}%</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: theme.textSecondary }}>{p.location.x.toFixed(0)}, {p.location.y.toFixed(0)}, {p.location.z.toFixed(0)}</td>
                        <td className="py-1.5 px-2 text-center" style={{ color: theme.textSecondary }}>
                          {p.shards > 0 && <span title={`${p.shards} power shards`}>{'◆'.repeat(Math.min(p.shards, 3))}</span>}
                          {p.sloops > 0 && <span title={`${p.sloops} somersloops`}>{'◇'.repeat(Math.min(p.sloops, 3))}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Consumer machines */}
          {totalConsumers > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: theme.danger }}>
                Consuming Machines ({totalConsumers})
              </h4>
              <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${theme.borderColor}` }}>
                <table className="w-full text-[10px]">
                  <thead style={{ backgroundColor: theme.bgSecondary }}>
                    <tr>
                      <th className="text-left py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Building</th>
                      <th className="text-left py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Recipe</th>
                      <th className="text-right py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Rate</th>
                      <th className="text-right py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Power</th>
                      <th className="text-right py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Clock</th>
                      <th className="text-right py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Eff</th>
                      <th className="text-right py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Location</th>
                      <th className="text-center py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>⏣</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumers.map((c, i) => (
                      <tr key={`cons-${i}`} style={{ borderTop: i > 0 ? `1px solid ${theme.borderColor}` : 'none' }}>
                        <td className="py-1.5 px-2" style={{ color: theme.textPrimary }}>{c.building}</td>
                        <td className="py-1.5 px-2 font-mono opacity-70" style={{ color: theme.textSecondary }}>{c.recipe}</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: theme.danger }}>{formatNumber(c.current)}/{formatNumber(c.max)}</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: theme.textSecondary }}>{formatNumber(c.power, { decimals: 3, unit: 'MW', compact: false })}</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: theme.textSecondary }}>{c.clock.toFixed(3)}%</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: c.eff >= 90 ? theme.success : c.eff >= 50 ? theme.accent : theme.danger }}>{c.eff.toFixed(0)}%</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: theme.textSecondary }}>{c.location.x.toFixed(0)}, {c.location.y.toFixed(0)}, {c.location.z.toFixed(0)}</td>
                        <td className="py-1.5 px-2 text-center" style={{ color: theme.textSecondary }}>
                          {c.shards > 0 && <span title={`${c.shards} power shards`}>{'◆'.repeat(Math.min(c.shards, 3))}</span>}
                          {c.sloops > 0 && <span title={`${c.sloops} somersloops`}>{'◇'.repeat(Math.min(c.sloops, 3))}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* If factory data not available yet */}
      {!factories && (
        <p className="text-[10px] italic" style={{ color: theme.textSecondary }}>
          Loading machine breakdown…
        </p>
      )}
    </div>
  );
}

/** Small metric display badge used in the detail panel's key-metrics row. */
function MetricBadge({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: string;
  color: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <div className="rounded-lg p-2.5" style={{ backgroundColor: theme.bgSecondary, border: `1px solid ${theme.borderColor}` }}>
      <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: theme.textSecondary }}>{label}</p>
      <p className="text-sm font-bold font-mono" style={{ color }}>{value}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ProductionMonitor
   ══════════════════════════════════════════════════════════════ */
/**
 * Production/consumption monitor tab showing all items as cards in a grid
 * with balance visualization (LED bar). Features:
 * - Text search to find items by name
 * - Sort modes (throughput, production, consumption, name, balance, max)
 * - Filter modes (all, surplus, deficit, balanced)
 * - Click any card to expand a detail panel with time-series chart,
 *   efficiency metrics, and per-machine breakdown
 */
export function ProductionMonitor({ config, timeWindow, settings }: Props) {
  const { theme } = useTheme();
  const [items, setItems] = useState<ProdStatItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Factory data for per-machine breakdown in the detail panel
  const [factories, setFactories] = useState<FactoryBuilding[] | null>(null);
  const factoriesLoaded = useRef(false);

  // Time-series buffer
  const { getWindowData, bufferSize } = useTimeBuffer(items);

  // UI state
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'throughput' | 'prod' | 'cons' | 'name' | 'balance' | 'max'>('throughput');
  const [filterMode, setFilterMode] = useState<'all' | 'surplus' | 'deficit' | 'balanced'>('all');
  const [selectedClassName, setSelectedClassName] = useState<string | null>(null);
  const cardScale = settings.iconSize;

  /* ── Data fetching ─────────────────────────────────────── */

  /** Fetch production stats from the FRM backend. */
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

  /** Fetch factory building data once for machine breakdowns. */
  const fetchFactories = useCallback(async () => {
    if (factoriesLoaded.current) return;
    try {
      const data = await fetchEndpoint<FactoryBuilding[]>(config, 'getFactory');
      setFactories(data);
      factoriesLoaded.current = true;
    } catch {
      // Factory data is supplemental; silently ignore failures
    }
  }, [config]);

  useEffect(() => {
    fetchData();
    fetchFactories();
    const interval = setInterval(fetchData, config.refreshRate || 5000);
    return () => clearInterval(interval);
  }, [fetchData, fetchFactories, config.refreshRate]);

  /* ── Derived data ──────────────────────────────────────── */

  // Compute averaged items over selected time window (or use live data if timeWindow=0)
  const displayItems: ProdStatItem[] = useMemo(() => {
    if (timeWindow === 0 || !items) return items ?? [];
    const snapshots = getWindowData(timeWindow) as unknown as ProdStatSnapshot[][];
    if (snapshots.length < 2) return items ?? [];
    return averageProdStats(snapshots) as ProdStatItem[];
  }, [items, timeWindow, getWindowData]);

  /** Extract time-series points for the selected item from the live buffer. */
  const selectedTimePoints: ProdTimePoint[] = useMemo(() => {
    if (!selectedClassName) return [];
    const snapshots = getWindowData(timeWindow || 5 * 60 * 1000) as unknown as ProdStatSnapshot[][];
    if (snapshots.length < 2) return [];
    return extractItemTimeSeries(snapshots, selectedClassName);
  }, [selectedClassName, getWindowData, timeWindow]);

  const periodLabel = TIME_WINDOWS.find(w => w.value === timeWindow)?.label ?? 'Live';

  /* ── Filter & sort pipeline ────────────────────────────── */

  const filtered = useMemo(() => {
    let result = displayItems;

    // Search filter — match against item name (stripped of Desc_ prefix and _C suffix)
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((i) => {
        const clean = i.Name.replace(/^Desc_/, '').replace(/_C$/, '').toLowerCase();
        return clean.includes(q) || i.ClassName.toLowerCase().includes(q);
      });
    }

    // Surplus/deficit/balanced filter
    if (filterMode === 'surplus') result = result.filter((i) => i.CurrentProd > i.CurrentConsumed);
    if (filterMode === 'deficit') result = result.filter((i) => i.CurrentConsumed > i.CurrentProd);
    if (filterMode === 'balanced') result = result.filter((i) => i.CurrentProd === i.CurrentConsumed);

    return result;
  }, [displayItems, search, filterMode]);

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
  const netBalance = totalProd - totalCons;

  /** The currently selected ProdStatItem, if any. */
  const selectedItem = selectedClassName
    ? displayItems.find((i) => i.ClassName === selectedClassName) ?? null
    : null;

  /* ── Early return states ───────────────────────────────── */

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

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      {/* ═══ Summary Cards ═══ */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Total Production</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.success }}>
            {formatNumber(totalProd)}
          </p>
          {timeWindow > 0 && (
            <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>
          )}
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Total Consumption</p>
          <p className="text-2xl font-bold font-mono" style={{ color: theme.danger }}>
            {formatNumber(totalCons)}
          </p>
          {timeWindow > 0 && (
            <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>
          )}
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${netBalance >= 0 ? theme.success : theme.danger}33` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Net Balance</p>
          <p className="text-2xl font-bold font-mono" style={{ color: netBalance >= 0 ? theme.success : theme.danger }}>
            {netBalance >= 0 ? '+' : ''}{formatNumber(netBalance)}
          </p>
          {timeWindow > 0 && (
            <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>
          )}
        </div>
      </div>

      {/* ═══ Item Grid ═══ */}
      <div className="rounded-xl p-6" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
        {/* Header row: title + search + sort + filter */}
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
            {bufferSize > 0 && (
              <span className="text-[10px] font-normal normal-case opacity-50" title="Buffered snapshots for time-series">
                · {bufferSize} snapshots
              </span>
            )}
          </h3>

          {/* Search + Sort + Filter controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search input */}
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: theme.textSecondary }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items…"
                className="search-input text-xs rounded-lg pl-8 pr-3 py-1.5 border w-40 sm:w-52 transition-colors outline-none"
                style={{
                  backgroundColor: theme.bgSecondary,
                  color: theme.textPrimary,
                  borderColor: theme.borderColor,
                }}
                aria-label="Search production items"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs hover:opacity-80"
                  style={{ color: theme.textSecondary }}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

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
        {/* Selected item detail panel — shown above grid when an item is selected */}
        {selectedItem && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: theme.accent }}>Item Detail</p>
              <button
                onClick={() => setSelectedClassName(null)}
                className="text-[10px] hover:underline"
                style={{ color: theme.textSecondary }}
              >
                Close ✕
              </button>
            </div>
            <ItemDetailPanel
              item={selectedItem}
              timePoints={selectedTimePoints}
              factories={factories}
              theme={theme}
            />
          </div>
        )}

        {sorted.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: theme.textSecondary }}>
            {search.trim() ? 'No items match your search' : 'No items match the current filter'}
          </p>
        ) : (
          <div className={
            cardScale === 'sm' ? 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2' :
            cardScale === 'lg' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5' :
            'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4'
          }>
          {sorted.map((item, i) => {
            const isSelected = selectedClassName === item.ClassName;
            return (
              <div
                key={item.ClassName || i}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedClassName(isSelected ? null : item.ClassName)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedClassName(isSelected ? null : item.ClassName); } }}
                className={`rounded-lg flex flex-col items-center gap-2 transition-all min-w-0 overflow-hidden cursor-pointer ${
                  cardScale === 'sm' ? 'p-2' : cardScale === 'lg' ? 'p-4' : 'p-3'
                }`}
                style={{
                  backgroundColor: isSelected ? theme.accent + '18' : theme.bgSecondary,
                  border: `1px solid ${isSelected ? theme.accent : theme.borderColor}`,
                  boxShadow: isSelected ? `0 0 0 1px ${theme.accent}44` : undefined,
                }}
                title={`${item.Name.replace(/^Desc_/, '').replace(/_C$/, '')} — Click for details`}
              >
                {/* Item Icon */}
                <ItemIcon className={item.ClassName} name={item.Name} prod={item.CurrentProd} cons={item.CurrentConsumed} size={cardScale} />

                {/* Item Name */}
                <p
                  className={`font-medium text-center leading-tight line-clamp-2 ${
                    cardScale === 'sm' ? 'text-[10px]' : cardScale === 'lg' ? 'text-sm' : 'text-xs'
                  }`}
                  style={{ color: theme.textPrimary }}
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
              <div
                className={`w-full space-y-0.5 ${
                  cardScale === 'sm' ? 'text-[8px]' : cardScale === 'lg' ? 'text-xs' : 'text-[10px]'
                }`}
                style={{ color: theme.textSecondary }}
              >
                <div className="flex justify-between">
                  <span>Prod{timeWindow > 0 ? ' avg' : ''}</span>
                  <span className="font-mono" style={{ color: theme.success }}>{formatNumber(item.CurrentProd)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net</span>
                  <span className="font-mono" style={{ color: item.CurrentProd >= item.CurrentConsumed ? theme.success : theme.danger }}>
                    {item.CurrentProd >= item.CurrentConsumed ? '+' : ''}{formatNumber(item.CurrentProd - item.CurrentConsumed)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cons{timeWindow > 0 ? ' avg' : ''}</span>
                  <span className="font-mono" style={{ color: theme.danger }}>{formatNumber(item.CurrentConsumed)}</span>
                </div>
              </div>
            </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}
