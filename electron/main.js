const { app, BrowserWindow, nativeTheme, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

// Follow the OS dark/light mode preference
nativeTheme.themeSource = "system";

let mainWindow;
let ngrokProcess = null;
let ngrokUrl = null;

/** Resolves the app icon path for Electron, handling dev vs packaged paths. */
function getIconPath() {
  // In dev: electron/ → ../public/icon.png
  // In packaged asar: electron/ → ../out/icon.png (Next.js copies public/ into out/)
  const devIcon = path.join(__dirname, "../public/icon.png");
  const prodIcon = path.join(__dirname, "../out/icon.png");
  return fs.existsSync(devIcon) ? devIcon : prodIcon;
}

/** Creates the main BrowserWindow with secure defaults (contextIsolation on). */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Statusfactory",
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0a",
  });

  const isDev =
    process.env.NODE_ENV === "development" || process.argv.includes("--dev");

  if (isDev) {
    const devUrl = "http://localhost:3000";
    const loadDev = (retries = 10) => {
      mainWindow.loadURL(devUrl).catch(() => {
        if (retries > 0) {
          setTimeout(() => loadDev(retries - 1), 1000);
        }
      });
    };
    loadDev();
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, "../out/index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Inject dark color-scheme meta tag so CSS media queries and browser chrome follow dark mode
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.insertCSS(`
      :root { color-scheme: dark; }
    `);
  });
}

app.whenReady().then(createWindow);

// ─── ngrok Tunnel IPC ───────────────────────────────────────────

const os = require("os");

/**
 * Returns platform-specific ngrok install instructions for error messages.
 * Covers Linux (snap/direct), macOS (brew), and Windows (choco/winget).
 */
function getNgrokInstallHint() {
  const platform = os.platform();
  if (platform === "linux") {
    return "Install ngrok: sudo snap install ngrok  or download from https://ngrok.com/download";
  }
  if (platform === "darwin") {
    return "Install ngrok: brew install ngrok";
  }
  if (platform === "win32") {
    return "Install ngrok: choco install ngrok  or  winget install ngrok";
  }
  return "Download ngrok from https://ngrok.com/download";
}

/**
 * Resolves the path to the ngrok binary, handling dev vs packaged modes.
 * In dev: node_modules/ngrok/bin/ngrok (or .exe on Windows)
 * In packaged: app.asar.unpacked/node_modules/ngrok/bin/ngrok (or .exe)
 * Falls back to "ngrok" on PATH if neither is found.
 */
function resolveNgrokBinary() {
  const platform = os.platform();
  const binName = platform === "win32" ? "ngrok.exe" : "ngrok";

  if (app.isPackaged) {
    const unpackedPath = path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      "ngrok",
      "bin",
      binName,
    );
    console.log("[tunnel] checking unpacked binary:", unpackedPath);
    if (fs.existsSync(unpackedPath)) return unpackedPath;
  }

  // Dev mode: resolve from electron/main.js → ../node_modules/ngrok/bin/
  const devBinDir = path.join(__dirname, "..", "node_modules", "ngrok", "bin");
  const devPath = path.join(devBinDir, binName);
  console.log("[tunnel] checking dev binary:", devPath);
  if (fs.existsSync(devPath)) return devPath;

  // Last resort: try system ngrok on PATH
  console.log("[tunnel] no bundled binary, falling back to system ngrok");
  return "ngrok";
}

/** Starts an ngrok tunnel to expose the FRM server. */
ipcMain.handle("tunnel:start", async (_event, host, port, authtoken) => {
  console.log("[tunnel] tunnel:start invoked", {
    host,
    port,
    authtoken: authtoken ? "***" : undefined,
  });
  try {
    // Kill any existing tunnel process
    if (ngrokProcess) {
      ngrokProcess.kill("SIGTERM");
      ngrokProcess = null;
      ngrokUrl = null;
    }

    const targetHost = host || "localhost";
    const targetPort = port || "8080";
    const addr = `${targetHost}:${targetPort}`;

    const ngrokBin = resolveNgrokBinary();
    const { spawn } = require("child_process");
    const args = [
      "http",
      addr,
      "--log=stdout",
      "--request-header-add",
      "ngrok-skip-browser-warning:1",
    ];
    if (authtoken) args.push("--authtoken", authtoken);

    console.log(
      "[tunnel] spawning:",
      ngrokBin,
      args.filter((a) => a !== authtoken),
    );
    ngrokProcess = spawn(ngrokBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Parse the URL from stdout
    const url = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("ngrok timed out after 15s"));
      }, 15000);

      let output = "";
      ngrokProcess.stdout.on("data", (data) => {
        output += data.toString();
        // ngrok v3 prints: Forwarding  https://abc123.ngrok-free.app -> http://localhost:8080
        const fwd = output.match(
          /Forwarding\s+(https?:\/\/[^\s]+\.ngrok[^\s]+)/i,
        );
        if (fwd) {
          clearTimeout(timeout);
          resolve(fwd[1].replace(/,$/, ""));
        }
      });

      ngrokProcess.stderr.on("data", (data) => {
        output += data.toString();
      });

      ngrokProcess.on("error", (err) => {
        clearTimeout(timeout);
        reject(
          new Error(
            err.code === "ENOENT"
              ? `ngrok binary not found. ${getNgrokInstallHint()}`
              : `ngrok failed to start: ${err.message}`,
          ),
        );
      });

      ngrokProcess.on("exit", (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(`ngrok exited with code ${code}`));
        }
      });
    });

    ngrokUrl = url;
    console.log("[tunnel] tunnel:start success, url:", url);
    return { ok: true, url };
  } catch (err) {
    console.error("[tunnel] tunnel:start failed:", err.message);
    ngrokUrl = null;
    ngrokProcess = null;
    return { ok: false, error: err.message };
  }
});

/** Stops any active ngrok tunnel and cleans up the process. */
ipcMain.handle("tunnel:stop", async () => {
  try {
    if (ngrokProcess) {
      ngrokProcess.kill("SIGTERM");
      ngrokProcess = null;
    }
    ngrokUrl = null;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/** Returns the current tunnel status: whether active and the public URL if so. */
ipcMain.handle("tunnel:status", async () => {
  return { active: !!ngrokUrl, url: ngrokUrl };
});

// ─── End ngrok IPC ───────────────────────────────────────────────

app.on("window-all-closed", () => {
  // Clean up ngrok on exit
  if (ngrokProcess) {
    ngrokProcess.kill("SIGTERM");
    ngrokProcess = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
