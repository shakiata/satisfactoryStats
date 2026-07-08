# TrainControlTower

`src/components/dashboard/TrainControlTower.tsx`

**Purpose:** Dispatch-board style train network monitor showing every train in a sortable, filterable full-width table with expandable per-railcar cargo breakdown. The track map is a collapsible secondary panel. Dwell time (how long a train has been docked at a station) is derived from the polling buffer.

### Props

```typescript
interface Props {
  config: FRMConfig;
}
```

### Data Sources

| Endpoint          | Type              | Purpose                                    |
| ----------------- | ----------------- | ------------------------------------------ |
| `getTrains`       | `TrainResponse[]` | All trains with railcars, speed, timetable |
| `getTrainStation` | `TrainStation[]`  | All train stations with cargo and fuel     |

### Layout

Single-column stacked layout:

```
┌─────────────────────────────────────────────────────┐
│  Status Bar — trains / active / docked / derailed / │
│  stations / cargo / time                            │
├─────────────────────────────────────────────────────┤
│  [All] [Moving] [Parked] [Derailed]  🔍 Search...  │
├─────────────────────────────────────────────────────┤
│  Train Table — full-width, sortable, expandable     │
│  TRAIN | STATUS | STATION | KM/H | THR% | LOAD |   │
│  CARS | DOCK | DWELL | !                           │
│  ▶ Iron Express | Moving | Grand Central | 85 ...  │
│    └ expanded: railcar cards + timetable            │
├─────────────────────────────────────────────────────┤
│  [▼ Show Track Map]  ←  collapsible SVG map        │
└─────────────────────────────────────────────────────┘
```

### Components

**StatusBar** — top bar showing:

- System status indicator (SYS OK with pulse dot)
- Total trains, docked count, station count
- Derailed count (only shown if > 0, in red)
- Total cargo items across all trains
- Current system time

**FilterBar** — status filter pills + train name search:

- Pill filters: All, Moving (Self-Driving), Parked, Derailed — with live counts
- Color-coded: green for All/Moving, amber for Parked, red for Derailed
- Text search input filters by train name or station name

**TrainTable** — full-width sortable table with 10 columns:

| Column  | Content                              | Sortable | Click behavior        |
| ------- | ------------------------------------ | -------- | --------------------- |
| TRAIN   | Expand arrow + color dot + name      | Yes      | Expand/collapse row   |
| STATUS  | Color-coded badge (Moving/Parked/...) | No       | —                     |
| STATION | Current station name (clickable)     | Yes      | Opens station modal   |
| KM/H    | Speed in km/h (— if stopped)         | Yes      | —                     |
| THR%    | Throttle percentage                  | Yes      | —                     |
| LOAD    | Progress bar + percentage            | Yes      | —                     |
| CARS    | Railcar count                        | Yes      | —                     |
| DOCK    | Green dot if docked, grey if not     | No       | —                     |
| DWELL   | "Xm Ys" if docked, "—" otherwise     | Yes      | —                     |
| !       | Red ⚠ if derailed                   | No       | —                     |

Column headers show ▲/▼ sort indicators on the active sort column.

**ExpandedDetail** (inline, below train row):

- Summary row: loco count, freight count, total mass, payload ratio
- Derailed/pending derail warnings
- Railcar cards (grid layout, responsive cols):
  - Type badge: LOCO (green) or FRT (amber) based on ClassName pattern matching
  - Railcar name
  - Load percentage bar
  - Cargo items with **ItemIcon** + name + amount (freight cars only)
  - "Empty" label for freight cars with no cargo
- Timetable strip: chronological stop list with current stop highlighted ("NOW" badge)

**CollapsibleMap** — SVG track map, hidden by default:

- Toggle button below the table: "▼ Show Track Map" / "▲ Hide Track Map"
- Auto-fits to all station + train points on first render
- Pan: mouse drag
- Zoom: mouse wheel + dedicated +/- buttons in top-right corner
- Reset view button (↺) restores auto-fit bounds
- Grid overlay (100,000 UE cm cells)
- Station markers: named dots
- Moving train markers: green rectangles with pulse animation
- Docked train markers: amber rectangles (non-moving, at station)

**StationModal** — full-screen overlay when clicking a station name:

- Station name, type, location coordinates
- Docked train name (if connected)
- Cargo inventory with ItemIcon, sorted by amount descending
- Fuel inventory with ItemIcon
- "No cargo or fuel" fallback message
- Click backdrop or "✕ Close" to dismiss

**SortHeader** — clickable table header cell with ▲/▼ direction indicator.

**LoadBar** — small inline progress bar (height 6px) with percentage label. Color scales:
- ≤40%: grey
- 41–80%: green
- >80%: amber

**StatBlock** — single statistic label/value pair in the status bar. Used for trains, docked, stations, derailed, cargo counts.

### Derived Data

**Dwell Time** — tracks consecutive polling intervals where a train has `Docking="YES"` and `ForwardSpeed < 1 km/h`. Uses a rolling buffer (5-minute window) stored in a ref, pushed into on every `fetchData` call. Formatted as "Xm Ys" or "Xs".

**Load Percentage** — `PayloadMass / MaxPayloadMass * 100`, clamped to [0, 100]. Computed at both train level (total) and per-railcar level.

**Railcar Classification** — ClassName pattern matching: any class name containing "loco", "locomotive", or "electric" is a locomotive; everything else is freight.

### Polling

- 4-second interval (`REFRESH_MS = 4000`)
- Fetches `getTrains` and `getTrainStation` in parallel via `Promise.all`
- Each fetch appends a snapshot to the dwell-time buffer (ref, not state, to avoid extra re-renders)

### Color Palette

Dark terminal aesthetic with CRT-green primary:

| Constant      | Hex       | Usage                                      |
| ------------- | --------- | ------------------------------------------ |
| `CTRL_GREEN`  | `#00ff88` | Active trains, SYS OK, table text          |
| `CTRL_AMBER`  | `#ffb020` | Parked/manual trains, cargo, load bars     |
| `CTRL_RED`    | `#ff4444` | Derailed trains, error state               |
| `CTRL_BG`     | `#0a0f0a` | Page background                            |

Background panels use progressively lighter greens: `#060a06` (map), `#080e08` (table), with borders at 15–20% opacity.

### Edge Cases

- **No trains:** "No trains detected" message with setup hint
- **No matching search:** "No trains match your search"
- **Empty inventory:** Freight cars show "Empty" label
- **No cargo/fuel at station:** "No cargo or fuel at this station"
- **Train not moving:** Speed, throttle, dwell show "—"
- **Derailed train:** Red ⚠ in the "!" column, red status badge, warning in expanded view
- **Pending derail:** Amber warning in expanded view
- **Dwell time buffer too short:** Returns null (< 2 snapshots)
- **MaxPayloadMass = 0:** Load percentage returns 0 (guard against division by zero)
- **Single train:** Table renders correctly with one row
- **Map with no points:** Empty SVG (shows grid only)
