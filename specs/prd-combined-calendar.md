# PRD: Combined Calendar

> **Status:** Ready
> **Confidence:** 90%
> **Created:** 2026-10-28
> **Last updated:** 2026-10-28

## 1. Problem Statement

Two adults share one family calendar (Apple/iCloud) and each has a separate Google work calendar.
The question the wall tablet has to answer every morning and evening is: *who does the daycare
(Kita) drop-off and pick-up today, and does that collide with a work appointment?* Today this means
opening three calendars in three apps. The calendar tile of the dashboard (right side of the wall
layout) must show the appointments of all three calendars in one calm agenda, readable from 2–3 meters,
with the family calendar as the most important one and the daycare duty impossible to miss.

The dashboard foundation already provides the tile frame and its states, scheduled data gathering with a
last-known-data fallback, the phone layout and the pattern of a tile with several views that was proven by
the weather tile. This epic delivers the calendar tile on top of it. Calendars are only read; nothing is ever
written to any calendar account, and credentials stay on the NAS.

## 2. Goals & Success Metrics

**Goals**

- G-1: Today and the next three days of all three calendars are visible in one agenda without touching the tablet.
- G-2: The family calendar stands out; each appointment can be attributed to its calendar at a glance.
- G-3: The daycare duty for today and tomorrow is shown in its own block whenever there is one.
- G-4: A viewer can switch to the family calendar only or to one person's calendar when needed.
- G-5: One failing calendar never hides the others, and an outdated calendar says how old its data is.

**Success metrics**

| Metric | Target |
| ------ | ------ |
| Time to see who does the daycare run today | Visible on the wall without interaction (no tap needed) |
| Data freshness under normal conditions | A new or changed appointment is visible within 15 minutes |
| Smallest text on the wall tile | At least the foundation minimum (28 px) |
| Tile behavior with one calendar unreachable | The other calendars stay fully visible; the affected one is marked with its age; 0 blank areas |
| Households opening a calendar app to plan the next days | 0 for ordinary planning (qualitative, judged by the two users after two weeks) |

## 3. User Stories & Personas

- **Viewer at the wall** — passes the tablet and wants to know what is on today and in the next days, from 2–3 m.
- **Parent on duty** — wants to see whether they have the daycare drop-off or pick-up today or tomorrow, and
  whether their own work calendar conflicts with it.
- **Partner** — wants the same view for their own work calendar and the family calendar.
- **Phone user** — wants the same agenda on the phone.
- **Administrator** — wants no extra account, no write access, and a clear sign when a calendar is not reachable.

User stories:

- US-1: As a viewer, I want one agenda of today and the next three days, so I do not open three calendars.
- US-2: As a parent, I want a "Kita" block with the duty of today and tomorrow, so I never miss a pick-up.
- US-3: As a parent, I want to see my work appointments next to the family appointments, so I can spot conflicts.
- US-4: As a viewer, I want to switch to the family calendar only or to one person, so I can focus.
- US-5: As an administrator, I want a failing calendar to be marked, not to blank the tile.

## 4. Features

### Feature 1 (F-1): Combined agenda

- Description: One agenda that merges the family calendar and both work calendars for today and the next
  three days, grouped by day.
- Acceptance Criteria:
  - AC-1: The default agenda shows the appointments of all three calendars for today and the next three days,
    grouped by day with a German day heading ("Heute", "Morgen", then weekday and date).
  - AC-2: Within a day, appointments are ordered by start time; all-day appointments come first.
  - AC-3: A day without appointments is left out, except today: if today has none, the agenda says
    "Heute keine Termine".
  - AC-4: If no calendar has any appointment in the whole period, the tile shows a calm empty state instead of a blank area.
  - AC-5: Each appointment shows start time (24-hour format), title and the calendar colour. Location and
    description are not shown.
  - AC-6: Text that does not fit is shortened with an ellipsis; the tile never overflows its card.

### Feature 2 (F-2): Correct display of every kind of appointment

- Description: All-day, multi-day and recurring appointments, time zones and cancelled or declined appointments
  are handled the way the calendar apps show them.
- Acceptance Criteria:
  - AC-7: All-day appointments show "ganztägig" instead of a time and appear on their day only.
  - AC-8: A multi-day appointment appears on every day of the period it covers, labelled "Tag 2 von 3" (for
    example) from the second day on; an appointment that started before today and runs into today appears today.
  - AC-9: Recurring appointments appear on each occurrence in the period, including exceptions (moved or
    removed single occurrences).
  - AC-10: Times are shown in the household time zone, also for appointments entered in another time zone.
  - AC-11: Appointments of today that have ended are no longer shown; running appointments stay; all-day
    appointments stay for the whole day.
  - AC-12: Cancelled appointments and appointments the person has declined are not shown; tentative ("maybe")
    appointments are shown like any other.

### Feature 3 (F-3): Attribution of appointments

- Description: Each of the three calendars has its own colour and name, and a small legend names them.
- Acceptance Criteria:
  - AC-13: Every appointment carries the colour of its calendar; the three colours are distinguishable from
    each other and meet the foundation contrast floors in both day and night theme.
  - AC-14: A legend names the calendars with their colours (for example "Familie", and the two persons); colour is
    never the only indication, because the legend and the active tab state the names in text.
  - AC-15: The names and colours of the calendars come from the household settings, not from the calendar data.

### Feature 4 (F-4): Family emphasis and switching

- Description: The default view shows all calendars with the family calendar emphasised; tabs switch to the family
  calendar only or to one person.
- Acceptance Criteria:
  - AC-16: In the default "Alle" view, family appointments are visually stronger than work appointments (larger
    or bolder), and work appointments are visually calmer, all still at least 28 px on the wall.
  - AC-17: The tile offers tabs "Alle", "Familie" and one tab per person; the active tab is indicated by shape
    and text, not by colour alone, and each tab is at least 56 px high on the wall.
  - AC-18: Selecting a tab (tap) shows only that calendar's appointments for the same period, with the same
    rules as the default view.
  - AC-19: Without any input for 60 seconds, the tile returns to the "Alle" view on its own.
  - AC-20: Switching the view uses one calm transition (a short fade under reduced motion), no layout jumps.
  - AC-21: A view whose calendar has no appointments in the period shows a calm text saying so.

### Feature 5 (F-5): Kita block

- Description: A block at the top of the tile shows the daycare duty of today and tomorrow, found by a keyword in
  the family calendar.
- Acceptance Criteria:
  - AC-22: Appointments of the family calendar whose title contains the configured keyword (default "Kita",
    case-insensitive) are shown in a block "Kita" above the agenda, for today and tomorrow, with day, time and title.
  - AC-23: The block appears only when at least one such appointment exists for today or tomorrow; otherwise it
    takes no space.
  - AC-24: The block's appointments are also removed from the agenda below, so nothing appears twice in the default view.
  - AC-25: The block is shown in the "Alle" and "Familie" views; in a person's view it is not shown.
  - AC-26: The keyword is part of the household settings and can be changed without a new software version.
  - AC-27: Ended appointments of today follow AC-11 in the block as well.

### Feature 6 (F-6): Reliable data and freshness

- Description: The tile gets its data through the dashboard's gateway, never directly from the browser, and
  stays truthful when a calendar cannot be read.
- Acceptance Criteria:
  - AC-28: The calendars are read at least every 15 minutes; a new or changed appointment is visible on the wall
    within 15 minutes plus the display's polling delay.
  - AC-29: No operation of the dashboard ever creates, changes or deletes anything in a calendar account.
  - AC-30: Calendar credentials and links are stored only on the NAS, and never appear in the browser, in
    logs, in backups or in any API response.
  - AC-31: If one calendar cannot be read, its last known appointments stay visible, marked in text as outdated
    with their age ("Veraltet · vor 40 Min."), and the other calendars are shown normally.
  - AC-32: A calendar that has never been loaded is named in text as not yet available while the others show.
  - AC-33: If all three calendars are unavailable, the foundation's error and stale states apply; the tile never
    shows a blank area or a technical error code.
  - AC-34: Each of the three calendars can be switched off in the settings; the others keep working and the
    legend, tabs and block follow.

### Feature 7 (F-7): Phone

- Description: The phone layout shows the same agenda, tabs and Kita block in the tile.
- Acceptance Criteria:
  - AC-35: On the phone the tile shows the same period (today and three days), tabs and block, without
    horizontal scrolling at 360 px width.
  - AC-36: All interactive elements on the phone are at least 44 px high.
  - AC-37: The phone does not return to the "Alle" view on its own; the selection stays until changed or reload.

## 5. Functional Requirements

- FR-1: The system merges the family calendar and both work calendars into one agenda (F-1).
- FR-2: The system displays all-day, multi-day and recurring appointments, time zones, cancelled and declined
  appointments correctly (F-2).
- FR-3: The system attributes each appointment to its calendar by colour and name (F-3).
- FR-4: The system offers tabs to restrict the view to one calendar and returns to the default view after inactivity (F-4).
- FR-5: The system emphasises the family calendar in the default view (F-4).
- FR-6: The system shows the daycare duty of today and tomorrow in its own block based on a configurable keyword (F-5).
- FR-7: The system reads calendars on a schedule through the gateway, read-only, and keeps the last known data (F-6).
- FR-8: The system marks outdated or unavailable calendars individually and never lets one hide the others (F-6).
- FR-9: The system keeps all calendar credentials on the NAS (F-6).
- FR-10: The tile follows the foundation's tile states, wall layout and phone layout (F-1, F-7).
- FR-11: All user-visible texts are German and come from the dictionary (all features).

## 6. Non-Functional Requirements

- NFR-1: Stability — the tile runs for days without a reload; opening, switching and returning to the default view
  leave no growing memory or timers.
- NFR-2: Readability — on the wall every text is at least 28 px and meets the foundation contrast floors; the tile fits
  its card at the supported tablet sizes with and without a Kita block and with long titles.
- NFR-3: Security and privacy — read-only access, credentials only on the NAS, no calendar data in logs, no calendar
  request from the browser, and no calendar data outside the home network.
- NFR-4: Efficiency — the load on the calendar providers stays at one refresh per calendar per interval; the display
  never triggers a provider request.
- NFR-5: Accessibility — tabs are labelled for screen readers and exposed as a tablist; each appointment's calendar is
  available as text for assistive technology.
- NFR-6: Calm motion — one shared fade for view changes, reduced to 150 ms under "reduce motion", animating only
  transform and opacity.
- NFR-7: Testability — calendar behavior can be verified with recorded calendar data of each provider without network access.

## 7. Out of Scope

- Creating, editing, accepting or deleting appointments, or any write access to a calendar.
- Reminders, notifications, alarms or sounds.
- A month or week grid, and periods beyond today plus three days.
- Showing location, description, attendees or attachments.
- Further calendars, birthdays or holiday calendars beyond the three named ones.
- Per-appointment privacy rules (all appointments of the three calendars are shown with title).
- Access from the internet, user accounts, and sign-in screens on the display.
- Rotation of the tile through calendars (switching is by hand only).

## 8. Dependencies & Risks

- Depends on `dashboard-foundation` (tile frame, states, gateway, settings, phone layout) and reuses the multi-view
  tile pattern of `weather`.
- Risk: the way to read the two Google work calendars is not yet known. A company administrator may block the
  secret-link sharing or an own app's access. The specification must establish a working read-only way before
  implementation; if none exists, the household must provide a different route (for example forwarding work
  appointments to a private calendar).
- Risk: the iCloud shared calendar needs a read-only access that works without the household's main password.
- Risk: recurring appointments with exceptions and time zones are error-prone; verification needs recorded data
  of both providers.
- Risk: the keyword in titles relies on how the household writes daycare entries.
- Calendar names, colours, the Kita keyword and each calendar's enabled flag are household settings.

## 9. Iteration Log

### Iteration 1 — 2026-10-28
- Questions asked: 11 (in chat, in three rounds plus one follow-up)
- Questions resolved: 10; the way to read the Google work calendars was answered "unknown" and is delegated to
  the specification as a documented risk.
- Confidence: 40% → 90%
- Summary of changes: Full PRD drafted from the roadmap and the user's answers: agenda list, today plus three
  days on wall and phone, empty days left out (today says "Heute keine Termine"), ended appointments hidden, colour
  per calendar with legend, family calendar emphasised in the default "Alle" view, tabs to switch with return after
  60 s on the wall, a Kita block from a configurable keyword that appears only with a match, 15-minute freshness,
  declined and cancelled appointments hidden, appointments with time, title and colour only, full titles for work
  calendars.

---

## Open Questions

_None — all questions are reconciled._
