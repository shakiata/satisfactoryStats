# Shared Components

Three components are always accessible (not tab-specific): `ConnectionBar`, `EndpointList`, and `TimeWindowSelector`.

---

## ConnectionBar

`src/components/ConnectionBar.tsx`

**Purpose:** Manages the FRM connection lifecycle — input fields, connect/disconnect, error display, and optional ngrok tunnel sharing (Electron only).

### Props

```typescript
interface ConnectionBarProps {
  config: FRMConfig;
  onConfigChange: (config: FRMConfig) => void;
  onConnect: () => void;
  connected: boolean;
  connecting: boolean;
  error: string | null;
}
```

### States

| State      | UI                                             |
| ---------- | ---------------------------------------------- |
| Default    | Host, Port, Auth Token inputs + Connect button |
| Connecting | Spinning indicator on Connect button           |
| Connected  | Green checkmark + "Live" badge in title bar    |
| Error      | Inline error message with icon below inputs    |

### ngrok Tunnel (Electron-only)

- Detects `window.electronAPI` presence to conditionally show the "Share" button.
- **Share:** Calls `electronAPI.tunnelStart(config.host, config.port)` — spawns ngrok, returns public URL.
- **Active tunnel:** Shows URL with copy button, stop button, and pulsing green status dot.
- **Error:** Displays tunnel error inline. Listens on `electronAPI.onTunnelError()`.
- **Stop:** Calls `electronAPI.tunnelStop()` — kills the ngrok process.

### Edge Cases

- Config changes reset connection state (`connected = false`, `error = null`).
- Tunnel errors don't affect the main FRM connection.
- Works in browser mode (no Electron) — tunnel UI is simply hidden.

---

## ItemIcon

`src/components/ui/ItemIcon.tsx`

**Purpose:** Shared item icon component extracted from `InventoryPanel` and `ProductionMonitor`. Renders a PNG icon from `public/Icons/` or falls back to a colored initial circle using a deterministic hash-based color (`nameToColor`).

### Props

```typescript
interface ItemIconProps {
  className?: string;
  name: string;
  size?: number; // default: 32
  prod?: number; // production rate — tints background green when > cons
  cons?: number; // consumption rate — tints background red when > prod
}
```

### Behavior

- Loads `public/Icons/{className}.png`; shows initials on error.
- When `prod` and `cons` are provided, background color indicates net balance.
- Uses an internal `nameToColor()` fallback to avoid `'use client'` boundary issues.

---

## EndpointList

`src/components/EndpointList.tsx`

**Purpose:** The "🔧 API Explorer" tab — browse all FRM endpoints, filter by category, fetch and display raw JSON responses.

### Props

```typescript
interface EndpointListProps {
  config: FRMConfig;
  endpoints: EndpointInfo[];
  categories: Map<string, EndpointInfo[]>;
}
```

### Features

- **Search bar:** Filters endpoints by path name, description, or category. Case-insensitive.
- **Category filters:** 13 toggle buttons with icons — ⚡🔥🏭⛏️🔧🚗🚂🏢👤📦🔬🎄🐾. Click to show/hide each category.
- **Endpoint cards:** Each card shows:
  - Category icon + badge color (unique per category)
  - Endpoint path in code-style text
  - Description
  - `requiresGameThread` badge (amber if true)
  - **Fetch button:** Expands to show live JSON response
  - Response header shows the full GET URL
  - Entry count displayed (e.g., "42 items")
- **Color coding:** Each category has a distinct border-left color and background opacity for quick visual scanning.

### Edge Cases

- Fetch errors show inline in the expanded card — don't crash the list.
- Multiple endpoint cards can be expanded simultaneously.
- Search + category filters compose (AND logic).

---

## TimeWindowSelector

`src/components/TimeWindowSelector.tsx`

**Purpose:** Shared control that lets the user pick a time window for averaging metrics across dashboard panels. Rendered above the tab content when connected.

### Props

```typescript
function TimeWindowSelector(props: {
  value: TimeWindowMs;
  onChange: (v: TimeWindowMs) => void;
}): JSX.Element;
```

### Windows

```typescript
const TIME_WINDOWS = [
  { value: 0, label: "Live" },
  { value: 60_000, label: "1m" },
  { value: 300_000, label: "5m" },
  { value: 600_000, label: "10m" },
  { value: 900_000, label: "15m" },
  { value: 1_800_000, label: "30m" },
  { value: 3_600_000, label: "1h" },
];
```

### Behavior

- **Inline button group** — all options visible at once.
- **Active button** highlighted with accent color.
- **"Live" (0)** means no averaging — show current API response directly.
- **Persistence:** Selection saved to `AppSettings.timeWindow` via `saveSettings()` in `page.tsx`.
- **Scope:** All time-aware panels read the same `timeWindow` value. Changing it affects PowerDashboard, ProductionMonitor, FactoryEfficiency, GeneratorStatus, and ResourceTracker simultaneously.
