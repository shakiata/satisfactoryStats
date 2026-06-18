/**
 * Tests for useTimeBuffer — rolling time-series buffer for windowed averaging.
 * Most logic is tested via the returned callbacks since the hook uses useState/useEffect.
 * We also test the pure helper functions directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { averageProdStats, averagePowerStats, extractItemTimeSeries } from '../useTimeBuffer';
import type { ProdStatSnapshot, PowerSnapshot, ProdTimePoint } from '../useTimeBuffer';

// ─── averageProdStats ─────────────────────────────────────────────

describe('averageProdStats', () => {
  it('returns an empty array for empty input', () => {
    expect(averageProdStats([])).toEqual([]);
  });

  it('returns the same items for a single snapshot', () => {
    const snapshot: ProdStatSnapshot[][] = [
      [
        { Name: 'Iron Plate', ClassName: 'Desc_IronPlate_C', CurrentProd: 10, MaxProd: 20, CurrentConsumed: 5, MaxConsumed: 15 },
      ],
    ];
    const result = averageProdStats(snapshot);
    expect(result).toHaveLength(1);
    expect(result[0].Name).toBe('Iron Plate');
    expect(result[0].CurrentProd).toBe(10);
    expect(result[0].MaxProd).toBe(20);
  });

  it('averages production and consumption across multiple snapshots', () => {
    const snapshots: ProdStatSnapshot[][] = [
      [
        { Name: 'Iron Plate', ClassName: 'Desc_IronPlate_C', CurrentProd: 10, MaxProd: 20, CurrentConsumed: 5, MaxConsumed: 15 },
      ],
      [
        { Name: 'Iron Plate', ClassName: 'Desc_IronPlate_C', CurrentProd: 20, MaxProd: 25, CurrentConsumed: 10, MaxConsumed: 10 },
      ],
    ];
    const result = averageProdStats(snapshots);
    expect(result).toHaveLength(1);
    expect(result[0].CurrentProd).toBe(15);   // (10+20)/2
    expect(result[0].CurrentConsumed).toBe(7.5); // (5+10)/2
    expect(result[0].MaxProd).toBe(25);        // max(20, 25)
    expect(result[0].MaxConsumed).toBe(15);    // max(15, 10)
  });

  it('merges items by ClassName across batches', () => {
    const snapshots: ProdStatSnapshot[][] = [
      [
        { Name: 'Iron Plate', ClassName: 'Desc_IronPlate_C', CurrentProd: 10, MaxProd: 20, CurrentConsumed: 5, MaxConsumed: 15 },
      ],
      [
        { Name: 'Iron Rod', ClassName: 'Desc_IronRod_C', CurrentProd: 30, MaxProd: 40, CurrentConsumed: 15, MaxConsumed: 20 },
      ],
    ];
    const result = averageProdStats(snapshots);
    expect(result).toHaveLength(2);
    const names = result.map(r => r.Name).sort();
    expect(names).toEqual(['Iron Plate', 'Iron Rod']);
  });

  it('uses the last seen Name for each ClassName', () => {
    const snapshots: ProdStatSnapshot[][] = [
      [
        { Name: 'Old Name', ClassName: 'Desc_IronPlate_C', CurrentProd: 10, MaxProd: 20, CurrentConsumed: 5, MaxConsumed: 15 },
      ],
      [
        { Name: 'New Name', ClassName: 'Desc_IronPlate_C', CurrentProd: 20, MaxProd: 20, CurrentConsumed: 5, MaxConsumed: 15 },
      ],
    ];
    const result = averageProdStats(snapshots);
    expect(result[0].Name).toBe('New Name');
  });
});

// ─── averagePowerStats ────────────────────────────────────────────

describe('averagePowerStats', () => {
  it('returns zeros for empty input', () => {
    const result = averagePowerStats([]);
    expect(result).toEqual({
      totalProd: 0,
      totalConsumed: 0,
      totalCapacity: 0,
      totalMaxConsumed: 0,
    });
  });

  it('returns the same values for a single snapshot', () => {
    const snapshots: PowerSnapshot[] = [
      { totalProd: 1000, totalConsumed: 500, totalCapacity: 2000, totalMaxConsumed: 1500 },
    ];
    const result = averagePowerStats(snapshots);
    expect(result.totalProd).toBe(1000);
    expect(result.totalConsumed).toBe(500);
    expect(result.totalCapacity).toBe(2000);
    expect(result.totalMaxConsumed).toBe(1500);
  });

  it('averages across multiple snapshots', () => {
    const snapshots: PowerSnapshot[] = [
      { totalProd: 1000, totalConsumed: 500, totalCapacity: 2000, totalMaxConsumed: 1500 },
      { totalProd: 2000, totalConsumed: 1000, totalCapacity: 2000, totalMaxConsumed: 1500 },
      { totalProd: 3000, totalConsumed: 1500, totalCapacity: 2000, totalMaxConsumed: 1500 },
    ];
    const result = averagePowerStats(snapshots);
    expect(result.totalProd).toBe(2000);
    expect(result.totalConsumed).toBe(1000);
    expect(result.totalCapacity).toBe(2000);        // constant
    expect(result.totalMaxConsumed).toBe(1500);     // constant
  });

  it('handles single-snapshot correctly', () => {
    const result = averagePowerStats([
      { totalProd: 500, totalConsumed: 300, totalCapacity: 1000, totalMaxConsumed: 800 },
    ]);
    expect(result.totalProd).toBe(500);
  });
});

// ─── extractItemTimeSeries ─────────────────────────────────────────

describe('extractItemTimeSeries', () => {
  const makeSnapshots = (batches: { ironProd: number; ironCons: number; copperProd?: number; copperCons?: number }[]) =>
    batches.map((b) => {
      const items: ProdStatSnapshot[] = [
        { Name: 'Iron Plate', ClassName: 'Desc_IronPlate_C', CurrentProd: b.ironProd, MaxProd: 40, CurrentConsumed: b.ironCons, MaxConsumed: 20 },
      ];
      if (b.copperProd !== undefined) {
        items.push({ Name: 'Copper Wire', ClassName: 'Desc_CopperWire_C', CurrentProd: b.copperProd, MaxProd: 60, CurrentConsumed: b.copperCons ?? 0, MaxConsumed: 30 });
      }
      return items;
    });

  it('returns empty array for empty input', () => {
    expect(extractItemTimeSeries([], 'Desc_IronPlate_C')).toEqual([]);
  });

  it('returns empty array when no snapshot contains the item', () => {
    const snapshots = makeSnapshots([{ ironProd: 10, ironCons: 5 }]);
    expect(extractItemTimeSeries(snapshots, 'Desc_Nonexistent_C')).toEqual([]);
  });

  it('extracts prod and cons values across snapshots with index-based timestamps', () => {
    const snapshots = makeSnapshots([
      { ironProd: 10, ironCons: 5 },
      { ironProd: 20, ironCons: 10 },
      { ironProd: 15, ironCons: 8 },
    ]);
    const result = extractItemTimeSeries(snapshots, 'Desc_IronPlate_C');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ timestamp: 0, prod: 10, cons: 5 });
    expect(result[1]).toEqual({ timestamp: 1, prod: 20, cons: 10 });
    expect(result[2]).toEqual({ timestamp: 2, prod: 15, cons: 8 });
  });

  it('skips snapshots where the item is missing', () => {
    const batches: ProdStatSnapshot[][] = [
      [{ Name: 'Iron Plate', ClassName: 'Desc_IronPlate_C', CurrentProd: 10, MaxProd: 40, CurrentConsumed: 5, MaxConsumed: 20 }],
      [{ Name: 'Iron Rod', ClassName: 'Desc_IronRod_C', CurrentProd: 30, MaxProd: 40, CurrentConsumed: 15, MaxConsumed: 20 }], // missing Iron Plate
      [{ Name: 'Iron Plate', ClassName: 'Desc_IronPlate_C', CurrentProd: 25, MaxProd: 40, CurrentConsumed: 12, MaxConsumed: 20 }],
    ];
    const result = extractItemTimeSeries(batches, 'Desc_IronPlate_C');
    // Only snapshots 0 and 2 have Iron Plate
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ timestamp: 0, prod: 10, cons: 5 });
    expect(result[1]).toEqual({ timestamp: 2, prod: 25, cons: 12 });
  });

  it('extracts only the requested item when multiple items exist', () => {
    const snapshots = makeSnapshots([
      { ironProd: 10, ironCons: 5, copperProd: 30, copperCons: 15 },
      { ironProd: 20, ironCons: 10, copperProd: 35, copperCons: 18 },
    ]);
    const ironResult = extractItemTimeSeries(snapshots, 'Desc_IronPlate_C');
    const copperResult = extractItemTimeSeries(snapshots, 'Desc_CopperWire_C');
    expect(ironResult).toHaveLength(2);
    expect(copperResult).toHaveLength(2);
    expect(ironResult[0].prod).toBe(10);
    expect(copperResult[0].prod).toBe(30);
  });
});

// ─── useTimeBuffer (hook behavior notes) ─────────────────────────
//
// The useTimeBuffer hook relies on useState/useEffect and Date.now(),
// making it difficult to unit test directly. Key behaviors tested here
// via the pure helpers, but the hook's core logic is:
//
// 1. On data change: appends { timestamp: Date.now(), data } to buffer
// 2. Prunes entries older than MAX_BUFFER_MS (1 hour)
// 3. getWindowData(ms): filters by timestamp >= now - ms, maps to data
// 4. getWindowAverage(ms, mapFn): averages mapFn over window entries
// 5. Returns 0 for getWindowAverage when buffer is empty
//
// Full integration tests for the hook should use @testing-library/react-hooks
// or a component wrapper with act() to trigger state changes.
