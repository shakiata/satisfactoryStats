# GeneratorStatus

`src/components/dashboard/GeneratorStatus.tsx`

**Purpose:** Power generation monitor — shows all generators grouped by type with individual load percentages and fuel status.

### Props

```typescript
interface Props {
  config: FRMConfig;
  timeWindow: number;
}
```

### Data Sources

| Endpoint        | Type          | Purpose                    |
| --------------- | ------------- | -------------------------- |
| `getGenerators` | `Generator[]` | All generators (all types) |

### Features

**Summary Cards (4 metrics):**

- **Total Count** — number of generators
- **Current Output** — total MW being produced
- **Max Capacity** — maximum possible MW
- **Avg Load %** — average `LoadPercentage` across all generators

**Generator Type Breakdown:**
Expandable groups by generator type (e.g., "BiomassGenerator", "CoalGenerator", "FuelGenerator", "NuclearGenerator", "GeothermalGenerator"):

- **Group header:** Type name, count, total output, total capacity
- **Expanded list of individual generators:**
  - **Load %** with color-coded progress bar:
    - Red: >90% (near overload)
    - Amber: >50% (moderate load)
    - Blue: ≤50% (low load)
  - **Fuel type** + remaining fuel amount
  - **Power output** (MW)
  - **"Not at speed" badge** if `IsFullSpeed === false`

### Time Windowing

Averages `LoadPercentage` and power output over selected window via `useTimeBuffer`.

### Edge Cases

- **No generators:** Empty state message.
- **Generator at 0% load:** Shows "Idle" status, dark bar.
- **Fuel empty:** Fuel amount shows 0 with red highlight.
- **Single generator type:** Still renders as expandable group (degenerate case).
