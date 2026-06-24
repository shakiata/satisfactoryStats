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
 * Checks whether the ngrok npm package's bundled binary exists and is a
 * valid executable.  On Unix, verifies execute permission and attempts
 * chmod +x if missing.  On all platforms, reads the first 4 bytes to
 * confirm the file is a real binary (ELF / Mach-O / PE), not a text file
 * left behind by a failed postinstall download.
 * Returns the resolved binary path on success, or null if unusable.
 */
function ensureNgrokNpmBinary() {
  try {
    const platform = os.platform();
    const binName = platform === "win32" ? "ngrok.exe" : "ngrok";

    // In packaged builds, use extraResources (resources/ngrok/)
    // In dev, use node_modules/ngrok/bin/
    let binPath;
    if (app.isPackaged) {
      binPath = path.join(process.resourcesPath, "ngrok", binName);
    } else {
      const binDir = path.join(__dirname, "..", "node_modules", "ngrok", "bin");
      binPath = path.join(binDir, binName);
    }

    if (!fs.existsSync(binPath)) {
      console.error("[tunnel] ngrok binary not found at:", binPath);
      return null;
    }

    // On Unix, ensure the binary is executable
    if (platform !== "win32") {
      try {
        fs.accessSync(binPath, fs.constants.X_OK);
      } catch (_permErr) {
        try {
          fs.chmodSync(binPath, 0o755);
        } catch (_chmodErr) {
          return null;
        }
      }
    }

    // Verify it's a real executable, not a text error page
    const fd = fs.openSync(binPath, "r");
    const magic = Buffer.alloc(4);
    fs.readSync(fd, magic, 0, 4, 0);
    fs.closeSync(fd);

    const isElf =
      magic[0] === 0x7f &&
      magic[1] === 0x45 &&
      magic[2] === 0x4c &&
      magic[3] === 0x46;
    const isMacho =
      (magic[0] === 0xcf && magic[1] === 0xfa) ||
      (magic[0] === 0xfe && magic[1] === 0xed);
    const isPE = magic[0] === 0x4d && magic[1] === 0x5a;
    const looksLikeText = magic[0] === 0x3c || magic[0] === 0x7b;

    if (looksLikeText || (!isElf && !isMacho && !isPE)) {
      console.error(
        "[tunnel] ngrok binary does not look like a valid executable (magic:",
        magic.toString("hex"),
        ")",
      );
      return null;
    }

    return binPath;
  } catch (_err) {
    return null;
  }
}

/** Starts an ngrok tunnel to expose the FRM server. Tries npm package first, falls back to CLI. */
ipcMain.handle("tunnel:start", async (_event, host, port, authtoken) => {
  console.log("[tunnel] tunnel:start invoked", {
    host,
    port,
    authtoken: authtoken ? "***" : undefined,
  });
  try {
    // Kill any existing tunnel process (both npm and CLI paths)
    try {
      const ngrok = require("ngrok");
      await ngrok.disconnect();
      await ngrok.kill();
    } catch (_) {
      // may not be connected — ignore
    }
    if (ngrokProcess) {
      const platform = os.platform();
      if (platform === "win32") {
        try {
          ngrokProcess.kill("SIGTERM");
        } catch (_) {
          /* Windows */
        }
        require("child_process").exec(
          `taskkill /pid ${ngrokProcess.pid} /f /t`,
          () => {},
        );
      } else {
        ngrokProcess.kill("SIGTERM");
      }
      ngrokProcess = null;
      ngrokUrl = null;
    }

    const targetHost = host || "localhost";
    const targetPort = port || "8080";
    const addr = `${targetHost}:${targetPort}`;

    // Pre-flight: check npm binary before attempting require("ngrok")
    const npmBinOk = ensureNgrokNpmBinary();

    // Try the ngrok npm package first, fall back to CLI.
    // The ngrok package's internal spawn() lacks an 'error' listener,
    // so a corrupted binary causes an uncaught exception that escapes
    // the promise chain.  We install a temporary safety-net handler.
    let url;
    if (npmBinOk) {
      let uncaughtFired = null;
      const uncaughtHandler = (err) => {
        uncaughtFired = err;
      };
      process.on("uncaughtException", uncaughtHandler);

      try {
        const ngrok = require("ngrok");
        const opts = {
          addr,
          request_header_add: ["ngrok-skip-browser-warning:1"],
        };
        if (authtoken) opts.authtoken = authtoken;
        if (app.isPackaged) {
          opts.binPath = () => path.join(process.resourcesPath, "ngrok");
        }
        url = await ngrok.connect(opts);
        ngrokUrl = url;
      } catch (npmErr) {
        console.error(
          "ngrok npm package failed:",
          npmErr.message || String(npmErr),
        );
        url = null;
      } finally {
        process.removeListener("uncaughtException", uncaughtHandler);
        if (uncaughtFired) {
          console.error(
            "ngrok npm package threw uncaught exception:",
            uncaughtFired.message || uncaughtFired,
          );
          url = null;
        }
      }
    }

    // CLI fallback — spawn the system ngrok binary
    if (!url) {
      const { spawn } = require("child_process");
      const args = [
        "http",
        addr,
        "--log=stdout",
        "--request-header-add",
        "ngrok-skip-browser-warning:1",
      ];
      if (authtoken) args.push("--authtoken", authtoken);

      ngrokProcess = spawn("ngrok", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Parse the URL from stdout
      url = await new Promise((resolve, reject) => {
        const installHint = getNgrokInstallHint();
        const timeout = setTimeout(() => {
          reject(new Error(`ngrok timed out after 15s. ${installHint}`));
        }, 15000);

        let output = "";
        ngrokProcess.stdout.on("data", (data) => {
          output += data.toString();
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
          const hint =
            err.code === "ENOENT"
              ? `ngrok binary not found. ${installHint}`
              : `ngrok failed to start: ${err.message}`;
          reject(new Error(hint));
        });

        ngrokProcess.on("exit", (code) => {
          if (code !== 0 && code !== null) {
            clearTimeout(timeout);
            reject(new Error(`ngrok exited with code ${code}`));
          }
        });
      });
      ngrokUrl = url;
    }

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
    try {
      const ngrok = require("ngrok");
      await ngrok.disconnect();
      await ngrok.kill();
    } catch (_) {
      /* npm package not available */
    }

    if (ngrokProcess) {
      const platform = os.platform();
      if (platform === "win32") {
        try {
          ngrokProcess.kill("SIGTERM");
        } catch (_) {
          /* Windows */
        }
        require("child_process").exec(
          `taskkill /pid ${ngrokProcess.pid} /f /t`,
          () => {},
        );
      } else {
        ngrokProcess.kill("SIGTERM");
      }
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
    const platform = os.platform();
    if (platform === "win32") {
      try {
        ngrokProcess.kill("SIGTERM");
      } catch (_) {
        /* Windows */
      }
      require("child_process").exec(
        `taskkill /pid ${ngrokProcess.pid} /f /t`,
        () => {},
      );
    } else {
      ngrokProcess.kill("SIGTERM");
    }
    ngrokProcess = null;
  }
  try {
    const ngrok = require("ngrok");
    ngrok.disconnect().catch(() => {});
    ngrok.kill().catch(() => {});
  } catch (_) {}

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
