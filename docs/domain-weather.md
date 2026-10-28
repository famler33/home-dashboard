# Domain: Weather

> **Last updated:** 2026-10-28
> **Related epics:** Weather (`weather`)

## 1. Overview

The weather tile shows the weather at the household location: the current conditions, the next hours,
seven days, the time of the next rain shower and an animated rain radar, plus a warning banner for
official severe-weather warnings. It uses only open services without an API key and follows the
foundation rules: the backend fetches, the display polls the snapshot, and a failing part never
blanks the tile.

On the wall tablet the tile rotates through three views (now, 7 days, rain and radar) and the viewer
can switch by hand. On the phone the three parts are stacked in one section without rotation.

## 2. Key Concepts & Entities

| Concept | Meaning |
| ------- | ------- |
| **Weather source** (`weather`) | Forecast from Open-Meteo every 15 min (stale after 30 min). Payload: location name, current values, today, 24 hourly slots, 7 days and a 15-minute rain series for the next 4 hours. |
| **Radar source** (`weather-radar`) | DWD radar from Bright Sky every 5 min (stale after 10 min). Snapshot payload only carries a `version`, the frame list (time, observed or forecast) and the rain series at the home point; the pictures live in the radar document. |
| **Alerts source** (`weather-alerts`) | DWD warnings from Bright Sky every 15 min. Expired warnings, test warnings and unknown severities are dropped; at most five warnings starting within 12 hours, ordered by severity then onset. |
| **Radar document** | One compressed document with the 101 x 101 value grids of all frames (about 1 h back, 2 h ahead, 5-minute steps), the four corner coordinates, the home cell and the list of map tiles. Stored as a single row in SQLite; the previous row stays when a refresh fails. |
| **Condition** | One of eleven normalised values (`clear`, `mostly-clear`, `partly-cloudy`, `overcast`, `fog`, `drizzle`, `rain`, `showers`, `snow`, `thunderstorm`, `unknown`) mapped from the provider's weather codes; the frontend maps each to a German label and an animated symbol (day and night variants). |
| **Rain statement** | One German sentence computed in the frontend from the rain series and the current time: rain now (with the end), rain starting at a time (and its duration), no rain within 2 hours, or rain continuing beyond the horizon. Steps below 0.1 mm/h do not count as rain. The radar series is preferred over the forecast series. |
| **View** | `now`, `days` or `rain`; the wall tile shows exactly one, plus the outgoing one during a fade. |

The radar's raw value is 0.01 mm per 5 minutes; mm/h is the value times 0.12.

## 3. Workflows & Behaviors

**Now view.** Temperature, symbol, description, today's high and low and rain probability (shown from
20 %), wind only from 40 km/h on the wall (always on the phone), the rain line and five hourly slots
starting with the next full hour (hour, temperature, probability from 20 %, symbol). The phone shows 24 slots.

**7 days view.** Seven days from today with weekday, symbol, high, low and probability from 20 %. The
columns reserve a probability line so the values stay aligned.

**Rain and radar view.** The rain statement, 15-minute bars and the radar loop drawn on a canvas from
the raw values over a static map. The home point is marked, every frame is labelled with its time and
"Beobachtung" or "Vorhersage", and a colour legend and the credit sit below the map. A stale radar keeps
its last picture and says "Radar veraltet" with its age. Reduced motion shows one still frame.

**Rotation and manual switching.** The wall tile changes view every 15 s with one calm fade (150 ms under
reduced motion). A tap on the tile, a swipe (at least 60 px, mainly horizontal) or a tap on a view
indicator switches by hand; the rotation pauses for 60 s after any input. Rotation stops while the
weather values are stale, but manual switching still works. The radar document is fetched, and the radar
timers run, only while the rain view is shown.

**Warnings.** A banner with severity as text and a distinct icon per level is visible in every wall view
and on the phone; it shows the most severe warning and the number of further ones and takes no space
without a warning. Stale, failed or never-loaded alert data shows "Warnungen nicht prüfbar" instead of
claiming there are none.

**Isolation.** Each of the three parts degrades on its own; a failed radar does not affect values or
warnings and the rain statement falls back to the forecast series.

**Short tablet screens** (wall layout up to 850 px high). The tile is compacted: the location name,
hourly symbols and day symbols are screen-reader text only, and with an active warning the hourly strip and
the rain line in the now view are left out. Taller screens show everything.

## 4. Interfaces

External services (outbound HTTPS from the backend only, three fixed hosts):

| Service | Use |
| ------- | --- |
| Open-Meteo (`api.open-meteo.com`) | Forecast, CC BY 4.0 |
| Bright Sky (`api.brightsky.dev`) | DWD radar and warnings |
| OpenStreetMap tiles (`tile.openstreetmap.org`) | Static map background, fetched through the backend |

Snapshot entries: `weather`, `weather-radar`, `weather-alerts` (shapes in the backend types, mirrored
by hand in the frontend and checked against a golden example).

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/v1/weather/radar` | The radar document, gzip, `ETag` = radar version, `Cache-Control: no-cache`; `404 RADAR_NOT_AVAILABLE` before the first success. The frontend loads it again only when the version in the snapshot changes. |
| `GET /api/v1/weather/basemap/:z/:x/:y` | Map tile proxy. Only the tiles listed in the current radar document (zoom 9) are served; `Cache-Control: private, max-age=86400`; `502 UPSTREAM_UNAVAILABLE` when the upstream fails. |

Configuration: `sources.weather.enabled` (default on) switches all three sources together. The home
location comes from the shared `location` setting.

## 5. Business Rules & Constraints

- The display never talks to the weather services; only the backend does.
- Coordinates are rounded to two decimals (about 1 km) before any upstream request; hosts are constants
  in code, requests carry an identifying user agent, no cookies, no referrer, no redirects.
- Upstream responses are size-limited and validated; logs carry only the source id and an error code, never
  URLs or upstream text.
- The tile proxy checks integer coordinates against the allow-list, the content type and the PNG header,
  and keeps a disk cache in `data/tiles` capped at 64 files, 8 MiB in total and 512 KiB per tile.
- Frames are labelled observed or forecast by comparing with the radar's own timestamps, never by colour only.
- The source credits stay visible: short on the wall, full on the phone, radar credit in the radar view.
- Symbol animations last at least 6 s and only use transform and opacity; they stop under reduced motion.
- Rain probability appears only from 20 %; wind only when notable on the wall.
- Units are fixed: °C, km/h, 24-hour time.

## 6. Related Documentation

- [Dashboard Foundation domain](domain-dashboard-foundation.md)
- [Architecture reference](guidelines/architecture-reference.md), [security guidelines](guidelines/security-guidelines.md),
  [UX guidelines](guidelines/ux-guidelines.md), [testing guidelines](guidelines/testing-guidelines.md)
- Runbook section "Wetter" in `infrastructure/README.md`; manual service check `backend/scripts/weather-live-check.mjs`

## 7. Change Log

| Date | Epic | Change |
|------|------|--------|
| 2026-10-28 | Weather (`weather`) | Forecast, radar and warning sources, radar document and map tile routes, the rotating wall tile with manual switching and the stacked phone section, rain statement, symbols, warning banner, compact short-screen layout, runbook section and live-check script. |
