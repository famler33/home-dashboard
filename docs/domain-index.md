# Domain Documentation

| Domain | Document | Covers |
| ------ | -------- | ------ |
| Calendar | [domain-calendar](domain-calendar.md) | Combined calendar tile: family iCloud and two Google work calendars from secret ICS feeds, guarded download, recurring-event expansion, merged agenda with Kita block, tabs, per-calendar problem chips, row fitting. |
| Dashboard Foundation | [domain-dashboard-foundation](domain-dashboard-foundation.md) | Wall and phone layout, tile framework and freshness states, polling and self-recovery, day/night schedule, backend gateway (sources, scheduler, SQLite cache, snapshot API), configuration, backup, container deployment on the NAS. |
| Lists | [domain-lists](domain-lists.md) | Shopping list and to-dos in SQLite: categories, suggestions, tombstones and undo, REST API and snapshot summary, optimistic client, wall tile with detail view, phone page `/listen`, one-time import, request guard. |
| News | [domain-news](domain-news.md) | News tile: headlines from the rbb24 and Tagesschau RSS feeds, hardened parsing, rotating wall view and phone list, stale marking per source, licensed rows kept out of backups. |
| Weather | [domain-weather](domain-weather.md) | Weather tile: forecast, rain radar and official warnings from open services, the three weather sources, radar document and map tile routes, view rotation and manual switching, rain statement, compact short-screen layout. |

Project-level implementation guidelines live in `docs/guidelines/`; this index links
the living documentation that describes the system and its operation.
