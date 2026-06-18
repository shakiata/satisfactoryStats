# TrainControlTower

`src/components/dashboard/TrainControlTower.tsx`

**Purpose:** Comprehensive train network monitor — departure boards, track map visualization, and detailed train/station inspection.

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

3-column responsive grid:

```
┌──────────────────┬──────────────────┬──────────────────┐
│  Departures      │   Track Map      │   Detail Panel   │
│  Board           │   (Canvas 2D)    │   (train/station │
│  (train list)    │                  │    or overview)   │
└──────────────────┴──────────────────┴──────────────────┘
```

### Components

**StatusBar** — top bar showing:

- Trains count, active trains, stations, total cargo, system time

**DeparturesBoard (left column):**

- Table of all trains (or active-only toggle)
- Sortable columns: name, destination, speed, load %
- Filterable by train name
- Click to select a train for detail view

**TrackMap (center column):**

- Canvas 2D visualization of the rail network
- **Grid overlay:** 100,000 Unreal cm grid cells
- **Station markers:** Named dots at station locations
- **Train markers:** Moving dots with direction indicators
- **Pan/zoom:** Mouse drag + wheel scroll
- **Color coding:**
  - Green (#00ff88): Active trains
  - Amber (#ffb020): Docked/loading
  - Red (#ff4444): Derailed/error
- Coordinate bounds: ±425,000 (full Unreal world)

**Detail Panel (right column):**
Two modes depending on selection:

_Train selected:_

- Name, speed (km/h), throttle %
- Total mass + cargo breakdown
- Current station / destination
- Timetable (list of stops)
- Number of railcars
- Derailed status warning

_Station selected:_

- Station name + location
- Cargo inventory (input + output)
- Fuel levels
- Coupled train ID (if train docked)

_No selection:_ OverviewPanel — summary stats for the whole network.

### Edge Cases

- **No trains on map:** Track map shows only stations and grid.
- **Train derailed:** Red marker on map, warning in detail panel.
- **Empty timetable:** Shows "No schedule."
- **No stations:** Map canvas is empty with grid only.
- **Single train:** Both overview and detail views handle the degenerate case.
