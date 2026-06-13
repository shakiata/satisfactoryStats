'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TimedEntry<T> {
  timestamp: number;
  data: T;
}

const MAX_BUFFER_MS = 60 * 60 * 1000; // 1 hour

/**
 * Stores timestamped snapshots of data and provides windowed queries.
 * Each time `data` changes (a new API response), it's pushed into a
 * rolling buffer. Old entries (>1hr) are automatically pruned.
 *
 * Usage:
 *   const { getWindowData, getWindowAverage } = useTimeBuffer(data, refreshRate);
 *   const windowed = getWindowData(5 * 60 * 1000); // all snapshots in last 5 min
 */
export function useTimeBuffer<T>(data: T | null) {
  const [buffer, setBuffer] = useState<TimedEntry<T>[]>([]);

  useEffect(() => {
    if (data !== null) {
      const now = Date.now();
      setBuffer((prev) => {
        const cutoff = now - MAX_BUFFER_MS;
        return [...prev.filter((e) => e.timestamp > cutoff), { timestamp: now, data }];
      });
    }
  }, [data]);

  /** All snapshots whose timestamp falls within [now - windowMs, now] */
  const getWindowData = useCallback(
    (windowMs: number): T[] => {
      const cutoff = Date.now() - windowMs;
      return buffer.filter((e) => e.timestamp >= cutoff).map((e) => e.data);
    },
    [buffer],
  );

  /** Average of mapFn(item) over the window. Returns 0 if no data. */
  const getWindowAverage = useCallback(
    (windowMs: number, mapFn: (item: T) => number): number => {
      const cutoff = Date.now() - windowMs;
      const entries = buffer.filter((e) => e.timestamp >= cutoff);
      if (entries.length === 0) return 0;
      return entries.reduce((s, e) => s + mapFn(e.data), 0) / entries.length;
    },
    [buffer],
  );

  return { getWindowData, getWindowAverage, bufferSize: buffer.length };
}

/* ─── ProdStatItem helpers — average an array of snapshots into one ─── */

export interface ProdStatSnapshot {
  Name: string;
  ClassName: string;
  CurrentProd: number;
  MaxProd: number;
  CurrentConsumed: number;
  MaxConsumed: number;
}

/**
 * Given N snapshots of ProdStatItem[], merge them into a single
 * array where each item's rates are averaged across the window.
 */
export function averageProdStats(snapshots: ProdStatSnapshot[][]): ProdStatSnapshot[] {
  if (snapshots.length === 0) return [];
  const map = new Map<string, { sumProd: number; sumCons: number; count: number; maxProd: number; maxCons: number; name: string }>();

  for (const batch of snapshots) {
    for (const item of batch) {
      const key = item.ClassName;
      const existing = map.get(key) || { sumProd: 0, sumCons: 0, count: 0, maxProd: 0, maxCons: 0, name: item.Name };
      existing.sumProd += item.CurrentProd;
      existing.sumCons += item.CurrentConsumed;
      existing.maxProd = Math.max(existing.maxProd, item.MaxProd);
      existing.maxCons = Math.max(existing.maxCons, item.MaxConsumed);
      existing.count++;
      existing.name = item.Name;
      map.set(key, existing);
    }
  }

  return Array.from(map.entries()).map(([className, v]) => ({
    Name: v.name,
    ClassName: className,
    CurrentProd: v.sumProd / v.count,
    MaxProd: v.maxProd,
    CurrentConsumed: v.sumCons / v.count,
    MaxConsumed: v.maxCons,
  }));
}

/* ─── Power snapshot helpers ─── */

export interface PowerSnapshot {
  totalProd: number;
  totalConsumed: number;
  totalCapacity: number;
  totalMaxConsumed: number;
}

export function averagePowerStats(snapshots: PowerSnapshot[]): PowerSnapshot {
  if (snapshots.length === 0) return { totalProd: 0, totalConsumed: 0, totalCapacity: 0, totalMaxConsumed: 0 };
  const n = snapshots.length;
  return {
    totalProd: snapshots.reduce((s, x) => s + x.totalProd, 0) / n,
    totalConsumed: snapshots.reduce((s, x) => s + x.totalConsumed, 0) / n,
    totalCapacity: snapshots.reduce((s, x) => s + x.totalCapacity, 0) / n,
    totalMaxConsumed: snapshots.reduce((s, x) => s + x.totalMaxConsumed, 0) / n,
  };
}
