# Coding Guidelines — Backend (`backend/`)

Scope: all files under `backend/`. Start short — `reconcile-docs` extends this file
after every epic.

## Code Style

- Node.js 22, TypeScript `strict` (with `noUncheckedIndexedAccess`), ESM, pnpm. ESLint
  (typescript-eslint, `no-explicit-any`, `consistent-type-imports`) and Prettier (single quotes,
  100 columns, trailing commas); `tsc --noEmit`. Dependencies are installed in the image without
  build scripts (`--ignore-scripts`).

## Naming Conventions

- `camelCase` for variables/functions, `PascalCase` for types/classes, kebab-case file
  names (`snapshot-store.ts`, routes as `<name>.route.ts`).

## File Structure

`src/main.ts` (entry, signals), `src/server.ts` (composition root `startServer(env)`),
`src/app.ts` (`buildApp(deps)`), `src/errors.ts`, `src/logger.ts` (logger interface),
`src/logging.ts` (redaction paths), `src/clock.ts`, `src/config/`,
`src/routes/`, `src/sources/` (contract, runner, registration, one file per source),
`src/snapshot/`, `src/cache/`, `src/scheduler/`, `src/backup/`, `src/db/` (+ `migrations/`).
Cross-cutting and repository tests live in `test/` (helpers in `test/helpers/`, shared fixtures
in `test/fixtures/`).

## Architecture Patterns

- Fastify application. External services (weather, calendars, news) are wrapped in
  integration modules with timeouts, caching and graceful fallback to the last cached
  value.
- Scheduled refreshes run in the backend; the frontend never triggers external calls
  directly. The in-process scheduler (`createScheduler`) chains one timeout per job, never lets a
  job overlap itself, isolates failures per job and takes an injectable clock and timers; daily
  jobs use `nextDailyRun` (time-zone aware, counts a repeated hour once).
- A source implements `Source` (`id`, `intervalSeconds`, `staleAfterSeconds` = twice the interval
  by convention, `timeoutMs`, `fetch(signal)`), maps the external payload to an internal type
  before returning it and is added to the list in `startServer`. It adds no scheduler or store code.

## API Endpoints & Versioning

- All endpoints under `/api/v1/`. Request/response schemas are TypeBox/JSON schemas on every route.
- Errors use one envelope `{ "error": { "code", "message", "details" } }`: `code` is a stable
  upper-snake value (the frontend's i18n key), `message` is English developer text that is never
  shown to users and never contains values, stack traces or secrets, `details` is `null` when absent.
  One shared error handler and one not-found handler produce it; the not-found handler answers
  `/api/` paths (and non-GET requests) with the envelope and serves the SPA entry page with
  `no-cache` for other GET requests when static files are configured. The health endpoint is the
  only exception (`{ "status": … }`).
- `Cache-Control: no-store` on every `/api/` response; no CORS plugin; request body limit 64 KiB.

## Dependency Injection

- Services are passed into route plugins explicitly (no global singletons) so tests
  can substitute fakes: a route is `(deps) => FastifyPluginAsync`, `buildApp(deps)` wires them and
  `startServer(env)` is the only composition root. Time comes from an injected `Clock`.

## Validation & Mapping

- Validate all input at the edge; map external payloads to internal types before use.

## Testing

- Vitest, tests colocated as `src/**/*.test.ts` plus `test/**`. Test names are plain English
  (`describe('<unit>')`, `it('<behaviour>')`). External services are faked or replayed from
  fixtures; no test needs a real API key or network. Use `app.inject`, a temporary directory for
  SQLite files and the fake clock/timers in `test/helpers/fake-time.ts`. A comment next to each
  test group lists the covered requirement identifiers.
- Docker-gated tests (`test/docker.test.ts`) are skipped without a daemon and keep their scratch
  folder inside the repository so VM-based Docker setups can mount it.

## Database & Migrations

- SQLite through `better-sqlite3` (synchronous), opened in WAL mode with a busy timeout.
- Migrations are numbered, forward-only `.sql` files in `src/db/migrations/`, applied in one
  transaction each by `runMigrations` and tracked with `PRAGMA user_version`; the build copies them
  next to the compiled code. An application older than the database refuses to start
  (`DB_SCHEMA_NEWER_THAN_APP`). Only the store modules touch their tables.
- Backups use the online backup API (never a file copy of a live database).

## Logging

- Structured JSON logs (pino through Fastify) with redaction of authorization, cookie and
  credential-like paths; never log credentials, tokens, calendar event contents or remote error
  messages. Source and job failures log only an id and an error code or class. Health probes are not
  request-logged.
- Configuration errors name the file and key, never the value.

## Exception Handling

- Integration failures degrade to cached data and are reported in a `stale`/`error`
  state in the API response, not as a crash.
