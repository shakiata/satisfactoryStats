# Testing

Statusfactory uses **Vitest** for unit and integration testing. Tests live alongside source files in `__tests__/` directories.

---

## Quick Start

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-run on file changes)
npx vitest

# Run a specific test file
npx vitest src/lib/__tests__/api.test.ts
```

---

## Test Structure

```
src/
├── lib/
│   ├── __tests__/
│   │   ├── api.test.ts           # URL building, headers, connection test
│   │   ├── useTimeBuffer.test.ts # Buffer ops, windowing, averaging helpers
│   │   └── types.test.ts         # Type validation smoke tests
│   ├── api.ts
│   ├── useTimeBuffer.ts
│   └── types.ts
└── components/
    └── __tests__/                # (future) component tests
```

---

## What We Test

### API Client (`api.test.ts`)

- **`buildUrl`** — URL construction for localhost, 127.0.0.1, LAN IPs, and domain names (ngrok). Port appending/omission logic. Scheme detection (http vs https). Input sanitization (scheme stripping, trailing slashes, embedded ports).
- **`fetchEndpoint`** — Header construction (Accept, X-FRM-Authorization, ngrok-skip-browser-warning). Error handling on non-OK responses.
- **`testConnection`** — Success and failure paths, error message extraction.
- **`sendChatMessage`** — POST method, Content-Type header, body serialization.
- **`getEndpoints` / `getEndpointsByCategory`** — Correct grouping, no empty categories.

### Time Buffer (`useTimeBuffer.test.ts`)

- Buffer insertion — new data creates a new `TimedEntry`.
- Pruning — entries older than 1 hour are removed.
- `getWindowData` — returns correct subset for given time window.
- `getWindowAverage` — correct averaging, returns 0 for empty buffer.
- `averageProdStats` — merging multiple snapshots, averaging by ClassName.
- `averagePowerStats` — averaging power snapshot arrays.

### Types (`types.test.ts`)

- `DEFAULT_SETTINGS` has all required `AppSettings` fields.
- `DEFAULT_THEME` has all 12 `DashboardTheme` properties.
- Type narrowing checks for building discriminants.

---

## Configuration

`vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

---

## Conventions

1. **Test files** go in `__tests__/` alongside the code they test.
2. **Naming:** `*.test.ts` for unit tests.
3. **One `describe` block per exported function**, with `it` blocks for each behavior.
4. **Mock `fetch`** globally for API tests — never hit the real network.
5. **No component tests yet** — hook/utility tests provide the highest value with least maintenance burden. Add component tests when UI logic becomes complex.
6. **Run `npm test` before committing** — CI will enforce this.
