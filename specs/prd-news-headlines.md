# PRD: News Headlines

> **Status:** Ready
> **Confidence:** 91%
> **Created:** 2026-11-01
> **Last updated:** 2026-11-01

## 1. Problem Statement

The two adults want to know the most important news of the day without picking up a phone or opening a
news app: what is happening nearby (local) and in the world (global). The news tile of the dashboard
(right column of the wall layout, below the calendar) must show current headlines in a calm, readable
way from 2–3 meters and say where each headline comes from and how old it is.

The dashboard foundation already provides the tile frame and its states, scheduled data gathering with a
last-known-data fallback, the phone layout and the multi-view rotation pattern proven by the weather tile.
This epic delivers the news tile on top of it. The tile only reads public headlines; nothing is written
anywhere, no account is needed and the displays never contact a news publisher directly.

## 2. Goals & Success Metrics

**Goals**

- G-1: The current local and global headlines are visible on the wall without touching the tablet.
- G-2: Every headline names its source and age, and local and global headlines are told apart at a glance.
- G-3: The presentation is calm and readable from a distance and does not wear on a display that runs for days.
- G-4: The tile stays truthful: it never goes blank and always says how old its headlines are when they are not fresh.
- G-5: One failing news source never hides the other.

**Success metrics**

| Metric | Target |
| ------ | ------ |
| Headline freshness under normal conditions | A new headline is visible within 30 min of publication |
| Time to see all headlines of one rotation | One rotation completes in at most 3 min |
| Smallest text on the wall tile | At least the foundation minimum (28 px) |
| Tile behavior with one source unreachable | The other source stays fully visible; the affected one is marked with its age; 0 blank areas |
| Households opening a news app for a quick look at the headlines | 0 for the daily glance (qualitative, judged by the two users after two weeks) |

## 3. User Stories & Personas

- **Viewer at the wall** — passes the tablet and wants to read the top headlines, local and global, from 2–3 m.
- **Phone user** — wants to scroll through all headlines.
- **Administrator** — wants no account or key to manage and a clear sign when a news source is failing.

User stories:

- US-1: As a viewer, I want current headlines of a local and a global source, so I know what is going on.
- US-2: As a viewer, I want to see at once whether a headline is local or global, from which source and how old it is.
- US-3: As a viewer, I want the headlines to change by themselves in a calm way and to go to the next or previous one by hand.
- US-4: As a phone user, I want the full list of headlines.
- US-5: As an administrator, I want the tile to say when its headlines are old or unavailable.

## 4. Features

### Feature 1 (F-1): Local and global headlines

- Description: The tile shows the most important headlines from at least one local and one global news
  source. Each headline shows its title as plain text, the source name and a label telling local from
  global. The local source is the regional public broadcaster for Berlin (rbb24); the global source is a German
  public broadcaster's national and international news (Tagesschau). Each source contributes about five headlines.
  Local and global headlines run in one mixed rotation, local first.
- Acceptance Criteria:
  - AC-1: The tile shows headlines from at least one local and one global source.
  - AC-2: Each headline shows title, source name and a text label for local or global.
  - AC-3: Titles are shown as plain text; markup or entities from the source never appear raw.
  - AC-4: Duplicate headlines (same story delivered twice by a source) appear only once.
  - AC-25: Each source contributes at most five headlines; the rotation shows the local ones first, then the global ones.

### Feature 2 (F-2): Calm rotating presentation

- Description: On the wall the tile shows one headline at a time and changes to the next with the shared
  calm cross-fade. A position indicator ("3 von 10") shows where the viewer is in the rotation. The ticker
  and scrolling lists are not used.
- Acceptance Criteria:
  - AC-5: On the wall the tile shows one headline at a time and changes automatically every 15 seconds (+/- 2 s).
  - AC-6: The position in the rotation is indicated in text, not by color alone.
  - AC-7: Under "reduce motion" the change is a fade of at most 150 ms.
  - AC-8: A long headline is shown in full or shortened with an ellipsis; it never overflows the tile.
  - AC-9: Rotation stops while the tile is in the stale, error or never-loaded state; the state is shown instead.

### Feature 3 (F-3): Manual navigation

- Description: The viewer can go to the next or previous headline by swipe or tap. Any input pauses the
  rotation, which resumes by itself after 60 seconds without input. Headlines are not opened on the wall.
- Acceptance Criteria:
  - AC-10: A tap advances to the next headline; a horizontal swipe of at least 60 px shows the next or previous one.
  - AC-11: Any manual input pauses the rotation, which resumes after 60 seconds without input.
  - AC-12: Manual changes use the same transition as automatic ones.
  - AC-13: Any previous/next control is a touch target of at least 56 px on the wall layout.

### Feature 4 (F-4): Source and age

- Description: Each headline shows its source name and its age in German ("vor 12 Min.", "gerade eben"
  under 15 s, a date beyond 24 h). The source name doubles as the credit.
- Acceptance Criteria:
  - AC-14: Source name and age are visible on every headline at 28 px or more on the wall.
  - AC-15: The age is computed from the publication time and the server-based clock, not the tablet clock.

### Feature 5 (F-5): Freshness, outage and empty states

- Description: Headlines are refreshed by the backend every 15 minutes, independent of open displays, and count as stale after 45 minutes. Each news
  source has its own freshness. Stale headlines stay visible with their age; never-loaded, first-failure and
  empty states have calm German texts without codes.
- Acceptance Criteria:
  - AC-16: Headlines are refreshed every 15 minutes while the dashboard runs, also when no display is open.
  - AC-17: Data older than 45 minutes is shown as stale with the last known headlines: the headlines of the stale source carry a marker with a clock icon, the word "Veraltet" and the age of the data ("Veraltet · vor X Min."), never by color alone.
  - AC-18: Before the first data arrives the tile shows "Schlagzeilen noch nicht geladen"; when the first fetch fails "Schlagzeilen derzeit nicht verfügbar"; when a source delivers no headlines "Noch keine Schlagzeilen".
  - AC-19: A failure of one source does not hide the other.
  - AC-20: The tile never goes blank.

### Feature 6 (F-6): Phone list

- Description: On the phone all headlines are shown as a scrolling list grouped "Regional" and "Welt", without rotation. Headlines are plain text; they are not links.
- Acceptance Criteria:
  - AC-21: The phone shows all headlines in one list grouped by local and global without rotation.
  - AC-26: Headlines are not links on the wall or on the phone; no article is opened from the dashboard.
  - AC-22: Rows have touch targets of at least 44 px and the list has no horizontal scrolling at 360 px width.

### Feature 7 (F-7): Wall fit

- Description: The tile content fits the news area of the wall layout on all supported tablet sizes without
  clipping, overlapping or scrolling. On screens up to 850 px high exactly one headline with source and age is shown.
- Acceptance Criteria:
  - AC-23: The content stays inside the tile at 1024 x 750, 1180 x 700, 1280 x 800, 1920 x 1200 and 2048 x 1536 CSS pixels with at least 28 px text.
  - AC-24: All texts come from the German dictionary; day and night contrast floors are met.

## 5. Functional Requirements

- FR-1: The tile shows headlines from at least one local and one global source. (F-1)
- FR-2: Each headline carries title (plain text), source name, local/global label and publication time. (F-1, F-4)
- FR-3: The wall shows one headline at a time in a calm rotation with a position indicator. (F-2)
- FR-4: Tap and swipe navigate; input pauses the rotation for 60 s. (F-3)
- FR-5: Ages are computed with the server-based clock. (F-4)
- FR-6: The backend gathers headlines on a schedule independent of open displays; each news source has its own freshness. (F-5)
- FR-7: Displays never contact a news publisher; only the backend does. (F-5)
- FR-8: Stale, never-loaded, error and empty states follow the dashboard's state rules; rotation stops while stale. (F-2, F-5)
- FR-9: The phone shows all headlines in a grouped list. (F-6)
- FR-10: The tile fits all supported wall sizes and the phone layout. (F-7)
- FR-11: All texts come from the central German dictionary. (F-1 to F-7)

## 6. Non-Functional Requirements

- NFR-1: Stability — the rotation does not increase page memory growth beyond the foundation's soak criterion over 24 hours. (AC-5)
- NFR-2: Performance — animations use transform and opacity only. (AC-7)
- NFR-3: Resilience — no outage of a news source blanks the tile or the dashboard. (AC-19, AC-20)
- NFR-4: Privacy and security — no key or credential is needed for the chosen sources; displays load no third-party resources; upstream text is never logged and never rendered as markup. (FR-7, AC-3)
- NFR-5: Fair use — request volume stays far below publisher limits; headlines are refreshed by the backend, never per display. (AC-16)
- NFR-6: Licence compliance — the publisher terms of every chosen feed allow private, non-commercial display and the source is credited. (AC-14)
- NFR-7: Readability — wall text at least 28 px, contrast floors met in both themes. (AC-23, AC-24)
- NFR-8: Observability — source failures are logged without payload contents and are visible as stale or error. (AC-17, AC-19)

## 7. Out of Scope

- Images, article summaries or full article text.
- Opening articles or linking to them, on the wall and on the phone.
- Personalisation, topic filters, keyword muting, search or reading history.
- A settings screen for sources, push notifications or breaking-news alerts.
- Sources that need an account, API key or scraping.

## 8. Dependencies & Risks

**Dependencies**

- Dashboard Foundation (`dashboard-foundation`): tile frame and states, scheduled data gathering, snapshot, German dictionary, layouts, multi-view rotation pattern proven by Weather.
- Public news feeds of the chosen publishers (rbb24 for Berlin, Tagesschau for national and international news); availability and terms are outside our control.

**Risks**

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Publisher stops or changes its feed | Source stale or empty | Per-source freshness; other source unaffected; contract tests with recorded fixtures |
| Publisher terms forbid the use | Non-compliance | Check terms before implementation (NFR-6); prefer public broadcasters |
| Long or odd titles break the layout | Clipping | Plain-text titles, length cap, fit tests (AC-8, AC-23) |
| rbb24 is regional to Berlin/Brandenburg, not district-level | Local news less granular | Accepted; district-level sources are a later option |
| Moving text wears or distracts on an always-on display | Poor experience | Calm rotation, no ticker, reduce-motion support |

## 9. Iteration Log

### Iteration 1 — 2026-11-01

- Questions asked: 8
- Questions resolved: 0
- Confidence: — → 55%
- Summary of changes: Draft built from the roadmap, the foundation and weather domain docs, and architecture and UX advisor input (RSS/Atom-style public feeds, one source per feed, rotation instead of ticker, text only).

### Iteration 2 — 2026-11-01

- Questions asked: 9 (Q1–Q8 plus a follow-up on the region, answered interactively in chat)
- Questions resolved: 9
- Confidence: 55% → 91%
- Summary of changes: Local source rbb24 (Berlin), global source Tagesschau; one headline at a time rotating with a position
  indicator; one mixed rotation, local first, labelled "Regional"/"Welt"; about five headlines per source, 15 s dwell; refresh every
  15 minutes, stale after 45 minutes; no links anywhere (AC-26); text only, no images or summaries. Exact feed addresses and the
  publishers' terms of use are verified in the technical specification (NFR-6).

### Iteration 3 — 2026-11-01

- Questions asked: 2 (verification findings, answered in chat)
- Questions resolved: 2
- Confidence: 91% → 91%
- Summary of changes: The user accepted the short stale marker "Veraltet · vor X Min." instead of the longer sentence (it wraps on short tablet screens, AC-17), and accepted the one-line headline on screens up to 850 px high.

---

## Open Questions

_None — all questions are reconciled._
