# Type Definitions

`src/lib/types.ts` defines all TypeScript interfaces and constants used across the application. Every type corresponds to a shape returned by the FRM API or used internally for UI state.

---

## Configuration

### `FRMConfig`

Connection settings for the FRM API.

```typescript
interface FRMConfig {
  host: string; // FRM server hostname/IP (default: "localhost")
  port: string; // FRM server port (default: "8080")
  password?: string; // Optional auth token
  refreshRate: number; // Polling interval in ms (default: 5000)
}
```

---

## Geometry & Location

### `LocationData`

3D position in Unreal Engine coordinates (centimeters).

```typescript
interface LocationData {
  x: number;
  y: number;
  z: number;
  rotation?: number;
}
```

### `Features`

GeoJSON-like structure for map rendering.

```typescript
interface Features {
  properties: { name: string; type: string };
  geometry: { coordinates: { x: number; y: number; z: number }; type: string };
}
```

---

## Power System

### `PowerInfo`

Per-building power draw.

```typescript
interface PowerInfo {
  CircuitGroupID: number;
  CircuitID: number;
  PowerConsumed: number;
  MaxPowerConsumed: number;
}
```

### `PowerCircuit`

Full circuit stats including production, consumption, and battery.

```typescript
interface PowerCircuit {
  CircuitGroupID: number;
  CircuitID: number;
  PowerProduction: number;
  PowerConsumed: number;
  PowerCapacity: number;
  PowerMaxConsumed: number;
  BatteryInput: number;
  BatteryOutput: number;
  BatteryDifferential: number;
  BatteryPercent: number;
  BatteryCapacity: number;
  BatteryTimeEmpty: string; // Estimated time until battery depleted
  BatteryTimeFull: string; // Estimated time until battery full
  FuseTriggered: boolean; // True if circuit has tripped
}
```

---

## Inventory

### `InventoryItem`

A single item stack in any inventory.

```typescript
interface InventoryItem {
  Name: string; // Display name (e.g., "Iron Plate")
  ClassName: string; // Internal class (e.g., "Desc_IronPlate_C")
  Amount: number;
  MaxAmount: number;
}
```

### `WorldInvItem`

Aggregated total across all storage containers (from `getWorldInv`).

### `StorageContainer`

Per-container storage (from `getStorageInv`). Includes location for map display.

```typescript
interface StorageContainer {
  ID: string;
  Name: string;
  ClassName: string;
  location: LocationData;
  Inventory: InventoryItem[];
  features?: Features;
}
```

### `CloudInvItem`

Dimensional Depot inventory item (from `getCloudInv`). Same shape as `InventoryItem`.

---

## Production

### `ProductionItem`

Per-building production output.

```typescript
interface ProductionItem {
  Name: string;
  ClassName: string;
  CurrentProd: number; // Current production rate
  MaxProd: number; // Maximum possible production rate
  ProdPercent: number; // Efficiency percentage
}
```

### `IngredientItem`

Per-building ingredient consumption.

```typescript
interface IngredientItem {
  Name: string;
  ClassName: string;
  CurrentConsumed: number;
  MaxConsumed: number;
  ConsPercent: number;
}
```

### `ProdStatItem`

Aggregated per-item production/consumption stats (from `getProdStats`).

```typescript
interface ProdStatItem {
  Name: string;
  ClassName: string;
  ProdPerMin: string;
  ProdPercent: number;
  ConsPercent: number;
  CurrentProd: number;
  MaxProd: number;
  CurrentConsumed: number;
  MaxConsumed: number;
}
```

### `ProdStatsResponse`

Wrapper for the `getProdStats` endpoint response.

```typescript
interface ProdStatsResponse {
  production: ProdStatItem[];
  consumption?: ProdStatItem[];
}
```

---

## Buildings

### `BuildableBase`

Base type shared by all placed buildings.

```typescript
interface BuildableBase {
  ID: string;
  Name: string;
  ClassName: string;
  location: LocationData;
  PowerInfo?: PowerInfo;
  features?: Features;
}
```

### `FactoryBuilding extends BuildableBase`

Manufacturing buildings (Assemblers, Constructors, Refineries, etc.).

```typescript
interface FactoryBuilding {
  Recipe: string; // Current recipe name
  RecipeClassName: string; // Internal recipe class
  production: ProductionItem[];
  ingredients: IngredientItem[];
  InputInventory: InventoryItem[];
  OutputInventory: InventoryItem[];
  Productivity: number; // Current productivity (0–100+)
  ManuSpeed: number; // Manufacturing speed multiplier
  Somersloops: number; // Number of Somersloops installed
  PowerShards: number; // Number of Power Shards installed
  IsConfigured: boolean; // Has a recipe set
  IsProducing: boolean; // Currently active
  IsPaused: boolean; // Paused (standby)
}
```

### `Generator extends BuildableBase`

Power generating buildings.

```typescript
interface Generator {
  CircuitID: number;
  BaseProd: number;
  DynamicProdCapacity: number;
  DynamicProdDemandFactor: number;
  RegulatedDemandProd: number;
  IsFullSpeed: boolean;
  CanStart: boolean;
  LoadPercentage: number;
  ProdPowerConsumption: number;
  CurrentPotential: number;
  ProductionCapacity: number;
  DefaultProductionCapacity: number;
  PowerProductionPotential: number;
  Somersloops: number;
  PowerShards: number;
  FuelAmount: number;
  FuelResource: string;
  AvailableFuel: InventoryItem[];
  FuelInventory: InventoryItem[];
  WasteInventory: InventoryItem[];
}
```

### `Extractor extends BuildableBase`

Resource extraction buildings (Miners, Oil Extractors, etc.).

```typescript
interface Extractor {
  Recipe: string;
  RecipeClassName: string;
  production: ProductionItem[];
  ManuSpeed: number;
  Somersloops: number;
  PowerShards: number;
  IsConfigured: boolean;
  IsProducing: boolean;
  IsPaused: boolean;
}
```

---

## Transport

### `Vehicle extends BuildableBase`

Ground vehicles (Explorers, Factory Carts, Trucks).

### `DroneStation extends BuildableBase`

Drone ports with paired station and fuel info.

```typescript
interface DroneStation {
  home_station?: string;
  paired_station?: string;
  fuel_name?: string;
  fuel_rate?: number;
  round_trip_seconds?: number;
}
```

### `TrainResponse`

Full train data including railcars, speed, and timetable.

```typescript
// Railcar cargo
interface Railcar {
  Name: string;
  ClassName: string;
  TotalMass: number;
  PayloadMass: number;
  MaxPayloadMass: number;
  Inventory: InventoryItem[];
}

// Complete train object
interface TrainResponse {
  ID: string;
  Name: string;
  ClassName: string;
  location: LocationData;
  TotalMass: number;
  ForwardSpeed: number; // km/h
  ThrottlePercent: number;
  TrainStation: string; // Current station name
  Derailed: boolean;
  Status: string;
  Path: string;
  TimeTable: any[];
  Vehicles: Railcar[];
}
```

### `TrainStation extends BuildableBase`

Train station with cargo, fuel, and coupled train info.

---

## Players & Chat

### `Player`

Basic player info and location.

```typescript
interface Player {
  Name: string;
  location: LocationData;
  ID: string;
}
```

### `ChatMessage`

In-game chat message.

```typescript
interface ChatMessage {
  Name: string; // Player name
  Message: string; // Message text
  Timestamp: number; // Unix ms
}
```

---

## Other

### `ResourceSinkData`

AWESOME Sink statistics.

```typescript
interface ResourceSinkData {
  ID: string;
  Name: string;
  ClassName: string;
  TotalPoints: number;
  PointsToCoupon: number;
  PercentToCoupon: number;
  CollectedCoupons: number;
  sink_type?: string;
}
```

---

## UI Types

### `DashboardTheme`

12 color properties for the customizable theme. Stored in localStorage as `frm-theme`.

```typescript
interface DashboardTheme {
  bgPrimary: string; // Main background
  bgSecondary: string; // Secondary surfaces
  bgCard: string; // Card/panel background
  borderColor: string; // Borders and dividers
  textPrimary: string; // Primary text
  textSecondary: string; // Secondary/muted text
  accent: string; // Primary accent (orange)
  accentHover: string; // Accent hover state
  success: string; // Success/positive (green)
  danger: string; // Danger/negative (red)
  info: string; // Info/neutral (blue)
  muted: string; // Muted/deemphasized
}
```

**`DEFAULT_THEME`** — dark theme with Ficsit orange accent (the default).

**`LIGHT_THEME`** — light theme with blue accent, used when `AppSettings.themeMode === 'light'`.

### `AppSettings`

Persistent UI preferences stored in localStorage as `frm-app-settings`.

```typescript
interface AppSettings {
  themeMode: "dark" | "light"; // Color mode (default: "dark")
  iconSize: "sm" | "md" | "lg"; // Production/Inventory card icon size
  activeTab: string; // Last active dashboard tab
  timeWindow: number; // Last selected time window (ms, 0 = live)
}
```

### `DEFAULT_SETTINGS`

```typescript
const DEFAULT_SETTINGS: AppSettings = {
  themeMode: "dark",
  iconSize: "md",
  activeTab: "power",
  timeWindow: 0,
};
```

### `EndpointCategory`

Union type for the 13 endpoint categories:

```typescript
type EndpointCategory =
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
```
