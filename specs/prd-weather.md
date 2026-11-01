# PRD: Weather

> **Status:** Ready
> **Confidence:** 92%
> **Created:** 2026-10-28
> **Last updated:** 2026-10-28

## 1. Problem Statement

The household wants to see the weather at a glance on the wall tablet and to answer the question
that matters most in daily life: *do I need a jacket now, and when exactly does the next shower
arrive?* One of the two users checks the rain situation several times a day, today in a separate
app. The weather tile of the dashboard (top-left quadrant of the wall layout) must replace that
habit: current conditions, the next hours, the coming week, the precise timing of rain and an
animated rain radar, readable from 2–3 meters and calm enough to run on the wall all day.

The dashboard foundation already provides the tile frame, its states (loading, never-loaded,
empty, fresh, stale, error), scheduled data gathering with a last-known-data fallback and the
phone layout. This epic delivers the first real tile on top of it and proves that pattern for the
other tiles.

## 2. Goals & Success Metrics

**Goals**

- G-1: Current conditions for the home location are visible from a distance at all times.
- G-2: The next hours, the next seven days and the exact timing of rain are one glance away without
  touching the tablet.
- G-3: An animated rain radar shows where rain is coming from and when it arrives.
- G-4: Official severe-weather warnings for the home location are visible.
- G-5: The tile stays calm, polished and truthful: it never shows a blank area and always says how
  old its data is when it is not fresh.

**Success metrics**

| Metric | Target |
| ------ | ------ |
| Time to find the next rain start (or "no rain") | Visible on the wall without interaction within one rotation of the tile (about 45 s) |
| Data freshness under normal conditions | Weather values at most 15 min old, radar images at most 15 min old |
| Smallest text on the wall tile | At least the foundation minimum (28 px) |
| Tile behavior with the weather service unreachable | Last known data stays visible with its age; 0 blank or broken-looking areas |
| Households needing a separate weather or rain app for daily use | 0 (qualitative, judged by the two users after two weeks) |

## 3. User Stories & Personas

- **Viewer at the wall** — passes the tablet and wants to know the temperature, the condition and
  whether it will rain, from 2–3 m, without touching it.
- **Rain checker** — wants to know when exactly the next shower starts and ends, and to see the radar
  moving, several times a day, on the wall or on the phone.
- **Phone user** — wants the hourly and daily details on the phone, where there is room to scroll.
- **Administrator** — wants no account or key to manage, and a clear sign when the data source is
  failing.

User stories:

- US-1: As a viewer, I want the current temperature, a symbol and a short German description, so I
  know how it is outside right now.
- US-2: As a viewer, I want today's high and low and the chance of rain, so I can dress and plan.
- US-3: As a viewer, I want the next few hours and the next seven days, so I can plan the day and week.
- US-4: As a rain checker, I want to read when rain starts and how long it lasts, so I can time my
  walk or bike ride.
- US-5: As a rain checker, I want an animated rain radar, so I can see the shower approach.
- US-6: As a viewer, I want to be warned about official severe weather for my location.
- US-7: As a viewer, I want the tile to rotate through these views on its own and to pause or jump on
  a tap, so I get everything without a remote control.
- US-8: As a phone user, I want hourly and daily detail on the phone.
- US-9: As an administrator, I want the tile to say when its data is old or unavailable.

## 4. Features

### Feature 1 (F-1): Current conditions

- Description: The "now" view shows the temperature in °C, a condition symbol with a short German
  description (a fixed set of about ten labels such as "Leicht bewölkt", "Regen", "Gewitter"), today's
  high and low and today's rain probability in one line (for example "Heute 8° / 14°, Regen 60 %"), and
  the name of the home location in the tile heading. Wind is shown only when notable (from about
  40 km/h) with its speed in km/h and direction.
- Acceptance Criteria:
  - AC-1: The now view shows temperature, symbol, German description, today's high and low and today's
    rain probability for the configured home location.
  - AC-2: The tile heading contains the configured location name. On short tablet screens (up to 850 px
    high) the name may be left out of the visible heading to save height; it stays available to assistive
    technology.
  - AC-3: Every condition reported by the data source maps to one of the German labels and a symbol;
    an unknown condition shows a neutral label and symbol instead of an empty area.
  - AC-4: Wind appears on the wall tile only at or above the notable-wind threshold; below it no wind
    element is shown.
  - AC-5: All values use °C, km/h and 24-hour time.

### Feature 2 (F-2): Hourly forecast

- Description: The next four to five hours are shown as slots (hour, symbol, temperature, rain
  probability) in the now view on the wall. The phone shows the next 24 hours.
- Acceptance Criteria:
  - AC-6: The wall now view shows exactly five upcoming hourly slots starting with the next full hour.
    On short tablet screens (up to 850 px high) with an active warning the hourly strip may be left out to
    keep the warning readable.
  - AC-7: Each slot shows the hour (24-hour format), symbol and temperature; the rain probability is
    shown when it is at least 20 %.
  - AC-8: On the phone the hourly list covers the next 24 hours.

### Feature 3 (F-3): Seven-day forecast

- Description: A forecast view for the next seven days (weekday, symbol, high and low, rain
  probability or amount) is part of the wall rotation and is always listed on the phone.
- Acceptance Criteria:
  - AC-9: The seven-day view shows seven days starting with today, each with weekday (German), symbol,
    high and low. On short tablet screens (up to 850 px high) the symbol may be conveyed to assistive
    technology only.
  - AC-10: Days with a rain probability of at least 20 % show it.
  - AC-11: On the phone the seven-day list is part of the weather section and needs no interaction.

### Feature 4 (F-4): Rain timing

- Description: A rain view shows the expected precipitation for the next two to three hours in
  15-minute steps as a bar line and states the result in words: when rain starts and how long it lasts
  ("Regen ab 14:15, ca. 40 Min."), that it is raining now and when it stops, or that no rain is
  expected. The sentence is also visible on the wall in the now view.
- Acceptance Criteria:
  - AC-12: The rain view shows precipitation for at least the next two hours in 15-minute steps.
  - AC-13: If rain is expected within the shown period, the sentence names its start time and
    approximate duration; if it is raining now, it names the expected end; if none is expected it says
    so.
  - AC-14: The now view contains a one-line rain statement with the next rain start or "kein Regen in
    den nächsten 2 Stunden". On short tablet screens (up to 850 px high) with an active warning the line may
    be left out; the rain view still shows the statement.
  - AC-15: Precipitation too small to matter (below a drizzle threshold) does not produce a rain
    statement.

### Feature 5 (F-5): Animated rain radar

- Description: A radar view shows a map section around the home location with the precipitation
  radar as an animated loop covering the recent past and the forecast of about the next two hours,
  with a marker for the home location and the time of the current frame. The loop is part of the wall
  rotation and is on the phone's weather section. The radar uses open weather-service data for
  Germany; the images are fetched, kept and delivered by the backend only, and the radar view names its
  source.
- Acceptance Criteria:
  - AC-16: The radar view shows an animated loop of consecutive radar frames covering the recent past
    and the forecast, with a marker for the home location.
  - AC-17: Each frame is labelled with its time and distinguishes observed from forecast frames.
  - AC-18: The radar images shown are at most 15 minutes old under normal conditions.
  - AC-19: When no radar images are available the radar view shows a calm state naming that, and the
    rain view (Feature 4) still works from its own data.
  - AC-20: The loop stops and shows one frame under "reduce motion".
  - AC-21: The radar view displays the credit of its data source.

### Feature 6 (F-6): Automatic view rotation

- Description: On the wall the weather tile cycles through the views "now and hours", "seven days" and
  "rain and radar" with a calm cross-fade, dwelling about 15 seconds on each. The viewer can switch views by hand at any time: a swipe to the
  left shows the next view, a swipe to the right the previous one, a tap on the tile advances to the
  next view, and a tap on one of the view indicators jumps straight to that view. Any such input pauses
  the rotation, which resumes by itself after a while. The indicators show the current view. On the
  phone all views are shown one below the other without rotation.
- Acceptance Criteria:
  - AC-22: On the wall the tile changes view automatically every 15 seconds (+/- 2 s) through all
    three views and starts again.
  - AC-23: A tap on the tile advances to the next view and pauses the rotation; the rotation resumes
    after 60 seconds without any input.
  - AC-24: The current view is indicated, and the indicator is not conveyed by color alone.
  - AC-25: Under "reduce motion" the views change with a short fade (at most 150 ms) instead of
    movement.
  - AC-26: The phone shows all views in one scrolling section without any rotation.
  - AC-44: A horizontal swipe of at least 60 px to the left shows the next view and to the right the
    previous one (wrapping around), pauses the rotation and does not scroll the page.
  - AC-45: Each view indicator is a touch target of at least 56 px on the wall layout and shows its
    view in German to assistive technology; a tap on it shows that view directly and pauses the
    rotation.
  - AC-46: Every manual switch (swipe, tap on the tile, tap on an indicator) uses the same calm
    transition as the automatic one, or a fade of at most 150 ms under "reduce motion".
  - AC-27: A view never rotates away while the tile is in the stale, error or never-loaded state;
    the state is shown instead (see Feature 9).

### Feature 7 (F-7): Calm animated symbols

- Description: Condition symbols have a very slow, subtle movement (sun glow, drifting cloud) and
  separate day and night variants that follow the dashboard's day and night schedule. No particle or
  scene effects.
- Acceptance Criteria:
  - AC-28: Symbols for at least clear, partly cloudy, cloudy, rain, thunderstorm, snow and fog exist in
    a day and a night variant and follow the active theme.
  - AC-29: Symbol movement uses only transform and opacity and is slower than one visible change every
    three seconds.
  - AC-30: Under "reduce motion" symbols are static.

### Feature 8 (F-8): Severe-weather warning

- Description: When an official severe-weather warning is active for the home location, the tile shows
  a warning hint on every view: an icon, the warning type in German (for example "Sturm", "Gewitter",
  "Starkregen"), its severity level as text and the time until it applies. With several warnings the
  most severe is shown, with a count of further ones. Warnings that are not active are not shown.
- Acceptance Criteria:
  - AC-31: An active warning for the home location is shown on every wall view and in the phone
    section, with icon, German type, severity as text and its validity period.
  - AC-32: The severity is never conveyed by color alone.
  - AC-33: With several active warnings the most severe is shown plus the number of further warnings.
  - AC-34: Without an active warning no warning element and no reserved empty space is shown.
  - AC-35: When warning data is unavailable the weather views still work and the tile does not claim
    that there is no warning; it shows that warnings could not be checked once the warning data is stale.

### Feature 9 (F-9): Freshness, outage and credit

- Description: Weather values refresh every 15 minutes, the radar images at least every 15 minutes and
  warnings at least every 15 minutes, all gathered by the backend independently of any open display.
  Each part follows the dashboard's tile states: stale data stays visible with its age ("Veraltet,
  zuletzt aktualisiert vor X Min."), never-loaded and first-failure have calm German texts without
  codes. The tile carries a small, legible credit for its data sources.
- Acceptance Criteria:
  - AC-36: Weather data is refreshed every 15 minutes while the dashboard runs, also when no display
    is open.
  - AC-37: A part whose data is older than twice its refresh interval is shown as stale with its age
    and the last known values; the tile never goes blank.
  - AC-38: Before the first data arrives the tile shows a calm "Wetter noch nicht geladen" state; when
    the first fetch fails it shows "Wetter derzeit nicht verfügbar" without error codes.
  - AC-39: A failure of one part (weather values, radar, warnings) does not hide the others.
  - AC-40: The tile shows a credit for each data source it uses (weather values, radar and warnings)
    that stays legible on a 1024 x 768 screen without overlapping content.

### Feature 10 (F-10): Wall and phone fit

- Description: The tile content fits the weather area of the wall layout on all supported tablet sizes
  without clipping, overlapping or scrolling, and the phone section stays usable and readable.
- Acceptance Criteria:
  - AC-41: In every wall view the content stays inside the tile at 1024 x 750, 1180 x 700, 1280 x 800,
    1920 x 1200 and 2048 x 1536 CSS pixels with at least 28 px text.
  - AC-42: The phone section has no horizontal scrolling at 360 px width and uses touch targets of at
    least 44 px.
  - AC-43: All texts come from the German dictionary and day and night contrast floors of the
    dashboard are met in all views.

## 5. Functional Requirements

- FR-1: The tile shows current conditions for the single configured home location. (F-1)
- FR-2: Conditions map to a fixed German label set and symbol set; unknown conditions get a neutral
  fallback. (F-1, F-7)
- FR-3: Wind is shown on the wall tile only when notable. (F-1)
- FR-4: The wall now view shows five hourly slots; the phone shows 24 hours. (F-2)
- FR-5: A seven-day forecast view exists. (F-3)
- FR-6: Precipitation for at least two hours in 15-minute steps is shown with a plain-language
  statement of start, duration or absence. (F-4)
- FR-7: An animated radar loop of the recent past and forecast around the home location is available.
  (F-5)
- FR-8: Radar images are obtained and served only through the dashboard backend; the displays never
  contact the radar service. (F-5)
- FR-9: The tile rotates through three views on the wall; the viewer can switch by swipe, tap on the
  tile or tap on a view indicator, which pauses the rotation until it resumes automatically; the phone
  shows all views. (F-6)
- FR-10: Symbols have day and night variants and move only very slowly; reduce motion makes them static.
  (F-7)
- FR-11: Active official warnings for the home location are shown with type, severity as text and
  validity period; the most severe wins. (F-8)
- FR-12: Weather values, radar images and warnings are refreshed by the backend on a schedule (every 15
  minutes) independent of open displays. (F-9)
- FR-13: Each part has its own freshness; stale, never-loaded and error states follow the dashboard's
  state rules. (F-9)
- FR-14: Data-source credits are shown on the tile. (F-5, F-9)
- FR-15: All units are °C, km/h and 24-hour time, fixed. (F-1)
- FR-16: The tile uses only German texts from the central dictionary. (F-1 to F-10)
- FR-17: The tile fits all supported wall sizes and the phone layout without clipping. (F-10)

## 6. Non-Functional Requirements

- NFR-1: Stability — the tile (rotation, radar loop, symbol motion) must not increase page memory
  growth beyond the foundation's soak criterion over 24 hours (no growth trend). (AC-16, AC-22, AC-29)
- NFR-2: Performance — animations run smoothly on the target tablet; the radar view uses
  pre-fetched images and causes no visible stutter; transform and opacity only. (AC-16, AC-29)
- NFR-3: Resilience — no outage of the weather, radar or warning service blanks the tile or the
  dashboard. (AC-19, AC-37, AC-39)
- NFR-4: Privacy and security — the home location is sent to external weather services only by the
  backend; no key or credential is needed for the chosen data sources; tablet and phone never contact
  the services directly and no third-party resource is loaded in the browser. (FR-8)
- NFR-5: Fair use — request volume stays far below the published fair-use limits of the data sources
  (weather values, radar images and warnings each refreshed at most every 5 minutes). (AC-36)
- NFR-6: Licence compliance — the credit and licence conditions of every data source are met.
  (AC-21, AC-40)
- NFR-7: Readability — wall text at least 28 px, day and night contrast per the dashboard floors.
  (AC-41, AC-43)
- NFR-8: Observability — failures of a data source are logged without payload contents and are visible
  on the tile as stale or error. (AC-37, AC-39)
- NFR-9: Internationalisation — all texts German and central. (AC-43)

## 7. Out of Scope

- Multiple locations, location search or per-user locations.
- Configurable units (fixed °C, km/h, 24-hour time).
- Warnings beyond a simple hint (no warning details page, no push notifications).
- Radar outside Germany or zooming/panning the radar map.
- Weather history, charts beyond the rain line, air quality, pollen, UV index, sunrise and sunset.
- Weather-based automation or notifications.

## 8. Dependencies & Risks

**Dependencies**

- Dashboard Foundation (`dashboard-foundation`): tile frame and states, scheduled data gathering,
  snapshot and settings with the home location, German dictionary, layouts.
- Open weather services for forecast values, rain timing, radar images and warnings (for Germany);
  their availability and licence conditions are outside our control.

**Risks**

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Radar service unavailable or outdated (for example a day-long outage was reported for one DWD mirror) | Radar view empty | Radar has its own stale/error state; the rain line stays; choose a second access path if the first fails (spec decision) |
| Licence or attribution requirements differ from assumption | Non-compliance | Verify the licence text of each source before implementation; NFR-6 |
| Too much content for the weather quadrant on small tablets | Clipped content, unreadable text | Rotation of three views, strict fit tests at the smallest sizes (AC-41) |
| Radar images are heavy on a low-powered tablet | Stutter, memory growth | Few small frames, cached by the backend, soak test (NFR-1, NFR-2) |
| Provider fair-use limits | Blocked access | Refresh only every 15 minutes, never per display (NFR-5) |
| Weather service changes data format | Tile shows nothing or wrong values | Mapped to internal types in the backend, contract tests with recorded fixtures |
| Warnings area mismatch (warning cell versus exact location) | Missing or extra warnings | Spec decides the mapping; accept the official cell of the home location |

## 9. Iteration Log

### Iteration 1 — 2026-10-28

- Questions asked: 10 (answered interactively in chat, including a follow-up on the radar)
- Questions resolved: 10
- Confidence: — → 91%
- Summary of changes: Draft built from the roadmap, the dashboard foundation domain doc and architecture
  and UX advisor input, then reconciled with the user's answers: keyless open weather service,
  15-minute refresh, wall tile with current values, five hourly slots, a seven-day view and rain timing
  with an animated radar (open DWD data, in this delivery after the rain line), automatic rotation of
  three views that can also be switched by swipe, tap or direct selection of a view, a separate phone detail view, calm animated day/night
  symbols, a simple severe-weather warning hint, fixed units with wind only when notable. The
  user asked to check the radar option in depth: research found that the DWD radar composite and its map
  service are open and keyless for Germany (5-minute frames, about 2 hours of forecast), that a second
  provider is possible but limited (personal use, no guarantee, coarse zoom) and that licence texts must
  be verified before implementation (NFR-6).
  Defaults assumed without a question and to be confirmed at review: rotation dwell of 15 s with 60 s
  auto-resume, about ten German condition labels, notable wind from about 40 km/h, rain-probability
  display threshold of 20 %, stale after twice the refresh interval, radar and warnings refreshed every
  15 minutes, credits shown on the tile.

### Iteration 2 — 2026-10-28

- Questions asked: 1 (follow-up from the user: can the viewer switch views by hand?)
- Questions resolved: 1
- Confidence: 91% → 92%
- Summary of changes: Manual switching added to the view rotation: swipe left or right, tap on the tile
  and directly selectable view indicators (AC-44 to AC-46, FR-9 extended, AC-23 wording clarified).

### Iteration 3 — 2026-10-28

- Questions asked: 1 (verification finding, answered in chat)
- Questions resolved: 1
- Confidence: 92% → 92%
- Summary of changes: The user accepted the compact layout of the wall tile on short tablet screens (up to 850 px high,
  e.g. 1024x768 and 1280x720): location name only for assistive technology (AC-2), no hourly strip and no rain line while a
  warning is active (AC-6, AC-14), day symbols for assistive technology only (AC-9). Taller screens show everything.

---

## Open Questions

_None — all questions are reconciled._
