<!-- BEGIN:essential-commands -->

# Essential Commands

```bash
npm run dev              # Next.js dev server (port 3000)
npm run electron:dev     # concurrently: next dev + wait-on :3000 + electron
npm start                # Serve static export
npm test                 # Vitest run (all tests)
npx vitest <path>        # Single test file
npm run build            # next build (static export → out/)
npm run electron:build   # next build → electron-builder → dist/
```

There is no `npm run lint` or `npm run typecheck` script. `tsc` (with `noEmit`)
runs implicitly during `next build`. Use `npm test && npm run build` as the
verification gate.

<!-- END:essential-commands -->

<!-- BEGIN:architecture -->

# Architecture Notes

- **Static export SPA** — Next.js `output: 'export'` + `assetPrefix: './'`.
  No SSR, no API routes, no `getServerSideProps`. Every interactive component
  must be `'use client'`.
- **Single page** — `src/app/page.tsx` is the entire app: a tab router rendering
  one of 12 dashboard panels. No routing library.
- **Electron shell** — `electron/main.js` creates a `BrowserWindow`;
  `electron/preload.js` exposes `window.electronAPI` (tunnel: start/stop/status
  only). Check `!!window.electronAPI` to gate Electron-only features (ngrok
  Share button). `electron/` is excluded from `tsconfig.json`.
- **FRM API is the only data source** — `src/lib/api.ts` talks to the Ficsit
  Remote Monitoring REST API. No backend, no database, no external auth.
- **Time-window data** — `useTimeBuffer` accumulates polling snapshots (max
  1 hour). Panels call `getWindowData(ms)` or `getWindowAverage(ms, mapFn)`.
- **Theme = CSS custom properties** — `useTheme` injects 12 `--*` vars into
  `:root`. Components reference them via `var(--)` in CSS or inline
  `style={{}}` (the one allowed case for inline styles).
- **Item icons** — 1000+ PNGs in `public/Icons/`, matched by FRM `ClassName`.
  See `src/components/ui/ItemIcon.tsx`.
- **Polling** — each dashboard panel manages its own `setInterval` at
  `config.refreshRate`. No centralized scheduler.
- **State** — pure React hooks only (useState, useContext, useCallback).
  No Redux, Zustand, etc. Persistence via localStorage (`useConfig`,
  `useAppSettings`, `useTheme`).
- **Fluid detection** — `src/lib/fluids.ts` uses synchronous ClassName pattern
  matching to identify liquids/gases and trace raw materials.
- **`@/` imports** map to `src/` (configured in both tsconfig and vitest config).

<!-- END:architecture -->

<!-- BEGIN:testing -->

# Testing

- **Vitest 3** with jsdom environment, globals enabled.
- Test files live in `__tests__/` alongside the code they test
  (`src/**/*.test.{ts,tsx}`).
- API tests mock `fetch` globally — never hit the real network.
- Pattern: one `describe` per exported function, `it` blocks per behavior.
- **No component tests exist yet** — only hook/utility tests (7 files).

<!-- END:testing -->

<!-- BEGIN:conventions -->

# Code & Style Conventions

- **Comments required** on every function, class, non-obvious block, and
  exported symbol. TSDoc for public APIs, inline `//` for internal logic.
- **Global CSS** in `src/app/globals.css` only. No per-component global
  stylesheets. CSS Modules (`*.module.css`) for component-specific styles.
- **No inline `style={{}}`** except for dynamic CSS custom property lookups
  (`var(--bg-primary)`). Use Tailwind utility classes for everything else.
- **Design tokens first** — define `--color-*` in globals.css, never hardcode
  hex values or pixel sizes in components.
- **Hooks** in `src/lib/`, **shared UI** in `src/components/ui/`.
- **Dashboard panels** in `src/components/dashboard/`.

<!-- END:conventions -->

<!-- BEGIN:docs-sync -->

# Docs Sync — Mandatory

Every source change must update the corresponding doc in `docs/` at the repo
root. If no doc covers the changed behavior, create one. Do not defer.

Key docs: `architecture.md`, `api-client.md`, `hooks.md`, `testing.md`,
`electron-integration.md`, `theme-and-styling.md`. Index at `docs/README.md`.

<!-- END:docs-sync -->

<!-- BEGIN:test-before-done -->

# Test Before Done

1. **Build check** — `npm run build` (catches TypeScript errors + build warnings)
2. **Test** — `npm test` (all existing tests pass)
3. **Add tests** — if you added new logic, add at least one test that would
   fail without your change
4. **Manual smoke** — if the change touches UI or API behavior, run
   `npm run dev` and hit the affected path

Only say "done" when everything is green.

<!-- END:test-before-done -->
