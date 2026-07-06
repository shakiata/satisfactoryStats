# Getting Started

## Prerequisites

- **Node.js** 18 or later
- **npm** (bundled with Node.js)
- **Satisfactory** with the [Ficsit Remote Monitoring (FRM)](https://ficsit.app/mod/FRM) mod installed
- **ngrok authtoken** (free account) — only needed for the "Share" tunnel feature in Electron

---

## Quick Start (Browser)

```bash
# Clone and install
git clone <repo-url>
cd satisfactoryStats
npm install

# Start Next.js dev server
npm run dev
```

Open `http://localhost:3000` in your browser. Enter your FRM credentials (default: host `localhost`, port `8080`) and click Connect.

---

## Quick Start (Electron Desktop App)

```bash
npm install
npm run electron:dev
```

This launches the Electron window loading the Next.js dev server. The app title bar shows "Statusfactory."

---

## FRM Configuration

The FRM mod exposes a REST API on the game machine. Defaults:

| Setting      | Default     | Notes                                       |
| ------------ | ----------- | ------------------------------------------- |
| Host         | `localhost` | Use IP if connecting from another machine   |
| Port         | `8080`      | Configurable in FRM mod settings            |
| Password     | _(empty)_   | Set in FRM mod if you want auth             |
| Refresh Rate | `5000` (5s) | How often dashboard panels poll for updates |

---

## ngrok Tunnel (Share Your Dashboard)

The Electron app can create an ngrok tunnel so friends can view your dashboard from anywhere:

1. **Get an ngrok authtoken:** Sign up at [ngrok.com](https://ngrok.com) and copy your authtoken.
2. **Configure:** Run `ngrok config add-authtoken <your-token>` once on your machine.
3. **In the app:** Click the 🌐 **Share** button in the Connection Bar.
4. **Share the URL:** Copy the generated `https://*.ngrok-free.app` URL and send it to friends.

The tunnel forwards traffic to your local FRM API (`localhost:8080`). The dashboard handles ngrok's browser warning interstitial automatically.

---

## Available npm Scripts

| Script                         | Description                                               |
| ------------------------------ | --------------------------------------------------------- |
| `npm run dev`                  | Next.js dev server on port 3000                           |
| `npm run build`                | Static export to `out/`                                   |
| `npm run start`                | Serve the static export                                   |
| `npm run electron:dev`         | Electron + Next.js dev (concurrent)                       |
| `npm run electron:build`       | Full production build (Next.js export + electron-builder) |
| `npm run electron:build:win`   | Windows-only production build                             |
| `npm run electron:build:linux` | Linux-only production build                               |
| `npm run electron:start`       | Build Next.js then launch Electron (production mode)      |
| `npm test`                     | Run Vitest test suite                                     |

---

## Build Output

Production builds go to `dist/`:

- **Windows:** `dist/Statusfactory Setup *.exe`
- **Linux:** `dist/Statusfactory-*.AppImage`
- **macOS:** `dist/Statusfactory-*.dmg`

---

## Automated GitHub Releases

When you push a **minor** or **major** version bump in `package.json` to `main`, a GitHub Actions workflow automatically builds Linux and Windows artifacts and creates a GitHub Release:

| Version change           | Example           | Release?            |
| ------------------------ | ----------------- | ------------------- |
| Patch bump               | `1.2.8` → `1.2.9` | ❌ No               |
| Minor bump               | `1.2.8` → `1.3.0` | ✅ Yes              |
| Major bump               | `1.3.0` → `2.0.0` | ✅ Yes              |
| No `package.json` change | —                 | ❌ Workflow skipped |

The workflow runs on GitHub-hosted runners — you don't need to build anything locally. Find releases at `https://github.com/shakiata/satisfactoryStats/releases`.

Workflow file: `.github/workflows/release.yml`

---

## Troubleshooting

### "Connection failed" in the app

- Verify Satisfactory is running with the FRM mod loaded.
- Check the host/port match FRM mod settings.
- If using a password, make sure it matches FRM's auth token.
- Try `curl http://localhost:8080/getPower` from the terminal to test directly.

### Blank screen in Electron

- The app needs the Next.js build output. Run `npm run build` first, or use `npm run electron:dev`.
- Check DevTools console (F12) for errors.

### ngrok tunnel won't start

- Run `ngrok config add-authtoken <token>` once.
- Make sure ngrok is installed globally or the npm package is available.
- Some networks block ngrok — try a different network.
