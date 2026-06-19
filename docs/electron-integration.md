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

## Troubleshooting ngrok

If the Share button produces an "ngrok binary not found" or "ENOENT" error:

### The npm package binary is missing or not executable

The ngrok npm package bundles a platform-specific binary at
`node_modules/ngrok/bin/ngrok` (or `.exe` on Windows).  The app now
pre-flights this path before attempting a connection.  If the file exists
but lacks execute permission (common on Linux/WSL after `npm install`),
the app attempts `chmod +x` automatically.

**Manual fix if auto-chmod fails:**
```bash
chmod +x node_modules/ngrok/bin/ngrok
```

**If the binary is missing entirely:**
```bash
npm rebuild ngrok
# or reinstall:
npm install ngrok@5.0.0-beta.2
```

### The system ngrok CLI is not installed (CLI fallback)

When the npm package fails, the app falls back to spawning `ngrok` from
your system PATH.  Install it via your platform's package manager:

| Platform | Command |
|----------|---------|
| **Linux** (including WSL) | `sudo snap install ngrok` |
| **macOS** | `brew install ngrok` |
| **Windows** | `choco install ngrok` or `winget install ngrok` |
| **Manual** | Download from https://ngrok.com/download |

After installing, verify with `ngrok version`.

### Common error messages

| Error | Meaning | Resolution |
|-------|---------|------------|
| `ngrok binary not found. Install ngrok: ...` | Neither the npm binary nor the system CLI is available | Install ngrok CLI (see table above) |
| `ngrok timed out after 15s` | ngrok started but didn't report a URL in time | Check your network/firewall; try again |
| `ngrok exited with code N` | ngrok process crashed | Check `~/.ngrok2/ngrok.log` for details |

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
