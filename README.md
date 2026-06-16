# Statusfactory

A desktop stats dashboard for Satisfactory, powered by [Ficsit Remote Monitoring](https://docs.ficsit.app/ficsitremotemonitoring/latest/index.html). Built with Next.js + Electron + TypeScript.

## Prerequisites

| Tool                                                                       | Why                         |
| -------------------------------------------------------------------------- | --------------------------- |
| [Node.js](https://nodejs.org) v18+                                         | Runs the dev server & build |
| npm (ships with Node)                                                      | Package manager             |
| Satisfactory with [FRM mod](https://ficsit.app/mod/FicsitRemoteMonitoring) | Data source                 |

## Quick Start (dev mode — browser only)

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Quick Start (Electron desktop app)

```bash
npm install
npm run electron:dev
# Launches Next.js + Electron window together
```

## Build standalone Electron app

```bash
npm run electron:build
# Output in /dist/
```

To build for a specific platform:

```bash
npm run electron:build:linux    # AppImage
npm run electron:build:win      # Windows .exe
```

## Configuration

Point Statusfactory at your FRM web server:

1. Enter the FRM server host & port (default: `localhost:8080`)
2. If the server has an **API Authentication Token** set, enter it in the Password field
3. Hit **Connect**

FRM web server setup: `/frm http start` in the Satisfactory chat console.

## 🌐 Sharing with Friends (ngrok Tunnel)

If you host your game locally (not on a dedicated server), your FRM server is only accessible on your LAN. The **🌐 Share** button in the Electron app creates a public URL so friends can connect from anywhere.

### One-time setup

1. Download and install **[ngrok](https://ngrok.com/download)** on your machine
   - Windows: `choco install ngrok` or download the `.exe` from ngrok.com
   - Linux: `snap install ngrok` or download from ngrok.com
2. Sign up for a **free** [ngrok account](https://dashboard.ngrok.com/signup)
3. Get your authtoken from [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
4. Run once:
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```

### How it works

1. You click **🌐 Share** in the Statusfactory connection bar
2. A public URL appears (e.g. `abc123.ngrok-free.dev`)
3. Click **📋** to copy it and send it to your friends
4. Your friends paste the URL into their Statusfactory app as the **Host**, enter the FRM auth token, and click Connect
5. They're now viewing your factory stats through the tunnel — no port forwarding, no VPN, no IP sharing

> **Note:** Your ngrok authtoken stays on your machine only — nothing is embedded in the app. The free tier works indefinitely but has a "visit warning" page that Statusfactory automatically bypasses. Each tunnel restart gives you a new URL.
