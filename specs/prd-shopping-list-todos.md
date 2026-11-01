# PRD: Shopping List and To-dos

> **Status:** Ready
> **Confidence:** 90%
> **Created:** 2026-10-29
> **Last updated:** 2026-10-31

## 1. Problem Statement

Two adults keep a to-do list for the household ("Zuhause": home projects with a room, a priority, an effort in hours and
an optional prerequisite) in a small separate app on the NAS, and they want a shopping list that does not exist yet.
Both lists belong on the wall: readable from 2–3 meters, editable on the wall tablet and on the phones in the home
Wi-Fi, identical on every device within a few seconds, with no accounts. The lists tile of the dashboard (bottom left of
the wall layout, first on the phone) must become the one place for both lists, and the old to-do app must become
unnecessary without losing its open tasks.

The dashboard foundation provides the tile frame, its states, polling every 30 seconds, persistence, the nightly backup,
the phone layout and the no-login home-network model. The weather and calendar tiles proved the multi-part tile
pattern and the row-fitting approach. This epic delivers the first tile that users change, and so also establishes how
editing works on the wall and on the phone.

## 2. Goals & Success Metrics

**Goals**

- G-1: A shopping list and a to-do list, visible on the wall without touching the tablet.
- G-2: Add, check off, change and remove entries from the wall tablet and from any phone in the home network.
- G-3: A change made on one device appears on all others within one polling interval.
- G-4: Entries survive restarts and updates; the open tasks of the old to-do app come over once and the old app is replaced.
- G-5: The to-do list shows the most important tasks first, with their room.

**Success metrics**

| Metric | Target |
| ------ | ------ |
| Time for a change to appear on another device | Within 30 s under normal conditions |
| Adding a shopping entry on the phone | Under 5 s using a suggestion, under 10 s typing |
| Smallest text on the wall tile | At least the foundation minimum (28 px) |
| Entries lost by a restart, update or backup restore | 0 (a restore returns the state of the last backup) |
| Open tasks of the old app missing after the import | 0 |
| Households still using the old to-do app after two weeks | 0 (qualitative) |

## 3. User Stories & Personas

- **Shopper at the wall** — walks past the kitchen tablet, sees what is missing and ticks entries off.
- **Person with a phone** — adds an entry the moment something runs out and checks things off at the shop.
- **Household planner** — keeps home projects as to-dos with room, priority, effort and prerequisite, and wants the important ones on top.
- **Administrator** — wants no extra system to run and a clear way to bring the old open tasks over.

User stories:

- US-1: As a shopper, I want the shopping list on the wall, so I know what to buy without opening anything.
- US-2: As a phone user, I want to add a shopping entry in a few seconds with suggestions from earlier entries.
- US-3: As a planner, I want each to-do to have a priority and a room, so the important ones are on top and I see where to do them.
- US-4: As a planner, I want to note effort and a prerequisite on a to-do, so I can plan the weekend.
- US-5: As a viewer, I want a change on one device to show up on the others without reloading.
- US-6: As an administrator, I want the old open tasks to arrive once so the old app can be switched off.

## 4. Features

### Feature 1 (F-1): Two fixed lists

- Description: A shopping list and a to-do list. There are no further lists and no accounts.
- Acceptance Criteria:
  - AC-1: The dashboard offers exactly two lists, "Einkauf" and "To-dos".
  - AC-2: A shopping entry has a text; a to-do has a title, a category, a priority, an optional effort and an optional prerequisite (see F-4). Texts are at most 80 characters; leading and trailing blanks are ignored and an empty text is not added.
  - AC-3: Entries persist across restarts of the dashboard and across updates to a new version.
  - AC-4: The lists are part of the nightly backup, and a restored backup brings them back as of that backup.
  - AC-5: Everyone in the home network can read and change the lists without signing in (accepted household model).
  - AC-6: The shopping list starts empty; nothing is imported into it.

### Feature 2 (F-2): Lists tile on the wall

- Description: The tile shows both lists side by side, Einkauf on the left and To-dos on the right, readable from a distance.
- Acceptance Criteria:
  - AC-7: The wall tile shows the shopping list and the to-do list in two columns with their names as headings.
  - AC-8: Each column shows as many whole entries as fit the tile, never cuts an entry in half, and ends with "+ n weitere" with the exact number of entries not shown.
  - AC-9: Open entries come first; the tile never scrolls.
  - AC-10: Long entries are shortened with an ellipsis; the tile never overflows its card.
  - AC-11: A list without entries shows a calm text ("Nichts zu kaufen", "Keine offenen To-dos") instead of a blank area.
  - AC-12: All text on the wall tile is at least the foundation minimum (28 px) and meets the contrast floors in both themes.
  - AC-13: The tile follows the foundation's states (loading, never loaded, error, stale with age); a failed refresh never empties the lists on screen.
  - AC-14: The tile shows each to-do in one line with its priority mark, its title and its category; effort and prerequisite are not shown on the wall tile.

### Feature 3 (F-3): Shopping list behavior

- Description: New entries appear on top; checked entries stay visible for a day, dimmed and crossed out, below the open ones.
- Acceptance Criteria:
  - AC-15: A new shopping entry is shown at the top of the open entries.
  - AC-16: Checking an entry moves it below the open entries, dimmed and crossed out; unchecking moves it back to the open entries.
  - AC-17: Checked entries disappear on the next local household day after they were checked (an entry checked at 23:59 disappears at midnight).
  - AC-18: Any entry can be removed from the list view, and a checked entry can be removed at once.
  - AC-19: A checked state is shown by shape and text (strike-through plus a check icon), never by colour alone.
  - AC-20: While typing a new shopping entry, earlier entries that match are offered for a single tap to add.
  - AC-21: Entries that are currently open are not offered as suggestions, and an entry that is already open is not added a second time.

### Feature 4 (F-4): To-do list with room, priority, effort and prerequisite

- Description: Each to-do carries a category (a room or another area), a priority, an optional effort in hours and an optional prerequisite. To-dos are ordered by priority and the tile shows the most important first.
- Acceptance Criteria:
  - AC-22: Every to-do has a priority "Hoch", "Mittel" or "Niedrig"; a new to-do is "Mittel" unless another level is chosen when adding it.
  - AC-23: The priority of an existing to-do can be changed by tapping its priority mark.
  - AC-24: To-dos are ordered by priority, Hoch before Mittel before Niedrig; within one priority the older to-do comes first.
  - AC-25: The priority is shown by a text label and a distinct shape, never by colour alone.
  - AC-26: A to-do has exactly one category chosen from the managed categories (F-5); a new to-do uses the category selected when adding it.
  - AC-27: The effort is an optional number of hours (steps of half an hour, up to 99); the prerequisite is an optional text of up to 80 characters; both can be changed later.
  - AC-28: Checked to-dos follow the same rule as checked shopping entries (below the open ones, dimmed, gone on the next day) and can be unchecked.
  - AC-29: On a wall tile too small for all to-dos, the highest priorities are shown and the rest is counted in "+ n weitere".

### Feature 5 (F-5): Categories

- Description: The categories (Wohnzimmer, Büro, Balkon, Gang, Großes Bad, Kleines Bad, Küche, Schlafzimmer, Kinderzimmer, Sonstiges) are managed by the household so other kinds of to-dos can be added later.
- Acceptance Criteria:
  - AC-30: The existing categories of the old app are available from the start; "Sonstiges" always exists and cannot be renamed or removed.
  - AC-31: A category can be added, renamed and removed on the phone list page.
  - AC-32: Renaming a category renames it on all its to-dos.
  - AC-33: Removing a category moves its open to-dos to "Sonstiges" and says how many were moved before the removal is confirmed.
  - AC-34: A category name is 1 to 20 characters and unique (ignoring case).
  - AC-35: On the phone list page the to-dos can be filtered by category, and the page shows the number of open to-dos and of those with high priority.

### Feature 6 (F-6): Editing on the wall tablet and on the phone

- Description: Entries can be added, checked off, changed and removed on the wall tablet and on phones. The phone has its own list page; the wall tablet edits in place.
- Acceptance Criteria:
  - AC-36: On the wall tablet an entry can be checked and unchecked by tapping it; touch targets are at least 56 px.
  - AC-37: On the wall tablet a new entry and a new to-do (with category and priority) can be added with the on-screen keyboard, and an entry can be removed with an explicit remove control.
  - AC-38: The phone has a dedicated list page that opens directly (bookmark or home-screen icon) and shows both lists with add, check, change and remove; touch targets are at least 44 px and nothing scrolls sideways at 360 px width.
  - AC-39: The phone layout of the dashboard shows the lists tile first and links clearly to the list page.
  - AC-40: Both work in the home network without any sign-in.
  - AC-41: Removing an entry or a category on any device can be undone for a few seconds, so an accidental tap does not lose it.
  - AC-42: Editing never reloads the whole page, never loses the text being typed, and never moves an entry under the finger while it is being tapped.
  - AC-51: The list page is reachable under one fixed, short address in the home network (for a bookmark or a home-screen icon) and works in any browser of the home network, including the one on the wall tablet.

### Feature 7 (F-7): Same state on every device

- Description: The lists are shared, and every device converges on the same state without a manual reload.
- Acceptance Criteria:
  - AC-43: A change on one device is visible on the wall tablet and on other phones within 30 seconds.
  - AC-44: If two devices change the same entry at nearly the same time, the last change wins and both devices show the same state after the next refresh.
  - AC-45: A change that cannot be sent (no connection) is not silently lost: the device says that the change did not arrive and keeps the previous state visible.

### Feature 9 (F-9): Full-screen detail view on the wall tablet

- Description: Any tile can offer a full-screen detail view that opens with a tap on its heading and closes the same way on every tile. This epic delivers the mechanism and the lists tile as its first user: the complete lists, scrollable and editable, while the tile itself never scrolls. Other tiles can add a detail view later.
- Acceptance Criteria:
  - AC-52: On the wall tablet a tap on the heading of the lists tile or on "+ n weitere" opens a full-screen view with the complete shopping list and the complete to-do list.
  - AC-53: In the full-screen view the lists scroll vertically with the finger; entries can be added, checked, changed and removed exactly as in F-6, and the to-dos can be filtered by category with the counts of open and high-priority to-dos as on the phone list page.
  - AC-54: A clear back control of at least 56 px returns to the dashboard; the view also closes by itself after 2 minutes without input, so the wall never stays on it.
  - AC-55: The full-screen view stays current (changes from other devices appear within 30 seconds), uses text of at least 28 px and keeps the dashboard's day/night theme.
  - AC-57: Opening, the back control and the automatic closing after 2 minutes work the same way for every tile that offers a detail view, so later tiles behave identically.
  - AC-58: A tile that offers a detail view shows this on its heading with an icon and an accessible name; a tile without a detail view keeps a heading that does nothing when tapped.
  - AC-59: A tap on the content of a tile keeps its own meaning (for example checking off an entry, switching a weather view); only the heading and "+ n weitere" open the detail view.
  - AC-56: Opening and closing use the shared calm transition (a short fade under "reduce motion"); the other tiles and the clock continue unchanged underneath and are shown as they were when the view closes.

### Feature 8 (F-8): Replacing the old to-do app

- Description: The open tasks of the existing "Zuhause" to-do app are brought over once; the old app is then no longer needed.
- Acceptance Criteria:
  - AC-46: The administrator can import the old app's open tasks once from an export file; each task keeps its title, category, priority, effort and prerequisite.
  - AC-47: Completed tasks of the old app are not imported.
  - AC-48: Categories found in the file that do not exist yet are created; tasks already present (same title and category) are not added twice.
  - AC-49: An unreadable or unexpected file changes nothing and says so in plain words.
  - AC-50: The import does not need the old app to be running and does not change or delete anything in the old app.

## 5. Functional Requirements

- FR-1: The system keeps two fixed shared lists without accounts (F-1).
- FR-2: The system shows both lists on the wall tile with a fixed layout and an exact count of hidden entries (F-2).
- FR-3: The system orders and dims shopping entries by open/checked state and shows new entries on top (F-3).
- FR-4: The system suggests earlier shopping entries while typing and avoids duplicates (F-3).
- FR-5: The system stores category, priority, effort and prerequisite on each to-do and orders to-dos by priority (F-4).
- FR-6: The system lets the household manage categories (F-5).
- FR-7: The system lets entries be added, checked off, changed, removed and restored on the wall tablet and on phones (F-6).
- FR-8: The system converges all devices to the same state within one polling interval (F-7).
- FR-9: The system keeps entries across restarts, updates and backup restores (F-1, F-7).
- FR-10: The system imports the old open tasks once without touching the old app (F-8).
- FR-11: The system follows the foundation's tile states, layouts and German-only texts (all features).
- FR-12: The system lets a tile offer a full-screen detail view that opens from its heading and closes after inactivity, and uses it for the complete lists (F-9).

## 6. Non-Functional Requirements

- NFR-1: Stability — the tile and the phone page run for days without reload and without growing memory or timers.
- NFR-2: Readability — wall text at least 28 px, contrast floors in both themes, the tile fits its card at all supported tablet sizes with long entries and many entries.
- NFR-3: Security and privacy — no accounts and no outside access (accepted household model); entries are limited in length and count so a device in the network cannot flood the system; nothing is sent to any outside service.
- NFR-4: Efficiency — editing does not increase polling; a change costs one small request.
- NFR-5: Accessibility — checkboxes, priority marks and remove controls are labelled for screen readers; state is never colour only.
- NFR-6: Calm motion — adding, checking and removing use the shared calm transitions (transform and opacity), reduced to a short fade under "reduce motion".
- NFR-7: Data safety — a malformed request never corrupts the stored lists, and the nightly backup contains the lists.
- NFR-8: Testability — editing, ordering, the next-day cleanup and the import can be verified without waiting for real time or the old app.

## 7. Out of Scope

- User accounts, per-person lists or assignees, sign-in, notifications and reminders.
- More than two lists or user-created lists; shopping categories, store aisles, quantities, prices.
- Due dates and recurring to-dos.
- Voice entry, barcode scanning, access from outside the home network.
- Importing completed tasks or a history view of completed tasks.
- A QR code for opening the list page from the tablet.
- Detail views for the weather, calendar and news tiles; only the mechanism and the lists tile's view are part of this epic.
- Two-way sync with the old app; the old app is replaced, not integrated.
- Photos or notes on entries.

## 8. Dependencies & Risks

- Depends on `dashboard-foundation` (tile frame, states, polling, persistence, backup, phone layout, no-login model) and reuses the calendar tile's row-fitting approach.
- Risk: the old to-do app was not reachable from the development machine, so its export options are unknown; the import (F-8) needs an export file or database from the user. The data shape is known from screenshots: title, category, priority, effort, prerequisite, done state.
- Risk: no login means every device in the home network can change or delete entries; accepted in the foundation, mitigated by undo (AC-41) and the nightly backup.
- Risk: simultaneous edits use last-change-wins; a rare overwritten change is accepted.
- Risk: a 30 second polling interval delays changes; acceptable for lists, to be confirmed on the real tablet.
- Risk: the tile area is small (two grid rows) while 30 open to-dos exist; the "+ n weitere" count matters and the tile may need a taller area, as for weather and calendar.
- Risk: a full-screen view on a wall display could stay open; it closes after 2 minutes without input (AC-54, duration to be confirmed on the real tablet).
- Decisions taken by the PRD author for confirmation at review: removing a category moves its open to-dos to "Sonstiges" (AC-33); category names are 1 to 20 characters (AC-34); effort steps of half an hour up to 99 (AC-27).

## 9. Iteration Log

### Iteration 1 — 2026-10-29
- Questions asked: 9 (in chat, in three rounds plus one follow-up)
- Questions resolved: 8; the number of priority levels stayed open until the old app could be seen.
- Confidence: 40% → 86%
- Summary of changes: Full PRD drafted from the roadmap and the user's answers: replace the old app, two fixed lists, two columns on the wall tile, editing of everything on the tablet and on phones with a dedicated phone list page, shopping entries newest on top, checked entries crossed out below and gone the next day, to-dos ordered by priority, suggestions from earlier entries.

### Iteration 2 — 2026-10-31
- Questions asked: 5 (in chat) plus screenshots of the old app from the user
- Questions resolved: 5 (Q1 on priority levels resolved from the screenshots: Hoch, Mittel, Niedrig, default Mittel)
- Confidence: 86% → 90%
- Summary of changes: The old app turned out to be a household to-do app ("Zuhause") with category (room), priority, effort in hours, prerequisite and done state, not a shopping list. Decisions: keep all three extra fields; the shopping list is new and starts empty; the tile shows priority mark, title and category per to-do; only open tasks are imported; categories are managed by the household (add, rename, remove, with "Sonstiges" as a fixed fallback); the phone list page gets a category filter and counts of open and high-priority to-dos like the old app.

### Iteration 3 — 2026-10-31
- Questions asked: 1 (in chat)
- Questions resolved: 1
- Confidence: 90% → 90%
- Summary of changes: The user chose how the complete list is opened: a list page with its own fixed address for phones (bookmark or home-screen icon), linked from the phone layout of the dashboard (AC-51 added). A full-screen list from the wall tile and a QR code were not chosen and are out of scope.

### Iteration 4 — 2026-10-31
- Questions asked: 1 (in chat, follow-up on scrolling)
- Questions resolved: 1
- Confidence: 90% → 90%
- Summary of changes: The tile does not scroll (about 3 to 4 entries per list fit on a Full HD tablet). The user chose that a tap on the tile opens the complete lists full screen on the wall tablet, scrollable and editable (F-9, AC-52 to AC-56). The earlier out-of-scope note for the full-screen list was removed; the QR code stays out of scope. The 2 minute auto-close is an author decision to confirm.

### Iteration 5 — 2026-10-31
- Questions asked: 1 (in chat, follow-up on full-screen views for all tiles)
- Questions resolved: 1
- Confidence: 90% → 90%
- Summary of changes: The full-screen view became a general mechanism of the tile frame (F-9): heading opens it, back control and a 2 minute auto-close are the same for every tile (AC-57 to AC-59). The lists tile is its first user; detail views for weather, calendar and news are later work. The tile content keeps its own tap meaning.

---

## Open Questions

_None — all questions are reconciled._
