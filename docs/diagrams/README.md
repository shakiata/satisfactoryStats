# Mermaid Diagrams — Statusfactory

This folder contains Mermaid diagrams documenting the architecture, data flow, component hierarchy, Electron integration, and state management of the Statusfactory application.

| Diagram               | File                                                     | Description                                                                  |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Architecture Overview | [`architecture-overview.md`](./architecture-overview.md) | System-level graph: Satisfactory → FRM Mod → Next.js → Electron → ngrok      |
| Data Flow             | [`data-flow.md`](./data-flow.md)                         | Sequence diagram: connect → poll → fetch → buffer → render pipeline          |
| Component Hierarchy   | [`component-hierarchy.md`](./component-hierarchy.md)     | React component tree from layout to all 13 dashboard tabs                    |
| Electron Integration  | [`electron-integration.md`](./electron-integration.md)   | Electron main process startup, IPC bridge, and ngrok tunnel lifecycle        |
| State Management      | [`state-management.md`](./state-management.md)           | State architecture: config, settings, theme, time buffer, and connection FSM |

All diagrams use [Mermaid](https://mermaid.js.org/) syntax and render natively in GitHub, VS Code, and most Markdown viewers.
