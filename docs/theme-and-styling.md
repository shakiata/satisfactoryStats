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

Defined in `src/app/globals.css` as CSS custom properties on `:root`:

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
2. **useEffect:** Reads `localStorage('frm-theme')`, merges with `DEFAULT_THEME`, calls `applyThemeCssVars()`.
3. **`mounted = true`:** Children render with the loaded theme.
4. **User changes color (SettingsPanel):** `updateTheme(partial)` → merges → localStorage → `applyThemeCssVars()` → instant visual update.
5. **Reset:** Clears localStorage, restores `DEFAULT_THEME` + re-applies CSS vars.

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
