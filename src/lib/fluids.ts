import { ProdStatSnapshot, ProdStatItem, FactoryBuilding, Extractor } from '@/lib/types';

/* ══════════════════════════════════════════════════════════════
   Fluid identification & stats utilities
   Works with the FluidDashboard to identify which items in the
   production stats are fluids (gases or liquids) and compute
   per-fluid summaries with net balance, machine assignments,
   and raw material traces.
   ══════════════════════════════════════════════════════════════ */

/**
 * Minimal representation of a recipe's product/ingredient entry
 * as returned by the FRM `getRecipes` endpoint.
 */
interface RecipeProduct {
  Name: string;
  ClassName: string;
  Amount: number;
}

/**
 * Each recipe returned by `getRecipes` has at least one product
 * entry and optional ingredients.
 */
export interface RawRecipe {
  ClassName: string;
  displayName?: string;
  /** Products this recipe creates. */
  products?: RecipeProduct[];
  /** Ingredients consumed by this recipe. */
  ingredients?: RecipeProduct[];
}

/* ══════════════════════════════════════════════════════════════
   FLUID DETECTION — ClassName-based pattern matching
   
   Satisfactory does NOT use a consistent naming convention for
   fluid ClassNames.  Many liquids use `Desc_Liquid*` but legacy
   items like `Desc_Water_C`, `Desc_SulfuricAcid_C`, and
   `Desc_HeavyOilResidue_C` do not.  Gases may use `Desc_Gas*`
   or embed "Gas" in the name (`Desc_NitrogenGas_C`).
   
   This module detects fluids by checking ClassName against:
     1. `Desc_Liquid*` prefix  →  liquid
     2. `Desc_Gas*` prefix     →  gas
     3. Known unpackaged base-game liquids (hardcoded set)
     4. Broad word-level hints (Oil, Acid, Residue, etc.)
   
   No API call is required — detection is pure & synchronous.
   ══════════════════════════════════════════════════════════════ */

/**
 * Tests whether a Satisfactory ClassName belongs to a fluid
 * (liquid or gas).  Covers all known base-game fluids and uses
 * broad patterns so mod-added fluids are likely detected too.
 *
 * @param className - The item's full ClassName (e.g. "Desc_Water_C")
 * @returns true if the ClassName represents a pipeline fluid.
 */
export function isFluidClassName(className: string): boolean {
  // 0. Exclude known solid items that happen to match fluid patterns.
  //    GasTank, GasMask, and GasNobelisk are solid items, not pipeline gases.
  if (
    className === 'Desc_GasTank_C' ||
    className === 'Desc_GasMask_C' ||
    className === 'Desc_GasNobelisk_C'
  ) {
    return false;
  }

  // 1. Most Satisfactory liquids use the Desc_Liquid prefix
  if (className.startsWith('Desc_Liquid')) return true;

  // 2. Gases — Desc_Gas prefix or "Gas" embedded in the name.
  if (className.startsWith('Desc_Gas')) return true;
  if (className.includes('Gas')) return true; // Desc_NitrogenGas_C, etc.

  // 3. Known unpackaged base-game liquids that don't follow the
  //    prefix convention.  Verified against Satisfactory UAsset dumps.
  const knownLiquids = new Set([
    'Desc_Water_C',
    'Desc_AluminaSolution_C',
    'Desc_SulfuricAcid_C',
    'Desc_NitricAcid_C',
    'Desc_HeavyOilResidue_C',
    'Desc_DarkMatterResidue_C',
    'Desc_IonizedFuel_C',
    'Desc_RocketFuel_C',
  ]);
  if (knownLiquids.has(className)) return true;

  // 4. Broader word-hint match — catches mod-added liquids whose
  //    ClassName contains "Oil", "Acid", "Residue", "Solution",
  //    or "Extract" after the Desc_ prefix.
  //    No word boundaries — Satisfactory uses CamelCase so modifiers
  //    like "HeavyOil" or "ConcentratedAcid" must match too.
  const core = className.replace(/^Desc_/, '');
  if (/Oil|Residue|Acid|Solution|Extract/.test(core)) {
    return true;
  }

  return false;
}

/** Cached fluid ClassName set — built once per session. */
let fluidSetCache: Set<string> | null = null;

/**
 * Builds a Set of ClassNames for all known Satisfactory fluids using
 * synchronous ClassName-pattern matching.  No API call is required.
 *
 * The set is built once and cached in memory — subsequent calls
 * return the cached set immediately.
 *
 * @returns A Set of fluid ClassName strings.
 */
export function getFluidSet(): Set<string> {
  if (fluidSetCache) return fluidSetCache;

  const fluidSet = new Set<string>();

  // Enumerate all known base-game fluid ClassNames so we can also
  // seed the set with them for use by isFluidItem / traceRawMaterials.
  const knownBase = [
    'Desc_Water_C',
    'Desc_LiquidFuel_C',
    'Desc_LiquidTurboFuel_C',
    'Desc_LiquidBiofuel_C',
    'Desc_HeavyOilResidue_C',
    'Desc_AluminaSolution_C',
    'Desc_SulfuricAcid_C',
    'Desc_NitricAcid_C',
    'Desc_NitrogenGas_C',
    'Desc_DarkMatterResidue_C',
    'Desc_IonizedFuel_C',
    'Desc_RocketFuel_C',
  ];
  for (const cn of knownBase) fluidSet.add(cn);

  // Also add Desc_LiquidOil_C (Crude Oil) and Desc_Liquid* variants
  // for completeness.
  fluidSet.add('Desc_LiquidOil_C');

  fluidSetCache = fluidSet;
  return fluidSet;
}

/**
 * Legacy alias — returns the fluid set synchronously.
 * Kept for backward compatibility with callers that await buildFluidSet.
 */
export function buildFluidSet(): Set<string> {
  return getFluidSet();
}

/**
 * Synchronous lookup — returns true if the item ClassName is in the
 * pre-built fluid set.  Call `getFluidSet()` first.
 */
export function isFluidItem(className: string, _fluidSet?: Set<string> | null): boolean {
  return isFluidClassName(className);
}

/** Summary for a single fluid item shown in the Fluid Dashboard. */
export interface FluidSummary {
  /** Display name (stripped of Desc_ prefix and _C suffix). */
  name: string;
  /** Full Satisfactory class name. */
  className: string;
  /** Averaged production rate (items/min). */
  prodPerMin: number;
  /** Averaged consumption rate (items/min). */
  consPerMin: number;
  /** Net rate: prod − cons (positive = surplus, negative = deficit). */
  netPerMin: number;
  /** Max production capacity across all producing buildings. */
  maxProd: number;
  /** Max consumption capacity across all consuming buildings. */
  maxCons: number;
  /** Estimated total fluid in storage (from world inventory). */
  storedAmount: number;
  /** Whether this is a gas (vs liquid) — affects unit label (m³ vs unspecified). */
  isGas: boolean;
}

/**
 * Filters a production stats snapshot to only fluid items and
 * computes per-fluid summary objects.
 *
 * If `fluidSet` is null, the function builds it automatically
 * via `getFluidSet()` — no pre-fetch is required.
 *
 * @param stats - The raw ProdStatSnapshot[] from the API.
 * @param fluidSet - Optional pre-built fluid ClassName set; built automatically if null.
 * @param worldInv - Optional world inventory map (ClassName → total amount)
 *                   for estimating stored fluid volume.
 * @returns Sorted array of FluidSummary objects (by absolute net magnitude descending).
 */
export function getFluidSummaries(
  stats: ProdStatSnapshot[],
  _fluidSet?: Set<string> | null,
  worldInv?: Map<string, number>,
): FluidSummary[] {
  // Use isFluidClassName for pattern-based detection — catches all
  // Desc_Liquid*, Desc_Gas*, and word-hint fluids, not just the 13
  // hardcoded names in getFluidSet().
  const fluidItems = stats.filter((item) => isFluidClassName(item.ClassName));
  if (fluidItems.length === 0) return [];

  const summaries: FluidSummary[] = fluidItems.map((item) => {
    const cleanName = item.Name
      .replace(/^Desc_/, '')
      .replace(/_C$/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2'); // Add spaces between camelCase words

    const stored = worldInv?.get(item.ClassName) ?? 0;
    const isGas =
      item.ClassName.startsWith('Desc_Gas') ||
      (item.ClassName.includes('Gas') && !item.ClassName.includes('GasTank'));

    return {
      name: cleanName,
      className: item.ClassName,
      prodPerMin: item.CurrentProd,
      consPerMin: item.CurrentConsumed,
      netPerMin: item.CurrentProd - item.CurrentConsumed,
      maxProd: item.MaxProd,
      maxCons: item.MaxConsumed,
      storedAmount: stored,
      isGas,
    };
  });

  // Sort by absolute net magnitude descending (most active fluids first)
  summaries.sort((a, b) => Math.abs(b.netPerMin) - Math.abs(a.netPerMin));

  return summaries;
}

/**
 * Merges fluid production entries from getExtractor into the getProdStats
 * array.  FRM reports fluid production (Water, Crude Oil) via getExtractor,
 * not getProdStats — so this function synthesizes ProdStatItem-shaped entries
 * from each extractor's production[] array, aggregating by ClassName.
 *
 * The merge iterator skips non-fluid production (e.g. Coal from Miners)
 * using isFluidClassName().  Multiple extractors producing the same
 * ClassName are summed for rates and averaged for ProdPercent.
 *
 * @param items      - Raw ProdStatItem[] from getProdStats (may be null).
 * @param extractors - Extractor[] from getExtractor (may be null/empty).
 * @returns Combined array of original items + synthesized fluid entries.
 */
export function mergeExtractorFluids(
  items: ProdStatItem[] | null,
  extractors: Extractor[] | null,
): ProdStatItem[] {
  const base = items ?? [];
  if (!extractors || extractors.length === 0) return base;

  // Aggregate extractor fluid production by ClassName
  const fluidAgg = new Map<string, {
    name: string;
    currentProd: number;
    maxProd: number;
    prodPercentSum: number;
    count: number;
  }>();

  for (const ext of extractors) {
    if (!ext.production) continue;
    for (const prod of ext.production) {
      if (!isFluidClassName(prod.ClassName)) continue;
      const existing = fluidAgg.get(prod.ClassName);
      if (existing) {
        existing.currentProd += prod.CurrentProd ?? 0;
        existing.maxProd += prod.MaxProd ?? 0;
        existing.prodPercentSum += prod.ProdPercent ?? 0;
        existing.count += 1;
      } else {
        fluidAgg.set(prod.ClassName, {
          name: prod.Name,
          currentProd: prod.CurrentProd ?? 0,
          maxProd: prod.MaxProd ?? 0,
          prodPercentSum: prod.ProdPercent ?? 0,
          count: 1,
        });
      }
    }
  }

  // Build synthetic ProdStatItem entries for fluids found in extractors
  const extras: ProdStatItem[] = [];
  for (const [className, agg] of fluidAgg) {
    extras.push({
      Name: agg.name,
      ClassName: className,
      CurrentProd: agg.currentProd,
      MaxProd: agg.maxProd,
      CurrentConsumed: 0,
      MaxConsumed: 0,
      ProdPerMin: `P: ${agg.currentProd.toFixed(1)}/ min - C: 0.0/ min`,
      ProdPercent: agg.count > 0 ? agg.prodPercentSum / agg.count : 0,
      ConsPercent: 0,
    });
  }

  return [...base, ...extras];
}

/**
 * Raw material trace entry — a material that feeds into a fluid
 * pipeline via some recipe step.
 */
export interface RawMaterialLink {
  /** The raw material name. */
  name: string;
  /** How many steps removed from the fluid. */
  depth: number;
  /** The intermediate recipe ClassName that transforms this material. */
  viaRecipe: string;
}

/**
 * Builds a dependency trace for a given fluid ClassName by walking
 * recipe ingredients recursively. Limited to `maxDepth` steps to
 * avoid infinite loops in cyclic recipes.
 *
 * @param fluidClassName - The fluid item to trace raw materials for.
 * @param fluidSet - The fluid ClassName set (used to stop tracing
 *                   once we hit a non-fluid raw material).
 * @param recipes - Raw recipe data from the FRM API.
 * @param maxDepth - Maximum recursion depth (default: 3).
 * @returns Sorted array of raw material links (by depth ascending).
 */
export function traceRawMaterials(
  fluidClassName: string,
  _fluidSet: Set<string> | null,
  recipes: RawRecipe[],
  maxDepth = 3,
): RawMaterialLink[] {
  const results: RawMaterialLink[] = [];
  const visited = new Set<string>();

  /** Recursively walk the recipe graph looking for non-fluid ingredient origins. */
  function walk(className: string, depth: number) {
    if (depth > maxDepth || visited.has(className)) return;
    visited.add(className);

    // Find recipes that produce this item
    const producers = recipes.filter((r) =>
      r.products?.some((p) => p.ClassName === className),
    );

    for (const recipe of producers) {
      if (!recipe.ingredients) continue;
      for (const ing of recipe.ingredients) {
        // Use isFluidClassName for pattern-based detection
        const isFluid = isFluidClassName(ing.ClassName);
        if (!isFluid) {
          // Found a non-fluid raw material
          const cleanName = ing.Name
            .replace(/^Desc_/, '')
            .replace(/_C$/, '')
            .replace(/([a-z])([A-Z])/g, '$1 $2');
          // Avoid duplicates
          if (!results.some((r) => r.name === cleanName)) {
            results.push({
              name: cleanName,
              depth,
              viaRecipe: recipe.ClassName,
            });
          }
        } else {
          // Fluid ingredient — recurse deeper
          walk(ing.ClassName, depth + 1);
        }
      }
    }
  }

  walk(fluidClassName, 1);
  results.sort((a, b) => a.depth - b.depth);
  return results;
}

/** Per-building machine info for fluid expandable rows. */
export interface FluidMachineEntry {
  /** Building display name. */
  building: string;
  /** Building class name. */
  buildingClass: string;
  /** Current recipe name. */
  recipe: string;
  /** Current production/consumption rate for this fluid. */
  currentRate: number;
  /** Max rate for this fluid at this building. */
  maxRate: number;
  /** Efficiency percentage (0–100). */
  efficiency: number;
  /** Whether this machine is currently active. */
  isActive: boolean;
  /** Power shards count. */
  shards: number;
  /** Somersloops count. */
  sloops: number;
}
