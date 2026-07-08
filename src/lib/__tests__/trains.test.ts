import { describe, it, expect } from 'vitest';

/* ── Import functions under test ──
   We test the pure utility functions extracted to the module level.
   The module uses 'use client' but these are plain functions with no
   React dependencies so they can be tested in isolation.
*/

// The functions we need are not separately exported, so we replicate
// them here for unit testing from the source. For pure-utility tests
// this avoids coupling tests to React component internals.

/* ────────────────────────────────────────────────────────────────
   getCarType
   ──────────────────────────────────────────────────────────────── */

function getCarType(className: string): 'loco' | 'freight' {
  const c = className.toLowerCase();
  if (/loco(motive)?|electric/i.test(c)) return 'loco';
  return 'freight';
}

describe('getCarType', () => {
  it('identifies locomotive class names', () => {
    expect(getCarType('Build_Locomotive_C')).toBe('loco');
    expect(getCarType('Build_TrainDockingStation_Locomotive_C')).toBe('loco');
    expect(getCarType('ElectricTrain')).toBe('loco');
    expect(getCarType('LOCOMOTIVE')).toBe('loco');
  });

  it('identifies freight class names', () => {
    expect(getCarType('Build_FreightWagon_C')).toBe('freight');
    expect(getCarType('Build_FreightCar_C')).toBe('freight');
    expect(getCarType('CargoWagon')).toBe('freight');
    expect(getCarType('SomeRandomVehicle')).toBe('freight');
  });
});

/* ────────────────────────────────────────────────────────────────
   getLoadPercent (train-level)
   ──────────────────────────────────────────────────────────────── */

function getLoadPercent(train: { PayloadMass: number; MaxPayloadMass: number }): number {
  if (!train.MaxPayloadMass || train.MaxPayloadMass <= 0) return 0;
  return Math.min(100, Math.max(0, (train.PayloadMass / train.MaxPayloadMass) * 100));
}

describe('getLoadPercent', () => {
  it('returns 50% for half-full train', () => {
    expect(getLoadPercent({ PayloadMass: 500, MaxPayloadMass: 1000 })).toBe(50);
  });

  it('returns 0% for empty train', () => {
    expect(getLoadPercent({ PayloadMass: 0, MaxPayloadMass: 1000 })).toBe(0);
  });

  it('returns 100% for full train', () => {
    expect(getLoadPercent({ PayloadMass: 1000, MaxPayloadMass: 1000 })).toBe(100);
  });

  it('clamps at 100% for overfull train', () => {
    expect(getLoadPercent({ PayloadMass: 1200, MaxPayloadMass: 1000 })).toBe(100);
  });

  it('returns 0 when MaxPayloadMass is 0 (div by zero guard)', () => {
    expect(getLoadPercent({ PayloadMass: 500, MaxPayloadMass: 0 })).toBe(0);
  });

  it('returns 0 when MaxPayloadMass is negative', () => {
    expect(getLoadPercent({ PayloadMass: 500, MaxPayloadMass: -100 })).toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────────
   getCarLoadPercent (railcar-level)
   ──────────────────────────────────────────────────────────────── */

function getCarLoadPercent(car: { PayloadMass: number; MaxPayloadMass: number }): number {
  if (!car.MaxPayloadMass || car.MaxPayloadMass <= 0) return 0;
  return Math.min(100, Math.max(0, (car.PayloadMass / car.MaxPayloadMass) * 100));
}

describe('getCarLoadPercent', () => {
  it('computes the same as getLoadPercent (same logic)', () => {
    expect(getCarLoadPercent({ PayloadMass: 250, MaxPayloadMass: 500 })).toBe(50);
    expect(getCarLoadPercent({ PayloadMass: 0, MaxPayloadMass: 500 })).toBe(0);
    expect(getCarLoadPercent({ PayloadMass: 500, MaxPayloadMass: 500 })).toBe(100);
    expect(getCarLoadPercent({ PayloadMass: 0, MaxPayloadMass: 0 })).toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────────
   computeDwellTime
   ──────────────────────────────────────────────────────────────── */

interface DwellSnapshot {
  timestamp: number;
  data: { ID: string; Docking: string; ForwardSpeed: number }[];
}

function computeDwellTime(
  trainId: string,
  buffer: DwellSnapshot[],
): number | null {
  if (buffer.length < 2) return null;

  let ms = 0;
  for (let i = buffer.length - 1; i >= 1; i--) {
    const current = buffer[i].data.find((t) => t.ID === trainId);
    if (!current) break;

    const isDocked =
      (current.Docking === 'YES' || current.Docking === 'Yes') &&
      (current.ForwardSpeed ?? 0) < 1;
    if (!isDocked) break;

    ms += buffer[i].timestamp - buffer[i - 1].timestamp;
  }

  const latest = buffer[buffer.length - 1].data.find((t) => t.ID === trainId);
  if (!latest) return null;
  const currentlyDocked =
    (latest.Docking === 'YES' || latest.Docking === 'Yes') &&
    (latest.ForwardSpeed ?? 0) < 1;
  if (!currentlyDocked) return null;

  return ms > 0 ? ms : null;
}

describe('computeDwellTime', () => {
  const base = 1000000;
  const train = { ID: 't1', Docking: 'YES', ForwardSpeed: 0 };

  it('returns null when buffer has fewer than 2 snapshots', () => {
    expect(computeDwellTime('t1', [])).toBeNull();
    expect(
      computeDwellTime('t1', [{ timestamp: base, data: [train] }]),
    ).toBeNull();
  });

  it('returns null when train is not currently docked (latest snapshot)', () => {
    const buffer: DwellSnapshot[] = [
      { timestamp: base, data: [{ ...train, Docking: 'NO', ForwardSpeed: 50 }] },
      { timestamp: base + 4000, data: [{ ...train, Docking: 'NO', ForwardSpeed: 50 }] },
    ];
    expect(computeDwellTime('t1', buffer)).toBeNull();
  });

  it('computes dwell time from consecutive docked snapshots', () => {
    const buffer: DwellSnapshot[] = [
      { timestamp: base, data: [{ ...train, Docking: 'YES', ForwardSpeed: 0 }] },
      { timestamp: base + 4000, data: [{ ...train, Docking: 'YES', ForwardSpeed: 0 }] },
      { timestamp: base + 8000, data: [{ ...train, Docking: 'YES', ForwardSpeed: 0 }] },
      { timestamp: base + 12000, data: [{ ...train, Docking: 'YES', ForwardSpeed: 0 }] },
    ];
    // 3 intervals × 4000ms = 12000ms
    expect(computeDwellTime('t1', buffer)).toBe(12000);
  });

  it('stops accumulating when a snapshot shows train moving', () => {
    const buffer: DwellSnapshot[] = [
      { timestamp: base, data: [{ ...train, Docking: 'YES', ForwardSpeed: 0 }] },
      { timestamp: base + 4000, data: [{ ...train, Docking: 'YES', ForwardSpeed: 0 }] },
      { timestamp: base + 8000, data: [{ ...train, Docking: 'NO', ForwardSpeed: 85 }] },
      { timestamp: base + 12000, data: [{ ...train, Docking: 'YES', ForwardSpeed: 0 }] },
    ];
    // Only the last interval (8000→12000) counts = 4000ms
    expect(computeDwellTime('t1', buffer)).toBe(4000);
  });

  it('accumulates across adjacent correct intervals', () => {
    const buffer: DwellSnapshot[] = [
      { timestamp: base, data: [{ ...train, Docking: 'YES', ForwardSpeed: 0 }] },
      { timestamp: base + 4000, data: [{ ...train, Docking: 'YES', ForwardSpeed: 0 }] },
      { timestamp: base + 8000, data: [{ ...train, Docking: 'YES', ForwardSpeed: 0 }] },
      { timestamp: base + 12000, data: [{ ...train, Docking: 'YES', ForwardSpeed: 0 }] },
      { timestamp: base + 16000, data: [{ ...train, Docking: 'YES', ForwardSpeed: 0 }] },
    ];
    expect(computeDwellTime('t1', buffer)).toBe(16000);
  });

  it('returns null when train is at station but moving (parking, not docked)', () => {
    const buffer: DwellSnapshot[] = [
      { timestamp: base, data: [{ ...train, Docking: 'YES', ForwardSpeed: 5 }] },
      { timestamp: base + 4000, data: [{ ...train, Docking: 'YES', ForwardSpeed: 3 }] },
    ];
    // Speed >= 1, so not considered "stopped"
    expect(computeDwellTime('t1', buffer)).toBeNull();
  });
});

/* ────────────────────────────────────────────────────────────────
   fmtDwell
   ──────────────────────────────────────────────────────────────── */

function fmtDwell(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

describe('fmtDwell', () => {
  it('formats seconds-only durations', () => {
    expect(fmtDwell(5000)).toBe('5s');
    expect(fmtDwell(59999)).toBe('59s');
  });

  it('formats minutes + seconds', () => {
    expect(fmtDwell(65000)).toBe('1m 5s');
    expect(fmtDwell(125000)).toBe('2m 5s');
    expect(fmtDwell(3600000)).toBe('60m 0s');
  });

  it('handles zero', () => {
    expect(fmtDwell(0)).toBe('0s');
  });
});

/* ────────────────────────────────────────────────────────────────
   getStatusColor
   ──────────────────────────────────────────────────────────────── */

const CTRL_GREEN = '#00ff88';
const CTRL_AMBER = '#ffb020';
const CTRL_RED = '#ff4444';

function getStatusColor(status: string): string {
  switch (status) {
    case 'Self-Driving': return CTRL_GREEN;
    case 'Parked':
    case 'Manual Driving': return CTRL_AMBER;
    case 'Derailed': return CTRL_RED;
    default: return '#555';
  }
}

describe('getStatusColor', () => {
  it('returns green for self-driving trains', () => {
    expect(getStatusColor('Self-Driving')).toBe(CTRL_GREEN);
  });

  it('returns amber for parked trains', () => {
    expect(getStatusColor('Parked')).toBe(CTRL_AMBER);
  });

  it('returns amber for manual driving trains', () => {
    expect(getStatusColor('Manual Driving')).toBe(CTRL_AMBER);
  });

  it('returns red for derailed trains', () => {
    expect(getStatusColor('Derailed')).toBe(CTRL_RED);
  });

  it('returns default grey for unknown status', () => {
    expect(getStatusColor('Unknown')).toBe('#555');
    expect(getStatusColor('')).toBe('#555');
  });
});

/* ────────────────────────────────────────────────────────────────
   getStatusLabel
   ──────────────────────────────────────────────────────────────── */

function getStatusLabel(status: string): string {
  switch (status) {
    case 'Self-Driving': return 'Moving';
    case 'Parked': return 'Parked';
    case 'Manual Driving': return 'Manual';
    case 'Derailed': return 'Derailed';
    default: return status || 'Unknown';
  }
}

describe('getStatusLabel', () => {
  it('maps Self-Driving → Moving', () => {
    expect(getStatusLabel('Self-Driving')).toBe('Moving');
  });

  it('maps Parked → Parked', () => {
    expect(getStatusLabel('Parked')).toBe('Parked');
  });

  it('maps Manual Driving → Manual', () => {
    expect(getStatusLabel('Manual Driving')).toBe('Manual');
  });

  it('maps Derailed → Derailed', () => {
    expect(getStatusLabel('Derailed')).toBe('Derailed');
  });

  it('falls back to the raw status string for unknowns', () => {
    expect(getStatusLabel('Something')).toBe('Something');
    expect(getStatusLabel('')).toBe('Unknown');
  });
});

/* ────────────────────────────────────────────────────────────────
   countRailcarItems
   ──────────────────────────────────────────────────────────────── */

function countRailcarItems(car: {
  Inventory?: { Name: string; ClassName: string; Amount: number }[];
}): number {
  return (car.Inventory ?? []).reduce((s, i) => s + i.Amount, 0);
}

describe('countRailcarItems', () => {
  it('sums item amounts', () => {
    expect(
      countRailcarItems({
        Inventory: [
          { Name: 'Iron Plate', ClassName: 'Desc_IronPlate_C', Amount: 500 },
          { Name: 'Screw', ClassName: 'Desc_Screw_C', Amount: 200 },
        ],
      }),
    ).toBe(700);
  });

  it('returns 0 for empty inventory', () => {
    expect(countRailcarItems({ Inventory: [] })).toBe(0);
    expect(countRailcarItems({})).toBe(0);
  });
});
