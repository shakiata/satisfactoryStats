'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FRMConfig,
  AppSettings,
  ProdStatItem,
  ProdStatSnapshot,
  FactoryBuilding,
  Extractor,
} from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';
import { useTimeBuffer, averageProdStats } from '@/lib/useTimeBuffer';
import { TIME_WINDOWS, type TimeWindowMs } from '@/components/TimeWindowSelector';
import { formatNumber } from '@/lib/formatters';
import { getFluidSummaries, traceRawMaterials, mergeExtractorFluids } from '@/lib/fluids';
import type { FluidSummary, RawMaterialLink, FluidMachineEntry, RawRecipe } from '@/lib/fluids';

interface Props {
  config: FRMConfig;
  timeWindow: TimeWindowMs;
  settings: AppSettings;
}

/* ══════════════════════════════════════════════════════════════
   FluidBar — compact balance visualizer for fluid cards
   Shows a split green/red bar with production (left) vs
   consumption (right) proportions.
   ══════════════════════════════════════════════════════════════ */

/**
 * A compact horizontal bar showing the balance between fluid production
 * and consumption. The left portion (green) represents production, the
 * right portion (red) represents consumption. The total width is capped
 * at 100% and scales proportionally.
 */
function FluidBar({
  prod,
  cons,
  theme,
}: {
  prod: number;
  cons: number;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const total = prod + cons || 1;
  const prodPct = Math.min(100, Math.max(0, (prod / total) * 100));
  const consPct = Math.min(100, Math.max(0, (cons / total) * 100));

  return (
    <div className="w-full h-2 rounded-full overflow-hidden flex" style={{ backgroundColor: theme.bgPrimary }}>
      {/* Production side */}
      <div
        className="h-full transition-all duration-300"
        style={{ width: `${prodPct}%`, backgroundColor: theme.success }}
      />
      {/* Neutral gap */}
      {prodPct + consPct < 100 && (
        <div
          className="h-full"
          style={{ width: `${100 - prodPct - consPct}%`, backgroundColor: 'transparent' }}
        />
      )}
      {/* Consumption side */}
      <div
        className="h-full transition-all duration-300"
        style={{ width: `${consPct}%`, backgroundColor: theme.danger }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FluidMachineTable — expandable per-building breakdown
   Lists Refineries, Blenders, Packagers, and Extractors that
   produce or consume a particular fluid.
   ══════════════════════════════════════════════════════════════ */

/**
 * Table showing every building that produces or consumes the selected
 * fluid, with recipe, rate, efficiency, and shard/sloop counts.
 */
function FluidMachineTable({
  machines,
  kind,
  theme,
}: {
  machines: FluidMachineEntry[];
  kind: 'producer' | 'consumer';
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  if (machines.length === 0) return null;

  const color = kind === 'producer' ? theme.success : theme.danger;
  const label = kind === 'producer' ? 'Producing Machines' : 'Consuming Machines';

  return (
    <div>
      <h4
        className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2"
        style={{ color }}
      >
        {label} ({machines.length})
      </h4>
      <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${theme.borderColor}` }}>
        <table className="w-full text-[10px]">
          <thead style={{ backgroundColor: theme.bgSecondary }}>
            <tr>
              <th className="text-left py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Building</th>
              <th className="text-left py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Recipe</th>
              <th className="text-right py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Rate</th>
              <th className="text-right py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>Eff</th>
              <th className="text-center py-1.5 px-2 font-medium" style={{ color: theme.textSecondary }}>⏣</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m, i) => (
              <tr
                key={`${kind}-${i}`}
                style={{
                  borderTop: i > 0 ? `1px solid ${theme.borderColor}` : 'none',
                  opacity: m.isActive ? 1 : 0.5,
                }}
              >
                <td className="py-1.5 px-2" style={{ color: theme.textPrimary }}>{m.building}</td>
                <td className="py-1.5 px-2 font-mono opacity-70" style={{ color: theme.textSecondary }}>
                  {m.recipe.replace(/^Recipe_/, '').replace(/_C$/, '')}
                </td>
                <td className="py-1.5 px-2 text-right font-mono" style={{ color }}>
                  {formatNumber(m.currentRate)}/{formatNumber(m.maxRate)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono" style={{
                  color: m.efficiency >= 90 ? theme.success : m.efficiency >= 50 ? theme.accent : theme.danger,
                }}>
                  {m.efficiency.toFixed(0)}%
                </td>
                <td className="py-1.5 px-2 text-center" style={{ color: theme.textSecondary }}>
                  {m.shards > 0 && <span title={`${m.shards} power shards`}>{'◆'.repeat(Math.min(m.shards, 3))}</span>}
                  {m.sloops > 0 && <span title={`${m.sloops} somersloops`}>{'◇'.repeat(Math.min(m.sloops, 3))}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FluidDashboard
   ══════════════════════════════════════════════════════════════ */

/**
 * Dashboard tab showing fluids in your pipe network.
 *
 * Features:
 * - Summary cards per fluid type (prod rate, cons rate, net balance, stored amount)
 * - Text search to filter fluid cards
 * - Sort modes (throughput, name, net balance, stored amount)
 * - Click any fluid card to expand per-building breakdown + raw material trace
 * - Infrastructure overview (total pipes, pumps, valves)
 * - Gas vs liquid differentiation with appropriate unit labels
 * - Theme-aware styling via useTheme()
 */
export function FluidDashboard({ config, timeWindow }: Props) {
  const { theme } = useTheme();

  // ─── Data state ──────────────────────────────────────────
  const [items, setItems] = useState<ProdStatItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // World inventory for stored fluid estimates
  const [worldInv, setWorldInv] = useState<Map<string, number> | null>(null);

  // Recipe data for raw material tracing
  const [recipes, setRecipes] = useState<RawRecipe[] | null>(null);

  // Factory buildings for per-machine breakdown
  const [machines, setMachines] = useState<FactoryBuilding[] | null>(null);
  const [extractors, setExtractors] = useState<Extractor[] | null>(null);
  const machinesLoaded = useRef(false);

  // Infrastructure counts
  const [pipeCount, setPipeCount] = useState<number | null>(null);
  const [pumpCount, setPumpCount] = useState<number | null>(null);

  /** Merge getProdStats items with fluid entries from getExtractor.
   *  FRM reports fluid production (Water, Crude Oil) via getExtractor,
   *  not getProdStats.  Placed before useTimeBuffer so the buffer
   *  captures extractor fluids too. */
  const allItems: ProdStatItem[] = useMemo(
    () => mergeExtractorFluids(items, extractors),
    [items, extractors],
  );

  // Time-series buffer — fed allItems so extractor fluids appear in historical windows
  const { getWindowData } = useTimeBuffer(allItems);

  // UI state
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'throughput' | 'name' | 'net' | 'stored'>('throughput');
  const [selectedClassName, setSelectedClassName] = useState<string | null>(null);
  const [showRawTrace, setShowRawTrace] = useState(false);

  /* ── Data fetching ─────────────────────────────────────── */

  /** Fetch production stats from the FRM backend. Core data for the dashboard. */
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

  /** Fetch world inventory for stored fluid estimates (one-time). */
  const fetchWorldInv = useCallback(async () => {
    try {
      const inv = await fetchEndpoint<{ Name: string; ClassName: string; Amount: number }[]>(config, 'getWorldInv');
      const map = new Map<string, number>();
      for (const item of inv) {
        map.set(item.ClassName, (map.get(item.ClassName) ?? 0) + item.Amount);
      }
      setWorldInv(map);
    } catch {
      // World inv is supplemental — silently fail
    }
  }, [config]);

  /** Fetch recipes for raw material tracing (one-time). */
  const fetchRecipes = useCallback(async () => {
    try {
      // Fetch recipe data for traceRawMaterials. Fluid detection itself
      // uses synchronous isFluidClassName() and does not need recipes.
      const data = await fetchEndpoint<RawRecipe[]>(config, 'getRecipes');
      setRecipes(data);
    } catch {
      // Recipe data is optional
    }
  }, [config]);

  /** Fetch fluid-processing buildings for per-machine breakdown (one-time). */
  const fetchMachines = useCallback(async () => {
    if (machinesLoaded.current) return;
    try {
      // Fetch the fluid-handling building types in parallel
      const [refineries, blenders, packagers, extractorData] = await Promise.all([
        fetchEndpoint<FactoryBuilding[]>(config, 'getRefinery').catch(() => [] as FactoryBuilding[]),
        fetchEndpoint<FactoryBuilding[]>(config, 'getBlender').catch(() => [] as FactoryBuilding[]),
        fetchEndpoint<FactoryBuilding[]>(config, 'getPackager').catch(() => [] as FactoryBuilding[]),
        fetchEndpoint<Extractor[]>(config, 'getExtractor').catch(() => [] as Extractor[]),
      ]);

      const allMachines: FactoryBuilding[] = [
        ...refineries,
        ...blenders,
        ...packagers,
        // Extractors are Extractor[], which extends BuildableBase but lacks
        // ingredients array. We cast them and add empty ingredients.
        ...extractorData.map((e) => ({
          ...e,
          ingredients: [],
          Recipe: e.Recipe || 'Mining',
          RecipeClassName: e.RecipeClassName || '',
          InputInventory: [],
          OutputInventory: [],
          Productivity: 100,
          ManuSpeed: e.ManuSpeed || 100,
          IsProducing: e.IsProducing ?? false,
        } as FactoryBuilding)),
      ];

      setMachines(allMachines);
      setExtractors(extractorData);
      machinesLoaded.current = true;
    } catch {
      // Machine data is supplemental
    }
  }, [config]);

  /** Fetch pipe/pump counts for infrastructure overview (one-time). */
  const fetchInfrastructure = useCallback(async () => {
    try {
      const [pipes, pumps] = await Promise.all([
        fetchEndpoint<unknown[]>(config, 'getPipes').catch(() => [] as unknown[]),
        fetchEndpoint<unknown[]>(config, 'getPump').catch(() => [] as unknown[]),
      ]);
      setPipeCount(Array.isArray(pipes) ? pipes.length : 0);
      setPumpCount(Array.isArray(pumps) ? pumps.length : 0);
    } catch {
      // Infrastructure counts are supplemental
    }
  }, [config]);

  useEffect(() => {
    fetchData();
    fetchWorldInv();
    fetchRecipes();
    fetchMachines();
    fetchInfrastructure();

    const interval = setInterval(fetchData, config.refreshRate || 5000);
    return () => clearInterval(interval);
  }, [fetchData, fetchWorldInv, fetchRecipes, fetchMachines, fetchInfrastructure, config.refreshRate]);

  /* ── Derived data ──────────────────────────────────────── */

  /** Compute display summaries over the selected time window.
   *  Uses allItems (getProdStats + extractor fluids) as the data source
   *  so that Water, Crude Oil, and other extractor-only fluids appear. */
  const displaySummaries: FluidSummary[] = useMemo(() => {
    if (timeWindow === 0 || !allItems.length) {
      return getFluidSummaries(allItems as unknown as ProdStatSnapshot[], undefined, worldInv ?? undefined);
    }

    const snapshots = getWindowData(timeWindow) as unknown as ProdStatSnapshot[][];
    if (snapshots.length < 2) {
      return getFluidSummaries(allItems as unknown as ProdStatSnapshot[], undefined, worldInv ?? undefined);
    }

    const averaged = averageProdStats(snapshots);
    return getFluidSummaries(averaged, undefined, worldInv ?? undefined);
  }, [allItems, timeWindow, getWindowData, worldInv]);

  const periodLabel = TIME_WINDOWS.find((w) => w.value === timeWindow)?.label ?? 'Live';

  /* ── Filter & sort pipeline ────────────────────────────── */

  const filtered = useMemo(() => {
    let result = displaySummaries;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.className.toLowerCase().includes(q),
      );
    }

    return result;
  }, [displaySummaries, search]);

  const sorters: Record<typeof sortMode, (a: FluidSummary, b: FluidSummary) => number> = {
    throughput: (a, b) => (b.prodPerMin + b.consPerMin) - (a.prodPerMin + a.consPerMin),
    name: (a, b) => a.name.localeCompare(b.name),
    net: (a, b) => b.netPerMin - a.netPerMin,
    stored: (a, b) => b.storedAmount - a.storedAmount,
  };
  const sorted = [...filtered].sort(sorters[sortMode]);

  /* ── Aggregate totals ──────────────────────────────────── */

  const totalProd = displaySummaries.reduce((s, f) => s + f.prodPerMin, 0);
  const totalCons = displaySummaries.reduce((s, f) => s + f.consPerMin, 0);
  const totalStored = displaySummaries.reduce((s, f) => s + f.storedAmount, 0);
  const netBalance = totalProd - totalCons;

  /* ── Selected item detail data ─────────────────────────── */

  /** The currently selected fluid summary, if any. */
  const selectedFluid = selectedClassName
    ? displaySummaries.find((f) => f.className === selectedClassName) ?? null
    : null;

  /** Per-building breakdown for the selected fluid. */
  const selectedMachines = useMemo((): {
    producers: FluidMachineEntry[];
    consumers: FluidMachineEntry[];
  } => {
    if (!selectedFluid || !machines) return { producers: [], consumers: [] };

    const producers: FluidMachineEntry[] = [];
    const consumers: FluidMachineEntry[] = [];

    for (const fb of machines) {
      // Check production output
      for (const p of fb.production ?? []) {
        if (p.ClassName === selectedFluid.className) {
          producers.push({
            building: fb.Name,
            buildingClass: fb.ClassName,
            recipe: fb.Recipe || 'Unknown',
            currentRate: p.CurrentProd,
            maxRate: p.MaxProd,
            efficiency: p.ProdPercent,
            isActive: fb.IsProducing,
            shards: fb.PowerShards ?? 0,
            sloops: fb.Somersloops ?? 0,
          });
        }
      }
      // Check ingredient consumption
      for (const ing of fb.ingredients ?? []) {
        if (ing.ClassName === selectedFluid.className) {
          consumers.push({
            building: fb.Name,
            buildingClass: fb.ClassName,
            recipe: fb.Recipe || 'Unknown',
            currentRate: ing.CurrentConsumed,
            maxRate: ing.MaxConsumed,
            efficiency: ing.ConsPercent,
            isActive: fb.IsProducing,
            shards: fb.PowerShards ?? 0,
            sloops: fb.Somersloops ?? 0,
          });
        }
      }
    }

    // Extractors are already included in `machines` via fetchMachines —
    // no separate extractors loop needed (would double-count every extractor).

    return { producers, consumers };
  }, [selectedFluid, machines]);

  /** Raw material trace for the selected fluid. */
  const rawMaterials: RawMaterialLink[] = useMemo(() => {
    if (!selectedFluid || !recipes || !showRawTrace) return [];
    return traceRawMaterials(selectedFluid.className, null, recipes, 3);
  }, [selectedFluid, recipes, showRawTrace]);

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
      <div
        className="rounded-xl p-6 text-center"
        style={{ backgroundColor: theme.danger + '18', border: `1px solid ${theme.danger}33` }}
      >
        <p className="text-sm" style={{ color: theme.danger }}>{error}</p>
        <button onClick={fetchData} className="mt-3 text-xs hover:underline" style={{ color: theme.accent }}>
          Retry
        </button>
      </div>
    );
  }

  if (displaySummaries.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: theme.textSecondary }}>
        <p className="text-lg font-medium">No fluids detected</p>
        <p className="text-sm mt-1">
          Set up fluid production (Refineries, Oil Extractors, Water Extractors)
          to see fluid data here.
        </p>
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      {/* ═══ Infrastructure Overview ═══ */}
      {(pipeCount !== null || pumpCount !== null) && (
        <div className="flex gap-3 flex-wrap">
          {pipeCount !== null && (
            <div
              className="rounded-xl px-4 py-2.5 flex items-center gap-2"
              style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}
            >
              <span className="text-lg">🔧</span>
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: theme.textSecondary }}>Pipelines</p>
                <p className="text-sm font-bold font-mono" style={{ color: theme.textPrimary }}>{pipeCount}</p>
              </div>
            </div>
          )}
          {pumpCount !== null && (
            <div
              className="rounded-xl px-4 py-2.5 flex items-center gap-2"
              style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}
            >
              <span className="text-lg">⛽</span>
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: theme.textSecondary }}>Pumps & Valves</p>
                <p className="text-sm font-bold font-mono" style={{ color: theme.textPrimary }}>{pumpCount}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Summary Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Fluid Production</p>
          <p className="text-xl font-bold font-mono" style={{ color: theme.success }}>
            {formatNumber(totalProd)}<span className="text-[10px] font-normal ml-0.5">/min</span>
          </p>
          {timeWindow > 0 && (
            <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>
          )}
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Fluid Consumption</p>
          <p className="text-xl font-bold font-mono" style={{ color: theme.danger }}>
            {formatNumber(totalCons)}<span className="text-[10px] font-normal ml-0.5">/min</span>
          </p>
          {timeWindow > 0 && (
            <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>
          )}
        </div>
        <div className="rounded-xl p-4" style={{
          backgroundColor: theme.bgCard,
          border: `1px solid ${netBalance >= 0 ? theme.success + '33' : theme.danger + '33'}`,
        }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Net Balance</p>
          <p className="text-xl font-bold font-mono" style={{ color: netBalance >= 0 ? theme.success : theme.danger }}>
            {netBalance >= 0 ? '+' : ''}{formatNumber(netBalance)}<span className="text-[10px] font-normal ml-0.5">/min</span>
          </p>
          {timeWindow > 0 && (
            <p className="text-[10px] mt-0.5" style={{ color: theme.accent }}>avg · {periodLabel}</p>
          )}
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Stored Fluids</p>
          <p className="text-xl font-bold font-mono" style={{ color: theme.info }}>
            {formatNumber(totalStored)}<span className="text-[10px] font-normal ml-0.5">m³</span>
          </p>
        </div>
      </div>

      {/* ═══ Fluid Cards Grid ═══ */}
      <div className="rounded-xl p-6" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
        {/* Header row: title + search + sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: theme.textPrimary }}>
            💧 Fluid Network
            {timeWindow > 0 && (
              <span className="text-[10px] font-normal normal-case" style={{ color: theme.accent }}>
                · {periodLabel} avg
              </span>
            )}
            {filtered.length !== displaySummaries.length && (
              <span className="text-[10px] font-normal normal-case opacity-60">
                ({filtered.length} of {displaySummaries.length})
              </span>
            )}
          </h3>

          {/* Search + Sort controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search input */}
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: theme.textSecondary }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fluids…"
                className="search-input text-xs rounded-lg pl-8 pr-3 py-1.5 border w-40 sm:w-52 transition-colors outline-none"
                style={{
                  backgroundColor: theme.bgSecondary,
                  color: theme.textPrimary,
                  borderColor: theme.borderColor,
                }}
                aria-label="Search fluid items"
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
              className="text-xs rounded-lg px-3 py-1.5 border cursor-pointer outline-none"
              style={{
                backgroundColor: theme.bgSecondary,
                color: theme.textPrimary,
                borderColor: theme.borderColor,
              }}
              aria-label="Sort fluid items"
            >
              <option value="throughput">Sort: Throughput</option>
              <option value="net">Sort: Net Balance</option>
              <option value="stored">Sort: Stored Amount</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        </div>

        {/* Fluid cards */}
        <div className="space-y-2">
          {sorted.map((fluid) => {
            const isSelected = selectedClassName === fluid.className;
            const isSurplus = fluid.netPerMin > 0;
            const isDeficit = fluid.netPerMin < 0;

            return (
              <div key={fluid.className}>
                {/* Card row */}
                <button
                  onClick={() => setSelectedClassName(isSelected ? null : fluid.className)}
                  className="w-full rounded-lg p-3 flex items-center gap-3 transition-all text-left fluid-card"
                  style={{
                    backgroundColor: isSelected ? theme.bgSecondary : 'transparent',
                    border: `1px solid ${isSelected ? theme.accent : theme.borderColor}`,
                  }}
                >
                  {/* Fluid type icon */}
                  <span className="text-xl shrink-0">{fluid.isGas ? '💨' : '💧'}</span>

                  {/* Fluid name + type badge */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: theme.textPrimary }}>
                        {fluid.name}
                      </p>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                        style={{
                          backgroundColor: fluid.isGas ? theme.info + '25' : theme.accent + '25',
                          color: fluid.isGas ? theme.info : theme.accent,
                        }}
                      >
                        {fluid.isGas ? 'Gas' : 'Liquid'}
                      </span>
                    </div>

                    {/* Balance bar */}
                    <div className="mt-1.5">
                      <FluidBar prod={fluid.prodPerMin} cons={fluid.consPerMin} theme={theme} />
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs font-mono" style={{ color: theme.success }}>
                      +{formatNumber(fluid.prodPerMin)}
                      <span className="text-[9px] opacity-60">/min</span>
                    </p>
                    <p className="text-xs font-mono" style={{ color: theme.danger }}>
                      −{formatNumber(fluid.consPerMin)}
                      <span className="text-[9px] opacity-60">/min</span>
                    </p>
                    {fluid.storedAmount > 0 && (
                      <p className="text-[10px] font-mono" style={{ color: theme.textSecondary }}>
                        {formatNumber(fluid.storedAmount)} m³ stored
                      </p>
                    )}
                  </div>

                  {/* Net indicator */}
                  <div className="shrink-0 text-right min-w-[50px]">
                    <p
                      className="text-sm font-bold font-mono"
                      style={{ color: isSurplus ? theme.success : isDeficit ? theme.danger : theme.textSecondary }}
                    >
                      {fluid.netPerMin > 0 ? '+' : ''}{formatNumber(fluid.netPerMin)}
                    </p>
                    <p className="text-[9px]" style={{ color: theme.textSecondary }}>
                      {isSurplus ? 'Surplus' : isDeficit ? 'Deficit' : 'Balanced'}
                    </p>
                  </div>

                  {/* Expand chevron */}
                  <span className="text-xs shrink-0" style={{ color: theme.textSecondary }}>
                    {isSelected ? '▲' : '▼'}
                  </span>
                </button>

                {/* ═══ Expanded Detail Panel ═══ */}
                {isSelected && selectedFluid && (
                  <div
                    className="mt-2 mx-2 rounded-xl p-5 space-y-5"
                    style={{ backgroundColor: theme.bgSecondary, border: `1px solid ${theme.borderColor}` }}
                  >
                    {/* Detail header */}
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{selectedFluid.isGas ? '💨' : '💧'}</span>
                      <div>
                        <h3 className="text-base font-semibold" style={{ color: theme.textPrimary }}>
                          {selectedFluid.name}
                        </h3>
                        <p className="text-[11px] font-mono opacity-60" style={{ color: theme.textSecondary }}>
                          {selectedFluid.className}
                        </p>
                      </div>
                    </div>

                    {/* Key metrics row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <MetricBadge label="Prod Rate" value={formatNumber(selectedFluid.prodPerMin) + '/min'} color={theme.success} theme={theme} />
                      <MetricBadge label="Cons Rate" value={formatNumber(selectedFluid.consPerMin) + '/min'} color={theme.danger} theme={theme} />
                      <MetricBadge label="Net" value={(selectedFluid.netPerMin >= 0 ? '+' : '') + formatNumber(selectedFluid.netPerMin) + '/min'} color={selectedFluid.netPerMin >= 0 ? theme.success : theme.danger} theme={theme} />
                      <MetricBadge label="Max Prod" value={formatNumber(selectedFluid.maxProd) + '/min'} color={theme.textPrimary} theme={theme} />
                      <MetricBadge label="Max Cons" value={formatNumber(selectedFluid.maxCons) + '/min'} color={theme.textPrimary} theme={theme} />
                      <MetricBadge label="Stored" value={formatNumber(selectedFluid.storedAmount) + ' m³'} color={theme.info} theme={theme} />
                      <MetricBadge label="Producers" value={String(selectedMachines.producers.length)} color={theme.info} theme={theme} />
                      <MetricBadge label="Consumers" value={String(selectedMachines.consumers.length)} color={theme.info} theme={theme} />
                    </div>

                    {/* Machine breakdown tables */}
                    {(selectedMachines.producers.length > 0 || selectedMachines.consumers.length > 0) && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <FluidMachineTable machines={selectedMachines.producers} kind="producer" theme={theme} />
                        <FluidMachineTable machines={selectedMachines.consumers} kind="consumer" theme={theme} />
                      </div>
                    )}

                    {/* Raw material trace */}
                    {recipes && !showRawTrace && (
                      <button
                        onClick={() => setShowRawTrace(true)}
                        className="text-xs underline cursor-pointer"
                        style={{ color: theme.accent }}
                      >
                        Show raw material trace →
                      </button>
                    )}
                    {showRawTrace && rawMaterials.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                          Raw Material Trace
                        </h4>
                        <div className="rounded-lg p-3" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
                          <div className="space-y-1">
                            {rawMaterials.map((rm, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span style={{ color: theme.accent }}>
                                  {'  '.repeat(rm.depth - 1)}↳
                                </span>
                                <span style={{ color: theme.textPrimary }}>{rm.name}</span>
                                <span className="opacity-50" style={{ color: theme.textSecondary }}>
                                  (depth {rm.depth})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {showRawTrace && rawMaterials.length === 0 && (
                      <p className="text-[10px] italic" style={{ color: theme.textSecondary }}>
                        No raw material trace available — this fluid may be directly extracted
                        (e.g., Water, Crude Oil) or recipe data is unavailable.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: item count */}
        <p className="text-[10px] text-right mt-3" style={{ color: theme.textSecondary }}>
          {filtered.length} fluid{filtered.length !== 1 ? 's' : ''}
          {displaySummaries.length > 0 && ` · ${displaySummaries.filter(f => f.isGas).length} gas(es), ${displaySummaries.filter(f => !f.isGas).length} liquid(s)`}
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MetricBadge — small labeled value chip
   ══════════════════════════════════════════════════════════════ */

/** Small badge displaying a labeled metric value, used in fluid detail panel. */
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
    <div className="rounded-lg p-2.5" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
      <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: theme.textSecondary }}>{label}</p>
      <p className="text-sm font-bold font-mono" style={{ color }}>{value}</p>
    </div>
  );
}
