/**
 * Tests for src/lib/names.ts — Satisfactory class name normalization.
 */

import { describe, it, expect } from 'vitest';
import { cleanName } from '@/lib/names';

describe('cleanName', () => {
  it('strips Build_ prefix and _C suffix and replaces underscores', () => {
    // Build_TrainStation_C → strip prefix/suffix → TrainStation
    // No underscores in "TrainStation", so no spaces inserted
    expect(cleanName('Build_TrainStation_C')).toBe('TrainStation');
  });

  it('replaces underscores with spaces', () => {
    expect(cleanName('Build_Iron_Plate_C')).toBe('Iron Plate');
  });

  it('handles camelCase class names (no space insertion — only _ replacement)', () => {
    // cleanName only replaces underscores; it does NOT split camelCase
    expect(cleanName('Build_ConstructorMk1_C')).toBe('ConstructorMk1');
  });

  it('handles names without Build_ prefix', () => {
    // Strips _C suffix, no underscores to replace
    expect(cleanName('TrainStation_C')).toBe('TrainStation');
  });

  it('handles plain names with no prefixes/suffixes', () => {
    expect(cleanName('IronPlate')).toBe('IronPlate');
  });

  it('returns empty string for empty input', () => {
    expect(cleanName('')).toBe('');
  });

  it('handles Desc_ class name prefix (icon paths)', () => {
    expect(cleanName('Desc_ConstructorMk1_C')).toBe('Desc ConstructorMk1');
  });
});
