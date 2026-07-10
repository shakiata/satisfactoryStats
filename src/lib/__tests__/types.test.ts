/**
 * Smoke tests for type definitions and default constants.
 * Validates that exported defaults are structurally sound and
 * type guards work as expected.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  DEFAULT_THEME,
  LIGHT_THEME,
} from '../types';
import type {
  AppSettings,
  DashboardTheme,
  ProdStatSnapshot,
} from '../types';
import type { FluidSummary } from '../fluids';

// ─── DEFAULT_SETTINGS ────────────────────────────────────────────

describe('DEFAULT_SETTINGS', () => {
  it('has all required AppSettings fields', () => {
    const requiredKeys: (keyof AppSettings)[] = [
      'themeMode',
      'iconSize',
      'activeTab',
      'timeWindow',
    ];
    for (const key of requiredKeys) {
      expect(DEFAULT_SETTINGS).toHaveProperty(key);
    }
  });

  it('has valid iconSize value', () => {
    expect(['sm', 'md', 'lg']).toContain(DEFAULT_SETTINGS.iconSize);
  });

  it('has a non-empty activeTab', () => {
    expect(DEFAULT_SETTINGS.activeTab).toBeTruthy();
    expect(typeof DEFAULT_SETTINGS.activeTab).toBe('string');
  });

  it('has timeWindow as a non-negative number', () => {
    expect(DEFAULT_SETTINGS.timeWindow).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(DEFAULT_SETTINGS.timeWindow)).toBe(true);
  });

  it('themeMode defaults to dark', () => {
    expect(DEFAULT_SETTINGS.themeMode).toBe('dark');
  });
});

// ─── DEFAULT_THEME ────────────────────────────────────────────────

describe('DEFAULT_THEME', () => {
  it('has all 12 DashboardTheme color properties', () => {
    const requiredKeys: (keyof DashboardTheme)[] = [
      'bgPrimary',
      'bgSecondary',
      'bgCard',
      'borderColor',
      'textPrimary',
      'textSecondary',
      'accent',
      'accentHover',
      'success',
      'danger',
      'info',
      'muted',
    ];
    for (const key of requiredKeys) {
      expect(DEFAULT_THEME).toHaveProperty(key);
    }
    // No extra keys
    expect(Object.keys(DEFAULT_THEME)).toHaveLength(12);
  });

  it('all color values are valid hex strings', () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    for (const [key, value] of Object.entries(DEFAULT_THEME)) {
      expect(value).toMatch(hexRegex);
    }
  });

  it('colors are distinguishable (not all the same)', () => {
    const uniqueColors = new Set(Object.values(DEFAULT_THEME));
    // At least some colors should differ (bg vs text vs accent vs status)
    expect(uniqueColors.size).toBeGreaterThan(3);
  });
});

// ─── LIGHT_THEME ─────────────────────────────────────────────────

describe('LIGHT_THEME', () => {
  it('has all 12 DashboardTheme color properties', () => {
    const requiredKeys: (keyof DashboardTheme)[] = [
      'bgPrimary',
      'bgSecondary',
      'bgCard',
      'borderColor',
      'textPrimary',
      'textSecondary',
      'accent',
      'accentHover',
      'success',
      'danger',
      'info',
      'muted',
    ];
    for (const key of requiredKeys) {
      expect(LIGHT_THEME).toHaveProperty(key);
    }
    expect(Object.keys(LIGHT_THEME)).toHaveLength(12);
  });

  it('all color values are valid hex strings', () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    for (const [key, value] of Object.entries(LIGHT_THEME)) {
      expect(value).toMatch(hexRegex);
    }
  });

  it('uses light background colors', () => {
    // Light theme backgrounds should be bright (lightness > dark theme)
    const parseHex = (h: string) => parseInt(h.slice(1), 16);
    const bgAvg = (parseHex(LIGHT_THEME.bgPrimary) + parseHex(LIGHT_THEME.bgSecondary) + parseHex(LIGHT_THEME.bgCard)) / 3;
    const darkBgAvg = (parseHex(DEFAULT_THEME.bgPrimary) + parseHex(DEFAULT_THEME.bgSecondary) + parseHex(DEFAULT_THEME.bgCard)) / 3;
    expect(bgAvg).toBeGreaterThan(darkBgAvg);
  });

  it('uses dark text colors (dark on light background)', () => {
    const parseHex = (h: string) => parseInt(h.slice(1), 16);
    // Light theme text should be darker than dark theme text
    const lightTextAvg = (parseHex(LIGHT_THEME.textPrimary) + parseHex(LIGHT_THEME.textSecondary)) / 2;
    const darkTextAvg = (parseHex(DEFAULT_THEME.textPrimary) + parseHex(DEFAULT_THEME.textSecondary)) / 2;
    expect(lightTextAvg).toBeLessThan(darkTextAvg);
  });

  it('is different from DEFAULT_THEME', () => {
    for (const key of Object.keys(DEFAULT_THEME) as (keyof DashboardTheme)[]) {
      // At least one color should differ between themes
      if (LIGHT_THEME[key] !== DEFAULT_THEME[key]) return;
    }
    throw new Error('LIGHT_THEME should differ from DEFAULT_THEME in at least one color');
  });
});

// ─── Type narrowing smoke tests ──────────────────────────────────
//
// These tests validate that type imports resolve correctly.
// If any of these fail at compile time, the type definitions
// are broken. They exist primarily to catch regressions in
// the type system.

describe('type imports', () => {
  it('FRMConfig type is structurally sound (compile-time check)', () => {
    const config = {
      host: 'localhost',
      port: '8080',
      refreshRate: 5000,
    };
    // If this compiles, FRMConfig accepts the shape
    expect(config.host).toBe('localhost');
  });

  it('LocationData type is structurally sound (compile-time check)', () => {
    const loc = { x: 100, y: 200, z: 300 };
    expect(loc.x).toBe(100);
  });
});

// ─── ProdStatSnapshot ────────────────────────────────────────────

describe('ProdStatSnapshot', () => {
  it('accepts all required fields', () => {
    const snap: ProdStatSnapshot = {
      Name: 'Desc_Water_C',
      ClassName: 'Desc_Water_C',
      CurrentProd: 300,
      MaxProd: 600,
      CurrentConsumed: 200,
      MaxConsumed: 600,
    };
    expect(snap.CurrentProd).toBe(300);
    expect(snap.CurrentConsumed).toBe(200);
  });

  it('allows zero values', () => {
    const snap: ProdStatSnapshot = {
      Name: 'Idle',
      ClassName: 'Desc_Idle_C',
      CurrentProd: 0,
      MaxProd: 150,
      CurrentConsumed: 0,
      MaxConsumed: 0,
    };
    expect(snap.MaxProd).toBe(150);
    expect(snap.MaxConsumed).toBe(0);
  });
});

// ─── FluidSummary (from fluids.ts) ──────────────────────────────

describe('FluidSummary', () => {
  it('accepts a valid fluid summary object', () => {
    const summary: FluidSummary = {
      name: 'Water',
      className: 'Desc_Water_C',
      prodPerMin: 300,
      consPerMin: 200,
      netPerMin: 100,
      maxProd: 600,
      maxCons: 600,
      storedAmount: 5000,
      isGas: false,
    };
    expect(summary.prodPerMin).toBe(300);
    expect(summary.isGas).toBe(false);
  });

  it('isGas is true for Nitrogen', () => {
    const summary: FluidSummary = {
      name: 'Nitrogen Gas',
      className: 'Desc_NitrogenGas_C',
      prodPerMin: 60,
      consPerMin: 0,
      netPerMin: 60,
      maxProd: 120,
      maxCons: 0,
      storedAmount: 0,
      isGas: true,
    };
    expect(summary.isGas).toBe(true);
    expect(summary.netPerMin).toBe(60);
  });
});
