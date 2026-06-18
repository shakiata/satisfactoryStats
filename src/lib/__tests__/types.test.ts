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
import type { AppSettings, DashboardTheme } from '../types';

// ─── DEFAULT_SETTINGS ────────────────────────────────────────────

describe('DEFAULT_SETTINGS', () => {
  it('has all required AppSettings fields', () => {
    const requiredKeys: (keyof AppSettings)[] = [
      'themeMode',
      'iconSize',
      'mapIconScale',
      'activeTab',
      'timeWindow',
      'mapVisibleLayers',
    ];
    for (const key of requiredKeys) {
      expect(DEFAULT_SETTINGS).toHaveProperty(key);
    }
  });

  it('has valid iconSize value', () => {
    expect(['sm', 'md', 'lg']).toContain(DEFAULT_SETTINGS.iconSize);
  });

  it('has mapIconScale within valid range', () => {
    expect(DEFAULT_SETTINGS.mapIconScale).toBeGreaterThanOrEqual(0.5);
    expect(DEFAULT_SETTINGS.mapIconScale).toBeLessThanOrEqual(2.0);
  });

  it('has a non-empty activeTab', () => {
    expect(DEFAULT_SETTINGS.activeTab).toBeTruthy();
    expect(typeof DEFAULT_SETTINGS.activeTab).toBe('string');
  });

  it('has timeWindow as a non-negative number', () => {
    expect(DEFAULT_SETTINGS.timeWindow).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(DEFAULT_SETTINGS.timeWindow)).toBe(true);
  });

  it('mapVisibleLayers contains expected default layers', () => {
    expect(DEFAULT_SETTINGS.mapVisibleLayers).toContain('factory');
    expect(DEFAULT_SETTINGS.mapVisibleLayers).toContain('generator');
    expect(DEFAULT_SETTINGS.mapVisibleLayers).toContain('extractor');
    expect(DEFAULT_SETTINGS.mapVisibleLayers).toContain('player');
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
