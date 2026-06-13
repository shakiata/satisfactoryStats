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

## Adding Item Icons

Statusfactory ships with **no icons** — they are excluded from git because they're extracted from the game itself. To add them:

### 1. Generate icons in single-player

1. Launch Satisfactory with the FRM mod installed
2. Load your save
3. Open the chat console (`~`) and run:
   ```
   /frm icon
   ```
4. Look for "Icon Generation Completed" in chat

### 2. Copy icons into the project

| OS                 | FRM Icons folder                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows**        | `%LocalAppData%\FactoryGame\Saved\Mods\FicsitRemoteMonitoring\Icons\`                                                                        |
| **Linux (Proton)** | `~/.steam/steam/steamapps/compatdata/526870/pfx/drive_c/users/steamuser/Local Settings/FactoryGame/Saved/Mods/FicsitRemoteMonitoring/Icons/` |

Copy the entire `Icons` folder into:

```
public/Icons/
```

So you end up with:

```
public/Icons/Desc_IronIngot_C.png
public/Icons/Desc_CopperIngot_C.png
...
```

> **Note:** The `public/Icons/` folder is gitignored. Every developer who clones the repo must repeat these steps.

## Configuration

Point Statusfactory at your FRM web server:

1. Enter the FRM server host & port (default: `localhost:8080`)
2. If the server has an **API Authentication Token** set, enter it in the Password field
3. Hit **Connect**

FRM web server setup: `/frm http start` in the Satisfactory chat console.
