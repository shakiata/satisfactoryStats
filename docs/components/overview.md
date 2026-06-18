# Component Overview

All UI components live under `src/components/`. They are React 19 Client Components (`'use client'`) rendered inside `ThemeProvider` and the tab router in `page.tsx`.

---

## Architecture

```
page.tsx (tab router)
├── ConnectionBar           ← Always visible (connection management)
├── TimeWindowSelector      ← Visible when connected (shared across tabs)
└── [active tab component]  ← One of 12 tab panels
    ├── PowerDashboard
    ├── ProductionMonitor
    ├── FactoryEfficiency
    ├── FactoryMap
    ├── GeneratorStatus
    ├── ResourceTracker
    ├── InventoryPanel
    ├── PlayerMap
    ├── ChatPanel
    ├── TrainControlTower
    ├── SettingsPanel
    └── EndpointList
```

---

## Shared Patterns

### Theme Access

Every component accesses theme colors via `useTheme()`. The hook returns `{ theme }` where `theme` is a `DashboardTheme` object. Components reference colors with inline styles using CSS variables:

```tsx
const { theme } = useTheme();
<div style={{ color: theme.textPrimary, backgroundColor: theme.bgCard }} />;
```

This works because `ThemeProvider` injects CSS custom properties via `applyThemeCssVars()` on mount.

### Data Fetching

All data panels follow the same polling pattern:

```tsx
useEffect(() => {
  const fetch = () => {
    fetchEndpoint<SomeType[]>(config, "getSomething")
      .then(setData)
      .catch(setError);
  };
  fetch();
  const interval = setInterval(fetch, config.refreshRate);
  return () => clearInterval(interval);
}, [config]);
```

- **Initial fetch** runs immediately on mount.
- **Subsequent fetches** run on `config.refreshRate` interval.
- **Cleanup** clears the interval on unmount or config change.

### Time Windowing

Panels that support time averaging (PowerDashboard, ProductionMonitor, FactoryEfficiency, GeneratorStatus, ResourceTracker) use `useTimeBuffer`:

```tsx
const { getWindowData, getWindowAverage } = useTimeBuffer(data);
const windowed = getWindowData(timeWindow); // last N ms of snapshots
```

When `timeWindow` is `0`, the panel shows live (current) data. When set to e.g. `300_000` (5 min), it averages all snapshots in that window.

### Icon Loading

Panels that display item/building icons (ProductionMonitor, InventoryPanel, FactoryMap) load PNGs from `./Icons/{ClassName}.png`. The pattern:

```tsx
const [imgSrc, setImgSrc] = useState<string | null>(null);
useEffect(() => {
  const img = new Image();
  img.onload = () => setImgSrc(`./Icons/${className}.png`);
  img.onerror = () => setImgSrc(null); // fallback to colored badge
  img.src = `./Icons/${className}.png`;
}, [className]);
```

If the icon fails to load, a fallback is shown (colored circle with initials for items, colored dot for buildings on the map).

### Error Handling

All panels catch API errors gracefully:

- Set an error state (displayed inline or as a subtle indicator).
- Never crash the entire dashboard.
- Continue polling — intermittent failures self-heal.

---

## Tab Routing

The tab system in `page.tsx`:

```typescript
const TABS = [
  { id: "power", label: "⚡ Power", icon: "⚡" },
  { id: "production", label: "📊 Production", icon: "📊" },
  { id: "factory", label: "🏭 Factory", icon: "🏭" },
  { id: "resources", label: "⛏️ Resources", icon: "⛏️" },
  { id: "generators", label: "🔥 Generators", icon: "🔥" },
  { id: "map", label: "🗺️ Map", icon: "🗺️" },
  { id: "trains", label: "🚂 Trains", icon: "🚂" },
  { id: "inventory", label: "📦 Inventory", icon: "📦" },
  { id: "players", label: "👤 Players", icon: "👤" },
  { id: "chat", label: "💬 Chat", icon: "💬" },
  { id: "settings", label: "🎨 Settings", icon: "🎨" },
  { id: "api", label: "🔧 API Explorer", icon: "🔧" },
];
```

- The active tab is persisted in `AppSettings.activeTab` via localStorage.
- Changing tabs calls `saveSettings({ activeTab: tab })`.
- On page load, if `loaded && settingsLoaded`, the persisted tab is restored.

### When Not Connected

Before a successful connection, the dashboard shows a welcome/instructions screen. The API Explorer tab is available regardless of connection state.

---

## Conventions

1. **All components are `'use client'`** — they use hooks (`useState`, `useEffect`, `useContext`).
2. **No inline `<style>` tags or `style={{}}` with hardcoded values** — always reference `theme` from `useTheme()`.
3. **No per-component CSS files** — use Tailwind utility classes for layout, CSS custom properties for colors.
4. **Extract shared logic into hooks** — if two panels need the same fetch pattern, add to `lib/`.
5. **Canvas components** (`FactoryMap`, `TrainControlTower` track map) use `requestAnimationFrame` loops and handle `devicePixelRatio` for sharp rendering.
6. **Polling intervals** respect `config.refreshRate` — don't hardcode fetch frequencies.
