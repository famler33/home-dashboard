# Domain Documentation

| Domain | Document | Covers |
| ------ | -------- | ------ |
| Dashboard Foundation | [domain-dashboard-foundation](domain-dashboard-foundation.md) | Wall and phone layout, tile framework and freshness states, polling and self-recovery, day/night schedule, backend gateway (sources, scheduler, SQLite cache, snapshot API), configuration, backup, container deployment on the NAS. |
| Lists | [domain-lists](domain-lists.md) | Shopping list and to-dos in SQLite: categories, suggestions, tombstones and undo, REST API and snapshot summary, optimistic client, wall tile with detail view, phone page `/listen`, one-time import, request guard. |
| Weather | [domain-weather](domain-weather.md) | Weather tile: forecast, rain radar and official warnings from open services, the three weather sources, radar document and map tile routes, view rotation and manual switching, rain statement, compact short-screen layout. |

Project-level implementation guidelines live in `docs/guidelines/`; this index links
the living documentation that describes the system and its operation.
