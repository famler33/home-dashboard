# Coding Guidelines — Backend (`backend/`)

Scope: all files under `backend/`. Start short — `reconcile-docs` extends this file
after every epic.

## Code Style

- Node.js (LTS), TypeScript `strict`, ESM, pnpm. ESLint + Prettier; `tsc --noEmit`.

## Naming Conventions

- `camelCase` for variables/functions, `PascalCase` for types/classes, kebab-case file
  names.

## Architecture Patterns

- Fastify application. External services (weather, calendars, news) are wrapped in
  integration modules with timeouts, caching and graceful fallback to the last cached
  value.
- Scheduled refreshes run in the backend; the frontend never triggers external calls
  directly. Scheduler approach: <TODO: offen>.

## API Endpoints & Versioning

- All endpoints under `/api/v1/`. Request/response schemas validated by Fastify
  schemas. Errors use one JSON shape with a stable, i18n-ready `code`.

## Dependency Injection

- Services are passed into route plugins explicitly (no global singletons) so tests
  can substitute fakes.

## Validation & Mapping

- Validate all input at the edge; map external payloads to internal types before use.

## Testing

- Vitest. External services are faked or replayed from fixtures; no test needs a real
  API key or network.

## Database & Migrations

- SQLite. Library and migration approach: <TODO: offen>.

## Logging

- Structured logs; never log credentials, tokens or calendar event contents.

## Exception Handling

- Integration failures degrade to cached data and are reported in a `stale`/`error`
  state in the API response, not as a crash.
