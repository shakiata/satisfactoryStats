# ProductionMonitor

`src/components/dashboard/ProductionMonitor.tsx`

**Purpose:** Global production statistics — per-item production rates, consumption rates, and net balance. Primary tool for identifying bottlenecks and surpluses. Includes text search, click-to-expand detail panels with time-series charts, and per-machine breakdowns.

### Props

```typescript
interface Props {
  config: FRMConfig;
  timeWindow: number;
  settings: AppSettings; // for iconSize
}
```

### Data Sources

| Endpoint       | Type                | Purpose                                   |
| -------------- | ------------------- | ----------------------------------------- |
| `getProdStats` | `ProdStatItem[]`    | Per-item production and consumption rates |
| `getFactory`   | `FactoryBuilding[]` | Per-machine breakdown for detail panel    |

### Features

**Summary Cards:**

- Total Production (items/min)
- Total Consumption (items/min)
- Net Balance (production − consumption, green if positive, red if negative)

**Search:**

- Text input above the item grid filters by item name or class name
- Reuses global `.search-input:focus` CSS rule for focus styling
- Show/hide icon and clear button when search is active

**LEDBar (Soundboard-style):**

- 10-segment LED bar showing production/consumption balance
- Red segments on left (consumption), green on right (production)
- Center line marks equilibrium
- Scale label below (items/min)

**Sort Modes:**

- `throughput` — highest total (prod + cons)
- `prod` — highest production
- `cons` — highest consumption
- `name` — alphabetical
- `balance` — most surplus first
- `max` — highest max production

**Filter Modes:**

- `all` — every item
- `surplus` — production > consumption
- `deficit` — consumption > production
- `balanced` — roughly equal (±5%)

**Card Grid:**

- Each item shown as a clickable card with:
  - Item icon (loaded from `./Icons/{ClassName}.png`, falls back to colored badge)
  - Item name
  - Production rate (green)
  - Consumption rate (red)
  - LED balance bar
- Click a card to expand the **Item Detail Panel**; click again to collapse
- Selected card gets an accent border and subtle background highlight
- Keyboard accessible: `Enter` or `Space` to toggle selection

### Item Detail Panel

When a card is clicked, a detail panel appears above the grid showing:

**Key Metrics (8 badges in a 2×4 grid):**

| Metric          | Description                              |
| --------------- | ---------------------------------------- |
| Prod Rate       | Current production rate (items/min)      |
| Cons Rate       | Current consumption rate (items/min)     |
| Net             | Net balance with +/- prefix              |
| Max Prod        | Maximum theoretical production capacity  |
| Max Cons        | Maximum theoretical consumption capacity |
| Prod Efficiency | CurrentProd / MaxProd as percentage      |
| Producers       | Number of buildings producing this item  |
| Consumers       | Number of buildings consuming this item  |

**Time-Series Chart (`ProdConsChart`):**

- Inline SVG line chart plotting production (green) and consumption (red) over time
- Data sourced from `useTimeBuffer`'s buffered `ProdStatItem[]` snapshots via `extractItemTimeSeries()`
- Y-axis auto-scaled with 10% headroom; 3 tick marks
- Subtle area fill under each line for visual comparison
- Falls back to "Collecting data…" when fewer than 2 snapshots exist

**Machine Breakdown Tables:**

- Two side-by-side tables: **Producing Machines** and **Consuming Machines**
- Each row shows: building name, recipe name, current/max rate, efficiency %, overclock indicators
- Power shards shown as `◆`, somersloops as `◇`
- Requires `getFactory` endpoint; gracefully shows "Loading machine breakdown…" if not yet available

### Internal Helpers

- `LEDBar` — SVG segmented balance meter (unchanged from original)
- `ProdConsChart` — Inline SVG time-series line chart with area fills and legend
- `ItemDetailPanel` — Expanded detail view for a single selected item
- `MetricBadge` — Small labeled value display used in the detail panel's key-metrics row
- `ItemIcon` — lazy-loads PNG icon, shows `nameToColor` fallback badge

### Time Windowing

Uses `useTimeBuffer` + `averageProdStats()` to merge multiple `ProdStatItem[]` snapshots into a single averaged view. The time-series chart uses `extractItemTimeSeries()` to pull per-item history from the buffer.

### Edge Cases

- **No data:** Empty state with "No production data available."
- **Icon load failure:** Falls back to colored circle with first letter.
- **All items balanced:** Filter shows no results for surplus/deficit modes — handled gracefully.
- **Search no results:** Message "No items match your search" shown instead of "No items match the current filter".
- **Factory data unavailable:** Machine count badges show "…" and table says "Loading machine breakdown…".
- **Fewer than 2 snapshots:** Chart shows "Collecting data…" placeholder.
- **Deselecting item:** Clicking the selected card again collapses the detail panel.
