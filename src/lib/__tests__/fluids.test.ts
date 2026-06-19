/**
 * Tests for src/lib/fluids.ts — fluid identification and stats utilities
 * used by FluidDashboard to filter production data and trace raw materials
 * through the recipe graph.
 */

import { describe, it, expect } from 'vitest';
import {
  getFluidSet,
  buildFluidSet,
  isFluidClassName,
  isFluidItem,
  getFluidSummaries,
  mergeExtractorFluids,
  traceRawMaterials,
} from '@/lib/fluids';
import type { FluidSummary, RawRecipe } from '@/lib/fluids';
import type { ProdStatSnapshot, ProdStatItem, Extractor } from '@/lib/types';

// ─── Test helpers ──────────────────────────────────────────────

/** Sample production stats mixing fluids and solids. */
function makeSampleSnapshots(): ProdStatSnapshot[] {
  return [
    { Name: 'Desc_Water_C', ClassName: 'Desc_Water_C', CurrentProd: 300, MaxProd: 600, CurrentConsumed: 200, MaxConsumed: 600 },
    { Name: 'Desc_LiquidFuel_C', ClassName: 'Desc_LiquidFuel_C', CurrentProd: 150, MaxProd: 300, CurrentConsumed: 120, MaxConsumed: 300 },
    { Name: 'Desc_IronIngot_C', ClassName: 'Desc_IronIngot_C', CurrentProd: 450, MaxProd: 900, CurrentConsumed: 400, MaxConsumed: 900 },
    { Name: 'Desc_AluminaSolution_C', ClassName: 'Desc_AluminaSolution_C', CurrentProd: 80, MaxProd: 160, CurrentConsumed: 80, MaxConsumed: 160 },
    { Name: 'Desc_NitrogenGas_C', ClassName: 'Desc_NitrogenGas_C', CurrentProd: 60, MaxProd: 120, CurrentConsumed: 0, MaxConsumed: 0 },
    { Name: 'Desc_SulfuricAcid_C', ClassName: 'Desc_SulfuricAcid_C', CurrentProd: 40, MaxProd: 80, CurrentConsumed: 40, MaxConsumed: 80 },
    { Name: 'Desc_HeavyOilResidue_C', ClassName: 'Desc_HeavyOilResidue_C', CurrentProd: 100, MaxProd: 200, CurrentConsumed: 60, MaxConsumed: 200 },
  ];
}

/**
 * Minimal recipe set for tracing.
 * Water is an ingredient (fluid) of Alumina Solution.
 * Bauxite is a solid ingredient.
 */
function makeSampleRecipes(): RawRecipe[] {
  return [
    {
      ClassName: 'Recipe_AluminaSolution_C',
      displayName: 'Alternate: Sloppy Alumina',
      products: [{ ClassName: 'Desc_AluminaSolution_C', Name: 'Alumina Solution', Amount: 80 }],
      ingredients: [
        { ClassName: 'Desc_Water_C', Name: 'Water', Amount: 100 },
        { ClassName: 'Desc_OreBauxite_C', Name: 'Bauxite', Amount: 70 },
      ],
    },
  ];
}

// ─── isFluidClassName ─────────────────────────────────────────

describe('isFluidClassName', () => {
  it('detects Desc_Liquid prefix items as liquids', () => {
    expect(isFluidClassName('Desc_LiquidFuel_C')).toBe(true);
    expect(isFluidClassName('Desc_LiquidTurboFuel_C')).toBe(true);
    expect(isFluidClassName('Desc_LiquidBiofuel_C')).toBe(true);
  });

  it('detects Desc_Gas prefix items as gases', () => {
    expect(isFluidClassName('Desc_GasSomething_C')).toBe(true);
  });

  it('detects embedded Gas in ClassName (e.g. NitrogenGas)', () => {
    expect(isFluidClassName('Desc_NitrogenGas_C')).toBe(true);
  });

  it('excludes solid items with Gas in name (GasTank, GasMask, GasNobelisk)', () => {
    expect(isFluidClassName('Desc_GasTank_C')).toBe(false);
    expect(isFluidClassName('Desc_GasMask_C')).toBe(false);
    expect(isFluidClassName('Desc_GasNobelisk_C')).toBe(false);
  });

  it('detects known unpackaged liquids from hardcoded set', () => {
    expect(isFluidClassName('Desc_Water_C')).toBe(true);
    expect(isFluidClassName('Desc_AluminaSolution_C')).toBe(true);
    expect(isFluidClassName('Desc_SulfuricAcid_C')).toBe(true);
    expect(isFluidClassName('Desc_NitricAcid_C')).toBe(true);
    expect(isFluidClassName('Desc_HeavyOilResidue_C')).toBe(true);
    expect(isFluidClassName('Desc_DarkMatterResidue_C')).toBe(true);
    expect(isFluidClassName('Desc_IonizedFuel_C')).toBe(true);
    expect(isFluidClassName('Desc_RocketFuel_C')).toBe(true);
  });

  it('detects liquids via word hints (Oil, Acid, Residue, Solution, Extract)', () => {
    // Mod-added liquids that contain these words after Desc_
    expect(isFluidClassName('Desc_SomeModOil_C')).toBe(true);
    expect(isFluidClassName('Desc_ConcentratedAcid_C')).toBe(true);
    expect(isFluidClassName('Desc_AlienResidue_C')).toBe(true);
    expect(isFluidClassName('Desc_CustomSolution_C')).toBe(true);
    expect(isFluidClassName('Desc_PlantExtract_C')).toBe(true);
  });

  it('returns false for solid items', () => {
    expect(isFluidClassName('Desc_IronIngot_C')).toBe(false);
    expect(isFluidClassName('Desc_CopperOre_C')).toBe(false);
    expect(isFluidClassName('Desc_ModularFrame_C')).toBe(false);
    expect(isFluidClassName('Desc_Computer_C')).toBe(false);
  });
});

// ─── getFluidSet / buildFluidSet ────────────────────────────────

describe('getFluidSet', () => {
  it('returns a non-empty Set of fluid ClassNames', () => {
    const set = getFluidSet();
    expect(set).toBeInstanceOf(Set);
    expect(set.size).toBeGreaterThan(0);
    expect(set.has('Desc_Water_C')).toBe(true);
    expect(set.has('Desc_LiquidFuel_C')).toBe(true);
    expect(set.has('Desc_NitrogenGas_C')).toBe(true);
    expect(set.has('Desc_IronIngot_C')).toBe(false);
  });

  it('is cached — second call returns the same Set instance', () => {
    const a = getFluidSet();
    const b = getFluidSet();
    expect(a).toBe(b);
  });

  it('buildFluidSet is a legacy alias', () => {
    expect(buildFluidSet()).toBe(getFluidSet());
  });
});

// ─── isFluidItem ────────────────────────────────────────────────

describe('isFluidItem', () => {
  const fluidSet = getFluidSet();

  it('returns true for known fluid ClassNames', () => {
    expect(isFluidItem('Desc_Water_C', fluidSet)).toBe(true);
    expect(isFluidItem('Desc_LiquidFuel_C', fluidSet)).toBe(true);
    expect(isFluidItem('Desc_NitrogenGas_C', fluidSet)).toBe(true);
  });

  it('returns false for solid items', () => {
    expect(isFluidItem('Desc_IronIngot_C', fluidSet)).toBe(false);
    expect(isFluidItem('Desc_CopperOre_C', fluidSet)).toBe(false);
  });

  it('returns true even when fluidSet is null (uses isFluidClassName directly)', () => {
    // isFluidItem now uses isFluidClassName() internally, so a null fluidSet
    // does not prevent detection — Water is always recognized as a fluid.
    expect(isFluidItem('Desc_Water_C', null)).toBe(true);
  });
});

// ─── getFluidSummaries ──────────────────────────────────────────

describe('getFluidSummaries', () => {
  const fluidSet = new Set<string>([
    'Desc_Water_C',
    'Desc_LiquidFuel_C',
    'Desc_AluminaSolution_C',
    'Desc_NitrogenGas_C',
  ]);

  const snapshots = makeSampleSnapshots();
  const worldInv = new Map<string, number>([
    ['Desc_Water_C', 5000],
    ['Desc_LiquidFuel_C', 1200],
  ]);

  it('filters out non-fluid items', () => {
    const summaries = getFluidSummaries(snapshots, fluidSet);
    const names = summaries.map((s) => s.className);
    expect(names).toContain('Desc_Water_C');
    expect(names).toContain('Desc_LiquidFuel_C');
    expect(names).toContain('Desc_AluminaSolution_C');
    expect(names).toContain('Desc_NitrogenGas_C');
    expect(names).not.toContain('Desc_IronIngot_C');
  });

  it('returns correct production and consumption rates', () => {
    const summaries = getFluidSummaries(snapshots, fluidSet);
    const water = summaries.find((s) => s.className === 'Desc_Water_C')!;
    expect(water.prodPerMin).toBe(300);
    expect(water.consPerMin).toBe(200);
    expect(water.netPerMin).toBe(100);
    expect(water.maxProd).toBe(600);
    expect(water.maxCons).toBe(600);
  });

  it('returns zero netPerMin for fluids with no consumers', () => {
    const summaries = getFluidSummaries(snapshots, fluidSet);
    const nitrogen = summaries.find((s) => s.className === 'Desc_NitrogenGas_C')!;
    expect(nitrogen.consPerMin).toBe(0);
    expect(nitrogen.netPerMin).toBe(60);
  });

  it('enriches with world inventory when provided', () => {
    const summaries = getFluidSummaries(snapshots, fluidSet, worldInv);
    const water = summaries.find((s) => s.className === 'Desc_Water_C')!;
    expect(water.storedAmount).toBe(5000);

    const alumina = summaries.find((s) => s.className === 'Desc_AluminaSolution_C')!;
    expect(alumina.storedAmount).toBe(0);
  });

  it('returns empty array when snapshots is empty', () => {
    expect(getFluidSummaries([], fluidSet)).toEqual([]);
  });

  it('returns empty array when no fluids match', () => {
    const solidOnly = [
      { Name: 'Iron', ClassName: 'Desc_IronIngot_C', CurrentProd: 10, MaxProd: 20, CurrentConsumed: 5, MaxConsumed: 10 },
    ];
    expect(getFluidSummaries(solidOnly, fluidSet)).toEqual([]);
  });

  it('cleans fluid names from Desc_ prefix and _C suffix', () => {
    const summaries = getFluidSummaries(snapshots, fluidSet);
    const water = summaries.find((s) => s.className === 'Desc_Water_C')!;
    expect(water.name).toBe('Water');
  });

  it('marks gases correctly', () => {
    const summaries = getFluidSummaries(snapshots, fluidSet);
    const nitrogen = summaries.find((s) => s.className === 'Desc_NitrogenGas_C')!;
    expect(nitrogen.isGas).toBe(true);

    const water = summaries.find((s) => s.className === 'Desc_Water_C')!;
    expect(water.isGas).toBe(false);
  });
});

// ─── traceRawMaterials ──────────────────────────────────────────

describe('traceRawMaterials', () => {
  const fluidSet = new Set<string>([
    'Desc_Water_C',
    'Desc_AluminaSolution_C',
    'Desc_NitrogenGas_C',
  ]);
  const recipes = makeSampleRecipes();

  it('traces solid ingredients from a fluid producer recipe', () => {
    const materials = traceRawMaterials('Desc_AluminaSolution_C', fluidSet, recipes);
    // Water is a fluid, should NOT appear. Bauxite is solid, SHOULD appear.
    const names = materials.map((m) => m.name);
    expect(names).toContain('Bauxite');
    expect(names).not.toContain('Water');
  });

  it('works even when fluidSet is null (uses isFluidClassName internally)', () => {
    // traceRawMaterials no longer requires a non-null fluidSet — it uses
    // isFluidClassName() for fluid classification.
    const materials = traceRawMaterials('Desc_AluminaSolution_C', null, recipes);
    // Water is a fluid (isFluidClassName → true), Bauxite is solid
    const names = materials.map((m) => m.name);
    expect(names).toContain('Bauxite');
    expect(names).not.toContain('Water');
  });

  it('returns empty array for non-existent ClassName', () => {
    const materials = traceRawMaterials('Desc_Nonexistent_C', fluidSet, recipes);
    expect(materials).toEqual([]);
  });

  it('returns empty array when recipes list is empty', () => {
    const materials = traceRawMaterials('Desc_AluminaSolution_C', fluidSet, []);
    expect(materials).toEqual([]);
  });

  it('stops at maxDepth', () => {
    // Build a deep chain: SolidA → LiquidB → LiquidC
    // Desc_LiquidTestB_C is detected as a fluid by isFluidClassName (Desc_Liquid prefix).
    // Desc_LiquidTestC_C is also a fluid.
    const deepRecipes = [
      {
        ClassName: 'Recipe_Deep_C',
        Name: 'Deep Recipe',
        products: [{ ClassName: 'Desc_LiquidTestB_C', Name: 'LiquidB', Amount: 120 }],
        ingredients: [{ ClassName: 'Desc_SolidA_C', Name: 'SolidA', Amount: 45 }],
      },
      {
        ClassName: 'Recipe_Deeper_C',
        Name: 'Deeper Recipe',
        products: [{ ClassName: 'Desc_LiquidTestC_C', Name: 'LiquidC', Amount: 60 }],
        ingredients: [{ ClassName: 'Desc_LiquidTestB_C', Name: 'LiquidB', Amount: 120 }],
      },
    ];

    // At maxDepth=1, we enter at depth 1 and find LiquidB (a fluid) as the
    // ingredient of LiquidC. We need to recurse to find SolidA, but that
    // would be depth 2 which is blocked. So result is empty.
    const materials = traceRawMaterials('Desc_LiquidTestC_C', null, deepRecipes, 1);
    expect(materials).toEqual([]);
  });

  it('merges fluid production from extractors into items', () => {
    const items: ProdStatItem[] = [
      { Name: 'Cable', ClassName: 'Desc_Cable_C', CurrentProd: 10, MaxProd: 20, CurrentConsumed: 0, MaxConsumed: 0, ProdPerMin: '', ProdPercent: 50, ConsPercent: 0 },
    ];
    const extractors: Extractor[] = [
      { production: [{ Name: 'Water', ClassName: 'Desc_Water_C', CurrentProd: 100, MaxProd: 120, ProdPercent: 80 }] } as Extractor,
    ];
    const result = mergeExtractorFluids(items, extractors);
    expect(result).toHaveLength(2);
    const water = result.find((i) => i.ClassName === 'Desc_Water_C');
    expect(water).toBeDefined();
    expect(water!.CurrentProd).toBe(100);
    expect(water!.MaxProd).toBe(120);
    expect(water!.Name).toBe('Water');
  });

  it('aggregates same ClassName across multiple extractors', () => {
    const extractors: Extractor[] = [
      { production: [{ Name: 'Water', ClassName: 'Desc_Water_C', CurrentProd: 60, MaxProd: 120, ProdPercent: 50 }] } as Extractor,
      { production: [{ Name: 'Water', ClassName: 'Desc_Water_C', CurrentProd: 60, MaxProd: 120, ProdPercent: 100 }] } as Extractor,
    ];
    const result = mergeExtractorFluids([], extractors);
    expect(result).toHaveLength(1);
    expect(result[0].CurrentProd).toBe(120);
    expect(result[0].MaxProd).toBe(240);
    expect(result[0].ProdPercent).toBe(75); // average of 50 and 100
  });

  it('skips non-fluid extractor production (e.g. Coal from Miner)', () => {
    const extractors: Extractor[] = [
      { production: [{ Name: 'Coal', ClassName: 'Desc_Coal_C', CurrentProd: 30, MaxProd: 60, ProdPercent: 50 }] } as Extractor,
    ];
    const result = mergeExtractorFluids([], extractors);
    expect(result).toHaveLength(0);
  });

  it('returns items unchanged when extractors is null', () => {
    const items: ProdStatItem[] = [
      { Name: 'Cable', ClassName: 'Desc_Cable_C', CurrentProd: 10, MaxProd: 20, CurrentConsumed: 0, MaxConsumed: 0, ProdPerMin: '', ProdPercent: 50, ConsPercent: 0 },
    ];
    const result = mergeExtractorFluids(items, null);
    expect(result).toEqual(items);
  });

  it('returns items unchanged when extractors is empty', () => {
    const items: ProdStatItem[] = [
      { Name: 'Cable', ClassName: 'Desc_Cable_C', CurrentProd: 10, MaxProd: 20, CurrentConsumed: 0, MaxConsumed: 0, ProdPerMin: '', ProdPercent: 50, ConsPercent: 0 },
    ];
    const result = mergeExtractorFluids(items, []);
    expect(result).toEqual(items);
  });

  it('respects visited set to avoid infinite loops', () => {
    // Circular: RecipeA produces LiquidX from LiquidY, RecipeB produces LiquidY from LiquidX
    // Both are detected as fluids by isFluidClassName (Desc_Liquid prefix).
    const circularRecipes = [
      {
        ClassName: 'Recipe_CircularA_C',
        Name: 'Circular A',
        products: [{ ClassName: 'Desc_LiquidTestX_C', Name: 'LiquidX', Amount: 50 }],
        ingredients: [{ ClassName: 'Desc_LiquidTestY_C', Name: 'LiquidY', Amount: 25 }],
      },
      {
        ClassName: 'Recipe_CircularB_C',
        Name: 'Circular B',
        products: [{ ClassName: 'Desc_LiquidTestY_C', Name: 'LiquidY', Amount: 50 }],
        ingredients: [{ ClassName: 'Desc_LiquidTestX_C', Name: 'LiquidX', Amount: 25 }],
      },
    ];

    // Should not hang — returns empty since both are fluids and never reach a solid
    const materials = traceRawMaterials('Desc_LiquidTestX_C', null, circularRecipes);
    expect(materials).toEqual([]);
  });
});
