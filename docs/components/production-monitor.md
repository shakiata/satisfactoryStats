# ProductionMonitor

`src/components/dashboard/ProductionMonitor.tsx`

**Purpose:** Global production statistics — per-item production rates, consumption rates, and net balance. Primary tool for identifying bottlenecks and surpluses.

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
| `getProdStats` | `ProdStatsResponse` | Per-item production and consumption rates |

### Features

**Summary Cards:**

- Total Production (items/min)
- Total Consumption (items/min)
- Net Balance (production − consumption, green if positive, red if negative)

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

- Each item shown as a card with:
  - Item icon (loaded from `./Icons/{ClassName}.png`, falls back to colored badge)
  - Item name
  - Production rate (green)
  - Consumption rate (red/amber)
  - Balance percentage bar

### Internal Helpers

- `ItemIcon` — lazy-loads PNG icon, shows `nameToColor` fallback badge
- `formatRate(v)` — formats large numbers with k/M suffix
- `nameToColor(name)` — hash-based deterministic color for fallback badges

### Time Windowing

Uses `useTimeBuffer` + `averageProdStats()` to merge multiple `ProdStatsResponse` snapshots into a single averaged view.

### Edge Cases

- **No data:** Empty state with "No production data available."
- **Icon load failure:** Falls back to colored circle with first letter.
- **All items balanced:** Filter shows no results for surplus/deficit modes — handled gracefully.
