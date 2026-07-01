---
description: "Mandatory step-by-step repo analysis — produce Mermaid diagrams, audit suggestions, and verify. Fire before any documentation or refactor work."
applyTo: "**"
---

# Repo Analysis — Mandatory Step-by-Step Workflow

This instruction fires on every file save. When the user asks you to **analyze, document, audit, diagram, or suggest improvements** for this repository, you MUST follow the workflow below. Do not skip steps.

---

## Step 0: Pre-Flight

1. Re-read `AGENTS.md` at the repo root. Follow every rule in it.
2. Re-read `docs/architecture.md` for the current architectural overview.
3. Re-read `docs/README.md` for the documentation index.

---

## Step 1: Walk the Codebase Systematically

Read every source file in this order, taking notes as you go:

1. **Entry points** — `src/app/layout.tsx`, `src/app/page.tsx`, `electron/main.js`, `electron/preload.js`
2. **Shared libraries** — everything in `src/lib/` (types, api, hooks, formatters, colors, names, fluids)
3. **Shared components** — `src/components/ConnectionBar.tsx`, `EndpointList.tsx`, `TimeWindowSelector.tsx`, `src/components/ui/ItemIcon.tsx`
4. **Dashboard components** — every file in `src/components/dashboard/`
5. **Styling** — `src/app/globals.css`
6. **Config** — `package.json`, `tsconfig.json`, `tailwind.config.js`, `next.config.js`, `vitest.config.ts`
7. **Tests** — everything in `src/lib/__tests__/`

For each file, record: its purpose, key exports, data dependencies, and any notable patterns or edge cases.

---

## Step 2: Produce or Update Mermaid Diagrams

All diagrams live in `docs/diagrams/`. If the folder doesn't exist, create it. Every diagram file must:

- Have a level-1 heading describing the diagram
- Contain exactly one Mermaid fenced code block
- Include a brief paragraph above the diagram explaining what the reader should learn from it
- Use semantic node labels (not just variable names)

### Required Diagrams (minimum)

| File | Type | Content |
|------|------|---------|
| `README.md` | — | Index table linking to every diagram with a one-line description |
| `architecture-overview.md` | `graph TD` | System-level: Satisfactory Game → FRM Mod → HTTP → Next.js App (all tabs, hooks, libs) → Electron Shell → ngrok |
| `data-flow.md` | `sequenceDiagram` | End-to-end: user clicks Connect → testConnection → setInterval poll → fetchEndpoint → useTimeBuffer → component render. Include time-window averaging path. Include localStorage persistence flow for config/settings/theme. |
| `component-hierarchy.md` | `graph TD` | React tree: `layout.tsx` → `ThemeProvider` → `page.tsx` (Home) → `ConnectionBar`, `EndpointList`, `TimeWindowSelector`, 13 dashboard tabs. Show shared libs consumed by each tab. Show `ui/ItemIcon` usage. |
| `electron-integration.md` | `sequenceDiagram` | Electron main process startup → BrowserWindow creation → Next.js load (dev vs prod) → `preload.js` `contextBridge` → `electronAPI` on `window` → ngrok tunnel start/stop/status lifecycle |
| `state-management.md` | `graph TD` | State diagram covering: `useConfig` (localStorage read→state→set→write), `useAppSettings` (+ reset), `useTheme`/`ThemeProvider` (CSS custom properties on `:root` on change), `useTimeBuffer` (push on data change→rolling buffer→windowed query). Include connection state machine: disconnected→connecting→connected→error. |

### Diagram Quality Checklist

- [ ] Every node appears in at least one edge
- [ ] Subgraphs are used to group related concepts
- [ ] Directional arrows reflect actual data/control flow
- [ ] No orphaned nodes
- [ ] Styling is minimal but consistent (use `classDef` if helpful)
- [ ] Diagram renders without syntax errors in a Mermaid-compatible viewer

---

## Step 3: Audit and Update Suggestions

Suggestions live in `suggestions/suggestions.md` at the repo root. If the file or folder doesn't exist, create it.

### Suggestion Format

Every suggestion must follow this template:

```markdown
### [Category Letter][Number]: Short Title

**Priority:** P0 | P1 | P2 | P3

**What:** One sentence describing the issue.

**Why:** 2-3 sentences on impact — who it affects, what breaks, or what opportunity is missed.

**How:** Concrete approach. Reference specific file paths. Include a code sketch if it clarifies the fix. Never just say "fix it."
```

### Priority Rubric

| Priority | Meaning |
|----------|---------|
| P0 | Critical — correctness bug, data loss, security issue, or broken core functionality |
| P1 | High — significant performance regression, missing error handling that causes bad UX, or architecture problem that blocks future work |
| P2 | Medium — code quality, duplication, missing tests, type safety gaps, documentation staleness |
| P3 | Nice-to-have — DX polish, tooling upgrades, minor refactors, style consistency |

### Required Audit Categories

Cover all nine. If a category has no issues, write "No issues found." — never skip a category.

| # | Category | Areas to check |
|---|----------|----------------|
| A | Architecture & Structure | Code-splitting, component size, routing, file organization, separation of concerns |
| B | API Client | Dead endpoints, duplicated fetch logic, request deduplication, retry/backoff, abort handling |
| C | State Management | Polling coordination, buffer correctness (deep vs shallow equality), side-effect placement, localStorage hydration |
| D | Component Design | Canvas rendering patterns, duplicated utilities across components, repeated dashboard patterns that could be abstracted |
| E | Performance | Missing memoization, unnecessary re-renders, large-list virtualization, computation in render body |
| F | TypeScript & Types | File size, union type strictness, `any` usage, type coverage |
| G | Testing | Component tests, integration tests, E2E tests, test coverage gaps |
| H | Documentation | Stale docs, missing TSDoc/JSDoc, docs-to-code drift |
| I | DX & Tooling | Lint scripts, pre-commit hooks, Node version pinning, import sorting |

---

## Step 4: Verify Your Work

Before claiming done, run this checklist:

1. **File existence** — Run `ls -la .github/instructions/ docs/diagrams/ suggestions/` and confirm all expected files are present.
2. **Instruction validity** — Open each `.instructions.md` file. The YAML frontmatter must be valid. The `applyTo` pattern must be intentional.
3. **Diagram syntax** — Open each diagram file in `docs/diagrams/`. Every Mermaid block must start with ` ```mermaid` and close with ` ``` `. No orphaned backticks.
4. **Suggestion completeness** — Every suggestion in `suggestions/suggestions.md` must have What / Why / How / Priority. No placeholder text.
5. **AGENTS.md compliance** — Re-read `AGENTS.md` at the repo root. Confirm zero violations.
6. **Doc sync** — If you updated any existing doc, the change must be reflected in `docs/README.md` if there's an index.

If any step fails, fix it and restart the checklist from step 1.

---

## Step 5: Surface Ambiguity

When making a judgment call (e.g., whether something is P0 or P1, whether a pattern is "duplicated enough" to warrant abstraction), estimate your confidence:

- **≥80% confident** → proceed and document your reasoning in the suggestion's **Why** section.
- **<80% confident** → stop and ask the user via `vscode_askQuestions`. Present both options with your leaning. Do not guess.

---

## Reminders

- This instruction fires on every file save. You don't need to re-run the full analysis on every edit — but when the user asks for analysis, diagrams, or suggestions, follow this workflow from Step 0.
- Never implement the suggestions themselves unless the user explicitly asks. This workflow is for **analysis and documentation only**.
- Keep `suggestions/suggestions.md` up to date. When code changes make a suggestion obsolete, remove it. When new issues are found, append them.
