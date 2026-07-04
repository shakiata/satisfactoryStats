# Electron Integration

This sequence diagram covers the Electron desktop shell lifecycle: main process startup, BrowserWindow creation, Next.js loading (dev vs production), the `contextBridge` IPC channel for ngrok tunnel management, and tunnel start/stop/status flows.

```mermaid
sequenceDiagram
    actor User
    participant CLI as Terminal
    participant Main as electron/main.js
    participant BW as BrowserWindow
    participant Preload as electron/preload.js
    participant Next as Next.js App
    participant ConnBar as ConnectionBar
    participant NgrokPkg as ngrok npm package
    participant NgrokCLI as ngrok CLI (fallback)
    participant Tunnel as ngrok Cloud

    Note over User,Tunnel: ═══ APP STARTUP ═══

    User->>CLI: npm run electron:dev
    CLI->>CLI: concurrently: next dev + wait-on + electron .

    Main->>Main: app.whenReady()
    Main->>Main: getIconPath()
    Note over Main: Dev: public/icon.png<br/>Prod: out/icon.png

    Main->>BW: new BrowserWindow({1400×900})
    Note over Main: nodeIntegration: false<br/>contextIsolation: true<br/>preload: preload.js<br/>autoHideMenuBar: true<br/>backgroundColor: #0a0a0a

    Main->>Preload: Load preload script

    Preload->>Preload: contextBridge.exposeInMainWorld for electronAPI
    Note over Preload: Exposes:<br/>tunnelStart(host, port, authtoken)<br/>tunnelStop()<br/>tunnelStatus()

    alt Development Mode (--dev flag)
        Main->>BW: loadURL('http://localhost:3000')
        Note over Main: Retry up to 10 times<br/>with 1s delay
        Main->>BW: webContents.openDevTools()
    else Production Mode
        Main->>BW: loadFile('out/index.html')
    end

    BW->>BW: did-finish-load event
    BW->>BW: Apply dark color scheme via insertCSS
    Next->>Next: page.tsx renders
    Next->>ConnBar: isElectron = !!window.electronAPI

    Note over User,Tunnel: ═══ NGROK TUNNEL STARTUP ═══

    ConnBar->>Preload: window.electronAPI.tunnelStatus()
    Preload->>Main: ipcRenderer.invoke('tunnel:status')
    Main-->>Preload: { active: false, url: null }
    Preload-->>ConnBar: { active: false, url: null }

    User->>ConnBar: Click "Start Tunnel"
    ConnBar->>Preload: window.electronAPI.tunnelStart(host, port, authtoken)
    Preload->>Main: ipcRenderer.invoke('tunnel:start', host, port, authtoken)

    Main->>Main: Kill any existing tunnel process
    Main->>Main: ensureNgrokNpmBinary()
    Note over Main: Checks bin path (dev vs packaged)<br/>Verifies execute permission<br/>Validates ELF/Mach-O/PE magic bytes

    alt npm binary valid
        Main->>Main: Install uncaughtException safety net
        Main->>NgrokPkg: ngrok.connect({ addr, authtoken })
        NgrokPkg->>Tunnel: Establish tunnel to host:port
        Tunnel-->>NgrokPkg: Public URL
        NgrokPkg-->>Main: url
        Main->>Main: Remove uncaughtException handler
    else npm binary invalid or fails
        Main->>NgrokCLI: spawn('ngrok', ['http', addr, ...])
        Note over Main: Falls back to system ngrok CLI<br/>Parses URL from stdout<br/>60s timeout
        NgrokCLI->>Tunnel: Establish tunnel
        Tunnel-->>NgrokCLI: Public URL
        NgrokCLI-->>Main: url (parsed from stdout)
    end

    Main-->>Preload: { ok: true, url }
    Preload-->>ConnBar: { ok: true, url }
    ConnBar->>ConnBar: setTunnelUrl(url)
    Note over ConnBar: Shows URL + Copy button

    Note over User,Tunnel: ═══ TUNNEL SHARING ═══

    User->>ConnBar: Click Copy URL
    ConnBar->>ConnBar: navigator.clipboard.writeText(url)
    ConnBar->>ConnBar: setCopied(true) → timeout 2s → false

    Note over User,Tunnel: ═══ TUNNEL TEARDOWN ═══

    User->>ConnBar: Click "Stop Tunnel"
    ConnBar->>Preload: window.electronAPI.tunnelStop()
    Preload->>Main: ipcRenderer.invoke('tunnel:stop')
    Main->>NgrokPkg: ngrok.disconnect() + ngrok.kill()
    Main->>NgrokCLI: ngrokProcess.kill('SIGTERM')
    Main-->>Preload: { ok: true }
    Preload-->>ConnBar: { ok: true }
    ConnBar->>ConnBar: setTunnelUrl(null)

    Note over User,Tunnel: ═══ APP SHUTDOWN ═══

    User->>BW: Close window
    BW->>Main: 'closed' event
    Main->>Main: mainWindow = null
    Note over Main: App quits when all windows closed<br/>(default Electron behavior)
```
