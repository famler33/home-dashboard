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
- Data-fetching and state approach: <TODO: offen>.

## Styling

- Tailwind CSS with project design tokens (colors, spacing, typography) defined once
  in the Tailwind config; no ad-hoc hard-coded values.
- Animation library and conventions: <TODO: offen>. Animate `transform`/`opacity`
  only; respect `prefers-reduced-motion`.

## Internationalization

- UI language German. No hard-coded UI strings; approach: <TODO: offen>.

## Imports & Assets

<TODO: offen>

## Dependencies

- Add a dependency only when it removes real effort; note new ones in the spec.
  Keep the bundle small — the tablet is low-powered.

## Testing

- Vitest colocated as `src/**/*.test.ts(x)`; Playwright in `frontend/e2e/`.
- ESLint; Prettier in check mode for gates.

## File Structure

<TODO: offen> — established in the first frontend epic.
