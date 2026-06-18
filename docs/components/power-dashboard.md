# PowerDashboard

`src/components/dashboard/PowerDashboard.tsx`

**Purpose:** Real-time power grid monitor. Shows production vs consumption, capacity headroom, battery status, and per-circuit breakdowns.

### Props

```typescript
interface Props {
  config: FRMConfig;
  timeWindow: number; // ms, 0 = live
}
```

### Data Sources

| Endpoint   | Type             | Purpose           |
| ---------- | ---------------- | ----------------- |
| `getPower` | `PowerCircuit[]` | All circuit stats |

### Features

**Summary Cards (4 metrics):**

- **Production** — total MW being generated
- **Consumption** — total MW being drawn
- **Capacity** — maximum possible production
- **Max Consumption** — theoretical max draw if everything ran at 100%

**Gauge Bars:**

- Production vs Capacity bar (green fill)
- Consumption vs Capacity bar (amber/red depending on headroom)
- Max Consumption vs Capacity bar (gray)

**Battery Section:**

- Current charge percentage
- Total battery capacity (MWh)
- Charge/drain rate with directional arrow
- Estimated time to empty/full

**Fuse Warning:**

- Alert banner if any circuit has `FuseTriggered === true`
- Shows which circuit(s) tripped

**Circuit List:**

- Table of all circuits grouped by `CircuitID`
- Each row shows: circuit name, production, consumption, capacity
- Individual gauge bars per circuit

### Time Windowing

When `timeWindow > 0`, uses `useTimeBuffer().getWindowData()` to average circuit values over the selected window. Uses the `averagePowerStats()` helper from `useTimeBuffer.ts`.

### Edge Cases

- **No circuits returned:** Shows empty state message.
- **Fuse triggered:** Prominent warning — takes priority over normal display.
- **Battery at 0%:** Shows "Depleted" with red indicator.
- **Negative battery differential:** Shows draining animation/icon.
