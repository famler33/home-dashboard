# Domain: Dashboard Foundation

> **Last updated:** 2026-10-28
> **Related epics:** Dashboard Foundation (`dashboard-foundation`), Weather (`weather`)

## 1. Overview

The foundation is everything the dashboard tiles share: the fullscreen wall layout and its
design language, the tile framework with its freshness states, the backend gateway that
fetches and remembers data from external sources, the configuration on the NAS, and the
deployment on the Synology NAS in the home network. Tiles (weather, calendar, lists, news)
only add a *source* in the backend and a *tile* in the frontend; they reuse everything else.

The display is meant to run for days without interaction. It never shows a blank screen:
when a source or the backend is unavailable it keeps the last known data and says how old it is.

## 2. Key Concepts & Entities

| Concept | Meaning |
| ------- | ------- |
| **Source** | A backend unit with an `id`, a refresh interval, a stale threshold (default twice the interval), a timeout and a `fetch` function. The only integration point for external data. |
| **Source state** | Per source, stored in SQLite (`source_state`): last successful payload, time of last success, time of last attempt, last error code, consecutive failures. A failed refresh never removes the previous payload. |
| **Snapshot** | The single read model the display polls: build id, server time, projected settings and one entry per enabled source. |
| **Source status** | `never-loaded` (no attempt yet), `error` (no payload and the last attempt failed), `stale` (payload older than its threshold), `fresh`. Computed by the server. |
| **Tile** | A frontend card bound to a source (or none). Tile states: `loading`, `never-loaded`, `empty`, `fresh`, `stale`, `error`, plus `crashed` when a tile component throws. |
| **Tile registry** | List of tile definitions: id, title key, optional source id, grid area on the 12 x 6 tablet grid, phone order, empty check, content component. A tile can require its source and can replace another tile. |
| **Settings projection** | The explicit allowlist of settings the display may see: time zone and the display schedule (night start and end, daily reload time). Location, backup and source settings are never sent. |
| **Build id** | Identifier baked into both the image and the SPA bundle. A mismatch makes the open display reload itself. |

Snapshot entry fields: `id`, `status`, `data`, `lastUpdated` (ISO time or null), `ageSeconds`
(computed by the server), `staleAfterSeconds`, `lastErrorCode` (`SOURCE_FETCH_FAILED` or
`SOURCE_TIMEOUT`, never a message).

## 3. Workflows & Behaviors

**Refreshing data.** On start and then after every interval the scheduler runs each enabled
source. The runner enforces the timeout (also when `fetch` ignores the abort signal), stores
the payload on success and the error code on failure, and logs only the source id and error
code. Jobs never overlap themselves and one failing source or job never affects others.

**Display polling.** The SPA fetches the snapshot every 30 s with a 10 s timeout. A new poll is
skipped while one is in flight. After two consecutive failures the display shows the offline
indicator (icon and "Keine Verbindung") and keeps the last snapshot. The first success clears it.

**Freshness without the device clock.** Tile age is the server's `ageSeconds` plus the
monotonic time since the snapshot was received, so staleness keeps growing while the backend is
unreachable and never depends on the tablet's wall clock. Under one minute the footer reads
"gerade eben" or seconds; a stale tile shows an amber footer with a clock icon and "Veraltet",
never color alone.

**Self-recovery.** A different build id in the snapshot reloads the page once (a reload guard
allows at most one per 60 s, also across reloads). Once a day, after the configured
`dailyReloadAt` and only if the page started before that time, the page reloads to bound
long-running browser drift. After a NAS restart the container starts again and the open
display reconnects without being touched.

**Day and night.** The theme switches between `day` and `night` at the configured local times
in the configured time zone (ranges may cross midnight). The night theme dims the whole
dashboard; all tiles stay visible. In the wall layout the shell shifts by a few pixels every
5 minutes through a fixed cycle (burn-in protection; half amplitude by day). Under
"reduce motion" the shift is applied as an instant step.

**Layouts.** Landscape screens of at least 1024 x 750 or 1180 x 700 CSS pixels get the wall
layout: header with clock, date, kiosk hint and offline indicator, then four tiles on the grid.
Everything else gets the phone layout: one scrolling column, tiles ordered by phone order with
the lists tile first, no drift, no fullscreen hint.

**Kiosk behavior.** One tap on the wall layout requests fullscreen; a discreet hint is shown
while fullscreen is available but inactive. The Wake Lock API is requested only where the browser
allows it (secure context); over plain HTTP the tablet's own settings keep the screen awake.
A web app manifest (fullscreen, landscape, German) allows "add to home screen".

**Nightly backup.** At the configured local time the backend writes a consistent online copy of
the database to the backup folder (temporary name, then rename), keeps the newest N copies and
logs the result. A failed backup is logged and never stops the service.

## 4. Interfaces

All endpoints are versioned under `/api/v1/` and answer with `Cache-Control: no-store`, except the two
cacheable weather routes described in [domain-weather](domain-weather.md).

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/v1/health` | Unauthenticated. `200 {"status":"ok"}` when the database answers, `503 {"status":"error"}` otherwise. Nothing else is ever returned. Used by the container health check. |
| `GET /api/v1/snapshot` | The snapshot described above. |

Error envelope for every other non-2xx API response:
`{"error":{"code","message","details"}}`. `code` is a stable upper-snake value that the frontend
maps to a German text (`NOT_FOUND`, `VALIDATION_FAILED`, `PAYLOAD_TOO_LARGE`, `INTERNAL_ERROR`);
`message` is English developer text that is never shown; `details` is `null` when absent. Unknown
API paths return `404 NOT_FOUND`; unknown non-API GET paths return the SPA entry page.

Static delivery: hashed files under `/assets/` are cached as immutable; the entry page and the
manifest use `no-cache`. Security headers: content security policy limited to the own origin
(inline style attributes only), `nosniff`, `no-referrer`, no CORS. The request body limit is 64 KiB.

Configuration files on the NAS (read-only mount): `settings.yaml` (required) and
`credentials.yaml` (optional). Operational environment variables: `CONFIG_DIR`, `DATA_DIR`,
`BACKUP_DIR`, `PORT`, `HOST`, `BUILD_ID`, `STATIC_DIR`.

The backend types are the source of truth for the snapshot; the frontend mirrors them by hand
and both are checked against a backend-owned example file.

## 5. Business Rules & Constraints

- The frontend never calls external services; only the backend does, and credentials never leave the NAS.
- A failed refresh keeps the previous payload and the time of the last success.
- Status and age are computed on the server; the client only continues ageing while offline.
- Source ids are lowercase kebab-case and unique; every source declares its own interval,
  threshold and timeout.
- Settings and credentials are validated at start and fail closed. Error messages name the file
  and key, never a value. Unknown keys are rejected. A credentials file readable by group or
  others only produces a warning.
- Credentials, location and backup settings never appear in API responses, logs or backups.
- Logs never contain remote error messages, payloads, credentials or request headers with secrets.
- Tile areas on the tablet grid must not overlap (a tile that replaces another is the exception).
- Smallest text in the wall layout is 28 px; clock size scales with width and height with a
  112 px floor. All user-visible text comes from the German dictionary.
- The database schema only moves forward; a newer schema than the application refuses to start.
- Calendars are accessed read-only (no write access to external accounts exists).

## 6. Related Documentation

- [Architecture reference](guidelines/architecture-reference.md)
- [Frontend coding guidelines](guidelines/coding-guidelines-frontend.md) and [backend coding guidelines](guidelines/coding-guidelines-backend.md)
- [UX guidelines](guidelines/ux-guidelines.md)
- [Security guidelines](guidelines/security-guidelines.md) and [infrastructure guidelines](guidelines/infrastructure-guidelines.md)
- [Testing guidelines](guidelines/testing-guidelines.md)
- Runbook for installation, updates, restore and tablet setup: `infrastructure/README.md`

## 7. Change Log

| Date | Epic | Change |
|------|------|--------|
| 2026-10-28 | Dashboard Foundation (`dashboard-foundation`) | Wall and phone layout, tile framework and freshness states, polling and self-recovery, day/night schedule, backend gateway with scheduler and SQLite cache, configuration files, nightly backup, container image, compose project, deploy script and runbook. |
| 2026-10-28 | Weather (`weather`) | First tile on the framework: three sources, a shell context for layout and theme, a short-screen variant and two explicitly cacheable routes. |
