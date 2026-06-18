# FactoryMap

`src/components/dashboard/FactoryMap.tsx`

**Purpose:** Interactive top-down map of the Satisfactory world showing factory buildings, generators, extractors, and players as icons on the official game map.

### Props

```typescript
interface Props {
  config: FRMConfig;
  settings: AppSettings;
  saveSettings: (partial: Partial<AppSettings>) => void;
}
```

### Data Sources

| Endpoint        | Type                | Purpose                    |
| --------------- | ------------------- | -------------------------- |
| `getFactory`    | `FactoryBuilding[]` | Factory building positions |
| `getGenerators` | `Generator[]`       | Generator positions        |
| `getExtractor`  | `Extractor[]`       | Extractor positions        |
| `getPlayer`     | `Player[]`          | Player positions           |

### Render Engine

- **HTML5 Canvas 2D** with `requestAnimationFrame` loop
- **High-DPI support:** Scales by `window.devicePixelRatio`
- **Background:** Official Satisfactory wiki map image at 85% opacity

### Coordinate System

```
MAP_MIN = -425000  (Unreal centimeters)
MAP_MAX =  425000
```

All building/player coordinates are in Unreal cm. The canvas transforms these to pixel space based on current pan/zoom.

### Controls

| Input       | Action                              |
| ----------- | ----------------------------------- |
| Mouse wheel | Zoom in/out (1.15× factor per step) |
| Mouse drag  | Pan the view                        |
| Click icon  | (Reserved for future detail popup)  |

### Layer Toggles

```typescript
const LAYERS = [
  { id: "factory", label: "Factory Buildings", color: "#4A90D9" },
  { id: "generator", label: "Generators", color: "#E8833A" },
  { id: "extractor", label: "Extractors", color: "#F5C842" },
  { id: "player", label: "Players", color: "#00E5FF" },
];
```

- Toggle buttons above the map show/hide each layer.
- Visibility state persisted in `AppSettings.mapVisibleLayers`.

### Icon Rendering

- Tries `./Icons/{ClassName}.png` for building icons
- Falls back to colored circles (size controlled by `settings.mapIconScale`)
- **Player markers:** Pulsing circles with animated halos

### UI Overlays

- **Layer toggles** — top of map
- **Scale bar** — bottom-left, shows 200m reference
- **Auto-center** — on first load, fits all visible points in view

### Edge Cases

- **Map image fails to load:** Canvas renders with dark background only.
- **No buildings on any layer:** Empty map with just the background.
- **All layers hidden:** Shows background only.
