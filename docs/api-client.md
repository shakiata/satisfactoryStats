# API Client

`src/lib/api.ts` is the sole interface to the Ficsit Remote Monitoring (FRM) REST API. It handles URL construction, authentication headers, response parsing, and ngrok compatibility.

---

## Exports

### `ENDPOINTS: EndpointInfo[]`

Registry of all 80+ FRM API endpoints. Each entry has:

```typescript
interface EndpointInfo {
  path: string; // API path (e.g., "getPower")
  category: EndpointCategory; // Grouping for UI filtering
  description: string; // Human-readable summary
  requiresGameThread: boolean; // Whether endpoint uses the game thread (performance consideration)
}
```

**Categories (13 total):**

| Category     | Count | Example endpoints                                                                                                                                                                      |
| ------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `power`      | 4     | `getPower`, `getPowerUsage`, `getCables`, `getSwitches`                                                                                                                                |
| `generators` | 6     | `getGenerators`, `getBiomassGenerator`, `getCoalGenerator`, `getFuelGenerator`, `getNuclearGenerator`, `getGeothermalGenerator`                                                        |
| `factory`    | 12    | `getFactory`, `getAssembler`, `getBlender`, `getConstructor`, `getConverter`, `getEncoder`, `getFoundry`, `getManufacturer`, `getPackager`, `getParticle`, `getRefinery`, `getSmelter` |
| `resources`  | 5     | `getExtractor`, `getFrackingActivator`, `getDropPod`, `getPowerSlug`, `getTapes`                                                                                                       |
| `logistics`  | 6     | `getPump`, `getPipes`, `getPipeJunctions`, `getHypertube`, `getHyperEntrance`, `getHyperJunctions`                                                                                     |
| `vehicles`   | 4     | `getVehicles`, `getExplorer`, `getFactoryCart`, `getDrone`                                                                                                                             |
| `transport`  | 4     | `getDroneStation`, `getTrainStation`, `getTrains`, `getTruckStation`                                                                                                                   |
| `support`    | 7     | `getHubTerminal`, `getTradingPost`, `getSpaceElevator`, `getResourceSinkBuilding`, `getElevators`, `getPortal`, `getRadarTower`                                                        |
| `session`    | 5     | `getPlayer`, `getModList`, `getMapMarkers`, `getProdStats`, `getExplorationSink`                                                                                                       |
| `inventory`  | 4     | `getWorldInv`, `getStorageInv`, `getCloudInv`, `getCrateInv`                                                                                                                           |
| `research`   | 3     | `getRecipes`, `getSchematics`, `getArtifacts`                                                                                                                                          |
| `events`     | 1     | `getFallingGiftBundles`                                                                                                                                                                |
| `creatures`  | 1     | `getCreatures`                                                                                                                                                                         |

---

### `getEndpoints(): EndpointInfo[]`

Returns the full flat array of all endpoints. Used by the API Explorer tab.

---

### `getEndpointsByCategory(): Map<string, EndpointInfo[]>`

Groups endpoints into a `Map<category, EndpointInfo[]>`. Used by `EndpointList` to render category-filtered views.

---

### `buildUrl(config: FRMConfig, endpoint: string): string`

Constructs a full URL for an FRM API call. **Auto-detects scheme** based on host type:

| Host pattern                                           | Scheme  | Port handling                         |
| ------------------------------------------------------ | ------- | ------------------------------------- |
| `localhost`, `127.0.0.1`, `192.168.*`, `10.*`, `172.*` | `http`  | Appends `:port`                       |
| Domain name (ngrok, Cloudflare, etc.)                  | `https` | Port omitted (tunnel handles mapping) |

**Input sanitization:**

- Strips `http://` or `https://` scheme if user pastes one
- Strips trailing slashes
- Strips embedded port (e.g., `host:8080` → `host`)
- Falls back to `localhost` and `8080` if config values are empty

**Example outputs:**

```
buildUrl({ host: 'localhost', port: '8080' }, 'getPower')
→ "http://localhost:8080/getPower"

buildUrl({ host: 'abc.ngrok-free.app', port: '8080' }, 'getPower')
→ "https://abc.ngrok-free.app/getPower"
```

---

### `fetchEndpoint<T>(config: FRMConfig, endpoint: string): Promise<T>`

Generic fetcher for any FRM endpoint. Returns the parsed JSON response.

**Headers set:**

- `Accept: application/json`
- `X-FRM-Authorization: <password>` — only if `config.password` is set
- `ngrok-skip-browser-warning: 1` — only if host contains `.ngrok` (bypasses free-tier interstitial)

**Error handling:** Throws `Error` with HTTP status on non-OK responses (`!response.ok`).

**Usage:**

```typescript
const circuits: PowerCircuit[] = await fetchEndpoint(config, "getPower");
```

---

### `testConnection(config: FRMConfig): Promise<{ ok: boolean; error?: string }>`

Tests connectivity by fetching `getPower`. Wraps `fetchEndpoint` in try/catch.

- **Success:** `{ ok: true }`
- **Failure:** `{ ok: false, error: "<message>" }`

Used by `ConnectionBar` when the user clicks Connect.

---

### `sendChatMessage(config: FRMConfig, message: string): Promise<void>`

Sends a chat message into the game via `POST /sendChatMessage`.

**Request:**

- Method: `POST`
- Content-Type: `application/json`
- Body: `{ "message": "<text>" }`
- Same auth + ngrok headers as `fetchEndpoint`

**Error handling:** Throws on non-OK response.

---

## Dependencies

- `FRMConfig` from `types.ts` — host, port, password, refreshRate
- `EndpointInfo` from `types.ts` — endpoint metadata type
- Browser `fetch` API (available in both Next.js and Electron renderer)
