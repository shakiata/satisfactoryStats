'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FRMConfig, WorldInvItem, StorageContainer, CloudInvItem } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';

interface Props {
  config: FRMConfig;
}

/* ─── Format large numbers ─── */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 1) return n.toFixed(0);
  return n.toFixed(1);
}

/* ─── Item icon with fallback initials ─── */
function ItemIcon({ className, name }: { className: string; name: string }) {
  const [errored, setErrored] = useState(false);
  const short = name.replace(/^Desc_/, '').replace(/_C$/, '');
  const initials = (short.match(/[A-Z]/g) || short.slice(0, 2).split('')).slice(0, 2).join('');

  return (
    <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {!errored && (
        <img
          src={`./Icons/${className}.png`}
          alt={name}
          className="w-7 h-7 object-contain"
          onError={() => setErrored(true)}
        />
      )}
      {errored && (
        <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
          {initials}
        </span>
      )}
    </div>
  );
}

/* ─── Progress bar for fill percentage ─── */
function FillBar({ amount, max }: { amount: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (amount / max) * 100) : 0;
  const full = pct >= 95;
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: full ? 'var(--danger)' : pct > 70 ? '#c9952e' : 'var(--accent)',
          }}
        />
      </div>
      <span className="text-[10px] w-8 text-right" style={{ color: full ? 'var(--danger)' : 'var(--text-secondary)' }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

/* ─── Main Component ─── */
export function InventoryPanel({ config }: Props) {
  const { theme } = useTheme();

  // ── State ──
  const [worldInv, setWorldInv] = useState<WorldInvItem[] | null>(null);
  const [storageContainers, setStorageContainers] = useState<StorageContainer[] | null>(null);
  const [cloudInv, setCloudInv] = useState<CloudInvItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedContainers, setExpandedContainers] = useState<Set<string>>(new Set());

  // ── Active view tab ──
  const [view, setView] = useState<'world' | 'storage'>('world');

  const fetchData = useCallback(async () => {
    try {
      const [world, storage, cloud] = await Promise.all([
        fetchEndpoint<WorldInvItem[]>(config, 'getWorldInv'),
        fetchEndpoint<StorageContainer[]>(config, 'getStorageInv'),
        fetchEndpoint<CloudInvItem[]>(config, 'getCloudInv'),
      ]);
      setWorldInv(world);
      setStorageContainers(storage);
      setCloudInv(cloud);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Derived ──

  const worldTotal = useMemo(() => (worldInv ?? []).reduce((s, i) => s + i.Amount, 0), [worldInv]);
  const cloudTotal = useMemo(() => (cloudInv ?? []).reduce((s, i) => s + i.Amount, 0), [cloudInv]);

  const filteredWorld = useMemo(() => {
    if (!worldInv) return [];
    if (!search) return [...worldInv].sort((a, b) => b.Amount - a.Amount);
    const q = search.toLowerCase();
    return [...worldInv]
      .filter(i => i.Name.toLowerCase().includes(q) || i.ClassName.toLowerCase().includes(q))
      .sort((a, b) => b.Amount - a.Amount);
  }, [worldInv, search]);

  const filteredContainers = useMemo(() => {
    if (!storageContainers) return [];
    if (!search) return storageContainers;
    const q = search.toLowerCase();
    return storageContainers.filter(c =>
      c.Name.toLowerCase().includes(q) ||
      c.Inventory?.some(i => i.Name.toLowerCase().includes(q) || i.ClassName.toLowerCase().includes(q))
    );
  }, [storageContainers, search]);

  const toggleContainer = (id: string) => {
    setExpandedContainers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Loading / Error ──

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

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="World Items"
          value={worldTotal}
          sub={`${(worldInv ?? []).length} types`}
          color={theme.accent}
        />
        <SummaryCard
          label="Containers"
          value={(storageContainers ?? []).length}
          sub={`${(storageContainers ?? []).reduce((s, c) => s + (c.Inventory?.length ?? 0), 0)} types`}
          color={theme.info}
        />
        <SummaryCard
          label="Dimensional Depot"
          value={cloudTotal}
          sub={`${(cloudInv ?? []).length} types`}
          color="#8b5cf6"
        />
        <SummaryCard
          label="Total Stored"
          value={worldTotal + cloudTotal}
          sub="World + Depot"
          color={theme.success}
        />
      </div>

      {/* ─── Search & View Toggle ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.textSecondary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search items or containers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border outline-none transition-colors"
            style={{
              backgroundColor: theme.bgCard,
              borderColor: theme.borderColor,
              color: theme.textPrimary,
            }}
            onFocus={e => { e.target.style.borderColor = theme.accent; }}
            onBlur={e => { e.target.style.borderColor = theme.borderColor; }}
          />
        </div>
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: theme.borderColor }}>
          {(['world', 'storage'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-4 py-2 text-xs font-medium transition-colors"
              style={{
                backgroundColor: view === v ? theme.accent : theme.bgCard,
                color: view === v ? '#000' : theme.textSecondary,
              }}
            >
              {v === 'world' ? '📦 Totals' : '🗄️ By Container'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── World View: Aggregated totals table ─── */}
      {view === 'world' && (
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: theme.bgCard, borderColor: theme.borderColor }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: theme.bgSecondary, color: theme.textSecondary }}>
                  <th className="text-left px-4 py-2 font-medium">Item</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                  <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">Max Stack</th>
                  <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">Stacks</th>
                  <th className="px-4 py-2 hidden sm:table-cell" style={{ width: 140 }}>Fill</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorld.map((item, i) => {
                  const stacks = item.MaxAmount > 0 ? item.Amount / item.MaxAmount : 0;
                  return (
                    <tr
                      key={item.ClassName}
                      className="transition-colors"
                      style={{ backgroundColor: i % 2 === 0 ? theme.bgCard : theme.bgSecondary + '80' }}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <ItemIcon className={item.ClassName} name={item.Name} />
                          <span style={{ color: theme.textPrimary }}>{item.Name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-medium" style={{ color: theme.textPrimary }}>
                        {fmt(item.Amount)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono hidden sm:table-cell" style={{ color: theme.textSecondary }}>
                        {item.MaxAmount > 0 ? item.MaxAmount : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono hidden sm:table-cell" style={{ color: theme.textSecondary }}>
                        {item.MaxAmount > 0 ? stacks.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-2 hidden sm:table-cell">
                        {item.MaxAmount > 0 && <FillBar amount={item.Amount} max={item.MaxAmount} />}
                      </td>
                    </tr>
                  );
                })}
                {filteredWorld.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center" style={{ color: theme.textSecondary }}>
                      {search ? 'No matching items' : 'No items in storage'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Storage View: Per-container breakdown ─── */}
      {view === 'storage' && (
        <div className="space-y-2">
          {filteredContainers.map(container => {
            const isExpanded = expandedContainers.has(container.ID);
            const totalItems = (container.Inventory ?? []).reduce((s, i) => s + i.Amount, 0);
            return (
              <div
                key={container.ID}
                className="rounded-xl border overflow-hidden transition-shadow hover:shadow-lg"
                style={{ backgroundColor: theme.bgCard, borderColor: theme.borderColor }}
              >
                {/* Container header */}
                <button
                  onClick={() => toggleContainer(container.ID)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:brightness-110"
                  style={{ backgroundColor: isExpanded ? theme.bgSecondary : theme.bgCard }}
                >
                  <svg
                    className={`w-4 h-4 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    style={{ color: theme.textSecondary }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: theme.textPrimary }}>
                        {container.Name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: theme.bgSecondary, color: theme.textSecondary }}>
                        {container.Inventory?.length ?? 0} items
                      </span>
                    </div>
                    <div className="text-[10px] mt-0.5 font-mono" style={{ color: theme.textSecondary }}>
                      {container.location ? `X: ${container.location.x.toFixed(0)} · Y: ${container.location.y.toFixed(0)} · Z: ${container.location.z.toFixed(0)}` : 'No location'}
                    </div>
                  </div>
                  <span className="text-xs font-mono font-medium shrink-0" style={{ color: theme.accent }}>
                    {fmt(totalItems)} total
                  </span>
                </button>

                {/* Expanded inventory list */}
                {isExpanded && (
                  <div className="border-t" style={{ borderColor: theme.borderColor }}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ backgroundColor: theme.bgSecondary, color: theme.textSecondary }}>
                            <th className="text-left px-4 py-1.5 font-medium">Item</th>
                            <th className="text-right px-4 py-1.5 font-medium">Amount</th>
                            <th className="px-4 py-1.5 font-medium hidden sm:table-cell" style={{ width: 120 }}>Fill</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(container.Inventory ?? []).map((item, j) => (
                            <tr key={item.ClassName} style={{ backgroundColor: j % 2 === 0 ? theme.bgCard : theme.bgSecondary + '80' }}>
                              <td className="px-4 py-1.5">
                                <div className="flex items-center gap-2">
                                  <ItemIcon className={item.ClassName} name={item.Name} />
                                  <span style={{ color: theme.textPrimary }}>{item.Name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-1.5 text-right font-mono" style={{ color: theme.textPrimary }}>
                                {fmt(item.Amount)}
                              </td>
                              <td className="px-4 py-1.5 hidden sm:table-cell">
                                <FillBar amount={item.Amount} max={item.MaxAmount} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filteredContainers.length === 0 && (
            <div className="text-center py-16" style={{ color: theme.textSecondary }}>
              <p className="text-sm">{search ? 'No containers match your search' : 'No storage containers found'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Summary card helper ─── */
function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3 border"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
    >
      <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <p className="text-xl font-bold mt-1 font-mono" style={{ color }}>
        {typeof value === 'number' ? fmt(value) : value}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
    </div>
  );
}
