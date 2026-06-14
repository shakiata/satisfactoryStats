export interface FRMConfig {
  host: string;
  port: string;
  password?: string;
  refreshRate: number;
}

export interface LocationData {
  x: number;
  y: number;
  z: number;
  rotation?: number;
}

export interface PowerInfo {
  CircuitGroupID: number;
  CircuitID: number;
  PowerConsumed: number;
  MaxPowerConsumed: number;
}

export interface InventoryItem {
  Name: string;
  ClassName: string;
  Amount: number;
  MaxAmount: number;
}

/** Aggregated world inventory item — total across all storage (from getWorldInv) */
export interface WorldInvItem {
  Name: string;
  ClassName: string;
  Amount: number;
  MaxAmount: number;
}

/** Per-container storage inventory (from getStorageInv) */
export interface StorageContainer {
  ID: string;
  Name: string;
  ClassName: string;
  location: LocationData;
  Inventory: InventoryItem[];
  features?: Features;
}

/** Cloud / Dimensional Depot inventory item (from getCloudInv) */
export interface CloudInvItem {
  Name: string;
  ClassName: string;
  Amount: number;
  MaxAmount: number;
}

export interface ProductionItem {
  Name: string;
  ClassName: string;
  CurrentProd: number;
  MaxProd: number;
  ProdPercent: number;
}

export interface IngredientItem {
  Name: string;
  ClassName: string;
  CurrentConsumed: number;
  MaxConsumed: number;
  ConsPercent: number;
}

export interface Features {
  properties: {
    name: string;
    type: string;
  };
  geometry: {
    coordinates: {
      x: number;
      y: number;
      z: number;
    };
    type: string;
  };
}

export interface BuildableBase {
  ID: string;
  Name: string;
  ClassName: string;
  location: LocationData;
  PowerInfo?: PowerInfo;
  features?: Features;
}

export interface FactoryBuilding extends BuildableBase {
  Recipe: string;
  RecipeClassName: string;
  production: ProductionItem[];
  ingredients: IngredientItem[];
  InputInventory: InventoryItem[];
  OutputInventory: InventoryItem[];
  Productivity: number;
  ManuSpeed: number;
  Somersloops: number;
  PowerShards: number;
  IsConfigured: boolean;
  IsProducing: boolean;
  IsPaused: boolean;
}

export interface PowerCircuit {
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
  BatteryTimeEmpty: string;
  BatteryTimeFull: string;
  FuseTriggered: boolean;
}

export interface Generator extends BuildableBase {
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

export interface Extractor extends BuildableBase {
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

export interface ProdStatItem {
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

export interface Vehicle extends BuildableBase {
  vehicle_type?: string;
  fuel_type?: string;
  path_name?: string;
}

export interface DroneStation extends BuildableBase {
  home_station?: string;
  paired_station?: string;
  fuel_name?: string;
  fuel_rate?: number;
  round_trip_seconds?: number;
}

export interface Player {
  Name: string;
  location: LocationData;
  ID: string;
}

export interface ChatMessage {
  Name: string;
  Message: string;
  Timestamp: number;
}

export interface ProdStatsResponse {
  production: ProdStatItem[];
  consumption?: ProdStatItem[];
}

export interface ResourceSinkData {
  ID: string;
  Name: string;
  ClassName: string;
  TotalPoints: number;
  PointsToCoupon: number;
  PercentToCoupon: number;
  CollectedCoupons: number;
  sink_type?: string;
}

export interface DashboardTheme {
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentHover: string;
  success: string;
  danger: string;
  info: string;
  muted: string;
}

export const DEFAULT_THEME: DashboardTheme = {
  bgPrimary: '#0a0a0a',
  bgSecondary: '#141414',
  bgCard: '#1a1a1e',
  borderColor: '#2a2a2e',
  textPrimary: '#f0f0f0',
  textSecondary: '#a0a0a0',
  accent: '#e6a720',
  accentHover: '#f4c542',
  success: '#2ecc71',
  danger: '#e74c3c',
  info: '#3498db',
  muted: '#606060',
};

export interface PlayerData {
  ID: string;
  Name: string;
  ClassName: string;
  location: LocationData;
  health?: number;
  maxHealth?: number;
  isOnline?: boolean;
}

export interface RecipeData {
  ID: string;
  Name: string;
  ClassName: string;
  Category: string;
  Ingredients: Array<InventoryItem & { ManualRate: number; FactoryRate: number }>;
  Products: Array<InventoryItem & { ManualRate: number; FactoryRate: number }>;
  ManualDuration: number;
  FactoryDuration: number;
}

export type EndpointCategory =
  | 'power'
  | 'generators'
  | 'factory'
  | 'resources'
  | 'logistics'
  | 'vehicles'
  | 'transport'
  | 'support'
  | 'session'
  | 'inventory'
  | 'research'
  | 'events'
  | 'creatures';

export interface EndpointInfo {
  path: string;
  category: EndpointCategory;
  description: string;
  requiresGameThread: boolean;
}
