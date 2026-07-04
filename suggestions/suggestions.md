# Suggestions — Statusfactory Improvement Audit

> Generated 2026-06-27. Each suggestion follows a **What / Why / How / Priority** format.
> Priority rubric: **P0** = critical bug/correctness, **P1** = high impact (perf, missing error handling, architecture blockers), **P2** = medium (code quality, duplication, missing tests, type gaps), **P3** = nice-to-have (DX polish, tooling).

---

## A. Architecture & Structure

### A1: Single monolithic `page.tsx` (~300 lines) — add code-splitting

**Priority:** P1

**What:** `page.tsx` renders all 13 dashboard tab components via conditional rendering (`{activeTab === 'power' && <PowerDashboard ... />}`). All 13 are imported eagerly at the top of the file, so every tab's code is bundled into the initial JS payload even if the user never visits most tabs.

**Why:** The initial JS bundle includes ~13 dashboard components, their hooks, and their dependencies. This slows first load (especially in Electron where `loadFile` reads from disk) and increases memory pressure. Users may only use 2-3 tabs regularly.

**How:** Use Next.js `dynamic()` with `ssr: false` (the app is `'use client'` already) to lazy-load each tab:

```tsx
// page.tsx
import dynamic from "next/dynamic";

const PowerDashboard = dynamic(
  () => import("@/components/dashboard/PowerDashboard"),
  { ssr: false },
);
const ProductionMonitor = dynamic(
  () => import("@/components/dashboard/ProductionMonitor"),
  { ssr: false },
);
// ... repeat for all 13 tabs
```

Move the tab-id-to-component mapping into a `TAB_COMPONENTS` record:

```tsx
const TAB_COMPONENTS: Record<TabId, React.ComponentType<{config: FRMConfig; timeWindow: TimeWindowMs; settings?: AppSettings; saveSettings?: ...}>> = {
  power: PowerDashboard,
  production: ProductionMonitor,
  // ...
};
```

Then render: `const TabComponent = TAB_COMPONENTS[activeTab]; return <TabComponent ... />;`

**Files:** `src/app/page.tsx`

---

### A2: `ConnectionBar` is ~250+ lines — split into `ConnectionForm` + `TunnelControls`

**Priority:** P2

**What:** `ConnectionBar.tsx` mixes two distinct concerns: (a) FRM connection form (host/port/token inputs + Connect button) and (b) ngrok tunnel management (start/stop/copy), which is Electron-only.

**Why:** The component is hard to read, hard to test, and the ngrok tunnel code is dead weight in the browser bundle since it's gated behind `isElectron` checks at render time. Separating concerns makes each piece independently testable.

**How:** Extract into:

- `src/components/ConnectionForm.tsx` — host, port, token inputs + Connect button + status display
- `src/components/TunnelControls.tsx` — ngrok start/stop/copy URL, rendered only when `isElectron` is true

`ConnectionBar` becomes a thin wrapper that composes both.

**Files:** `src/components/ConnectionBar.tsx`

---

### A3: No routing — tabs are not shareable/bookmarkable

**Priority:** P3

**What:** All 13 tabs are managed by a `useState<TabId>` in `page.tsx`. There are no URL query parameters, so you can't share a link to a specific tab or bookmark it.

**Why:** Minor UX friction. If someone wants to share "check out my power grid" they can't send a URL like `?tab=power`. Not critical since this is primarily a desktop Electron app, but would be nice for the web version.

**How:** Use `useSearchParams` from Next.js to sync `activeTab` to `?tab=power` in the URL. On mount, read the param; on tab change, push to history. This is a shallow route change — no page reload.

```tsx
import { useSearchParams } from "next/navigation";
const searchParams = useSearchParams();
const tabFromUrl = searchParams.get("tab") as TabId | null;
// On change: router.push(`?tab=${newTab}`, { shallow: true });
```

**Files:** `src/app/page.tsx`

---

## B. API Client

### B1: 70+ endpoints defined, only ~15 used — dead code

**Priority:** P2

**What:** `api.ts` defines `ENDPOINTS` with 70 entries covering every FRM endpoint. Only about 15 are actually consumed by dashboard components.

**Why:** The unused endpoints add ~2KB of dead code to the bundle and create confusion about what's actually supported. The `EndpointList` API Explorer tab exposes all 70, which may mislead users into thinking endpoints like `getCreatures` or `getDropPod` are tested and working.

**How:** Two options (confirm preference with user):

1. **Remove unused endpoints** from `ENDPOINTS` and keep only the 15 active ones. Add a comment linking to the FRM mod docs for the full list.
2. **Keep all but mark untested ones** with a `tested: boolean` flag. The API Explorer can show a "⚠️ Untested" badge on untested endpoints.

Option 1 is simpler and reduces bundle size. Option 2 preserves the explorer's completeness at the cost of maintaining the flag.

**Files:** `src/lib/api.ts`

---

### B2: `EndpointList.tsx` duplicates fetch logic from `api.ts`

**Priority:** P2

**What:** `api.ts` exports `fetchEndpoint<T>(config, endpoint)` which handles URL building, auth headers, and ngrok bypass. But `EndpointList.tsx` builds its own URL with `buildUrl()` and manually constructs headers — bypassing `fetchEndpoint` entirely.

**Why:** Duplicated logic means any fix to auth headers (e.g., adding a new header) must be made in two places. It also means the API Explorer doesn't benefit from `fetchEndpoint`'s error formatting.

**How:** Replace the manual `fetch()` in `EndpointList.tsx` with a call to `fetchEndpoint()`. Since `EndpointList` displays raw JSON, add a `fetchEndpointRaw` variant that returns the raw `Response` or the parsed JSON — or simply call `fetchEndpoint` and display the result.

**Files:** `src/components/EndpointList.tsx`, `src/lib/api.ts`

---

### B3: No request deduplication across tabs

**Priority:** P1

**What:** If the user opens `GeneratorStatus` and `FactoryMap` simultaneously (or switches between them quickly), both components independently poll `getGenerators` — resulting in duplicate HTTP requests to the FRM server.

**Why:** Wastes bandwidth, increases server load on the FRM mod, and can cause race conditions where one component renders stale data while the other gets fresh data. The FRM mod runs inside Satisfactory and every request has some game-thread cost.

**How:** Build a simple in-memory request cache in `api.ts`:

```ts
const pendingRequests = new Map<string, Promise<unknown>>();

export async function fetchEndpointDeduped<T>(
  config: FRMConfig,
  endpoint: string,
): Promise<T> {
  const key = `${config.host}:${config.port}:${endpoint}`;
  if (pendingRequests.has(key)) return pendingRequests.get(key) as Promise<T>;
  const promise = fetchEndpoint<T>(config, endpoint).finally(() =>
    pendingRequests.delete(key),
  );
  pendingRequests.set(key, promise);
  return promise;
}
```

Also add a short TTL (e.g., 2 seconds) so polls don't return stale cache hits from a previous poll cycle.

**Files:** `src/lib/api.ts`

---

### B4: No retry or backoff logic on fetch failure

**Priority:** P1

**What:** Every dashboard component calls `fetchEndpoint` in a `setInterval`. If the FRM server is temporarily unreachable (game paused, network blip), every component immediately shows its error state. On the next interval tick, it tries again with no backoff.

**Why:** Network blips cause unnecessary error UI flashes. Rapid retries can hammer the server during recovery. Users see "Failed to fetch" repeatedly with no indication that the system is retrying intelligently.

**How:** Add per-endpoint retry with exponential backoff to `fetchEndpoint` or as a wrapper:

```ts
async function fetchWithRetry<T>(
  config: FRMConfig,
  endpoint: string,
  maxRetries = 3,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchEndpoint<T>(config, endpoint);
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new Error("unreachable");
}
```

Components should use this instead of raw `fetchEndpoint` in their polling intervals.

**Files:** `src/lib/api.ts`, all dashboard components in `src/components/dashboard/`

---

### B5: No AbortController cleanup on component unmount

**Priority:** P2

**What:** Dashboard components use `setInterval` + `fetchEndpoint`, but the `fetch()` call inside `fetchEndpoint` has no `AbortController` signal. If a component unmounts mid-fetch (user switches tabs), the fetch continues and tries to `setState` on an unmounted component.

**Why:** React 19 handles this gracefully (no "setState on unmounted" warning), but the HTTP request still wastes bandwidth and server resources. In slow network conditions, this can queue up many abandoned requests.

**How:** Pass an `AbortSignal` through `fetchEndpoint`:

```ts
export async function fetchEndpoint<T>(
  config: FRMConfig,
  endpoint: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, { headers, signal });
  // ...
}
```

Components create an `AbortController` in their `useEffect` and pass `controller.signal`. The `useEffect` cleanup calls `controller.abort()`.

**Files:** `src/lib/api.ts`, all dashboard components in `src/components/dashboard/`

---

## C. State Management

### C1: Independent polling intervals per component — no centralized scheduler

**Priority:** P1

**What:** Each dashboard component runs its own `setInterval(fetchData, N)` in a `useEffect`. There are 10+ components, each polling at different rates (3s for chat, 5s for power/players, 8s for generators, 10s for resources).

**Why:** Polling intervals drift independently, causing bursts of simultaneous requests. Components polling the same endpoint (e.g., `FactoryMap` and `GeneratorStatus` both poll `getGenerators`) issue duplicate requests at different times. No way to globally pause/resume polling when the connection is lost. No way to batch related endpoints into a single request.

**How:** Create a centralized poll registry hook or context:

```ts
// src/lib/usePolling.ts
type PollEntry = {
  endpoint: string;
  intervalMs: number;
  callback: (data: unknown) => void;
};

export function usePolling(config: FRMConfig) {
  const registry = useRef(new Map<string, PollEntry>());

  const subscribe = useCallback((key: string, entry: PollEntry) => {
    registry.current.set(key, entry);
    return () => {
      registry.current.delete(key);
    };
  }, []);

  // Single master interval that fires at GCD of all intervals (or 1s)
  // Checks each entry: if enough time elapsed since last poll, fire it
  // Deduplicates same-endpoint requests
  // Pauses all when !connected
}
```

This also enables global pause when connection drops, batched reconnection, and consistent polling alignment.

**Files:** New: `src/lib/usePolling.ts`; modified: `src/app/page.tsx`, all dashboard components

---

### C2: `useTimeBuffer` uses shallow reference equality — identical data means no snapshot

**Priority:** P2

**What:** `useTimeBuffer` checks `if (data !== null)` to decide whether to push a new snapshot. If the API returns the same values twice in a row, the new object reference (`data`) is different from the previous one (since `fetchEndpoint` returns a new parsed object each time), so this works in practice. But the check is a reference equality, not deep equality — if the consumer memoizes or reuses the same object, no snapshot is pushed.

**Why:** Currently works because `fetchEndpoint` creates a new object each time. But it's fragile — if a component adds `useMemo` on the fetched data, the buffer silently stops accumulating. The comment says "Each time `data` changes" but the code checks `!== null`, not whether data actually changed.

**How:** The current behavior is actually correct for the use case — the buffer should accumulate every poll result regardless of whether values changed, because the timestamp is the meaningful dimension. Rename and clarify:

```ts
// Instead of: "Each time `data` changes (a new API response)"
// Document as: "Each time a non-null data value is passed, a timestamped snapshot is pushed"
```

Also consider renaming the parameter from `data` to `latestSnapshot` to make intent clearer.

**Files:** `src/lib/useTimeBuffer.ts`

---

### C3: Side-effect in render body of `page.tsx`

**Priority:** P2

**What:** `page.tsx` has this in the render function body:

```tsx
const [applied, setApplied] = useState(false);
if (!applied && loaded && settingsLoaded) {
  setApplied(true);
  if (TABS.some((t) => t.id === settings.activeTab)) {
    setActiveTab(settings.activeTab as TabId);
  }
  setTimeWindow(settings.timeWindow as TimeWindowMs);
}
```

**Why:** `setState` in the render body is a React anti-pattern. It causes an immediate re-render (the setState during render triggers a synchronous re-render). React 19 may handle this, but it's fragile and can cause unexpected double-renders or infinite loops if the condition isn't perfectly gated.

**How:** Move to a `useEffect`:

```tsx
useEffect(() => {
  if (!loaded || !settingsLoaded) return;
  if (TABS.some((t) => t.id === settings.activeTab)) {
    setActiveTab(settings.activeTab as TabId);
  }
  setTimeWindow(settings.timeWindow as TimeWindowMs);
}, [loaded, settingsLoaded]);
```

Remove the `applied` state gate — the `useEffect` dependency array naturally prevents re-execution.

**Files:** `src/app/page.tsx`

---

### C4: Three separate localStorage reads on boot — no shared hydration

**Priority:** P3

**What:** `useConfig`, `useAppSettings`, and `useTheme` each independently read from `localStorage` on mount via their own `useEffect`. That's three separate `JSON.parse` calls, three separate try/catch blocks, and three independent render cycles as each hook finishes loading.

**Why:** Three sequential hydration steps cause visible layout shifts: first `loaded` (config), then `settingsLoaded`, then the theme's `mounted` flag. The `page.tsx` already waits for `loaded && settingsLoaded` before rendering, and `ThemeProvider` waits for `mounted`. This means 3 render passes before the UI stabilizes.

**How:** Create a single `useHydration` hook that reads all three localStorage keys in one pass and returns all values:

```ts
function useHydration() {
  const [state, setState] = useState({
    config: defaultConfig,
    settings: DEFAULT_SETTINGS,
    theme: DEFAULT_THEME,
    ready: false,
  });
  useEffect(() => {
    const config = readKey("frm-config", defaultConfig);
    const settings = readKey("frm-app-settings", DEFAULT_SETTINGS);
    const theme = readKey("frm-theme", DEFAULT_THEME);
    setState({ config, settings, theme, ready: true });
  }, []);
  return state;
}
```

This reduces 3 render passes to 1. However, this is a significant refactor touching 3 hooks — worth doing only if the UX flash is noticeable.

**Files:** `src/lib/useConfig.ts`, `src/lib/useAppSettings.ts`, `src/lib/useTheme.tsx`

---

## D. Component Design

### D1: `FactoryMap.tsx` uses raw Canvas API with manual render loop

**Priority:** P1

**What:** `FactoryMap.tsx` manages a `<canvas>` element with manual `requestAnimationFrame` rendering, raw mouse event handlers for pan/zoom, an in-memory `iconCache` for PNG loading, and manual coordinate transforms (`worldToMap` → `mapToScreen`). It's ~400+ lines of imperative canvas code inside a React component.

**Why:** The raw Canvas approach works but is brittle. Every map interaction requires manually computing which icon was clicked, manually redrawing the entire canvas, and manually managing image loading states. Adding new features (clustering, heatmaps, minimap) would require significant rework. The code is hard to test because it's entirely imperative.

**How:** Three options, in order of effort:

1. **Extract canvas logic into a custom hook** (`useFactoryMap`) that encapsulates the canvas ref, pan/zoom state, coordinate transforms, and icon loading. The React component becomes a thin wrapper that passes data to the hook. This is the lowest-effort improvement and keeps the Canvas approach.

2. **Use a 2D rendering library** like PixiJS or Konva. These handle hit testing, layering, and image caching natively. Konva has a React binding (`react-konva`) that would make the map declarative.

3. **Replace with a WebGL map** using deck.gl or MapLibre for future-proofing (clustering, heatmaps, terrain overlay).

Recommendation: start with option 1 (extract hook), then evaluate option 2 if the map needs more features.

**Files:** `src/components/dashboard/FactoryMap.tsx`

---

### D2: `ItemIcon` duplicates `nameToColor` from `colors.ts`

**Priority:** P2

**What:** `ItemIcon.tsx` has a local copy of the `nameToColor` hashing function with a comment: "local copy to avoid `'use client'` boundary issues". The canonical version lives in `src/lib/colors.ts`.

**Why:** Duplicated logic means a bug fix in one won't propagate to the other. The `'use client'` boundary concern is valid (Next.js server/client component split), but `ItemIcon` is already `'use client'` and `colors.ts` is a pure function with no React dependencies — it can safely be imported.

**How:** Remove the local `nameToColor` from `ItemIcon.tsx` and import from `@/lib/colors`. If there's a genuine bundling issue, add `'use client'` to `colors.ts` — it has no server-side dependencies and the directive is harmless.

**Files:** `src/components/ui/ItemIcon.tsx`, `src/lib/colors.ts`

---

### D3: `ItemIcon` duplicates `cleanName`-like logic from `names.ts`

**Priority:** P2

**What:** `ItemIcon.tsx` manually strips `Desc_` prefix and `_C` suffix to derive a short name for the fallback initials. `names.ts` exports `cleanName()` which does the same for `Build_` prefix. There's no shared utility for the `Desc_` case.

**Why:** Two places doing similar string munging. If Satisfactory changes its ClassName convention, both places need updating.

**How:** Add a `shortName()` function to `names.ts`:

```ts
/** Strips Desc_ prefix and _C suffix for icon fallback display. */
export function shortName(className: string): string {
  return className.replace(/^Desc_/, "").replace(/_C$/, "");
}
```

Use it in `ItemIcon.tsx` and anywhere else that does this (e.g., `InventoryPanel` item name derivation).

**Files:** `src/lib/names.ts`, `src/components/ui/ItemIcon.tsx`

---

### D4: Repeated dashboard pattern — summary cards + accordion + search + time-window

**Priority:** P2

**What:** `ProductionMonitor`, `ResourceTracker`, `GeneratorStatus`, and `FluidDashboard` all share a similar structure: summary stat cards at the top, a grouped/accordion list below, a search filter, and time-window averaging. Each implements this independently.

**Why:** Four components with 60-70% structural overlap. Changes to the summary card design or search UX must be replicated four times. Bugs in time-window averaging logic could exist in one but not others.

**How:** Extract a generic `DashboardPanel` component:

```tsx
interface DashboardPanelProps<T> {
  title: string;
  data: T[] | null;
  loading: boolean;
  error: string | null;
  summaryCards: SummaryCard[];
  renderItem: (item: T) => ReactNode;
  groupBy?: (item: T) => string;
  searchFields?: (item: T) => string[];
  timeWindow?: TimeWindowMs;
}
```

Each specific dashboard becomes a thin wrapper that fetches data + defines `renderItem` and `summaryCards`, then renders `<DashboardPanel ... />`.

**Files:** New: `src/components/ui/DashboardPanel.tsx`; modified: `ProductionMonitor`, `ResourceTracker`, `GeneratorStatus`, `FluidDashboard`

---

### D5: `SettingsPanel.tsx` is ~400+ lines — split into sub-components

**Priority:** P2

**What:** `SettingsPanel` handles theme color pickers (12 colors), appearance settings (icon size, map scale, color mode), general settings (refresh rate), and theme JSON export/import — all in one file.

**Why:** Hard to navigate, hard to test. Each section is independent. A change to the color picker layout shouldn't risk breaking the JSON import.

**How:** Split into:

- `src/components/settings/ThemeColorEditor.tsx` — 12 color picker rows + section grouping
- `src/components/settings/AppearanceSettings.tsx` — icon size, map scale, dark/light toggle
- `src/components/settings/GeneralSettings.tsx` — refresh rate dropdown
- `src/components/settings/ThemeJsonTool.tsx` — export textarea + import button

`SettingsPanel` imports and composes all four.

**Files:** `src/components/dashboard/SettingsPanel.tsx` → split into `src/components/settings/`

---

## E. Performance

### E1: `getEndpointsByCategory()` called on every render of `page.tsx`

**Priority:** P2

**What:** `page.tsx` calls `const categories = getEndpointsByCategory()` in the render body. This function iterates over all 70 endpoints and builds a `Map<string, EndpointInfo[]>` every time the component re-renders (which is every time `activeTab`, `timeWindow`, or connection state changes).

**Why:** The endpoints list is static — it never changes at runtime. Building the same Map on every render is wasted CPU. At 70 endpoints it's not expensive, but it's unnecessary and contradicts the principle of not computing static data in render.

**How:** Move the call outside the component (module scope) or wrap in `useMemo`:

```ts
// Module scope — computed once at import time
const endpointsByCategory = getEndpointsByCategory();
```

`categories` is only passed to `EndpointList`, so compute it there instead.

**Files:** `src/app/page.tsx`

---

### E2: `FactoryMap` canvas re-renders every animation frame regardless of data changes

**Priority:** P1

**What:** The canvas `requestAnimationFrame` loop runs continuously, clearing and redrawing the entire map every ~16ms — including the background map image, all icons, all players, and the scale bar — even when the user isn't interacting and no data has changed.

**Why:** Continuous rendering wastes GPU and CPU, especially on battery-powered laptops. The map image alone is large (8192×8192 source) and drawing it every frame is expensive. When the user is idle, the frame loop should stop.

**How:** Use a dirty flag pattern:

```ts
const needsRedraw = useRef(true);

// Mark dirty on data change, pan, zoom, or layer toggle
useEffect(() => { needsRedraw.current = true; }, [data, panOffset, zoom, visibleLayers]);

// Only draw when dirty, then clear flag
const renderLoop = useCallback(() => {
  if (!needsRedraw.current) { animFrameRef.current = requestAnimationFrame(renderLoop); return; }
  // ... draw everything ...
  needsRedraw.current = false;
  animFrameRef.current = requestAnimationFrame(renderLoop);
}, [...]);
```

Optionally, pause the loop entirely when the tab is not visible (`document.hidden`).

**Files:** `src/components/dashboard/FactoryMap.tsx`

---

### E3: No virtualization for long lists

**Priority:** P2

**What:** `FactoryEfficiency`, `InventoryPanel`, and `ProductionMonitor` render all items in a single scrollable container with no windowing/virtualization. A large factory with 200+ buildings or 500+ inventory items renders all DOM nodes — even the off-screen ones.

**Why:** DOM node count directly impacts scroll performance and memory usage. 500 inventory items × ~10 DOM nodes each = 5,000 DOM nodes. This is near the threshold where scrolling becomes janky, especially in Electron on lower-end hardware.

**How:** Add a lightweight virtualizer. Options:

- `react-window` (mature, small bundle, fixed-height rows)
- `@tanstack/react-virtual` (more flexible, variable heights, TanStack ecosystem)

For the accordion-grouped lists (`ResourceTracker`, `FluidDashboard`), use a virtualizer that supports sticky group headers.

**Files:** `src/components/dashboard/FactoryEfficiency.tsx`, `InventoryPanel.tsx`, `ProductionMonitor.tsx`, `ResourceTracker.tsx`

---

### E4: Missing `useMemo`/`useCallback` on inline handlers in `page.tsx`

**Priority:** P3

**What:** `page.tsx` defines `handleTabChange`, `handleTimeWindowChange`, `handleConnect`, and `handleConfigChange` as regular functions in the component body (not wrapped in `useCallback`). Each render creates new function references.

**Why:** These are passed as props to `ConnectionBar`, `TimeWindowSelector`, and the tab buttons. New references on every render cause unnecessary re-renders of child components that use `React.memo` or reference equality checks. The performance impact is negligible for this app's scale, but it's a hygiene issue.

**How:** Wrap the handlers in `useCallback` with appropriate dependency arrays:

```ts
const handleConnect = useCallback(async () => {
  setConnecting(true);
  setError(null);
  const result = await testConnection(config);
  setConnecting(false);
  if (result.ok) setConnected(true);
  else {
    setConnected(false);
    setError(result.error || "Connection failed");
  }
}, [config]);
```

**Files:** `src/app/page.tsx`

---

## F. TypeScript & Types

### F1: `types.ts` is ~300+ lines — split into domain files

**Priority:** P2

**What:** `types.ts` contains every TypeScript interface for the entire app: FRM config, all building types, power circuits, inventory, production stats, UI theme, app settings, endpoint metadata. 300+ lines in a single file.

**Why:** Hard to find types. Any component that imports one building type gets the entire types module bundled (tree-shaking may help, but code organization matters for readability). Domain boundaries are blurred.

**How:** Split into:

- `src/lib/types/config.ts` — `FRMConfig`, `EndpointInfo`, `EndpointCategory`
- `src/lib/types/buildings.ts` — `BuildableBase`, `FactoryBuilding`, `Generator`, `Extractor`, `Vehicle`, `DroneStation`, `TrainStation`, `Railcar`, `TrainResponse`
- `src/lib/types/power.ts` — `PowerInfo`, `PowerCircuit`
- `src/lib/types/inventory.ts` — `InventoryItem`, `WorldInvItem`, `StorageContainer`, `CloudInvItem`
- `src/lib/types/production.ts` — `ProductionItem`, `IngredientItem`, `ProdStatItem`, `ProdStatSnapshot`, `ProdStatsResponse`, `ResourceSinkData`
- `src/lib/types/ui.ts` — `DashboardTheme`, `AppSettings`, `DEFAULT_THEME`, `LIGHT_THEME`, `DEFAULT_SETTINGS`
- `src/lib/types/player.ts` — `Player`, `PlayerData`, `ChatMessage`, `LocationData`, `Features`
- `src/lib/types/index.ts` — barrel re-export of all above

**Files:** `src/lib/types.ts` → `src/lib/types/`

---

### F2: `EndpointInfo.category` is typed as `string`, not a union

**Priority:** P2

**What:** `EndpointInfo.category` is typed as `string`. The `ENDPOINTS` array uses literal strings like `'power'`, `'generators'`, `'factory'`, etc., but the type system doesn't enforce that only valid categories are used.

**Why:** A typo like `categroy: 'powre'` would not be caught by TypeScript. The `CATEGORY_ICONS` and `CATEGORY_COLORS` records in `EndpointList.tsx` use string index signatures, so a missing category silently returns `undefined`.

**How:** Define a union type and use `as const` on the categories:

```ts
export type EndpointCategory =
  | "power"
  | "generators"
  | "factory"
  | "resources"
  | "logistics"
  | "vehicles"
  | "transport"
  | "support"
  | "session"
  | "inventory"
  | "research"
  | "events"
  | "creatures";

export interface EndpointInfo {
  path: string;
  category: EndpointCategory; // was: string
  description: string;
  requiresGameThread: boolean;
}
```

Then `CATEGORY_ICONS` and `CATEGORY_COLORS` become `Record<EndpointCategory, string>` which ensures every category has an entry.

**Files:** `src/lib/types.ts`, `src/components/EndpointList.tsx`

---

### F3: Weakly typed `FluidSummary`, `FluidMachineEntry` in `fluids.ts`

**Priority:** P3

**What:** `fluids.ts` defines its own `RawRecipe` interface with `products?: RecipeProduct[]` (optional). The main `types.ts` has `RecipeData` but `fluids.ts` doesn't use it — it defines its own subset type.

**Why:** Type drift between `fluids.ts`'s `RawRecipe` and `types.ts`'s `RecipeData`. If the FRM API changes the recipe shape, only one will be updated.

**How:** Either import `RecipeData` from `types.ts` and use `Pick<>` to extract the needed fields, or define `RawRecipe` in `types.ts` as a proper subset type and import it in `fluids.ts`.

**Files:** `src/lib/fluids.ts`, `src/lib/types.ts`

---

## G. Testing

### G1: Zero component tests — 13 dashboard tabs untested

**Priority:** P1

**What:** The repo has 6 test files in `src/lib/__tests__/` covering pure functions (api, colors, fluids, formatters, names, types, useTimeBuffer). There are zero tests for any of the 13 dashboard components, `ConnectionBar`, `EndpointList`, `TimeWindowSelector`, or `ItemIcon`.

**Why:** Dashboard components contain the bulk of the app's logic — data fetching, state management, UI rendering, and user interaction. Without tests, refactoring any component (like splitting `SettingsPanel` or extracting `DashboardPanel`) carries high risk of regressions. The lib tests only cover ~20% of the codebase's behavior.

**How:** Start with the highest-value components:

1. **`ItemIcon.tsx`** — Pure presentational, easy to test. Test: renders PNG, fallback initials, size variants, balance coloring.
2. **`TimeWindowSelector.tsx`** — Pure presentational. Test: renders 7 buttons, fires onChange with correct value.
3. **`PowerDashboard.tsx`** — Core dashboard, time-window averaging logic. Mock `fetchEndpoint` and test: loading state, error state, circuit card rendering, gauge bar percentages.
4. **`ConnectionBar.tsx`** — Connection form + ngrok controls. Test: input changes call onConfigChange, Connect button fires onConnect, tunnel button visibility (Electron vs non-Electron).

Use `vitest` + `@testing-library/react` (already compatible with the vitest config's jsdom environment).

**Files:** New: `src/components/__tests__/ItemIcon.test.tsx`, `TimeWindowSelector.test.tsx`, etc.

---

### G2: No integration tests for the connect → poll → render flow

**Priority:** P2

**What:** No test validates the full lifecycle: user enters config → clicks Connect → `testConnection` succeeds → tab renders → interval polls → data displays → time-window change → averaged data displays.

**Why:** This is the core user flow. If it breaks, the app is unusable. Unit tests on individual functions don't catch integration issues like the `useEffect` cleanup order, the localStorage hydration race, or the `page.tsx` render-body side effect.

**How:** Write an integration test that:

1. Renders `page.tsx` with a mock `fetch` that returns successful responses
2. Fills in the connection form
3. Clicks Connect
4. Asserts the tab bar appears
5. Clicks different tabs, asserts the correct dashboard renders
6. Changes the time window, asserts the dashboard receives the new value

Use `@testing-library/react` with `vitest`. Mock `fetch` globally using `vi.stubGlobal('fetch', ...)`.

**Files:** New: `src/app/__tests__/page.integration.test.tsx`

---

### G3: No E2E tests

**Priority:** P3

**What:** No end-to-end tests using Playwright, Cypress, or similar. The `vitest.config.ts` already uses jsdom — no browser automation is configured.

**Why:** E2E tests would catch regressions in the full stack (Next.js → React → FRM API interaction) that unit and integration tests can miss. However, E2E tests require a running FRM server or a mock server, which adds significant setup complexity. Lower priority until component and integration coverage is solid.

**How:** Add Playwright (already available in the VS Code toolchain):

- `npm install -D @playwright/test`
- Write a smoke test: app loads → connect form visible → enter dummy config → error state shown (since no real server)
- If a mock FRM server is feasible, test full poll-and-render cycles

**Files:** New: `e2e/` directory, `playwright.config.ts`

---

## H. Documentation

### H1: Some docs files may be stale — need audit

**Priority:** P2

**What:** `docs/` has 21 files covering architecture, components, hooks, API client, testing, and more. It's unclear when each was last updated against the actual code. The `components/` subdirectory has one doc per dashboard tab — some may describe features that have since changed.

**Why:** Stale docs are worse than no docs — they mislead developers and LLMs. The AGENTS.md rule says "Every source change must update the corresponding docs" — but without a last-updated timestamp on each doc, it's hard to know which ones are current.

**How:**

1. Add a `<!-- Last reviewed: YYYY-MM-DD -->` comment at the top of every `.md` file in `docs/`.
2. Audit each doc against the current source code during the next code change that touches that area.
3. Remove or archive docs for features that no longer exist.
4. Add a `docs/README.md` section listing each doc with its last-reviewed date.

**Files:** All files in `docs/`

---

### H2: Missing TSDoc/JSDoc on component props interfaces

**Priority:** P3

**What:** `ConnectionBarProps`, `Props` interfaces in dashboard components, and many exported types in `types.ts` lack JSDoc comments.

**Why:** AGENTS.md mandates: "Every function, class, non-obvious block, and exported symbol MUST have a human-readable comment." Several component props interfaces are exported (even if implicitly via the component) and lack comments describing each prop's purpose.

**How:** Add JSDoc to each props interface:

```tsx
interface Props {
  /** FRM server connection configuration (host, port, auth token). */
  config: FRMConfig;
  /** Currently selected time window for data averaging (0 = live). */
  timeWindow: TimeWindowMs;
  /** User-facing app settings (icon size, map scale, etc.). */
  settings: AppSettings;
}
```

**Files:** All `src/components/dashboard/*.tsx`, `src/components/ConnectionBar.tsx`, `src/components/EndpointList.tsx`

---

## I. DX & Tooling

### I1: No explicit `lint` script in `package.json`

**Priority:** P2

**What:** `package.json` scripts include `dev`, `build`, `start`, `test`, `test:watch`, and Electron variants — but no `lint` script. ESLint is configured (via `eslint-config-next`) and `next build` runs lint as part of the build pipeline, but there's no standalone `npm run lint` command.

**Why:** Developers can't quickly check lint without running a full build. CI pipelines typically want a separate lint step. AGENTS.md says "Lint & type-check — run the project's linter and TypeScript compiler. Fix every error." — but there's no quick way to do just lint.

**How:** Add to `package.json`:

```json
"scripts": {
  "lint": "next lint",
  "lint:fix": "next lint --fix",
  "typecheck": "tsc --noEmit"
}
```

**Files:** `package.json`

---

### I2: No pre-commit hooks (husky + lint-staged)

**Priority:** P3

**What:** No git hooks to enforce linting, type-checking, or test passing before commits. A developer can commit code with TypeScript errors or lint violations.

**Why:** CI will catch these eventually, but that's slow feedback. Pre-commit hooks prevent broken commits from reaching the remote and reduce CI churn.

**How:**

```bash
npm install -D husky lint-staged
npx husky init
```

In `.husky/pre-commit`:

```
npx lint-staged
```

In `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"]
}
```

**Files:** `package.json`, new: `.husky/pre-commit`

---

### I3: No `.nvmrc` or `.node-version` for Node version pinning

**Priority:** P3

**What:** No file specifying the required Node.js version. The `package.json` has no `engines` field either.

**Why:** Different Node versions can cause different behavior (especially with Next.js 15 and Electron 33). Contributors might use an incompatible version and hit cryptic errors.

**How:**

1. Determine the minimum Node version (Next.js 15 requires Node >= 18.17; Electron 33 bundles its own Node).
2. Create `.nvmrc` with `20` or `22` (LTS).
3. Add to `package.json`:

```json
"engines": {
  "node": ">=20.0.0"
}
```

**Files:** New: `.nvmrc`; modified: `package.json`

---

### I4: No import sorting convention

**Priority:** P3

**What:** Import order varies across files. Some files group React imports first, then third-party, then local. Others mix them. No tooling enforces consistency.

**Why:** Inconsistent imports make it harder to scan files. An auto-formatter eliminates the cognitive overhead of deciding import order.

**How:** Add `eslint-plugin-simple-import-sort`:

```bash
npm install -D eslint-plugin-simple-import-sort
```

Configure in `.eslintrc`:

```json
"plugins": ["simple-import-sort"],
"rules": {
  "simple-import-sort/imports": "error",
  "simple-import-sort/exports": "error"
}
```

Run `npm run lint:fix` once to normalize all files.

**Files:** `.eslintrc` or `eslint.config.mjs` (depending on ESLint 9 flat config setup), `package.json`

---

## Summary by Priority

| Priority | Count | IDs                                                                |
| -------- | ----- | ------------------------------------------------------------------ |
| P0       | 0     | —                                                                  |
| P1       | 7     | A1, B3, B4, C1, D1, E2, G1                                         |
| P2       | 17    | A2, B1, B2, B5, C2, C3, D2, D3, D4, D5, E1, E3, F1, F2, G2, H1, I1 |
| P3       | 9     | A3, C4, E4, F3, G3, H2, I2, I3, I4                                 |
