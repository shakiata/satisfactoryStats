# ResourceTracker

`src/components/dashboard/ResourceTracker.tsx`

**Purpose:** Monitors resource extraction — miners and extractors organized by type with production rates.

### Props

```typescript
interface Props {
  config: FRMConfig;
  timeWindow: number;
}
```

### Data Sources

| Endpoint       | Type          | Purpose                   |
| -------------- | ------------- | ------------------------- |
| `getExtractor` | `Extractor[]` | All miners and extractors |

### Features

**Summary Cards (4 metrics):**

- **Total Extractors** — all mining/extraction buildings
- **Active** — currently producing
- **Paused/Idle** — not producing
- **Total Prod/min** — sum of all extraction rates

**Search:** Filter by name or resource type.

**Grouped List:**
Extractors grouped by type (Miner, HighMiner, ResourceExtractor, etc.):

- **Group header:** Type name, count, total production rate
- **Expanded list of individual extractors:**
  - Name + recipe (if configured)
  - **State badge:** Producing (green), Paused (amber), Idle (gray)
  - Production rate per minute

### Time Windowing

Averages extraction rates over selected window via `useTimeBuffer`.

### Edge Cases

- **No extractors:** Empty state message.
- **Extractor not configured:** Shows "No recipe" badge.
- **All idle:** Active count is 0, shown prominently.
