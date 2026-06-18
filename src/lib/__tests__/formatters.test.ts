/**
 * Tests for src/lib/formatters.ts — shared number formatting utilities
 * extracted from InventoryPanel, ProductionMonitor, TrainControlTower,
 * and PowerDashboard to eliminate code duplication.
 */

import { describe, it, expect } from 'vitest';
import { formatNumber, formatPower } from '@/lib/formatters';

// ─── formatNumber ──────────────────────────────────────────────

describe('formatNumber', () => {
  it('formats integers and sub-1 values with appropriate decimals', () => {
    // >= 1 with compact (default): no decimals
    expect(formatNumber(42)).toBe('42');
    // Sub-1 values always get 1 decimal
    expect(formatNumber(0)).toBe('0.0');
    // Negative >= 1 in absolute value: no decimals
    expect(formatNumber(-7)).toBe('-7');
  });

  it('adds decimals when decimals option is set', () => {
    expect(formatNumber(42, { decimals: 2 })).toBe('42.00');
    expect(formatNumber(3.14159, { decimals: 3 })).toBe('3.142');
  });

  it('appends a unit string with a space separator', () => {
    expect(formatNumber(120, { unit: '/min' })).toBe('120 /min');
    expect(formatNumber(500, { unit: 'MW' })).toBe('500 MW');
  });

  it('uses compact notation for large numbers', () => {
    expect(formatNumber(1_500_000, { compact: true })).toBe('1.5M');
    expect(formatNumber(2_500, { compact: true })).toBe('2.5k');
    expect(formatNumber(500, { compact: true })).toBe('500');
    expect(formatNumber(0.5, { compact: true })).toBe('0.5');
  });

  it('shows + sign for positive values when forceSign is true', () => {
    expect(formatNumber(42, { forceSign: true })).toBe('+42');
    expect(formatNumber(-7, { forceSign: true })).toBe('-7');
    // 0 is sub-1, gets 1 decimal; forceSign adds + if n >= 0
    expect(formatNumber(0, { forceSign: true })).toBe('+0.0');
  });

  it('combines multiple options (unit always space-separated)', () => {
    expect(formatNumber(1_500_000, { compact: true, unit: 'W' })).toBe('1.5M W');
    expect(formatNumber(2_500, { compact: true, unit: '/min' })).toBe('2.5k /min');
  });
});

// ─── formatPower ───────────────────────────────────────────────

describe('formatPower', () => {
  it('formats values >= 1000 MW as GW', () => {
    expect(formatPower(1500)).toBe('1.5 GW');
    expect(formatPower(1000)).toBe('1.0 GW');
  });

  it('formats values < 1000 MW with MW unit', () => {
    expect(formatPower(420)).toBe('420 MW');
    expect(formatPower(0)).toBe('0 MW');
    expect(formatPower(1)).toBe('1 MW');
  });

  it('handles negative power values', () => {
    expect(formatPower(-500)).toBe('-500 MW');
  });
});
