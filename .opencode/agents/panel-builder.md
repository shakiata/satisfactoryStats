---
description: Builds or edits Statusfactory dashboard panels. Use when adding, modifying, or refactoring a dashboard tab component. Triggered by "panel", "dashboard tab", "add a tab", "new component".
mode: subagent
permission:
  edit: allow
  bash: allow
---

You are building or editing a **Statusfactory dashboard panel**. Follow every rule below.

## File Location

- New panels go in `src/components/dashboard/<Name>.tsx`
- Register the panel in `src/app/page.tsx`:
  1. Import the component
  2. Add a `{ id: 'name', label: '🔧 Label', icon: '🔧' }` entry to `TABS`
  3. Add a conditional render `{activeTab === 'name' && <Component config={config} ... />}`

## Component Template

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/useTheme';
import { useTimeBuffer } from '@/lib/useTimeBuffer';
import { fetchEndpoint } from '@/lib/api';
import type { FRMConfig } from '@/lib/types';
import type { TimeWindowMs } from '@/components/TimeWindowSelector';

// TSDoc describing what this panel shows
export function MyNewPanel({
  config,
  timeWindow,
}: {
  config: FRMConfig;
  timeWindow: TimeWindowMs;
}) {
  const { theme } = useTheme();
  const [data, setData] = useState<SomeType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getWindowData, getWindowAverage } = useTimeBuffer(data);

  // Standard polling pattern
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

  // Handle time window
  const windowed = timeWindow > 0 ? getWindowData(timeWindow) : data;

  // Error state — never crash, always show inline
  if (error) {
    return <div style={{ color: 'var(--danger)' }}>Error: {error}</div>;
  }

  // Render content using theme tokens via var(--) or theme object
  return (
    <div style={{ color: theme.textPrimary, backgroundColor: theme.bgCard }}>
      {/* content */}
    </div>
  );
}
```

## Theme Access

```tsx
const { theme } = useTheme();
// Use theme.textPrimary, theme.textSecondary, theme.bgCard, theme.bgSecondary,
// theme.bgPrimary, theme.accent, theme.accentHover, theme.danger, theme.success, theme.info
```

- Inline `style={{}}` is ONLY allowed for CSS custom property lookups (`var(--bg-primary)`)
- Use Tailwind utility classes for layout (flex, grid, padding, margin, sizing)
- Never hardcode hex values or pixel sizes

## Icon Loading

```tsx
const [imgSrc, setImgSrc] = useState<string | null>(null);
useEffect(() => {
  const img = new Image();
  img.onload = () => setImgSrc(`./Icons/${className}.png`);
  img.onerror = () => setImgSrc(null); // show fallback
  img.src = `./Icons/${className}.png`;
}, [className]);
```

Icons live in `public/Icons/`, matched by FRM `ClassName` property.

## Time Window Integration

- When `timeWindow === 0`, show live (current) data
- When `timeWindow > 0`, call `getWindowData(timeWindow)` or `getWindowAverage(timeWindow, mapFn)`
- `useTimeBuffer` accumulates snapshots up to 1 hour

## Error Handling

- Set error state on fetch failure, display inline
- Never crash the entire dashboard
- Continue polling — intermittent failures self-heal

## Mandatory Rules

1. **Comments** — TSDoc on the component export, inline `//` on non-obvious blocks
2. **Docs sync** — create or update `docs/components/<name>.md` for every new/changed panel
3. **Test-before-done** — after writing code: `npm test && npm run build` (fix any failures)
4. **Add tests** — if you added new logic, add at least one test that would fail without your change
5. **No inline style tags or style with hardcoded values** — use theme tokens or CSS variables
6. **All interactive components are `'use client'`**
