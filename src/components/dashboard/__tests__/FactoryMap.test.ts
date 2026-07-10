import { describe, it, expect } from 'vitest';
import {
  worldToMap,
  mapToWorld,
  classNameToIconPath,
  cleanRecipe,
  calcIconSize,
  calcHitRadius,
} from '../FactoryMap';

describe('worldToMap', () => {
  it('converts world origin to center of map', () => {
    const [x, y] = worldToMap(0, 0);
    expect(x).toBeCloseTo(4096, 0);
    expect(y).toBeCloseTo(4096, 0);
  });

  it('maps south-west to top-left (0,0) — south has lower Z, image has south at top', () => {
    const [x, y] = worldToMap(-425000, -425000);
    expect(x).toBeCloseTo(0, 0);
    expect(y).toBeCloseTo(0, 0);
  });

  it('maps north-east to bottom-right (MAP_SIZE, MAP_SIZE) — north has higher Z, image has north at bottom', () => {
    const [x, y] = worldToMap(425000, 425000);
    expect(x).toBeCloseTo(8192, 0);
    expect(y).toBeCloseTo(8192, 0);
  });

  it('roundtrips through mapToWorld', () => {
    const testPoints = [
      { x: 0, z: 0 },
      { x: -425000, z: -425000 },
      { x: 425000, z: 425000 },
      { x: 123456, z: -789012 },
    ];
    for (const pt of testPoints) {
      const [mx, my] = worldToMap(pt.x, pt.z);
      const { x, z } = mapToWorld(mx, my);
      expect(x).toBeCloseTo(pt.x, 0);
      expect(z).toBeCloseTo(pt.z, 0);
    }
  });
});

describe('mapToWorld', () => {
  it('converts map center (4096, 4096) to world origin', () => {
    const { x, z } = mapToWorld(4096, 4096);
    expect(x).toBeCloseTo(0, 0);
    expect(z).toBeCloseTo(0, 0);
  });

  it('maps top-left (0,0) to south-west — image has south at top', () => {
    const { x, z } = mapToWorld(0, 0);
    expect(x).toBeCloseTo(-425000, 0);
    expect(z).toBeCloseTo(-425000, 0);
  });

  it('maps bottom-right (8192, 8192) to north-east — image has north at bottom', () => {
    const { x, z } = mapToWorld(8192, 8192);
    expect(x).toBeCloseTo(425000, 0);
    expect(z).toBeCloseTo(425000, 0);
  });
});

describe('classNameToIconPath', () => {
  it('converts Build_ prefixed class name to Desc_ icon path', () => {
    expect(classNameToIconPath('Build_ConstructorMk1_C')).toBe(
      './Icons/Desc_ConstructorMk1_C.png',
    );
  });

  it('keeps Desc_ prefixed names unchanged', () => {
    expect(classNameToIconPath('Desc_IronPlate_C')).toBe(
      './Icons/Desc_IronPlate_C.png',
    );
  });

  it('handles class names without _C suffix', () => {
    expect(classNameToIconPath('Build_Assembler')).toBe(
      './Icons/Desc_Assembler.png',
    );
  });

  it('works for item class names', () => {
    expect(classNameToIconPath('Desc_Wire_C')).toBe('./Icons/Desc_Wire_C.png');
  });
});

describe('cleanRecipe', () => {
  it('strips Recipe_ prefix and _C suffix from CamelCase names', () => {
    expect(cleanRecipe('Recipe_IngotIron_C')).toBe('IngotIron');
  });

  it('replaces underscores with spaces', () => {
    expect(cleanRecipe('Recipe_Alternate_IronIngot_C')).toBe(
      'Alternate IronIngot',
    );
  });

  it('handles recipe names without _C suffix', () => {
    expect(cleanRecipe('Recipe_ConstructIronPlate')).toBe(
      'ConstructIronPlate',
    );
  });

  it('passes through already-clean names', () => {
    expect(cleanRecipe('Iron Ingot')).toBe('Iron Ingot');
  });
});

describe('calcIconSize', () => {
  it('returns a positive number', () => {
    expect(calcIconSize(1000, 1)).toBeGreaterThan(0);
  });

  it('scales with iconScale', () => {
    expect(calcIconSize(1000, 2)).toBe(calcIconSize(1000, 1) * 2);
  });

  it('caps at maximum of 32 * iconScale', () => {
    // At large viewBox width, the result is capped at 32 then * scale
    expect(calcIconSize(99999, 1)).toBe(32);
  });

  it('has a minimum of 8 * iconScale', () => {
    // At very small viewBox width, clamped to minimum 8
    const result = calcIconSize(1, 1);
    expect(result).toBeGreaterThanOrEqual(8);
  });
});

describe('calcHitRadius', () => {
  it('returns a positive number', () => {
    expect(calcHitRadius(1000)).toBeGreaterThan(0);
  });

  it('scales with viewBox width', () => {
    // At viewBox.w = 1000: max(12, 1000/25) = max(12, 40) = 40
    expect(calcHitRadius(1000)).toBeGreaterThan(12);
  });

  it('has a minimum of 12', () => {
    expect(calcHitRadius(50)).toBe(12);
  });
});
