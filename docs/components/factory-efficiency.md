# FactoryEfficiency

`src/components/dashboard/FactoryEfficiency.tsx`

**Purpose:** Building-level productivity overview. Groups all factory buildings by type and shows producing/paused/idle breakdowns with stacked bar charts.

### Props

```typescript
interface Props {
  config: FRMConfig;
  timeWindow: number;
}
```

### Data Sources

| Endpoint     | Type                | Purpose               |
| ------------ | ------------------- | --------------------- |
| `getFactory` | `FactoryBuilding[]` | All factory buildings |

### Features

**Overview Cards (5 metrics):**

- **Total Buildings** — count of all factory buildings
- **Producing %** — percentage actively running
- **Paused** — count of paused buildings
- **Idle** — count of idle buildings (no recipe, no inputs, or output full)
- **Total Power Draw** — sum of all factory building power consumption

**Search:** Filter by building type name (e.g., "Assembler").

**Building Type List:**
Each row shows:

- Building type name + total count
- Producing / Paused / Idle counts
- **Stacked bar chart:** Green (producing) | Amber (paused) | Dark (idle) segments
- **Efficiency %** — percentage of buildings actively producing
- **Avg Productivity %** — average `Productivity` value across all buildings of that type

### Internal Helpers

`summarizeBuildings(buildings: FactoryBuilding[]): BuildingSummary[]`

- Groups buildings by `ClassName`
- Counts producing, paused, and idle states (based on `IsProducing` and `IsPaused`)
- Averages `Productivity` across the group

### Edge Cases

- **No factories placed:** Empty state message.
- **All buildings idle:** Efficiency shows 0%, chart is all dark.
- **Single building type:** Still renders as a list (degenerate case).
