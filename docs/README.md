# Statusfactory Documentation

Hub and index for all project documentation. Organized by conceptual layer so both humans and LLMs can navigate efficiently.

---

## Structure

| Document                                                                 | What it covers                                                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [architecture.md](./architecture.md)                                     | System architecture, data flow diagram, tech stack, build pipeline                                   |
| [getting-started.md](./getting-started.md)                               | Prerequisites, install, dev/electron commands, ngrok tunnel setup                                    |
| [api-client.md](./api-client.md)                                         | FRM API client — `buildUrl`, `fetchEndpoint`, `testConnection`, `sendChatMessage`, endpoint registry |
| [types.md](./types.md)                                                   | All TypeScript type definitions — config, buildings, transport, inventory, UI                        |
| [hooks.md](./hooks.md)                                                   | Custom React hooks — `useConfig`, `useAppSettings`, `useTheme`, `useTimeBuffer`                      |
| [theme-and-styling.md](./theme-and-styling.md)                           | CSS design tokens, Tailwind palette, ThemeProvider context, color picker flow                        |
| [electron-integration.md](./electron-integration.md)                     | Electron main process, preload bridge, ngrok IPC, type declarations                                  |
| [diagrams/](./diagrams/)                                                 | Mermaid diagrams — architecture overview, data flow, component hierarchy, Electron, state management |
| [testing.md](./testing.md)                                               | Testing strategy, Vitest config, test file locations, run instructions                               |
| [components/overview.md](./components/overview.md)                       | Shared patterns across all UI components, tab routing, conventions                                   |
| [components/shared-components.md](./components/shared-components.md)     | `ConnectionBar`, `EndpointList`, `TimeWindowSelector`                                                |
| [components/power-dashboard.md](./components/power-dashboard.md)         | PowerDashboard panel                                                                                 |
| [components/production-monitor.md](./components/production-monitor.md)   | ProductionMonitor panel                                                                              |
| [components/factory-efficiency.md](./components/factory-efficiency.md)   | FactoryEfficiency panel                                                                              |
| [components/generator-status.md](./components/generator-status.md)       | GeneratorStatus panel                                                                                |
| [components/inventory-panel.md](./components/inventory-panel.md)         | InventoryPanel                                                                                       |
| [components/player-map.md](./components/player-map.md)                   | PlayerMap panel                                                                                      |
| [components/resource-tracker.md](./components/resource-tracker.md)       | ResourceTracker panel                                                                                |
| [components/chat-panel.md](./components/chat-panel.md)                   | ChatPanel                                                                                            |
| [components/settings-panel.md](./components/settings-panel.md)           | SettingsPanel                                                                                        |
| [components/train-control-tower.md](./components/train-control-tower.md) | TrainControlTower panel                                                                              |

---

## Quick Links

- **New contributor?** Start with [getting-started.md](./getting-started.md) then [architecture.md](./architecture.md).
- **Adding a dashboard panel?** Read [components/overview.md](./components/overview.md) for patterns, then reference an existing panel doc.
- **Changing the API client?** See [api-client.md](./api-client.md) and check which dashboard panels are affected.
- **Writing tests?** See [testing.md](./testing.md).
