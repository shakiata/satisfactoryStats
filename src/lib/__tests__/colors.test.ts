/**
 * Tests for src/lib/colors.ts — deterministic color generation from string hash.
 */

import { describe, it, expect } from 'vitest';
import { nameToColor } from '@/lib/colors';

describe('nameToColor', () => {
  it('returns a valid HSL color string', () => {
    const result = nameToColor('Iron Plate');
    expect(result).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });

  it('returns the same color for the same input', () => {
    const a = nameToColor('Iron Plate');
    const b = nameToColor('Iron Plate');
    expect(a).toBe(b);
  });

  it('returns different colors for different inputs', () => {
    const a = nameToColor('Iron Plate');
    const b = nameToColor('Copper Wire');
    expect(a).not.toBe(b);
  });

  it('handles empty string', () => {
    const result = nameToColor('');
    expect(result).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });

  it('keeps saturation >= 30% and lightness between 30-50%', () => {
    for (const name of ['A', 'B', 'C', 'Iron Plate', 'SomeLongName']) {
      const result = nameToColor(name);
      const [, sat, light] = result.match(/hsl\(\d+,\s*(\d+)%,\s*(\d+)%\)$/)!;
      expect(Number(sat)).toBeGreaterThanOrEqual(30);
      expect(Number(light)).toBeGreaterThanOrEqual(30);
      expect(Number(light)).toBeLessThanOrEqual(50);
    }
  });
});
