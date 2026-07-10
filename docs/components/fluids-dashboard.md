# FluidDashboard

`src/components/dashboard/FluidDashboard.tsx`

**Purpose:** Real-time monitoring of the factory's fluid/pipe network — how much of each liquid or gas is in the system, how much is being produced vs consumed, total stored amounts, and a per-building breakdown of which machines are handling which fluids.

### Props

```typescript
interface Props {
  config: FRMConfig;
  timeWindow: TimeWindowMs;
  settings: AppSettings;
}
```

### Data Sources

| Endpoint       | Type                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getProdStats` | `ProdStatItem[]`    | Per-item production/consumption rates (polled live). **Note:** FRM omits ALL pipeline fluid items from this endpoint — they only appear in per-building endpoints (getRefinery, getBlender, getPackager, getExtractor).                                                                                                                                                                                                           |
| `getRecipes`   | `RawRecipe[]`       | Recipe graph for raw material trace only                                                                                                                                                                                                                                                                                                                                                                                          |
| `getWorldInv`  | `WorldInvItem[]`    | Total in-world fluid amounts (pipes, buffers, tanks)                                                                                                                                                                                                                                                                                                                                                                              |
| `getRefinery`  | `FactoryBuilding[]` | Per-refinery breakdown for detail panel                                                                                                                                                                                                                                                                                                                                                                                           |
| `getBlender`   | `FactoryBuilding[]` | Per-blender breakdown for detail panel                                                                                                                                                                                                                                                                                                                                                                                            |
| `getPackager`  | `FactoryBuilding[]` | Per-packager breakdown for detail panel                                                                                                                                                                                                                                                                                                                                                                                           |
| `getExtractor` | `Extractor[]`       | Per-extractor breakdown in the detail panel. Extractors are cast to `FactoryBuilding` and included in the `machines` array by `fetchMachines`.                                                                                     |
| `getPipes`     | `unknown`           | Count only — infrastructure overview                                                                                                                                                                                                                                                                                                                                                                                              |
| `getPump`      | `unknown`           | Count only — infrastructure overview                                                                                                                                                                                                                                                                                                                                                                                              |

### Fluid Detection Logic

**Data merge (`allItems`):** Because FRM omits all pipeline fluids from `getProdStats`, the component synthesizes `ProdStatItem`-shaped entries from all fluid-handling buildings' data (refineries, blenders, packagers, extractors). The `mergeBuildingFluids()` utility in `src/lib/fluids.ts` iterates each building's `production[]` (for fluid output) and `ingredients[]` (for fluid input), aggregates by ClassName (summing rates, averaging efficiency), and produces entries with both `CurrentProd`/`MaxProd` _and_ `CurrentConsumed`/`MaxConsumed` populated from real building data. This merge happens in a `useMemo` _before_ the `useTimeBuffer` call so that building-sourced fluids also appear in historical time-window data.

**ClassName detection** uses `src/lib/fluids.ts` → `isFluidClassName()` which applies **synchronous ClassName pattern matching** directly to production stats — no API call or pre-built set required. Detection uses a four-tier approach:

1. **Prefix check:** `Desc_Liquid*` → liquid, `Desc_Gas*` → gas
2. **Embedded "Gas":** ClassName contains `Gas` (e.g., `Desc_NitrogenGas_C`), excluding known solid items (`GasTank`, `GasMask`, `GasNobelisk`)
3. **Hardcoded exceptions:** Known base-game liquids that don't follow the prefix convention — `Desc_Water_C`, `Desc_AluminaSolution_C`, `Desc_SulfuricAcid_C`, `Desc_NitricAcid_C`, `Desc_HeavyOilResidue_C`, `Desc_DarkMatterResidue_C`, `Desc_IonizedFuel_C`, `Desc_RocketFuel_C`
4. **Word-hint fallback:** ClassName (after `Desc_` prefix) contains `Oil`, `Residue`, `Acid`, `Solution`, or `Extract` — catches mod-added fluids

`getFluidSummaries()` and `traceRawMaterials()` call `isFluidClassName()` directly on each item, so every `Desc_Liquid*` variant is detected regardless of whether it appears in the hardcoded list. `getFluidSet()` exists as a convenience for pre-seeding known base-game ClassNames but is no longer required for fluid detection.

### UI Sections

**Infrastructure Overview (2 cards):**

- Total pipes in network
- Total pumps in network

**Aggregate Summary Cards (4 cards):**

- **Fluid Production:** Total fluid items/min being produced
- **Fluid Consumption:** Total fluid items/min being consumed
- **Net Balance:** Production minus consumption (green/red)
- **Stored Amount:** Total fluid units sitting in pipes, buffers, and tanks

**Fluid Cards Grid:**

- One card per detected fluid, showing:
  - Fluid name and type (liquid/gas icon)
  - `FluidBar` — split green/red bar visualizing production vs consumption balance
  - Current production rate (items/min)
  - Current consumption rate (items/min)
  - Net balance
  - Stored amount (if world inventory data available)
- Search input filters by fluid name or class name
- Sort modes: throughput, prod, cons, name, balance, max, stored
- Click any card to expand a detail panel

**Detail Panel (expanded on card click):**

- Tab switching between "Machines" and "Raw Materials"
- **Machines tab:**
  - Producers table: each building producing this fluid with recipe name, current rate, max rate, overclock % (from `ManuSpeed`), efficiency %, shards count, activity status
  - Consumers table: same breakdown for buildings consuming this fluid
- **Raw Materials tab:**
  - Recursive recipe graph walker (`traceRawMaterials` from `lib/fluids.ts`) follows ingredient chains up to `maxDepth=3`
  - Stops when finding non-fluid items (ores, ingots, etc.)
  - Shows raw material name, depth in recipe tree, and which recipe introduced it

### States Handled

| State             | Visual                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Loading           | Spinning indicator + "Connecting..." message                                                                                   |
| Error             | Red error message + Retry button                                                                                               |
| No recipes        | "Unable to detect fluid recipes" + Retry                                                                                       |
| No fluids found   | "No fluids detected in production data" message + diagnostic panel showing API item count, fluid count, and first 8 ClassNames |
| Empty/ready       | Cards grid with all matching fluids                                                                                            |
| No machines found | "No machines found handling this fluid" message                                                                                |

### Sub-Components

- **`FluidBar`:** 10-segment LED bar. Green segments = production portion, red = consumption. Scale label below showing items/min range.
- **`FluidMachineTable`:** Renders a table of machines with columns: Building Name, Recipe, Current Rate, Max Rate, Efficiency, Shards, Status. Handles `Extractor` cast to `FactoryBuilding` by providing defaults for missing fields (`ingredients: []`, `InputInventory: []`, `OutputInventory: []`, `Productivity: 100`, `ManuSpeed: 100`).
- **`MetricBadge`:** Compact labeled metric chip used in the detail panel header for quick-glance values.

### Performance Considerations

- `buildFluidSet` is cached at module level — subsequent calls return the cached set immediately
- `fetchInfrastructure` (pipes + pumps) only runs once, not polled
- `fetchFluidSet`, `fetchRecipes`, `fetchMachines`, `fetchWorldInv` only run once per mount
- Only `fetchData` (prod stats) polls on the config's refresh interval
- `displaySummaries`, `filtered`, `sorted`, `selectedMachines`, and `rawMaterials` are all memoized via `useMemo`

### Edge Cases

- **Extractor machines** lack `ingredients`, `InputInventory`, `OutputInventory`, `Productivity`, and `ManuSpeed` fields. Cast to `FactoryBuilding` with sensible defaults.
- **Fluid detection** handles both packaged and unpackaged fluid items by checking ClassName prefixes (`Desc_Liquid`, `Desc_Gas`) plus a regex fallback for known unpackaged fluids.
- **Missing world inventory** — if `getWorldInv` fails or returns empty, stored amounts show "—" instead of crashing.
- **No producers/consumers** — detail panel shows "No machines found" rather than an empty table.
- **Recipe fetch failure** — `buildFluidSet` returns an empty set, and the dashboard shows "Unable to detect fluid recipes" with a retry button.
- **FRM `getRecipes` field name variants** — different FRM versions return recipe products/ingredients as either camelCase (`products`, `ingredients`) or PascalCase (`Products`, `Ingredients`). The `traceRawMaterials()` function now checks both conventions.
- **Recipe load error** — if `getRecipes` returns an HTTP error, the detail panel shows a red error banner with the error message and a "Retry" button, rather than silently hiding the raw trace feature.
- **Fluid data from buildings is static:** `fetchMachines` runs once per mount (gated by `machinesLoaded.current`). If the user reconfigures a refinery/blender/packager while the dashboard is open, fluid production/consumption data won't update until reconnection. This is acceptable because (a) the four endpoints are expensive, and (b) reconfiguration is infrequent.
