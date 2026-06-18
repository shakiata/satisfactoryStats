import { FRMConfig, ProdStatSnapshot, FactoryBuilding } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';

/* ══════════════════════════════════════════════════════════════
   Fluid identification & stats utilities
   Works with the FluidDashboard to identify which items in the
   production stats are fluids (gases or liquids) and compute
   per-fluid summaries with net balance, machine assignments,
   and raw material traces.
   ══════════════════════════════════════════════════════════════ */

/**
 * Minimal representation of a recipe's output product form
 * as returned by the FRM `getRecipes` endpoint.
 */
interface RecipeProduct {
  Name: string;
  ClassName: string;
  Amount: number;
}

/**
 * Each recipe returned by `getRecipes` has at least one product
 * entry with an optional `form` hint (liquid/gas/solid).
 */
interface RawRecipe {
  ClassName: string;
  displayName?: string;
  /** Products this recipe creates. */
  products?: RecipeProduct[];
  /** Ingredients consumed by this recipe. */
  ingredients?: RecipeProduct[];
}

/** Cached fluid ClassName set — built once per session. */
let fluidSetCache: Set<string> | null = null;
let fluidSetPromise: Promise<Set<string>> | null = null;

/**
 * Builds a set of ClassNames for items that are produced as fluids
 * (liquids or gases) by any recipe. Fetches `getRecipes` from the
 * FRM backend, inspects each recipe's product form, and collects
 * matching output ClassNames.
 *
 * Fluid detection priority:
 * 1. Check the recipe's product `ClassName` — if it starts with
 *    `Desc_Liquid` or `Desc_Gas`, it is a fluid.
 * 2. Fallback: also check known liquid/gas ClassNames that the
 *    Satisfactory data model doesn't prefix predictably.
 *
 * Results are cached in memory — repeated calls return the cached set.
 *
 * @param config - FRM connection configuration.
 * @returns A Promise resolving to a Set of fluid ClassNames.
 */
export async function buildFluidSet(config: FRMConfig): Promise<Set<string>> {
  if (fluidSetCache) return fluidSetCache;
  if (fluidSetPromise) return fluidSetPromise;

  fluidSetPromise = (async () => {
    const fluidSet = new Set<string>();
    try {
      const recipes = await fetchEndpoint<RawRecipe[]>(config, 'getRecipes');
      for (const recipe of recipes) {
        if (!recipe.products || recipe.products.length === 0) continue;
        for (const product of recipe.products) {
          const cn = product.ClassName;
          // Satisfactory fluid items are prefixed Desc_Liquid or Desc_Gas
          if (cn.startsWith('Desc_Liquid') || cn.startsWith('Desc_Gas')) {
            fluidSet.add(cn);
          }
          // Some edge cases: check known unpackaged fluid class names
          if (/Desc_(Water|Fuel|Oil|Nitrogen|Acid|Alumina|Residue|Coolant)/.test(cn)) {
            fluidSet.add(cn);
          }
        }
      }
    } catch {
      // If recipes can't be fetched, fluid identification won't work.
      // The dashboard will show "fluid data unavailable" state.
    }
    fluidSetCache = fluidSet;
    fluidSetPromise = null;
    return fluidSet;
  })();

  return fluidSetPromise;
}

/**
 * Synchronous lookup — returns true if the item ClassName is in the
 * pre-built fluid set.  Call `buildFluidSet()` first.
 */
export function isFluidItem(className: string, fluidSet: Set<string> | null): boolean {
  if (!fluidSet) return false;
  return fluidSet.has(className);
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
 * computes per-fluid summary objects. If `fluidSet` is null (not yet
 * loaded), returns an empty array.
 *
 * @param stats - The raw ProdStatSnapshot[] from the API.
 * @param fluidSet - The pre-built fluid ClassName set.
 * @param worldInv - Optional world inventory map (ClassName → total amount)
 *                   for estimating stored fluid volume.
 * @returns Sorted array of FluidSummary objects (by absolute net magnitude descending).
 */
export function getFluidSummaries(
  stats: ProdStatSnapshot[],
  fluidSet: Set<string> | null,
  worldInv?: Map<string, number>,
): FluidSummary[] {
  if (!fluidSet || fluidSet.size === 0) return [];

  const fluidItems = stats.filter((item) => fluidSet.has(item.ClassName));
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
  fluidSet: Set<string> | null,
  recipes: RawRecipe[],
  maxDepth = 3,
): RawMaterialLink[] {
  if (!fluidSet) return [];

  // Capture in a const so TS narrows it for use inside walk() closure
  const fluids = fluidSet;

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
        const isFluid = fluids.has(ing.ClassName);
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
