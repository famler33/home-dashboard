# Domain: News

> **Last updated:** 2026-11-01
> **Related epics:** News Headlines (`news-headlines`)

## 1. Overview

The news tile shows current headlines from two public RSS feeds: rbb24 for Berlin and Brandenburg (regional) and
the Tagesschau for Germany and the world. It needs no key and no account. Each headline shows its group, source
name and age; there are no links, images or summaries. The backend fetches and the display polls the snapshot, as
in the foundation. A failing feed never blanks the tile: the other feed stays visible and the failed one is
marked.

On the wall tablet the tile shows one headline at a time and rotates; on the phone it is a plain list grouped
"Regional" and "Welt".

## 2. Key Concepts & Entities

| Concept | Meaning |
| ------- | ------- |
| **News source** (`news-local`, `news-global`) | One backend source per feed, every 15 min (stale after 45 min, timeout 15 s). Payload: `group` (`local` or `global`), `sourceName` (`rbb24` or `Tagesschau`) and at most five headlines. |
| **Headline** | `id` (the feed's guid, else link, else a hash of the title; at most 100 characters), `title` (plain text, at most 160 characters) and `publishedAt` (ISO instant). |
| **Feed catalogue** | The two feed addresses and source names, constants in `sources/news/catalogue.ts`. Never configuration. |
| **Wall headline** | A headline in the frontend with its group, source name, `stale` flag and the source's age while stale. Order: local group first, feed order inside a group. |

## 3. Workflows & Behaviors

**Parsing (backend).** The RSS 2.0 document is parsed with entity processing off and any DOCTYPE removed. Titles
have CDATA unwrapped, markup removed, entities decoded once, control characters and angle brackets removed and
whitespace collapsed, and are cut to 160 characters with an ellipsis. Items without a title or a parseable
`pubDate`/`dc:date` are skipped, as are items older than 72 hours; a date more than five minutes in the future is
treated as now. Duplicates (same id or same normalised title) are dropped and the first five remaining items are
kept. A payload that fails the schema, or a feed without an RSS channel, counts as an upstream failure.

**Wall rotation.** The tile changes the headline every 15 s with one fade (600 ms, 150 ms under reduced motion;
the outgoing headline stays mounted for the fade). A tap on the headline, a swipe left or the next button shows
the next one; a swipe right or the previous button shows the previous one. The buttons are 56 px targets. Any
input pauses the rotation for 60 s. Rotation stops while every headline is stale or only one exists. A counter
"n von m" and up to two lines of title (one line on short screens) are shown; the rotation covers both groups.

**Phone.** All headlines in two groups, titles up to two lines, same meta line, no rotation.

**Age and problems.** The meta line shows the headline's age ("vor 12 Min." up to 24 hours, then a German date; "gerade eben" when just published). When the headline's
source is stale (older than its threshold, computed with the monotonic clock since receipt) the age is replaced by
"Veraltet · vor X Min." in the warning colour with a clock icon. The tile frame is fresh while any news source is
fresh, stale when every source with data is stale, and error or never-loaded (own German texts) when no source has
data. With no usable headline the tile says "Noch keine Schlagzeilen".

## 4. Interfaces

External services (outbound HTTPS from the backend only, two fixed hosts):

| Service | Use |
| ------- | --- |
| rbb24 (`www.rbb24.de`) | Regional feed; use only for non-commercial offers, may be revoked, must not be archived. |
| Tagesschau (`www.tagesschau.de`) | World feed. |

Snapshot entries: `news-local` and `news-global` (payload as above, mirrored by hand in the frontend and checked by
a type guard). Registry entries `news` (placeholder) and `news-live` (shown when either source exists, replaces
`news` and the demo tile, dense frame, own state texts).

Configuration: `sources.news.enabled` switches both feeds together; without the key the tile is on.

Manual check: `backend/scripts/news-live-check.mjs` prints counts and ages per feed, never titles.

## 5. Business Rules & Constraints

- The display never contacts the feeds; only the backend does. Hosts are constants, requests carry an identifying
  user agent, no cookies, no referrer, `redirect: 'error'`, a content type containing `xml` and a size limit of
  512,000 bytes. Errors and logs carry only the source id and an error code, never the address or feed text.
- Licensed content is not archived: each fetch overwrites the previous headlines, and the nightly backup removes
  all `news-` rows from its copy (purge followed by `VACUUM`). After a restore the tile shows "Schlagzeilen noch
  nicht geladen" until the first fetch succeeds.
- The source name stays visible on every headline.
- No links, images or summaries are carried or shown.
- Titles are rendered as text only; nothing from a feed is interpreted as markup.
- If the rbb24 feed is withdrawn or its use is forbidden, `sources.news.enabled: false` switches the tile back to
  the placeholder.

Known limitations (not verified): the licence terms of both feeds and the behaviour on the real tablet, including
a 24-hour soak, remain manual checks.

## 6. Related Documentation

- [Dashboard Foundation domain](domain-dashboard-foundation.md), [Weather domain](domain-weather.md) (shares the
  view rotation and gesture helpers)
- [Architecture reference](guidelines/architecture-reference.md), [security guidelines](guidelines/security-guidelines.md),
  [UX guidelines](guidelines/ux-guidelines.md), [testing guidelines](guidelines/testing-guidelines.md)
- Runbook section "Nachrichten" in `infrastructure/README.md`; manual feed check `backend/scripts/news-live-check.mjs`

## 7. Change Log

| Date | Epic | Change |
|------|------|--------|
| 2026-11-01 | News Headlines (`news-headlines`) | Two feed sources with hardened RSS parsing, backup without licensed rows, the rotating wall tile and the phone list with stale marking, shared rotation and gesture helpers, runbook section, live-check script and soak test. |
