/**
 * Tests for useTimeBuffer — rolling time-series buffer for windowed averaging.
 * Most logic is tested via the returned callbacks since the hook uses useState/useEffect.
 * We also test the pure helper functions directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { averageProdStats, averagePowerStats } from '../useTimeBuffer';
import type { ProdStatSnapshot, PowerSnapshot } from '../useTimeBuffer';

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
