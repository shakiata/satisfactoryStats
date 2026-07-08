---
name: satisfactory-stats
description: "Use for Statusfactory app work — architecture, dashboard panels, FRM API, Electron, theme, conventions. Triggers on: satisfactory, statusfactory, frm, ficsit, dashboard, panel, polling, useTimeBuffer, theme, factory, train, power, production, fluid, inventory, generator"
---

# Statusfactory — Satisfactory Stats

Next.js 15 + Electron 33 desktop app monitoring Satisfactory factories via Ficsit Remote Monitoring (FRM) REST API.

---

## Essential Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on port 3000 |
| `npm run electron:dev` | next dev → wait-on → Electron window |
| `npm test` | Vitest run (all tests) |
| `npx vitest <path>` | Single test file |
| `npm run build` | next build (static export → `out/`) |
| `npm run electron:build` | next build → electron-builder → `dist/` |

**Verification gate** (run before claiming done): `npm test && npm run build`

No `npm run lint` or `typecheck` script — `tsc` runs implicitly in `next build`.

---

## Architecture Constraints

- **Static export SPA** — `next.config.js` sets `output: "export"` + `assetPrefix: "./"`. No SSR, no API routes, no `getServerSideProps`.
- **Single page** — `src/app/page.tsx` is the entire app: a tab router rendering one of 13 dashboard panels. No routing library.
- **Every interactive component** must be `'use client'`.
- **Electron shell** — `electron/main.js` creates a `BrowserWindow`; `electron/preload.js` exposes `window.electronAPI` (tunnel: start/stop/status only). Gate Electron features with `!!window.electronAPI`. `electron/` excluded from `tsconfig.json`.
- **FRM API is the only data source** — `src/lib/api.ts`. No backend, no database, no external auth.
- **State** — pure React hooks only (useState, useContext, useCallback). No Redux, Zustand, etc. Persistence via localStorage (`useConfig`, `useAppSettings`, `useTheme`).
- **`@/` imports** map to `src/`.

---

## Data Flow

```
User enters FRM credentials → ConnectionBar → useConfig().saveConfig() → localStorage
User clicks Connect → testConnection(config) → GET /getPower on FRM API
On success → connected = true → tab content renders
Each dashboard panel polls endpoints on setInterval matching config.refreshRate
useTimeBuffer accumulates timestamped snapshots (max 1 hour) for windowed averaging
useTheme injects CSS custom properties into document.documentElement from localStorage
```

### Connection URL Logic (`buildUrl()`)

- **localhost / 127.0.0.1 / private IPs** → `http://host:port/endpoint`
- **Domain names (ngrok, Cloudflare Tunnel, etc.)** → `https://host/endpoint` (port stripped)

### Authentication

If `config.password` is set, every request includes header `X-FRM-Authorization: <password>`. ngrok connections also send `ngrok-skip-browser-warning: 1`.

---

## Dashboard Panel Pattern

Every panel in `src/components/dashboard/` follows this structure:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/useTheme';
import { useTimeBuffer } from '@/lib/useTimeBuffer';
import { fetchEndpoint } from '@/lib/api';
import type { FRMConfig } from '@/lib/types';

/**
 * TSDoc describing what this panel shows, what endpoints it uses,
 * and any special behavior.
 */
export function PanelName({
  config,
  timeWindow,
  settings?
}: {
  config: FRMConfig;
  timeWindow: TimeWindowMs;
  settings? /* optional, for panels that need it */;
}) {
  const { theme } = useTheme();
  const [data, setData] = useState<SomeType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getWindowData, getWindowAverage } = useTimeBuffer(data);

  // Polling
  useEffect(() => {
    let mounted = true;
    const fetch = () => {
      fetchEndpoint<SomeType[]>(config, 'getSomeEndpoint')
        .then((res) => { if (mounted) setData(res); })
        .catch((err) => { if (mounted) setError(err.message); });
    };
    fetch();
    const interval = setInterval(fetch, config.refreshRate);
    return () => { mounted = false; clearInterval(interval); };
  }, [config]);

  // Time window: 0 = live, >0 = averaged snapshots
  const windowed = timeWindow > 0 ? getWindowData(timeWindow) : data;

  // Error: display inline, never crash
  if (error) {
    return <div style={{ color: 'var(--danger)' }}>Error: {error}</div>;
  }

  return (
    <div style={{ color: theme.textPrimary, backgroundColor: theme.bgCard }}>
      {/* content */}
    </div>
  );
}
```

### Registering a New Panel in `page.tsx`

1. Import the component
2. Add entry to `TABS` array: `{ id: 'name', label: '🔧 Label', icon: '🔧' }`
3. Add render: `{activeTab === 'name' && <Component config={config} timeWindow={timeWindow} />}`

---

## CSS & Theme Rules

- **No hardcoded hex values or pixel sizes in components** — ever. Use CSS custom properties.
- **Tailwind** for layout (flex, grid, padding, margin, sizing, text sizing).
- **Inline `style={{}}`** ONLY for dynamic CSS custom property lookups (`var(--bg-primary)`).
- **Design tokens** defined in `src/app/globals.css` as `--*` vars on `:root`.
- **No per-component global stylesheets** — `globals.css` is the only global file. CSS Modules (`*.module.css`) for component-specific styles.

Available tokens: `--bg-primary`, `--bg-secondary`, `--bg-card`, `--border-color`, `--text-primary`, `--text-secondary`, `--accent`, `--accent-hover`, `--danger`, `--success`, `--info`.

### useTheme

```tsx
const { theme } = useTheme();
// theme.textPrimary, theme.textSecondary, theme.bgCard, theme.bgSecondary,
// theme.bgPrimary, theme.accent, theme.accentHover, theme.danger, theme.success, theme.info
```

---

## File Organization

| Path | Contents |
|---|---|
| `src/lib/` | Hooks (`useConfig`, `useAppSettings`, `useTheme`, `useTimeBuffer`), API client (`api.ts`), types (`types.ts`), fluids (`fluids.ts`), formatters |
| `src/components/ui/` | Shared UI (`ItemIcon.tsx`) |
| `src/components/dashboard/` | All 13 dashboard tab panels |
| `src/components/` | Shared components (`ConnectionBar`, `EndpointList`, `TimeWindowSelector`) |
| `electron/` | `main.js` + `preload.js` (excluded from tsc) |
| `docs/` | All documentation — **every source change must update the corresponding doc** |
| `public/Icons/` | 1000+ PNG icons matched by FRM `ClassName` |
| `suggestions/suggestions.md` | Improvement suggestions in structured format |

---

## API Client (`src/lib/api.ts`)

Key exports:

| Export | Description |
|---|---|
| `ENDPOINTS` | Registry of 80+ FRM endpoints (path, category, description, requiresGameThread) |
| `getEndpoints()` | Returns full flat endpoint array |
| `getEndpointsByCategory()` | Groups endpoints into Map by category (13 categories) |
| `buildUrl(config, endpoint)` | Constructs URL with auto-detected scheme (http vs https) |
| `fetchEndpoint<T>(config, endpoint, options?)` | Generic fetch wrapper with auth, returns typed response |
| `testConnection(config)` | Pings /getPower, returns `{ ok: boolean, error?: string }` |
| `sendChatMessage(config, message)` | Posts to /chat |

---

## Fluid Detection

`src/lib/fluids.ts` uses synchronous ClassName pattern matching (`isFluidClassName()`) to identify liquids/gases from production stats. Also traces raw materials through the recipe graph.

---

## Testing

- **Vitest 3** with jsdom, globals enabled.
- Tests in `__tests__/` alongside code: `src/**/*.test.{ts,tsx}`.
- API tests mock `fetch` globally — never hit real network.
- Pattern: one `describe` per exported function, `it` blocks per behavior.
- **No component tests exist yet** — only hook/utility tests (7 current files: `api.test.ts`, `fluids.test.ts`, `useConfig.test.ts`, `useAppSettings.test.ts`, `useTheme.test.ts`, `useTimeBuffer.test.ts`, `names.test.ts`).

---

## Icon Loading Pattern

```tsx
const [imgSrc, setImgSrc] = useState<string | null>(null);
useEffect(() => {
  const img = new Image();
  img.onload = () => setImgSrc(`./Icons/${className}.png`);
  img.onerror = () => setImgSrc(null); // fallback to colored badge/initials
  img.src = `./Icons/${className}.png`;
}, [className]);
```

---

## Mandatory Rules (from AGENTS.md)

1. **Comments** — TSDoc on every function/class/exported symbol. Inline `//` for non-obvious blocks.
2. **Docs sync** — every source change must update the corresponding doc in `docs/`. If no doc covers it, create one.
3. **Test-before-done** — `npm test && npm run build`, add tests for new logic, manual smoke for UI/API changes.
4. **No inline `style={{}}`** except for `var(--)` lookups. Tailwind for everything else.
5. **All components `'use client'`**.
6. **Electron features** gated on `!!window.electronAPI`.
7. **Canvas components** (`FactoryMap`, `TrainControlTower`) use `requestAnimationFrame` + handle `devicePixelRatio`.

---

## Quick File Map

| File | Purpose |
|---|---|
| `src/app/page.tsx` | Tab router, connection state, ThemeProvider |
| `src/app/layout.tsx` | Root layout, metadata, Inter font |
| `src/app/globals.css` | CSS custom properties, Tailwind, scrollbar, utility overrides |
| `src/lib/api.ts` | FRM API client + 80+ endpoint registry |
| `src/lib/useConfig.ts` | FRM config persistence in localStorage |
| `src/lib/useAppSettings.ts` | UI preferences persistence |
| `src/lib/useTheme.tsx` | Theme context + CSS variable injection |
| `src/lib/useTimeBuffer.ts` | Rolling time-series buffer (max 1 hour) |
| `src/lib/types.ts` | All TypeScript types |
| `src/lib/fluids.ts` | Fluid identification + raw material tracing |
| `src/lib/electron.d.ts` | Type declarations for `window.electronAPI` |
| `src/components/ui/ItemIcon.tsx` | Icon loader from `public/Icons/` |
| `electron/main.js` | Electron main process, BrowserWindow |
| `electron/preload.js` | contextBridge, tunnel IPC |
| `docs/README.md` | Documentation index |
