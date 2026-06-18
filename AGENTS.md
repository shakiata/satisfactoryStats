<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:documentation-rules -->

# AGENTS.md — Mandatory Pre-Read

Before implementing, writing, editing, or deleting any code in this repository, you MUST:

1. Read this file for project conventions, architecture, common patterns, and documentation rules
2. Follow all rules and conventions documented here
3. After making changes, re-read relevant sections and update anything that is now wrong

**Do not skip this step.** AGENTS.md is the source of truth for how this codebase works. Treat it as a mandatory pre-read before any code work.

<!-- END:documentation-rules -->

<!-- BEGIN:code-comments -->

# Code Comments — Mandatory

Every function, class, non-obvious block, and exported symbol MUST have a human-readable comment explaining **why** it exists and **what** it does. Follow these rules:

- Write comments as if explaining to a new teammate — plain English, no jargon shortcuts.
- Focus on intent and edge cases, not restating the code.
- Keep comments up to date when logic changes. Stale comments are worse than no comments.
- JSDoc / TSDoc for public APIs; inline `//` for internal logic that isn't self-evident.
<!-- END:code-comments -->

<!-- BEGIN:documentation-step -->

# Docs — Always Keep Them In Sync

Every source change must update the corresponding docs in `docs/` at the repo root. Docs must be human-readable and structured so other LLMs can consume them.

1. Check which docs in `docs/` at the repo root cover the behavior you changed
2. Re-read those docs
3. Update anything that's now wrong. If no doc covers it, create one.

**Do not defer.** Apply doc updates in the same turn as the code change. Treat docs as part of the feature.

<!-- END:documentation-step -->

<!-- BEGIN:test-before-done -->

# Test Before You're Done

Never claim a change is complete until you have verified it. Before wrapping up:

1. **Lint & type-check** — run the project's linter and TypeScript compiler. Fix every error.
2. **Build check** — ensure `next build` (or equivalent) succeeds with no warnings you introduced.
3. **Manual smoke test** — if the change touches UI or API behavior, run the dev server and hit the affected path at least once.
4. **Existing tests** — run `npm test` (or equivalent). If existing tests break, fix them before declaring done.
5. **Add tests** — if you added new logic, add at least one test that would fail without your change.

If any step fails, fix it and re-run. Only say "done" when everything is green.

<!-- END:test-before-done -->

<!-- BEGIN:reusable-code -->

# Reusable Code & Global Stylesheet — Mandatory

Don't repeat yourself. Every piece of logic and styling must live in exactly one place.

## Reusable Blocks

- **Extract, don't duplicate.** If the same logic appears in two places, pull it into a shared utility, hook, or component.
- **UI components belong in `components/ui/`.** Buttons, inputs, cards, dialogs — these are shared primitives. Don't inline them in page-level code.
- **Shared utilities go in `lib/`.** Date formatting, string helpers, API wrappers — anything used across multiple files lives here.
- **Custom hooks are preferred over repeated `useEffect` / `useState` patterns.** If two components share stateful logic, extract a hook.

## Global Stylesheet

- **All global CSS lives in `src/app/globals.css`.** Colors, typography, spacing variables, resets, utility classes — one file, one source of truth.
- **No inline `<style>` tags or `style={{}}` objects.** Use Tailwind utility classes or CSS Modules instead.
- **No per-component global stylesheets.** If a component needs unique styles, use a CSS Module (`.module.css`) co-located with the component file.
- **Keep the cascade flat.** Avoid deep nesting and overly specific selectors. Prefer composition over inheritance.
- **Design tokens first.** Define CSS custom properties (`--color-primary`, `--spacing-md`, etc.) in `globals.css` and reference them everywhere else. Never hardcode hex values or pixel sizes in components.
<!-- END:reusable-code -->
