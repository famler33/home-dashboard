# Roadmap

> **Source Briefing:** specs/briefing.md
> **Ticket:** —
> **Type:** feature
> **Created:** 2026-10-27
> **Epic Count:** 5

## Overview

Home-Dashboard is a private, animated and distance-readable family dashboard for a
wall-mounted tablet (plus phone access for list editing), served from Docker containers
on a Synology NAS in the home network. It shows weather, a combined calendar (shared
Apple calendar plus two Google work calendars), a shopping list / to-dos and local and
global news headlines. The build strategy is a shared foundation first (app shell, design
system, backend gateway with caching, NAS deployment), followed by one vertical slice per
dashboard tile. Five epics fit the work: the four in-scope capabilities are
cleanly decoupled (distinct external sources, separate data, separately testable), while
everything they share (shell, design system, gateway/cache pattern, deployment) is
tightly coupled and belongs in one foundation epic that all others depend on.

## Build Order

The epics below are ordered so the product can be built and tested incrementally. Each
epic depends only on epics listed before it.

## Epics

### 1. Dashboard Foundation (`dashboard-foundation`)

**Goal:** Deliver a running, deployable skeleton of the dashboard on the NAS: the
fullscreen tablet layout with its design system and animation basics, and the backend
integration gateway with caching and health reporting that every later tile builds on.
It comes first because all other epics need the shell, the tile pattern and the
deployment path.

**Capabilities:**
- Fullscreen, distance-readable dashboard layout for the wall tablet with a tile grid, clock/date and the polished, animated design language
- Stable long-running display behaviour (no memory growth or layout drift over days, graceful handling of backend or internet outage by showing last known data with a staleness indication)
- Backend gateway foundation: internal API, SQLite storage, scheduled fetch-and-cache pattern for external sources, configuration and secrets kept on the NAS
- Docker / Docker Compose deployment on the Synology NAS, reachable only from the home network
- Responsive behaviour so the same app is usable from a phone in the home Wi-Fi

**Affected layers:** frontend, backend, infrastructure

**Depends on:** _None_

**Testable outcome:** After `docker compose up` on the NAS (or locally), opening the app
on the tablet and a phone in the home network shows the animated dashboard shell with
clock and placeholder tiles; the backend health endpoint reports status, data survives a
container restart, and the app is not reachable from outside the home network.

---

### 2. Weather (`weather`)

**Goal:** Show current weather and a short forecast at a glance. It comes first among the
tiles because it is the simplest external integration and proves the gateway, caching and
stale-data pattern end to end.

**Capabilities:**
- Current conditions and short-term forecast for the home location, readable from a distance
- Animated, condition-appropriate weather visuals
- Cached data shown with a staleness indication when the weather source is unreachable

**Affected layers:** frontend, backend

**Depends on:** `dashboard-foundation`

**Testable outcome:** The weather tile shows current conditions and forecast for the
configured location, refreshes on its own, and keeps showing the last cached values when
the external source is blocked.

---

### 3. Combined Calendar (`combined-calendar`)

**Goal:** Show upcoming appointments of the shared Apple (iCloud) calendar and both
Google work calendars in one combined, read-only view. It follows weather because it
reuses the proven gateway pattern and carries the most integration risk (three sources,
two providers, credentials).

**Capabilities:**
- Read-only access to the shared iCloud calendar and the two Google work calendars, with credentials stored only on the NAS
- One merged view of today and upcoming days, with each source or person visually distinguishable
- All-day, multi-day and recurring events displayed correctly
- Cached events shown with a staleness indication when a calendar source is unreachable; one failing source does not hide the others

**Affected layers:** frontend, backend

**Depends on:** `dashboard-foundation`

**Testable outcome:** Events created in each of the three calendars appear in the combined
view, correctly merged and attributed; no write access to any calendar exists; disabling
one source leaves the other two intact.

---

### 4. Shopping List and To-dos (`shopping-list-todos`)

**Goal:** Provide the shared shopping list and to-dos, visible on the tablet and editable
from phones in the home Wi-Fi, reusing or adapting the existing shopping list app.

**Capabilities:**
- Shopping list and to-dos tile on the dashboard, readable from a distance
- Add, check off and remove entries from a phone in the home network, with the tablet updating without manual reload
- Existing shopping list reused or adapted (integration vs. rebuild decided in the PRD/spec phase), including carrying over its current data where sensible
- Lists persist across restarts; no user accounts

**Affected layers:** frontend, backend, infrastructure

**Depends on:** `dashboard-foundation`

**Testable outcome:** An item added on a phone appears on the tablet tile shortly
afterwards, can be checked off from either device, and is still there after a container
restart.

---

### 5. News Headlines (`news-headlines`)

**Goal:** Show the most important local and global news headlines on the dashboard, rotating
or scrolling in a calm, readable way.

**Capabilities:**
- Headlines from at least one local and one global source, clearly separated or labelled
- Calm animated presentation (rotation/ticker) suited to a wall display
- Cached headlines shown with a staleness indication when sources are unreachable

**Affected layers:** frontend, backend

**Depends on:** `dashboard-foundation`

**Testable outcome:** The news tile shows current local and global headlines, updates
periodically, and keeps displaying the last fetched headlines when the sources are blocked.

---

## Dependency Summary

| Epic | Depends On |
|------|------------|
| `dashboard-foundation` | _None_ |
| `weather` | `dashboard-foundation` |
| `combined-calendar` | `dashboard-foundation` |
| `shopping-list-todos` | `dashboard-foundation` |
| `news-headlines` | `dashboard-foundation` |

## Briefing Coverage

| Briefing Capability | Covered By Epic |
|---------------------|-----------------|
| Beautiful, animated, distance-readable wall-tablet dashboard | `dashboard-foundation` |
| Docker on Synology NAS, home network only, credentials stay on the NAS | `dashboard-foundation` |
| Stable continuous operation on a tablet | `dashboard-foundation` |
| Phone access in the home Wi-Fi | `dashboard-foundation`, `shopping-list-todos` |
| Weather | `weather` |
| Combined calendar: shared Apple calendar + two Google work calendars, read-only | `combined-calendar` |
| Shopping list / to-dos (reuse or adapt existing list) | `shopping-list-todos` |
| Most important news headlines, local and global | `news-headlines` |

## Open Questions Carried from the Briefing

Resolved in the brainstorm/spec phase of the owning epic, not here:

- Calendar access method for iCloud and Google → `combined-calendar`
- Weather and news sources → `weather`, `news-headlines`
- Location and integration approach of the existing shopping list → `shopping-list-todos`
- Tablet resolution/orientation and NAS architecture (Intel/ARM) → `dashboard-foundation`
