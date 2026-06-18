# Theme & Styling

Statusfactory uses a hybrid approach: **Tailwind CSS** for layout/utility classes and **CSS custom properties** for the dynamic, user-customizable color theme.

---

## Architecture

```
globals.css
  ├── Tailwind directives (@tailwind base/components/utilities)
  ├── CSS custom properties (design tokens, :root defaults)
  ├── Global resets (box-sizing, scrollbars, font)
  └── @apply utilities
        │
        ▼
ThemeProvider (useTheme.tsx)
  ├── Reads localStorage('frm-theme')
  ├── Injects CSS custom properties via applyThemeCssVars()
  └── Provides theme object via React Context
        │
        ▼
Components
  ├── useTheme() → { theme } object
  ├── style={{ color: theme.textPrimary }}
  └── Tailwind classes for layout (grid, flex, gap, padding)
```

---

## Design Tokens

Two preset themes are defined in `src/lib/types.ts`:

### Dark Theme (`DEFAULT_THEME`)

| Variable           | Default   | Role                                    |
| ------------------ | --------- | --------------------------------------- |
| `--bg-primary`     | `#0a0a0a` | Main page background                    |
| `--bg-secondary`   | `#141414` | Secondary surfaces (title bar, tabs)    |
| `--bg-card`        | `#1a1a1e` | Card/panel backgrounds                  |
| `--border-color`   | `#2a2a2e` | Borders and dividers                    |
| `--text-primary`   | `#f0f0f0` | Primary text (headings, labels)         |
| `--text-secondary` | `#a0a0a0` | Secondary text (descriptions, metadata) |
| `--accent`         | `#e6a720` | Primary accent (Ficsit orange)          |
| `--accent-hover`   | `#f4c542` | Accent hover state                      |
| `--success`        | `#2ecc71` | Positive indicators (green)             |
| `--danger`         | `#e74c3c` | Negative/warning indicators (red)       |
| `--info`           | `#3498db` | Informational elements (blue)           |
| `--muted`          | `#6b7280` | De-emphasized elements                  |

### Light Theme (`LIGHT_THEME`)

| Variable           | Default   | Role                                    |
| ------------------ | --------- | --------------------------------------- |
| `--bg-primary`     | `#f5f5f7` | Main page background                    |
| `--bg-secondary`   | `#ffffff` | Secondary surfaces (title bar, tabs)    |
| `--bg-card`        | `#ffffff` | Card/panel backgrounds                  |
| `--border-color`   | `#d4d4d8` | Borders and dividers                    |
| `--text-primary`   | `#18181b` | Primary text (headings, labels)         |
| `--text-secondary` | `#71717a` | Secondary text (descriptions, metadata) |
| `--accent`         | `#2563eb` | Primary accent (blue)                   |
| `--accent-hover`   | `#3b82f6` | Accent hover state                      |
| `--success`        | `#16a34a` | Positive indicators (green)             |
| `--danger`         | `#dc2626` | Negative/warning indicators (red)       |
| `--info`           | `#0ea5e9` | Informational elements (blue)           |
| `--muted`          | `#a1a1aa` | De-emphasized elements                  |

Users can switch between themes via the **Color Mode** toggle in Settings → Appearance, or customize individual colors via the color pickers.

---

## CSS Override Classes

To avoid inline `style={{}}` DOM mutations (`onFocus`/`onBlur`/`onMouseEnter`/`onMouseLeave`) — which are prohibited by AGENTS.md — the following utility classes in `globals.css` use `!important` to override dynamically-set inline styles:

| Class                                   | Applies To                                                                                   | Effect                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `.conn-input:focus`                     | ConnectionBar host/port/auth inputs                                                          | Border turns accent color on focus                   |
| `.search-input:focus`                   | Search inputs in EndpointList, InventoryPanel, FactoryEfficiency, ChatPanel, ResourceTracker | Border turns accent color on focus                   |
| `.btn-accent:hover`                     | Send button in ChatPanel                                                                     | Background shifts to accent-hover on hover           |
| `.tab-btn:not(.tab-active):hover`       | Dashboard tab buttons in page.tsx                                                            | Text and border lighten on hover                     |
| `.train-row:not(.train-selected):hover` | Train rows in TrainControlTower                                                              | Subtle green tint appears on hover via `color-mix()` |

---

## Tailwind Configuration

`tailwind.config.js` extends the default palette with Ficsit brand colors:

```javascript
colors: {
  ficsit: {
    50: '#fef9e7',  // Lightest
    // ... gradient stops ...
    400: '#e6a720', // Primary accent
    // ...
    950: '#3d2e04', // Darkest
  },
}
```

Tailwind handles **layout only** (grid, flex, spacing, typography). Colors are always referenced via CSS variables, not Tailwind color classes.

---

## ThemeProvider Flow

1. **Mount:** `ThemeProvider` renders with `mounted = false` → returns `null` (no children rendered).
2. **useEffect:** Reads `localStorage('frm-theme')`, merges with `DEFAULT_THEME`. If no custom theme is saved, checks `localStorage('frm-app-settings')` for `themeMode` — if `'light'`, loads `LIGHT_THEME`. Calls `applyThemeCssVars()`.
3. **`mounted = true`:** Children render with the loaded theme.
4. **User toggles Color Mode (SettingsPanel):** `saveSettings({ themeMode: 'light' })` + `updateTheme(LIGHT_THEME)` → localStorage → `applyThemeCssVars()`.
5. **User changes color (SettingsPanel):** `updateTheme(partial)` → merges → localStorage → `applyThemeCssVars()` → instant visual update.
6. **Reset:** Clears localStorage, restores `DEFAULT_THEME` + re-applies CSS vars.

This flow eliminates **FOUC** (flash of unstyled content) because children are hidden until the saved theme is loaded and injected.

---

## How Components Use Theme

Components import `useTheme` and reference the `theme` object:

```tsx
const { theme } = useTheme();

<div style={{
  backgroundColor: theme.bgCard,
  color: theme.textPrimary,
  borderColor: theme.borderColor,
}}>
```

For responsive states (hover, focus), use CSS `color-mix()`:

```tsx
style={{
  backgroundColor: `color-mix(in srgb, ${theme.success} 15%, transparent)`,
}}
```

---

## Global Styles

From `globals.css`:

- **Box-sizing:** `border-box` on all elements.
- **Font:** Inter (300, 400, 500, 600, 700) from Google Fonts via `<link>` in `layout.tsx`.
- **Scrollbars:** Custom webkit scrollbar (8px wide, theme-colored track and thumb).
- **Body:** `min-h-screen antialiased`, dark background.
- **Color scheme:** Dark mode enforced via CSS + Electron `nativeTheme.themeSource = "system"`.

---

## SettingsPanel Color Picker Flow

1. User opens Settings tab → sees 12 `ColorRow` components.
2. Each row has a hex input and visual preview swatch.
3. On change: `updateTheme({ bgPrimary: '#...' })` → immediate CSS var update + localStorage save.
4. Live Preview section updates in real-time to reflect new colors.
5. Reset Theme button → `resetTheme()` → all 12 colors back to defaults.
