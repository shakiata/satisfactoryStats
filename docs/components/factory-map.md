# FactoryMap

`src/components/dashboard/FactoryMap.tsx`  
`src/components/dashboard/FactoryMap.module.css`

**Purpose:** Interactive SVG-based map of the Satisfactory world showing factory buildings, generators, extractors, and players as icons overlaid on the official game map, with hover tooltips, coordinate readout, and pan/zoom.

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

- **SVG (HTML5)** with `viewBox`-based pan/zoom — same approach as `CollapsibleMap` in `TrainControlTower`.
- **Background:** Official Satisfactory wiki map image (`Map.jpg`) at 85% opacity, loaded as a `<image>` element.
- **High-DPI:** SVG is resolution-independent; no manual DPI handling needed.

### Coordinate System

```
MAP_MIN = -425000 (Unreal centimeters)
MAP_MAX =  425000
MAP_SIZE = 8192  (internal pixel grid)
```

All building/player coordinates are in Unreal cm. Internal coordinate math:

- `worldToMap(wx, wz)` → map-pixel coords `[0..MAP_SIZE, 0..MAP_SIZE]`
- `mapToWorld(mx, my)` → world coords `{ x, z }`
- `screenToWorld(clientX, clientY, svgEl, viewBox)` → world coords from mouse position

**Z → Y inversion:** Satisfactory's Z axis increases northward but SVG's Y axis increases
downward. `worldToMap` inverts Z (`MAP_SIZE - z`) so north maps to the top of the SVG and
south maps to the bottom. `mapToWorld` reverses this inversion for the cursor readout.

#### Coordinate System (cont.)

**ViewBox aspect ratio matching:** The auto-fit and Fit button preserve the container's
aspect ratio. If the buildings span a tall area but the container is wide, the viewBox
expands horizontally (and vice versa) — preventing SVG meet-scaling from squishing icons
into a narrow band.

### Controls

| Input       | Action                              |
| ----------- | ----------------------------------- |
| Mouse hover | Show tooltip with building stats    |
| Mouse click | Pin/unpin tooltip (stays on click)  |
| Mouse drag  | Pan the view                        |
| Mouse wheel | Zoom in/out (centered on cursor)    |
| + / − btn   | Zoom in/out (centered on viewport)  |
| ⊞ Fit btn   | Reset view to fit all buildings     |

### Tooltip Content

The tooltip displays building-specific information depending on type:

| Type        | Content                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| Factory     | Recipe, output items + rate, input items, power, productivity, shards/sloops |
| Generator   | Fuel type + amount, power output, load %, shards/sloops, status         |
| Extractor   | Output items + rate, speed multiplier, shards/sloops, status            |
| Player      | Name, coordinates                                                       |

All tooltips show world coordinates `(x, y, z)` at the bottom. Click to pin the tooltip; click elsewhere or the ✕ button to close.

### Coordinate Readout

Bottom-left corner of the map shows the current cursor position as world coordinates:
```
X: -123,456.7
Z:  45,678.9
```

### Layer Toggles

```typescript
const LAYERS = [
  { id: "factory",    label: "Factory Buildings", color: "#4A90D9" },
  { id: "generator",  label: "Generators",        color: "#E8833A" },
  { id: "extractor",  label: "Extractors",        color: "#F5C842" },
  { id: "player",     label: "Players",           color: "#00E5FF" },
];
```

- Toggle buttons above the map show/hide each layer.
- Visibility state persisted in `AppSettings.mapVisibleLayers`.

### Icon Rendering

- For factory/extractor buildings with production output, shows the **output item's icon** from `public/Icons/`.
- Falls back to the building's own ClassName icon if no production data exists.
- Uses `classNameToIconPath()`: `Build_*_C` → `./Icons/Desc_*_C.png`, `Desc_*` → kept as-is.
- **Player markers:** Pulsing cyan circles (animated via SVG `<animate>`).

### Exported Utilities

```typescript
export function worldToMap(wx: number, wz: number): [number, number]
export function mapToWorld(mx: number, my: number): { x: number; z: number }
export function classNameToIconPath(className: string): string
export function cleanRecipe(recipe: string): string
export function calcIconSize(vbW: number, iconScale: number): number  // max(8, min(32, vbW/50))
export function calcHitRadius(vbW: number): number                   // max(12, min(64, vbW/25))
```

`calcIconSize` targets ~20px screen size at moderate zoom. `calcHitRadius` targets
~40px screen hit area for comfortable mouse targeting of small icons.

### Edge Cases

- **Map image fails to load:** SVG renders with dark background `#1a1a2e` only.
- **No buildings on any layer:** Shows "No building data yet" text centered on the map.
- **All layers hidden:** Shows background only, with an empty state message.
- **Building without location:** Filtered out; not rendered.
- **Icon 404:** Invisible in SVG; fallback colored circle is visible beneath the image.

### CSS Module (`FactoryMap.module.css`)

| Class               | Purpose                                |
| ------------------- | -------------------------------------- |
| `.mapContainer`     | Outer container, relative positioning  |
| `.mapSvg`           | SVG element, grab cursor               |
| `.dragging`         | Grabbing cursor during drag            |
| `.tooltip`          | Fixed-position tooltip overlay         |
| `.tooltipPinned`    | Pointer events enabled for pinned mode |
| `.coordinates`      | Bottom-left world coordinate readout   |
| `.zoomControls`     | Top-right zoom button stack            |
| `.zoomBtn`          | Individual zoom button                 |
| `@keyframes ping`   | Player marker pulse animation          |
