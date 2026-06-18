# Electron Integration

Statusfactory runs as an Electron desktop app. The Electron shell loads the Next.js static export and provides native OS integration plus ngrok tunnel sharing.

---

## Architecture

```
┌──────────────────────────────────────────┐
│              Electron Main Process        │
│  main.js                                  │
│  ├── BrowserWindow (1400×900)            │
│  ├── IPC handlers (tunnel:*)             │
│  └── nativeTheme (dark mode)             │
├──────────────────────────────────────────┤
│              Preload Bridge               │
│  preload.js                               │
│  └── contextBridge.exposeInMainWorld()   │
│      └── window.electronAPI              │
├──────────────────────────────────────────┤
│              Renderer Process             │
│  Next.js static export (out/index.html)  │
│  └── ConnectionBar.tsx (tunnel UI)       │
└──────────────────────────────────────────┘
```

---

## Main Process (`electron/main.js`)

### Window Creation

```javascript
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Statusfactory",
    webPreferences: {
      nodeIntegration: false, // Security: no Node in renderer
      contextIsolation: true, // Security: isolate preload scope
      preload: path.join(__dirname, "preload.js"),
    },
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0a",
  });
}
```

### Dev vs Production Loading

- **Dev mode** (`--dev` flag or `NODE_ENV=development`): Loads `http://localhost:3000` with retries (10 attempts, 1s apart). Opens DevTools.
- **Production mode:** Loads `../out/index.html` (Next.js static export).

### Dark Mode

- `nativeTheme.themeSource = "system"` — follows OS preference.
- On window load, injects `:root { color-scheme: dark; }` for CSS media query support.

### Icon Resolution

```javascript
function getIconPath() {
  // Dev: ../public/icon.png
  // Prod: ../out/icon.png (Next.js copies public/ into out/)
  const devIcon = path.join(__dirname, "../public/icon.png");
  const prodIcon = path.join(__dirname, "../out/icon.png");
  return fs.existsSync(devIcon) ? devIcon : prodIcon;
}
```

---

## ngrok Tunnel IPC

The Electron main process manages an ngrok tunnel process for sharing the FRM connection publicly.

### IPC Handlers

| Channel         | Direction       | Purpose                         |
| --------------- | --------------- | ------------------------------- |
| `tunnel:start`  | Renderer → Main | Start ngrok tunnel              |
| `tunnel:stop`   | Renderer → Main | Stop ngrok tunnel               |
| `tunnel:status` | Renderer → Main | Check tunnel state              |
| `tunnel:error`  | Main → Renderer | Error events from ngrok process |

### tunnel:start

```
Input:  (host: string, port: string, authtoken?: string)
Output: { ok: boolean, url?: string, error?: string }
```

1. Spawns ngrok as a child process or uses the npm package.
2. Captures stdout, regex-matches `Forwarding https://...` to extract the public URL.
3. 15-second timeout — if no URL found, returns `{ ok: false }`.
4. Stores `ngrokProcess` and `ngrokUrl` in module scope.

### tunnel:stop

```
Output: { ok: boolean, error?: string }
```

Kills the ngrok child process and cleans up module state.

### tunnel:status

```
Output: { active: boolean, url: string | null }
```

Returns current tunnel state without side effects.

---

## Preload Script (`electron/preload.js`)

Exposes a safe API surface to the renderer via `contextBridge`:

```javascript
contextBridge.exposeInMainWorld("electronAPI", {
  tunnelStart: (host, port, authtoken) =>
    ipcRenderer.invoke("tunnel:start", host, port, authtoken),
  tunnelStop: () => ipcRenderer.invoke("tunnel:stop"),
  tunnelStatus: () => ipcRenderer.invoke("tunnel:status"),
  onTunnelError: (callback) =>
    ipcRenderer.on("tunnel:error", (_event, msg) => callback(msg)),
});
```

**Security:** `nodeIntegration: false` + `contextIsolation: true` means the renderer has zero direct access to Node.js APIs. All system access goes through this narrow IPC bridge.

---

## Type Declarations (`src/lib/electron.d.ts`)

TypeScript declarations for the `window.electronAPI` surface:

```typescript
declare global {
  interface Window {
    electronAPI?: {
      tunnelStart: (
        host: string,
        port: string,
        authtoken?: string,
      ) => Promise<{ ok: boolean; url?: string; error?: string }>;
      tunnelStop: () => Promise<{ ok: boolean; error?: string }>;
      tunnelStatus: () => Promise<{ active: boolean; url: string | null }>;
      onTunnelError: (callback: (msg: string) => void) => void;
    };
  }
}
```

The `?` on `electronAPI` indicates it's only available in Electron — in browser mode, this property is `undefined`. `ConnectionBar` checks for its presence before showing the tunnel UI.

---

## Build Output

`electron-builder` packages the app:

```json
{
  "appId": "com.satisfactory.stats",
  "productName": "Statusfactory",
  "directories": { "output": "dist" },
  "files": ["out/**/*", "electron/**/*"],
  "win": { "target": "portable" },
  "linux": { "target": "AppImage", "category": "Utility" },
  "mac": { "target": "dmg" }
}
```

The `next build` static export goes to `out/`, then electron-builder bundles `out/**/*` + `electron/**/*` into platform executables.
