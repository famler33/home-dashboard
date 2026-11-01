# UX Guidelines

Scope: frontend components, styles, animations and static assets. Start short —
`reconcile-docs` extends this file after every epic.

## Related company-wide guidelines

None — private project.

## Project type

Always-on wall-mounted tablet dashboard in a browser (fullscreen), plus phone access
in the home network for lists.

## Users & context to design for

- Two adults and their household, glancing at the display from a distance.
- Runs for days without interaction; must stay stable and look good.
- Cost of a mistake is low, but stale or broken-looking data erodes trust.

## Input & interaction model

- Mostly passive viewing; touch for lists and simple interactions.

## Readability & contrast

- Readable from 2–3 meters: large type, high contrast. In the wall layout every text is at least
  28 px (caption); the scale is caption 28, body 32, title 40, display 64 (each `max(floor, width part)`)
  and the clock `max(112 px, min(9vw, 15vh))`. The phone layout uses 14–20 px for text and 32 px for its compact clock.
- Contrast is a best-effort floor, tested on the pairs actually used in both themes: primary text
  at least 7:1, everything else at least 4.5:1. No formal conformance level is required.
- Line heights are tight for large text (clock 1, display 1.05, title 1.2) so tiles keep their content.

## Touch targets & layout

- Generous touch targets (at least 44 px on the phone, more on the tablet).
- The wall layout is landscape only, for screens of at least 1024 x 750 or 1180 x 700 CSS pixels
  (a 2048 x 1536 iPad reports 1024 x 768). Smaller screens and portrait use the scrollable phone
  layout. It is four tiles on a 12 x 6 grid: weather and lists on the left, calendar and news on
  the right. The phone layout puts the lists first.
- Tile content never overlaps its heading or leaves its card; on screens up to 850 px high (the
  `tablet-short` variant) the explanatory hints in tile states become screen-reader-only, spacing shrinks and
  tiles may compact their content (the weather tile keeps symbols and the location name for screen readers
  and drops secondary lines while a warning is shown). Taller screens show the full content.
- A tile with several views (weather) rotates calmly on the wall, tells the active view with indicators
  (at least 56 px touch targets, not colour alone), supports tap, swipe and direct selection, pauses the
  rotation for 60 s after input and stops it while its data is stale. The phone shows all parts at once.
- A tile with editable content (lists) opens a full-screen detail view from its heading on the wall: a dialog
  with a back control (at least 56 px, labelled), Escape support, and automatic closing after two quiet minutes
  unless a draft is open. Rows, checkboxes and buttons there are at least 56 px high on the wall and 44 px on
  the phone; a tile that cannot show everything says "+ n weitere" and the line opens the detail view.
- A tile with tabs (calendar) returns to its "all" tab after 60 s without input on the wall, so a forgotten
  selection never stays; the tab buttons are touch targets of the wall size, and the active tab is marked by more
  than colour.
- Edits show their state without blocking: a clock icon while saving, a warning icon with "Nicht gespeichert"
  and a retry action when it failed, and "Rückgängig" for a short time after a check or removal.
- Tile credits and licence notices stay visible on the tile; map overlays never cover the data, so credits
  and legends sit beside or below the map except on short screens.

## Feedback & error states

- Every widget shows loading, empty, stale ("zuletzt aktualisiert …") and error
  states; never a blank screen. A tile that has never loaded or whose first fetch failed says so.
- Stale means an amber accent plus a clock icon plus the word "Veraltet" and the age ("vor 5 Min."),
  never color alone; under 15 seconds the text is "gerade eben". Copy is calm and specific, without
  exclamation marks or error codes.
- Backend unreachable: a pill in the header with an icon and "Keine Verbindung" in a color distinct
  from the stale accent; data stays visible and the display recovers by itself.

## Visual design & animation

- Distinctive, polished, minimalist design with purposeful animation; calm rather than flashy:
  staggered tile entrance, a slow ambient background and a rolling clock. No parallax or particles.
- Ambient symbol animations (weather) last at least 6 s per cycle; view changes use one shared fade
  (150 ms under "reduce motion"); canvas loops show one still frame under "reduce motion".
- Animate transform/opacity only. With "reduce motion" the entrance becomes a 150 ms fade, the
  ambient background stops and the clock swaps digits without movement.
- Burn-in protection: the shell shifts through eight positions of at most 8 px every 5 minutes (half
  amplitude by day), as an instant step under "reduce motion". Phones do not drift.
- One tap on the wall layout enters fullscreen; a discreet hint in the header shows while fullscreen
  is possible but inactive. Keeping the screen awake relies on the tablet settings over HTTP.

## Internationalization

- German UI; no hard-coded strings (typed dictionary, `Intl` for dates and relative times).

## Dark mode

Automatic day and night theme from a configured daily schedule in the household time zone. The
night theme dims the whole dashboard and keeps every tile visible; both themes are defined as
semantic color tokens and meet the contrast floors above.

## Iconography

One open SVG set (lucide) as components; no emoji. Icons accompany state texts and are decorative
(`aria-hidden`).

## Accessibility

Best effort, no formal level: sufficient contrast, large type, semantic landmarks (tiles are labelled
regions), `aria-label` on the clock with the full time while its digits are hidden from screen
readers, the offline indicator as a status role, and `prefers-reduced-motion` support.
