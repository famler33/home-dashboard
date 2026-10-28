# Coding Guidelines — Frontend (`frontend/`)

Scope: all files under `frontend/`. Start short — `reconcile-docs` extends this file
after every epic.

## Language & Framework

- React function components and hooks, Vite, TypeScript. Package manager: pnpm.
- The SPA talks only to the project's own backend API, never to external services.

## Type Rules

- TypeScript `strict`; no `any` (use `unknown` and narrow). `tsc --noEmit` passes.
- API types mirror the backend contract; the backend is the source of truth.

## Component Patterns

- The dashboard is composed of self-contained widgets (weather, calendar, lists,
  news), each with its own loading, empty, stale and error state.
- Data fetching: one `SnapshotProvider` polls the snapshot and exposes it through `useSnapshot()`;
  tiles derive their state with the pure functions in `snapshot/freshness.ts`. No query library
  (revisit when list mutations need optimistic updates). Timers and listeners are always cleaned up.
- Every tile uses `TileFrame`/`Tile`, which provide all states and a per-tile error boundary; a tile
  only supplies its content component and a registry entry (`tiles/registry.ts`).

## Styling

- Tailwind CSS with project design tokens (colors, spacing, typography) defined once
  in the Tailwind config; no ad-hoc hard-coded values.
- Tokens (colors for day and night, type scale, line heights, media queries) live in
  `src/styles/tokens.ts` and are emitted as CSS variables by the Tailwind config; components use
  semantic names (`bg-surface-raised`, `text-ink-muted`, `text-title`), never raw colors or sizes.
- Animation is CSS first (keyframes and transitions on `transform`/`opacity`, stagger through the
  `--i` custom property). Motion (`LazyMotion` with `m` components) is used only for the rolling clock
  digits. Never use Motion's pop-layout mode: it injects a style element that the content security
  policy blocks. No infinite JavaScript animation loops. Honor `prefers-reduced-motion` through
  `usePrefersReducedMotion` and the global media rule.

## Internationalization

- UI language German. All texts come from the typed dictionary `src/i18n/de.ts` through
  i18next (`useTranslation`); unknown keys fail `tsc`. Dates, times and relative times use `Intl`.
  ESLint (`react/jsx-no-literals` and a ban on literal `aria-label`/`title`/`alt`/`placeholder`)
  enforces this outside tests. Backend error codes map to `errors.<CODE>`.

## Imports & Assets

- Relative imports, no path aliases. The build id is injected as `__BUILD_ID__` (`BUILD_ID`
  environment variable). Fonts are self-hosted through fontsource and icons are `lucide-react`
  SVG components (no emoji, no external requests: the content security policy allows only the own
  origin).

## Dependencies

- Add a dependency only when it removes real effort; note new ones in the spec.
  Keep the bundle small — the tablet is low-powered.

## Testing

- Vitest (jsdom) colocated as `src/**/*.test.ts(x)`; Playwright in `frontend/e2e/` against the
  production build served by the real backend. Shared fixtures: `src/test-fixtures.ts`,
  `src/test-utils.tsx`; the snapshot contract is checked against the backend-owned example file.
  A comment next to each test group lists the covered requirement identifiers.
- ESLint; Prettier in check mode for gates. Typescript `strict` with `noUncheckedIndexedAccess`.

## File Structure

`src/main.tsx`, `src/App.tsx`; `src/api/` (typed client, snapshot types); `src/snapshot/`
(provider, freshness, version guard); `src/shell/` (layout, clock, theme, drift, kiosk hooks);
`src/tiles/` (frame, states, boundary, registry, one folder per tile with content); `src/i18n/`;
`src/styles/` (tokens, CSS); `e2e/` (specs and helpers). Naming: PascalCase `.tsx` components,
camelCase hooks and utilities (`useX.ts`), tests `<file>.test.ts(x)`.
