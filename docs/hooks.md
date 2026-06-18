# Hooks

Custom React hooks in `src/lib/` provide reusable stateful logic for config persistence, UI preferences, theme management, and time-series data buffering.

---

## `useConfig`

`src/lib/useConfig.ts`

**Purpose:** Persist and manage the FRM connection configuration (`FRMConfig`) in localStorage.

### Return Value

```typescript
{
  config: FRMConfig;
  saveConfig: (newConfig: FRMConfig) => void;
  loaded: boolean;
}
```

### Behavior

- **On mount:** Reads `frm-config` from localStorage, merges with `defaultConfig`.
- **`saveConfig(newConfig)`:** Updates React state + writes JSON to localStorage.
- **`loaded`:** `false` until the initial localStorage read completes (prevents SSR hydration mismatch).
- **Default config:** `{ host: 'localhost', port: '8080', password: '', refreshRate: 5000 }`.

### Usage

```typescript
const { config, saveConfig, loaded } = useConfig();
if (!loaded) return null; // wait for hydration
```

### Edge Cases

- Corrupt localStorage data → caught, falls back to defaults.
- `loaded` is critical for Next.js static export — prevents flash of default values.

---

## `useAppSettings`

`src/lib/useAppSettings.ts`

**Purpose:** Persist and manage UI preferences (`AppSettings`) in localStorage.

### Return Value

```typescript
{
  settings: AppSettings;
  saveSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
  loaded: boolean;
}
```

### Behavior

- **On mount:** Reads `frm-app-settings` from localStorage, merges with `DEFAULT_SETTINGS`.
- **`saveSettings(partial)`:** Merges partial into current settings, persists JSON.
- **`resetSettings()`:** Removes localStorage key, resets state to `DEFAULT_SETTINGS`.
- **`loaded`:** Same pattern as `useConfig` — prevents flicker.

### Usage

```typescript
const { settings, saveSettings, resetSettings } = useAppSettings();

// Persist tab change
saveSettings({ activeTab: "production" });

// Reset everything
resetSettings();
```

---

## `useTheme`

`src/lib/useTheme.tsx`

**Purpose:** Full-theme customization via React Context. Injects CSS custom properties into `document.documentElement` for immediate visual updates.

### Exports

- `ThemeProvider({ children })` — context provider, must wrap the app.
- `useTheme()` → `ThemeContextType`

### `ThemeContextType`

```typescript
{
  theme: DashboardTheme;
  updateTheme: (partial: Partial<DashboardTheme>) => void;
  resetTheme: () => void;
}
```

### Behavior

- **On mount:** Reads `frm-theme` from localStorage. If no custom theme is saved, checks `frm-app-settings` for `themeMode` — if `'light'`, loads `LIGHT_THEME` instead of `DEFAULT_THEME`. Applies 12 CSS custom properties via `applyThemeCssVars()`.
- **`updateTheme(partial)`:** Merges partial, writes to localStorage, calls `applyThemeCssVars()`.
- **`resetTheme()`:** Clears localStorage, resets to `DEFAULT_THEME`.
- **`mounted` state:** Provider doesn't render children until theme is loaded — prevents flash of default colors then switching to saved.

### CSS Variable Injection

```typescript
function applyThemeCssVars(t: DashboardTheme) {
  root.style.setProperty("--bg-primary", t.bgPrimary);
  root.style.setProperty("--bg-secondary", t.bgSecondary);
  // ... all 12 properties
}
```

Components reference these via `var(--bg-primary)` in inline styles or `style={{ color: theme.textPrimary }}`.

### Edge Cases

- Corrupt localStorage → caught, defaults to `DEFAULT_THEME`.
- Server-side rendering → `loadTheme()` returns defaults (no `window`).
- Mount delay prevents FOUC (flash of unstyled content).

---

## `useTimeBuffer`

`src/lib/useTimeBuffer.ts`

**Purpose:** Rolling time-series buffer that stores timestamped snapshots of API data and provides windowed queries for averaging metrics over configurable time windows.

### Return Value

```typescript
{
  getWindowData: (windowMs: number) => T[];
  getWindowAverage: (windowMs: number, mapFn: (item: T) => number) => number;
  bufferSize: number;
}
```

### Behavior

- **Buffer:** Array of `TimedEntry<T>[]` (`{ timestamp, data }`).
- **Max size:** 1 hour (3,600,000 ms). Entries older than this are pruned on each push.
- **On `data` change:** A new `TimedEntry` is appended with `timestamp = Date.now()`.
- **`getWindowData(ms)`:** Returns all entries where `timestamp >= now - ms`.
- **`getWindowAverage(ms, mapFn)`:** Returns the mean of `mapFn(item)` across the window. Returns `0` if no data.

### Usage Pattern

```typescript
const { getWindowData, getWindowAverage } = useTimeBuffer(powerData);

// All snapshots from last 5 minutes
const windowed = getWindowData(300_000);

// Average power production over last 5 minutes
const avgProd = getWindowAverage(300_000, (circuit) => circuit.PowerProduction);
```

### Exported Helpers

**`averageProdStats(snapshots: ProdStatSnapshot[][]): ProdStatSnapshot[]`**

- Merges multiple `ProdStatsResponse` snapshots into one.
- Groups by `ClassName`, averages `CurrentProd` and `CurrentConsumed`.
- Takes `max` of `MaxProd` and `MaxConsumed` across the window.

**`averagePowerStats(snapshots: PowerSnapshot[]): PowerSnapshot`**

- Averages `totalProd`, `totalConsumed`, `totalCapacity`, and `totalMaxConsumed` across snapshots.

**`extractItemTimeSeries(snapshots: ProdStatSnapshot[][], className: string): ProdTimePoint[]`**

- Extracts a time-series of production and consumption values for a single item across buffered snapshots.
- Each snapshot is searched for the matching `ClassName`; if found, a `ProdTimePoint` (`{ timestamp, prod, cons }`) is emitted.
- Timestamps are index-based (snapshot position in the array) rather than wall-clock time.
- Skips snapshots where the item is not present (e.g., newly added or removed items).
- Used by `ProdConsChart` in `ProductionMonitor`'s detail panel to render the production vs consumption line chart.

### Edge Cases

- **Empty buffer:** `getWindowData` returns `[]`, `getWindowAverage` returns `0`.
- **Single snapshot:** Average equals the single value.
- **Buffer overflow:** Older entries are silently pruned — max 1 hour of data.
