# PRD: Dashboard Foundation

> **Status:** Ready
> **Confidence:** 92%
> **Created:** 2026-10-27
> **Last updated:** 2026-10-28

## 1. Problem Statement

Two people want a Home-Dashboard on a wall-mounted tablet that shows at a glance what the
household needs in daily life (weather, calendar, shopping list / to-dos, news headlines).
Before any of these tiles can deliver value, the household needs a dashboard that exists,
runs on the family's Synology NAS, is reachable from the tablet and from phones in the home
Wi-Fi, looks polished and is readable from 2–3 meters, and keeps running for days without
anyone touching it.

If this foundation is weak, every later tile inherits the problem: a display that freezes,
shows a blank screen when the internet drops, looks flat, or needs a manual reload after
every update would erode the household's trust in the dashboard — stale or broken-looking
data is the biggest risk named in the UX guidelines. This epic delivers the shared base
(shell, design language, tile behaviour, data-freshness behaviour, deployment, home-network
protection) that the four tile epics (`weather`, `combined-calendar`, `shopping-list-todos`,
`news-headlines`) plug into.

## 2. Goals & Success Metrics

**Goals**

- G-1: A beautiful, animated, distance-readable dashboard shell on the wall tablet.
- G-2: Unattended operation for days and weeks, including recovery from restarts and outages.
- G-3: A consistent, honest way for every tile to show loading, empty, fresh, stale and
  error states — never a blank screen.
- G-4: A reusable way for the system to fetch external data on a schedule, remember it, and
  keep showing the last known data when a source or the internet is unavailable.
- G-5: Simple, repeatable deployment on the NAS, reachable only inside the home network.
- G-6: The same app is usable from a phone on the home Wi-Fi.

**Success metrics**

| Metric | Target |
| ------ | ------ |
| Continuous unattended runtime of the display without manual action | ≥ 7 days with no freeze, visible slowdown or layout drift |
| Recovery of the display after a NAS or application restart or a new dashboard version | Automatic, without touching the tablet |
| Blank or error-only screens during a simulated internet outage | 0 (last known data stays visible) |
| Text readability from 2–3 m on the wall tablet | Smallest text meets the minimum size set in FR-3 |
| Reachability from outside the home network | None |
| Steps for the household to start/update the dashboard on the NAS | One documented repeatable procedure |

## 3. User Stories & Personas

**Personas**

- **Household member (viewer)** — one of two adults who glances at the wall tablet while
  passing by, from 2–3 m. Wants calm, clear information, no interaction.
- **Household member (phone user)** — the same person on their phone in the home Wi-Fi, who
  wants to look at the dashboard and (in later epics) edit lists.
- **Household administrator** — the person who installs and maintains the dashboard on the
  NAS. Wants one repeatable procedure, secrets that stay on the NAS, and a clear sign when
  something is wrong.

**User stories**

- US-1: As a viewer, I want a large, clear, animated dashboard on the wall tablet so I can
  read time, date and tile contents from across the room.
- US-2: As a viewer, I want the dashboard to look good and calm at night so it does not
  glare in the room and does not burn into the screen.
- US-3: As a viewer, I want to see how fresh the data of each tile is, so I know whether I
  can trust it.
- US-4: As a viewer, I want the dashboard to keep showing the last known data when the
  internet or an external service is down, so the screen is never blank.
- US-5: As a viewer, I want the dashboard to recover on its own after a power cut or update,
  so nobody has to walk to the tablet and reload it.
- US-6: As a phone user, I want the same dashboard to be usable on my phone in the home
  Wi-Fi.
- US-7: As an administrator, I want to start and update the dashboard on the NAS with one
  repeatable procedure and keep all credentials on the NAS.
- US-8: As an administrator, I want to be certain that the dashboard cannot be reached from
  the internet.

## 4. Features

### Feature 1 (F-1): Distance-readable dashboard shell

- Description: A fullscreen landscape dashboard layout for the wall tablet with a tile grid,
  a large clock and date, and a consistent, minimalist yet distinctive ("fancy minimalistic")
  visual design language (type scale, colors, spacing, icons) that all later tiles reuse.
  The tablet is not purchased yet, so the layout must be robust for common landscape tablet
  screens (16:10 and 4:3). All UI text is German.
- Acceptance Criteria:
  - AC-1: On a landscape tablet screen in fullscreen, the dashboard shows a clock, the date
    and a set of placeholder tiles without scrolling.
  - AC-37: The layout renders without clipping, overlap or scrolling on both a 16:10 and a
    4:3 landscape screen at tablet sizes (for example 1920×1200 and 2048×1536).
  - AC-2: The smallest text on the dashboard meets the minimum size defined for 2–3 m
    readability (see FR-3).
  - AC-3: All user-visible texts are German and come from a central text source; no text is
    hard-coded in components.
  - AC-4: Adding a new tile later requires no change to the shell's layout rules beyond
    declaring the tile (verified by adding a demo tile in a test).

### Feature 2 (F-2): Animated design language

- Description: Moderate, purposeful and calm animation — staggered entrances, slow ambient
  background motion and smooth clock/number transitions — in a "fancy minimalistic" style
  that makes the dashboard feel polished without hurting stability on the tablet. Rich
  effects such as parallax or particle effects are not part of this epic.
- Acceptance Criteria:
  - AC-5: On first load, tiles animate in with a staggered entrance.
  - AC-6: The clock and changing values transition smoothly rather than jump.
  - AC-7: With the operating system's "reduce motion" setting enabled, non-essential motion
    is replaced by static display or simple fades.
  - AC-8: After 24 hours of continuous running on the target tablet, animations show no
    visible stutter and memory use of the page has not grown beyond the agreed ceiling
    (see NFR-2).

### Feature 3 (F-3): Common tile states

- Description: Every tile uses the same set of visible states so the household learns them
  once: loading, empty, fresh, stale (with a "zuletzt aktualisiert …" indication), error,
  and never-loaded. Data is never replaced by a blank area.
- Acceptance Criteria:
  - AC-9: A demo tile can be put into each state and each state is visually distinct and
    readable from a distance.
  - AC-10: In the stale state the tile still shows the last known content plus the time of
    the last successful update in German.
  - AC-11: A tile becomes stale after the freshness threshold defined for its source (see
    FR-6) and returns to fresh automatically after the next successful update.
  - AC-12: No tile state ever results in an empty, unlabeled area.

### Feature 4 (F-4): Unattended stability and self-recovery

- Description: The display runs for days without interaction, shows a calm offline
  indication when the backend is unreachable, and recovers automatically after restarts and
  after the dashboard itself has been updated.
- Acceptance Criteria:
  - AC-13: When the backend is stopped, the display shows a calm "offline" indication and
    keeps the last data visible; when the backend returns, the indication disappears without
    manual action.
  - AC-14: After a restart of the whole NAS, the dashboard becomes available again and the
    already open tablet display reconnects and shows current data without being touched.
  - AC-15: After a new version of the dashboard has been deployed, the open tablet display
    shows the new version without manual reload.
  - AC-16: The display survives 7 days of continuous operation without a freeze (see
    NFR-1).
  - AC-38: With one tap on the display the dashboard enters fullscreen and keeps the
    screen awake; after an interruption (for example the screen lock or leaving fullscreen)
    the app re-establishes keep-awake automatically and shows a discreet hint when a tap is
    needed again to restore fullscreen.
  - AC-39: Recommended tablet settings for permanent kiosk-style operation (for example
    auto-lock off, guided access/kiosk mode) are documented for the administrator.

### Feature 5 (F-5): Day/night mode and burn-in protection

- Description: The wall display switches automatically between a day and a dimmed, calmer
  night appearance on a fixed daily schedule that the administrator can configure (for
  example 22:00–06:30), and protects the tablet screen from burn-in with a slow shift of
  static elements. At night the whole dashboard stays visible, only dimmed.
- Acceptance Criteria:
  - AC-17: The dashboard switches between day and night appearance automatically at the
    configured times, without reload or manual action.
  - AC-18: In night appearance, static elements slowly shift position so no pixel stays
    unchanged for long.
  - AC-19: Both appearances meet the readability requirements (see NFR-4).
  - AC-40: In night appearance all tiles remain visible and readable, only dimmer; none are
    hidden.

### Feature 6 (F-6): Phone-responsive view

- Description: The same app adapts to a phone screen in the home Wi-Fi with a list-first
  order: shopping list and to-dos on top, a compact overview of the other tiles below. In
  this epic the responsive shell and placeholder tiles exist; the real list content follows
  in `shopping-list-todos`. Phones need no night drift.
- Acceptance Criteria:
  - AC-20: On a typical phone viewport the dashboard is usable without horizontal scrolling
    and with touch targets large enough for comfortable tapping (see NFR-4).
  - AC-21: On the phone, the lists tile is shown first and the other tiles follow in a
    compact form below it.

### Feature 7 (F-7): Scheduled data gathering with last-known-data fallback

- Description: A shared foundation that lets later epics fetch data from external sources on
  a schedule, remember the results, and serve the last known data together with its
  "last updated" time when a source or the internet is unavailable. External services are
  never contacted directly from the tablet or phone.
- Acceptance Criteria:
  - AC-22: A demo source is fetched on its schedule and its latest result plus "last
    updated" time is available to the display.
  - AC-23: When the demo source fails, the previous result stays available, the "last
    updated" time does not change, and the failure is visible to the household as a stale
    state (not a crash).
  - AC-24: Cached data survives a restart of the application and of the NAS.
  - AC-25: A failure of one source does not affect the display of other sources.

### Feature 8 (F-8): Household configuration and secrets

- Description: A single place on the NAS where the administrator sets household-level
  values (for example home location, night schedule) and credentials. Secrets never leave
  the NAS. The administrator edits settings by hand in files on the NAS (one for settings,
  a separate one for credentials); there is no settings screen.
- Acceptance Criteria:
  - AC-26: The home location and other household settings can be changed by the
    administrator without changing the application's code.
  - AC-27: Credentials and API keys are not contained in the repository, the delivered
    images, the files delivered to the tablet or phone, or the logs.
  - AC-28: A documented example configuration with placeholders exists for the
    administrator.

### Feature 9 (F-9): NAS deployment and home-network-only access

- Description: A repeatable way to start, update and stop the dashboard on the Synology NAS
  that starts automatically after NAS reboots, keeps data across updates, works on the NAS
  CPU architecture (Synology NAS, Intel x86_64) and is only reachable from the home
  network through a local hostname (for example dashboard.home; a fixed address is the
  fallback if the router cannot provide local names). Updates are deployed with a one-command
  script from the administrator's Mac that builds, transfers and restarts the dashboard
  while keeping data. The data is copied nightly into a NAS folder that the NAS's own backup
  tools can include. Phones and the tablet need no login; guests are assumed to use a
  separate guest network that cannot reach the NAS.
- Acceptance Criteria:
  - AC-29: Following the documented procedure on a clean NAS, the dashboard is running and
    reachable from the tablet and a phone in the home Wi-Fi.
  - AC-30: After an update, stored data (cache and, in later epics, lists) is still there.
  - AC-31: After a NAS reboot the dashboard starts without manual action.
  - AC-32: From outside the home network (for example mobile data) the dashboard cannot be
    reached.
  - AC-33: The delivered images run on the NAS (Intel x86_64).
  - AC-41: Every night a copy of the stored data is written to a NAS folder; the
    documented restore procedure brings the dashboard back with that data.
  - AC-42: One documented command on the administrator's Mac builds, transfers and restarts
    the dashboard on the NAS; data is retained.
  - AC-43: The dashboard is reachable under the configured local hostname from the tablet and
    a phone, and needs no login on either; the "guests use a separate network" assumption is
    documented.

### Feature 10 (F-10): Operational visibility

- Description: The household and the administrator can tell whether the dashboard is
  healthy. The health signal exposes no data. On the dashboard, each tile shows
  "zuletzt aktualisiert vor X Min" and turns amber once its source's freshness threshold
  (about twice its refresh interval) is exceeded, and a small global dot indicates when the
  backend is offline. External monitoring or push alerts are not part of this epic.
- Acceptance Criteria:
  - AC-34: The NAS container manager shows the dashboard's health status.
  - AC-35: The health signal contains no household data, credentials or error details.
  - AC-36: When data is stale or the backend is unreachable, this is visible on the
    dashboard itself.

## 5. Functional Requirements

- FR-1: The dashboard provides a fullscreen tile-based layout for the wall tablet showing
  clock, date and a configurable set of tiles. (F-1)
- FR-2: All UI text is German and stored centrally. (F-1)
- FR-3: Text size scales fluidly with the screen, with a hard minimum for the smallest text
  of about 28 px equivalent on a typical tablet screen, so it stays readable from 2–3 m. (F-1)
- FR-4: The shell supports adding tiles without changing the layout rules. (F-1)
- FR-5: Tiles support the states loading, empty, fresh, stale, error and never-loaded, and
  never show a blank area. (F-3)
- FR-6: Every data source has a freshness threshold after which its tile is shown as stale;
  thresholds are defined per source, by default about twice its refresh interval. (F-3, F-7)
- FR-7: The system displays the time of the last successful update for each source, using
  the time recorded when the data was obtained, not the display's own clock. (F-3, F-7)
- FR-8: The system fetches data from external sources on a schedule independently of whether
  a display is open, stores the results, and serves the last known result when a source is
  unavailable. (F-7)
- FR-9: Tablet and phone never contact external services directly. (F-7)
- FR-10: A failure of one source does not affect other sources or the shell. (F-7)
- FR-11: The display shows a calm offline indication when the backend is unreachable and
  recovers automatically when it returns. (F-4)
- FR-12: The display adopts a newly deployed version without manual reload. (F-4)
- FR-13: The display switches between day and night appearance automatically at
  administrator-configured daily times, dims the whole dashboard at night, and shifts static
  content slowly to prevent burn-in. (F-5)
- FR-14: The dashboard adapts to phone screens with the lists first and the other tiles
  compact below. (F-6)
- FR-15: Motion honors the operating system's "reduce motion" setting. (F-2)
- FR-16: One tap on the display activates fullscreen and keep-awake; the app re-establishes
  keep-awake automatically after interruptions and documents recommended tablet kiosk
  settings. (F-4)
- FR-17: The administrator can set household values (such as home location) and credentials
  outside the code, on the NAS. (F-8)
- FR-18: The dashboard is deployed as a repeatable procedure on the NAS that keeps data
  across updates and starts automatically after NAS reboot. (F-9)
- FR-19: The dashboard is reachable only inside the home network. (F-9)
- FR-20: The dashboard exposes a health signal without household data. (F-10)
- FR-21: Read-only access to calendars is the only calendar access the system supports;
  no feature in this foundation adds write access to external accounts. (F-7, F-8)
- FR-22: The dashboard is reachable under a local hostname; no login is required on tablet
  or phones. Any device in the home network may view the dashboard and, in later epics,
  edit lists. Guest devices are assumed to be on a separate network that cannot reach the
  NAS. (F-9)
- FR-23: The stored data is copied automatically every night into a NAS folder. (F-9)
- FR-24: A single documented command on the administrator's Mac deploys and updates the
  dashboard on the NAS. (F-9)
- FR-25: Household settings are read from files on the NAS; there is no settings screen,
  and credentials are kept in a file separate from other settings. (F-8)

## 6. Non-Functional Requirements

- NFR-1: Stability — continuous operation of the display for at least 7 days without freeze,
  crash or required manual action. (AC-16)
- NFR-2: Performance — animations run smoothly on the target tablet; page memory use after
  24 hours stays within a ceiling to be set in the spec based on measurements on the target
  device (no growth trend). (AC-8)
- NFR-3: Resilience — no outage of internet or of an external service may blank the screen
  or crash the app. (AC-12, AC-23)
- NFR-4: Accessibility and readability — best-effort accessibility: good contrast, the
  minimum text size from FR-3 and generous touch targets for tablet and phone; a formal
  WCAG level is not required. Both day and night appearance must stay readable.
  (AC-19, AC-20)
- NFR-5: Security — credentials only on the NAS; the app is not reachable from the internet;
  the health signal discloses no data; no API keys in anything delivered to the tablet or
  phone; API responses are not stored by browsers longer than necessary. (AC-27, AC-32, AC-35)
- NFR-6: Privacy — household data (including work-calendar data in later epics) stays on
  the NAS and the home network; no third-party analytics or tracking. (AC-27)
- NFR-7: Operability — one documented procedure to deploy, update and restore; example
  configuration provided. (AC-28, AC-29)
- NFR-8: Compatibility — runs on the NAS (Synology NAS, Intel x86_64) and in current
  browsers of the wall tablet (landscape, 16:10 and 4:3) and typical phones. (AC-33, AC-37)
- NFR-9: Internationalisation — German UI; text kept centrally so another language can be
  added later. (AC-3)
- NFR-10: Observability — failures of data fetching are recorded in logs without
  credentials; stale/offline state visible on the dashboard. (AC-36)

## 7. Out of Scope

- The tile content itself: weather, calendar, shopping list / to-dos, news (own epics).
- Access from the internet or from outside the home network.
- User accounts, login, roles.
- Smart-home control, public transport, waste collection (later deliveries).
- An in-dashboard settings UI for administrators.
- Native app or dedicated kiosk operating-system setup beyond documenting recommended
  tablet settings.
- Monitoring/alerting tools external to the dashboard (for example push alerts).
- Portrait or adaptive tablet layouts; images for CPU architectures other than Intel x86_64.
- Rich animation effects (parallax, particles) and a formal WCAG conformance level.
- Automatic unattended updates from an online registry; off-NAS backup copies.

## 8. Dependencies & Risks

**Dependencies**

- Synology NAS (Intel x86_64) with Container Manager.
- Wall tablet: not purchased yet, so model, resolution and browser are unknown; the layout
  is designed for landscape 16:10 and 4:3 and fine-tuned once the tablet is chosen.
- Home router capabilities (local hostname, separate guest network).
- All four tile epics depend on this epic.

**Risks**

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Tablet not chosen yet; its browser may limit keep-awake, fullscreen or animation performance | Display sleeps, stutters or layout needs rework | Robust 16:10/4:3 layout (AC-37); re-measure and fine-tune on the real tablet once bought |
| Long-running browser slowly leaks memory | Display freezes after days | NFR-1/NFR-2; soak test on the tablet |
| Burn-in on the tablet panel | Permanent screen damage | Night dimming and slow pixel shift (F-5) |
| Router cannot provide a local hostname | Unstable URL | Fixed address with a reservation in the router as fallback |
| Guest devices on the same network can reach the dashboard | Unwanted access and list edits | Documented assumption of a separate guest network (FR-22) |
| Over-ambitious animation | Instability on tablet | Moderate animation only; performance ceiling NFR-2 |
| Later move to an ARM NAS | Images do not run | Out of scope now; rebuild images for the new architecture |

## 9. Iteration Log

### Iteration 1 — 2026-10-27

- Questions asked: 17
- Questions resolved: 0
- Confidence: — → 45%
- Summary of changes: Initial draft from roadmap, briefing, architecture/UX/infrastructure/
  security guidelines and advisor input. Product decisions about layout, day/night,
  phone view, animation, accessibility, stale indication, deployment, backup and access
  are open.

### Iteration 2 — 2026-10-28

- Questions asked: 3 follow-ups (Q18–Q20); Q1–Q17 answered in chat
- Questions resolved: 20
- Confidence: 45% → 92%
- Summary of changes: Reconciled all answers. Landscape-only tablet layout; automatic
  day/night on configurable fixed times with the whole dashboard dimmed and burn-in drift;
  list-first phone layout; moderate "fancy minimalistic" animation; best-effort
  accessibility (no WCAG level); fluid type with a hard minimum; per-tile staleness
  indication plus global offline dot; tap-to-fullscreen with keep-awake; automatic
  reconnect and reload on new version; local hostname; Intel x86_64 images only (NAS);
  nightly data copy to a NAS folder; hand-edited settings and credential files; firewall plus
  LAN-only binding; no-login access with a separate guest network assumed; one-command
  deployment script. Tablet not purchased yet, so the layout is designed for 16:10 and 4:3
  landscape and recorded as a risk. Added AC-37 to AC-43 and FR-22 to FR-25. Status set to
  Ready.

---

## Open Questions

_None — all questions are reconciled._
