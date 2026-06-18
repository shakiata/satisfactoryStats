import { EndpointInfo, FRMConfig } from './types';

const ENDPOINTS: EndpointInfo[] = [
  // Power
  { path: 'getPower', category: 'power', description: 'All power circuits with production, consumption, and battery stats', requiresGameThread: false },
  { path: 'getPowerUsage', category: 'power', description: 'Per-building power usage across the factory', requiresGameThread: false },
  { path: 'getCables', category: 'power', description: 'All power cables/wires', requiresGameThread: false },
  { path: 'getSwitches', category: 'power', description: 'All power switches and their states', requiresGameThread: false },

  // Generators
  { path: 'getGenerators', category: 'generators', description: 'All power generating buildings (all types)', requiresGameThread: false },
  { path: 'getBiomassGenerator', category: 'generators', description: 'Biomass Burners', requiresGameThread: false },
  { path: 'getCoalGenerator', category: 'generators', description: 'Coal Generators', requiresGameThread: false },
  { path: 'getFuelGenerator', category: 'generators', description: 'Fuel Generators', requiresGameThread: false },
  { path: 'getNuclearGenerator', category: 'generators', description: 'Nuclear Power Plants', requiresGameThread: false },
  { path: 'getGeothermalGenerator', category: 'generators', description: 'Geothermal Generators', requiresGameThread: false },

  // Factory Buildings
  { path: 'getFactory', category: 'factory', description: 'All factory buildings (all types)', requiresGameThread: false },
  { path: 'getAssembler', category: 'factory', description: 'Assemblers', requiresGameThread: false },
  { path: 'getBlender', category: 'factory', description: 'Blenders', requiresGameThread: false },
  { path: 'getConstructor', category: 'factory', description: 'Constructors', requiresGameThread: false },
  { path: 'getConverter', category: 'factory', description: 'Converters', requiresGameThread: false },
  { path: 'getEncoder', category: 'factory', description: 'Quantum Encoders', requiresGameThread: false },
  { path: 'getFoundry', category: 'factory', description: 'Foundries', requiresGameThread: false },
  { path: 'getManufacturer', category: 'factory', description: 'Manufacturers', requiresGameThread: false },
  { path: 'getPackager', category: 'factory', description: 'Packagers', requiresGameThread: false },
  { path: 'getParticle', category: 'factory', description: 'Particle Accelerators', requiresGameThread: false },
  { path: 'getRefinery', category: 'factory', description: 'Refineries', requiresGameThread: false },
  { path: 'getSmelter', category: 'factory', description: 'Smelters', requiresGameThread: false },

  // Resources
  { path: 'getExtractor', category: 'resources', description: 'Miners and Extractors', requiresGameThread: false },
  { path: 'getFrackingActivator', category: 'resources', description: 'Fracking Activators / Resource Well Pressurizers', requiresGameThread: false },
  { path: 'getDropPod', category: 'resources', description: 'Drop Pods on the map', requiresGameThread: true },
  { path: 'getPowerSlug', category: 'resources', description: 'Power Slugs on the map', requiresGameThread: true },
  { path: 'getTapes', category: 'resources', description: 'Cassette Tapes on the map', requiresGameThread: false },

  // Logistics
  { path: 'getPump', category: 'logistics', description: 'Pipeline Pumps and Valves', requiresGameThread: false },
  { path: 'getPipes', category: 'logistics', description: 'All pipelines', requiresGameThread: false },
  { path: 'getPipeJunctions', category: 'logistics', description: 'Pipeline junctions', requiresGameThread: false },
  { path: 'getHypertube', category: 'logistics', description: 'Hypertubes', requiresGameThread: false },
  { path: 'getHyperEntrance', category: 'logistics', description: 'Hypertube Entrances', requiresGameThread: false },
  { path: 'getHyperJunctions', category: 'logistics', description: 'Hypertube Junctions', requiresGameThread: false },

  // Vehicles
  { path: 'getVehicles', category: 'vehicles', description: 'All vehicles', requiresGameThread: true },
  { path: 'getExplorer', category: 'vehicles', description: 'Explorers', requiresGameThread: true },
  { path: 'getFactoryCart', category: 'vehicles', description: 'Factory Carts', requiresGameThread: true },
  { path: 'getDrone', category: 'vehicles', description: 'All Drones', requiresGameThread: true },

  // Transport Stations
  { path: 'getDroneStation', category: 'transport', description: 'Drone Ports', requiresGameThread: false },
  { path: 'getTrainStation', category: 'transport', description: 'Train Stations', requiresGameThread: false },
  { path: 'getTrains', category: 'transport', description: 'All trains with railcars, speed, and timetable', requiresGameThread: false },
  { path: 'getTruckStation', category: 'transport', description: 'Truck Stations', requiresGameThread: false },

  // Support Buildings
  { path: 'getHubTerminal', category: 'support', description: 'HUB Terminal', requiresGameThread: true },
  { path: 'getTradingPost', category: 'support', description: 'Trading Post / Central HUB', requiresGameThread: false },
  { path: 'getSpaceElevator', category: 'support', description: 'Space Elevator', requiresGameThread: false },
  { path: 'getResourceSinkBuilding', category: 'support', description: 'AWESOME Sinks', requiresGameThread: false },
  { path: 'getElevators', category: 'support', description: 'Elevators', requiresGameThread: false },
  { path: 'getPortal', category: 'support', description: 'Portals', requiresGameThread: false },
  { path: 'getRadarTower', category: 'support', description: 'Radar Towers', requiresGameThread: false },

  // Session
  { path: 'getPlayer', category: 'session', description: 'Player information and location', requiresGameThread: true },
  { path: 'getModList', category: 'session', description: 'Installed mods list', requiresGameThread: false },
  { path: 'getMapMarkers', category: 'session', description: 'Map markers and stamps', requiresGameThread: false },
  { path: 'getProdStats', category: 'session', description: 'Production Stats (per-item production/consumption rates)', requiresGameThread: false },
  { path: 'getExplorationSink', category: 'session', description: 'Exploration sink statistics', requiresGameThread: false },

  // Inventory
  { path: 'getWorldInv', category: 'inventory', description: 'Total aggregated inventory across all storage containers', requiresGameThread: false },
  { path: 'getStorageInv', category: 'inventory', description: 'Storage container inventories (per container)', requiresGameThread: false },
  { path: 'getCloudInv', category: 'inventory', description: 'Dimensional Depot (cloud) inventory', requiresGameThread: false },
  { path: 'getCrateInv', category: 'inventory', description: 'Crate inventories', requiresGameThread: true },

  // Research
  { path: 'getRecipes', category: 'research', description: 'All recipes', requiresGameThread: true },
  { path: 'getSchematics', category: 'research', description: 'All schematics/milestones', requiresGameThread: true },
  { path: 'getArtifacts', category: 'research', description: 'Artifacts (Mercer Spheres, Somersloops)', requiresGameThread: true },

  // Events & Creatures
  { path: 'getFallingGiftBundles', category: 'events', description: 'FICSMAS gift bundles', requiresGameThread: true },
  { path: 'getCreatures', category: 'creatures', description: 'Creatures on the map', requiresGameThread: false },
];

/** Returns the full list of FRM API endpoints with metadata. */
export function getEndpoints(): EndpointInfo[] {
  return ENDPOINTS;
}

/** Returns endpoints grouped by category as a Map. */
export function getEndpointsByCategory(): Map<string, EndpointInfo[]> {
  const map = new Map<string, EndpointInfo[]>();
  for (const ep of ENDPOINTS) {
    const existing = map.get(ep.category) || [];
    existing.push(ep);
    map.set(ep.category, existing);
  }
  return map;
}

export function buildUrl(config: FRMConfig, endpoint: string): string {
  let host = (config.host || 'localhost').trim();
  // Strip any scheme the user may have pasted (https://, http://)
  host = host.replace(/^https?:\/\//, '');
  // Strip trailing slashes
  host = host.replace(/\/+$/, '');
  // Strip port if embedded in host (user pasted host:8080)
  host = host.replace(/:\d+$/, '');
  
  const port = config.port || '8080';
  // Auto-detect HTTPS for domain names (ngrok, Cloudflare Tunnel, reverse proxies, etc.)
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
  const scheme = isLocal ? 'http' : 'https';
  // Only append port for local connections — domain-based tunnels handle port mapping themselves
  const portPart = isLocal && port !== '80' && port !== '443' && port !== '' ? `:${port}` : '';
  return `${scheme}://${host}${portPart}/${endpoint}`;
}

/**
 * Fetches data from an FRM endpoint with auth headers.
 * Throws on non-OK responses. Generic T allows typed callers.
 */
export async function fetchEndpoint<T = unknown>(config: FRMConfig, endpoint: string): Promise<T> {
  const url = buildUrl(config, endpoint);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.password) {
    headers['X-FRM-Authorization'] = config.password;
  }
  // Bypass ngrok's browser warning interstitial for free-tier tunnels
  if (config.host?.includes('.ngrok')) {
    headers['ngrok-skip-browser-warning'] = '1';
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`FRM API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/** Tests connectivity to the FRM server by hitting the health endpoint. */
export async function testConnection(config: FRMConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    await fetchEndpoint(config, 'getPower');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/** Sends a chat message to the FRM server for in-game delivery. */
export async function sendChatMessage(config: FRMConfig, message: string): Promise<void> {
  const url = buildUrl(config, 'sendChatMessage');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (config.password) {
    headers['X-FRM-Authorization'] = config.password;
  }
  // Bypass ngrok's browser warning interstitial for free-tier tunnels
  if (config.host?.includes('.ngrok')) {
    headers['ngrok-skip-browser-warning'] = '1';
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    throw new Error(`Chat send failed: ${response.status} ${response.statusText}`);
  }
}
