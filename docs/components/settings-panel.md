# SettingsPanel

`src/components/dashboard/SettingsPanel.tsx`

**Purpose:** Configure FRM connection settings, UI appearance, and fully customize the 12-color dashboard theme.

### Props

```typescript
interface Props {
  config: FRMConfig;
  saveConfig: (c: FRMConfig) => void;
  settings: AppSettings;
  saveSettings: (s: Partial<AppSettings>) => void;
}
```

### Sections

**1. General**

- **Refresh Rate** dropdown: 1s, 2s, 5s, 10s, 15s, 30s, 60s
- Changes `config.refreshRate` via `saveConfig()`

**2. Appearance**

- **Icon Size** toggle: Small / Medium / Large
- **Map Icon Scale** slider: 0.5× to 2.0×
- **Reset Appearance** button (resets to DEFAULT_SETTINGS)

**3. Theme Customization**
12 color pickers organized in 4 groups:

| Group       | Properties                              |
| ----------- | --------------------------------------- |
| Backgrounds | `bgPrimary`, `bgSecondary`, `bgCard`    |
| Text        | `textPrimary`, `textSecondary`, `muted` |
| Accents     | `accent`, `accentHover`                 |
| Status      | `success`, `danger`, `info`             |
| Borders     | `borderColor`                           |

Each color row (`ColorRow` component) shows:

- Color label
- Visual preview swatch
- Hex input field (e.g., `#e6a720`)

All changes call `updateTheme(partial)` via `useTheme()` — injected immediately into CSS custom properties.

**4. Live Preview**

- Shows status badges (Success / Danger / Info / Accent)
- Sample progress bars
- Text hierarchy preview (primary, secondary, muted)
- Updates in real-time as colors change

**5. Reset Buttons**

- **Reset Settings** — restores `FRMConfig` and `AppSettings` to defaults
- **Reset Theme** — restores all 12 colors to `DEFAULT_THEME`

### Edge Cases

- **Invalid hex input:** Clamped/highlighted, no crash.
- **Reset confirmation:** No confirmation dialog needed (changes are non-destructive, theme can be re-customized).
- **Rapid color changes:** Each change immediately updates CSS vars — no debounce needed (color pickers are low-frequency).
