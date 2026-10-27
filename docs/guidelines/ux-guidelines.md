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

- Readable from 2–3 meters: large type, high contrast. Exact scale: <TODO: offen>.

## Touch targets & layout

- Generous touch targets on the tablet. Target resolution and orientation:
  <TODO: offen>.

## Feedback & error states

- Every widget shows loading, empty, stale ("zuletzt aktualisiert …") and error
  states; never a blank screen. A calm offline indication when the backend is
  unreachable.

## Visual design & animation

- Distinctive, polished design with purposeful animation; calm rather than flashy.
- Animate transform/opacity only; honor `prefers-reduced-motion`.
- Avoid burn-in: subtle periodic movement or dimming at night is considered.
  <TODO: offen>

## Internationalization

- German UI; no hard-coded strings.

## Dark mode

<TODO: offen> — likely automatic day/night mode for a wall display.

## Iconography

<TODO: offen>

## Accessibility

<TODO: offen> — target level to be decided.
