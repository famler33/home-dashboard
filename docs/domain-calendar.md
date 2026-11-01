# Domain: Calendar

> **Last updated:** 2026-11-01
> **Related epics:** Combined Calendar (`combined-calendar`)

## 1. Overview

The calendar tile shows the next days of the household as one agenda. It merges up to three read-only calendars:
the shared family calendar (Apple/iCloud) and one work calendar (Google) per person. Each calendar is read from
its ICS feed address by the backend; the display never talks to a calendar provider. A calendar that fails does
not hide the others, and the tile keeps showing the last good data.

On the wall tablet the tile fits as many rows as the space allows and offers a tab per calendar next to "Alle".
On the phone it is one scrollable section with the same tabs but without the idle reset and without row fitting.

## 2. Key Concepts & Entities

| Concept | Meaning |
| ------- | ------- |
| **Calendar** (`family`, `person-1`, `person-2`) | A configured feed with a display name (at most 20 characters), a colour (`blue`, `green`, `orange`, `purple`, `teal`, `rose`), an `enabled` switch and optional `selfAddresses`. `family` has the role family, the others the role person. |
| **Calendar source** (`calendar-<id>`) | One backend source per enabled calendar, every 15 min (stale after 30 min, timeout 20 s). Payload: `events` (at most 200) and `truncated`. |
| **Event** | `uid`, `title` (control characters removed, at most 120 characters), `allDay`, `start`, `end`, `tentative`. Timed events carry UTC instants; all-day events carry local dates (`end` exclusive). |
| **Window** | The expanded range is yesterday up to seven days ahead in the household time zone; recurring events are expanded into single occurrences inside it. |
| **Tagged event** | An event in the frontend with its calendar, role, colour and name. |
| **Kita block** | A separate block for family events of today and tomorrow whose title contains the configured keyword (`kitaKeyword`, case-insensitive); the keyword is stripped from the shown label. |
| **Tab** | `all`, or one calendar. |

## 3. Workflows & Behaviors

**Expansion (backend).** Cancelled events are dropped; an event the owner declined (an attendee matching one of
`selfAddresses` with `PARTSTAT=DECLINED`) is dropped; `TENTATIVE` status or a tentative reply marks the event
tentative. Recurrence rules and exceptions are honoured. Times in a zone the parser does not know and floating
times count as household time. One broken event never hides the others. Expansion is bounded (20,000 steps per
rule, 100,000 per feed, a 4 s budget, 200 events); hitting a bound sets `truncated`.

**Download.** The backend keeps the last response in memory and asks with `If-None-Match`/`If-Modified-Since`; a
`304` re-expands the kept text without a download. The guarded transport is described in the security guidelines.

**Agenda (tile).** Four days starting today; today is always listed ("Heute keine Termine" when empty), other days
only when they have events. Ended events of today disappear, all-day events stay for their days, and a multi-day
event appears on each day as "Tag n von m". Order inside a day: all-day and continued events first, then by start,
family before person, then title. The tile's clock is the server time plus the monotonic time since receipt.

**All view.** The same appointment in several calendars appears once (same uid and start, or same title, start and
end); the family copy wins. Family events are emphasised, person events are quieter. In a person's tab only that
calendar shows and there is no Kita block. A colour dot (and a screen-reader name) tells the calendar of each row;
tentative events are italic and announced as "vorläufig".

**Wall fitting.** The tile measures its body and fits rows with `fitRows`: the Kita block first, then the days;
a day that does not fit collapses to a count ("n Termine") or is left out, and "+ n weitere" counts the rest.
Titles are one line with an ellipsis (the full title is in the `title` attribute); on the phone they wrap to two.

**Tabs.** Shown when more than one calendar is enabled. On the wall the tile returns to "Alle" after 60 s without
input.

**Problems per calendar.** The frame is fresh while any calendar is fresh, stale when every calendar with data is
stale, and error or never-loaded when none has data. Single problems are shown on the legend chip of the affected
calendar in text ("Veraltet · vor 40 Min.", "Noch nicht geladen", "Nicht verfügbar") with a clock icon; with tabs
the legend lists only calendars with a problem, and on short screens calendar names are screen-reader-only unless
there is a problem.

## 4. Interfaces

External services: ICS feed addresses on `calendar.google.com` and `icloud.com` (and their subdomains), https
only; the address itself is the secret.

Configuration: `sources.calendar` in `settings.yaml` (`enabled`, `kitaKeyword`, `calendars.<id>` with `enabled`,
`name`, `color`, `selfAddresses`) and one `url` per enabled calendar in `credentials.yaml` under
`calendar-<id>`. The start fails with a message naming file and key (never the value) when an enabled calendar has
no valid address. `webcal://` is rewritten to `https://`.

Snapshot: one entry `calendar-<id>` per enabled calendar, plus `settings.calendar` (`kitaKeyword` and the enabled
calendars with `id`, `name`, `color`, `role`; never the addresses or `selfAddresses`). Registry entries
`calendar` (placeholder) and `calendar-live` (shown when any `calendar-*` source exists, replaces the
placeholder, frame derived from all calendar sources).

Manual check: `backend/scripts/calendar-live-check.mjs` prints size, event count and duration of each feed
without titles or addresses.

## 5. Business Rules & Constraints

- Calendar access is read-only; the feed address is a credential and lives only in `credentials.yaml`.
- A rejected feed carries a closed reason (`url`, `host`, `redirect`, `private-address`, `size`, `content-type`,
  `status`, `parse`); logs contain the source id and that reason, never the address, a host name or feed text.
- Event titles of work calendars reach every device in the home network and are stored in the database cache,
  including the nightly backup (folder mode 0700).
- Only a secret iCal address is meant to be configured; the runbook forbids Google's guessable public address.
- Timed values are never shown in the tablet's own time zone; the household time zone from `settings.yaml` decides.
- Each calendar is identified by its configured name and colour, never by colour alone (names appear in tabs and as
  screen-reader text on every row).

Known limitations: only the family calendar has been exercised with a real feed so far; the Google work calendars
need a secret iCal address, which a company administrator may block (the runbook describes the workaround of
mirroring appointments into a private calendar). Real-tablet checks are still open.

## 6. Related Documentation

- [Dashboard Foundation domain](domain-dashboard-foundation.md)
- [Architecture reference](guidelines/architecture-reference.md), [security guidelines](guidelines/security-guidelines.md),
  [UX guidelines](guidelines/ux-guidelines.md), [testing guidelines](guidelines/testing-guidelines.md)
- Runbook section "Kalender" in `infrastructure/README.md`; manual check `backend/scripts/calendar-live-check.mjs`

## 7. Change Log

| Date | Epic | Change |
|------|------|--------|
| 2026-11-01 | Combined Calendar (`combined-calendar`) | ICS feed transport with host allow-list and address pinning, expansion of recurring events, one source per calendar, merged agenda with Kita block, tabs and per-calendar problem chips, row fitting on the wall, runbook section, live-check script and soak test. |
