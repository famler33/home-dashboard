# Domain: Lists

> **Last updated:** 2026-11-01
> **Related epics:** Shopping List and To-dos (`shopping-list-todos`)

## 1. Overview

The lists domain holds the household's shopping list and to-do list. Both live in the dashboard's own
SQLite database; there is no account and no external service. Any device in the home network can view and
edit them (see the security guidelines for this accepted risk).

On the wall tablet the lists tile shows both lists side by side, and a tap on the heading opens a
full-screen detail view with the complete editor. On the phone the tile is the first section of the page and
links to a dedicated list page at `/listen` that holds only the editor. Edits are optimistic: the display
applies a change at once, sends it in the background and shows what is not saved yet.

## 2. Key Concepts & Entities

| Concept | Meaning |
| ------- | ------- |
| **Shopping item** | A title with a checked time and a creation time. Open titles are unique per list (compared case-insensitively with German lower-casing), so adding a title that is already open does nothing and the editor highlights the existing row. |
| **To-do item** | A title plus a **category**, a **priority** (`high`, `medium`, `low`; default `medium`), an optional **effort** in hours (0 to 99) and an optional **prerequisite** text. |
| **Category** | A named group for to-dos. Ten categories are seeded (Wohnzimmer, Büro, Balkon, Gang, Großes Bad, Kleines Bad, Küche, Schlafzimmer, Kinderzimmer, Sonstiges). Names are unique among active categories, `Sonstiges` (`sonstiges`) is built in and cannot be renamed or removed. Removing a category moves its to-dos to `Sonstiges`. |
| **Tombstone** | A removed item or category stays in the database for one hour so an "undo" can restore it; after that it is purged. |
| **Suggestion** | A title from the shopping history (most recently used first, at most 100) that is not currently open; the editor offers matching ones while typing. |
| **Revision** (`epoch`, `rev`) | `rev` counts the changes since the database was created and `epoch` identifies the running backend instance; together they let the client reject an older state than the one it already shows. |
| **Lists state** | The full read model: categories (with open to-do count), all shopping items, all to-dos, suggestions. |
| **Lists summary** | The compact version published in the snapshot as source `lists`: category ids and names, the first 30 shopping items, the first 40 to-dos, a `truncated` flag and counts (`shoppingOpen`, `todoOpen`, `todoHigh`). |

Ordering: shopping lists open items newest first, then checked items by check time (newest first). To-dos list
open items by priority (high first) then age, then checked ones.

Limits: titles and prerequisites 80 characters, category names 20, at most 500 open items and 600 rows per list
(removed rows count until purged), at most 100 categories. Text is normalised (NFC), control, bidi and
zero-width characters are removed and whitespace is collapsed.

## 3. Workflows & Behaviors

**Tile on the wall.** Two columns (Einkauf and To-dos) with an open count each. Rows are 56 px high, show a check
circle, the to-do priority mark, the title and the category name (hidden on short screens). The tile measures its
space and shows as many rows as fit; the rest is summarised as "+ n weitere", which opens the detail view.
Checking an item shows a "Rückgängig" button for 8 s. A pending change shows a clock, a failed one "Nicht
gespeichert" and a retry button above the columns.

**Detail view (wall) and list page (phone).** The same editor in two layouts. Shopping: a text field with
suggestions; to-dos: an add form and an edit sheet (title, category, priority, effort, prerequisite), a category
filter and a category manager (add, rename, remove with confirmation). Removing an item or category offers
"Rückgängig" while its tombstone lives. The detail view stays open while a draft exists and otherwise closes
after two quiet minutes. The phone editor follows the visual viewport so the on-screen keyboard does not hide the
field.

**Daily clean-up.** Checked items of an earlier local day disappear on their own; tombstones older than one hour
are purged. The purge runs with every change and with the source refresh.

**Optimistic client.** Every change gets a client-generated id (UUID) and is queued and sent one after another.
Creating with an existing id answers success without a second entry, so a retry after a lost answer never
duplicates. Network errors and server errors retry every 5 s and when the browser comes back online; permanent
errors (validation, forbidden, not found) drop the change and show a notice. The client polls the full state every
10 s and also takes the summary from the snapshot; a state is accepted only if it is newer (same epoch, higher
`rev`) and is held back while the user is editing.

**Import from the old to-do app (one time).** `node dist/cli/import-todos.js <file> [--dry-run] [--delete-file]`
reads a JSON file from `data/imports/` (regular file, at most 1 MiB, format
`{"version":1,"tasks":[{"title","category","priority":"Hoch|Mittel|Niedrig","effortHours?","prerequisite?","done?"}]}`).
It is all or nothing: done tasks are skipped, unknown categories are created, a task with the same title in the
same category is skipped, and the output has counts only, never titles or paths.

## 4. Interfaces

REST API under `/api/v1/lists`, outside the snapshot (the snapshot carries only the summary). All responses are
`no-store` and, except the creates, return the full lists state.

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/v1/lists` | The full state. |
| `POST /api/v1/lists/items` | Create an item (`id`, `list`, `title`, and for to-dos `categoryId`, `priority`, `effortHours`, `prerequisite`). `201` when created, `200` when the id or an open shopping title already exists. |
| `PATCH /api/v1/lists/items/:id` | Change title, `checked`, category, priority, effort or prerequisite (at least one field; to-do fields only on to-dos). |
| `DELETE /api/v1/lists/items/:id` | Remove into a tombstone; repeating it is a success. |
| `POST /api/v1/lists/items/:id/restore` | Bring a tombstone back. |
| `POST /api/v1/lists/categories` | Create a category (`id`, `name`); idempotent by id. |
| `PATCH /api/v1/lists/categories/:id` | Rename. |
| `DELETE /api/v1/lists/categories/:id` and `POST …/restore` | Remove into a tombstone and restore. |

Request bodies are limited to 4 KiB, schemas reject unknown fields, ids are UUIDs (items, new categories) or short
slugs. Errors use the shared envelope: `400 VALIDATION_FAILED`, `404 NOT_FOUND`, `409 LIST_LIMIT_REACHED`,
`409 CATEGORY_NAME_TAKEN`, `409 CATEGORY_PROTECTED`, `403 FORBIDDEN_HOST` (request guard).

Snapshot source `lists` (`intervalSeconds` 900, stale after 7200): purges and republishes the summary, so an idle
list never looks stale; every successful change republishes the summary at once. Registry entries `lists`
(placeholder) and `lists-live` (replaces the placeholder when the source exists, detail view, own state texts).
The phone page is served at `/listen` by the single-page app.

Tables (migration `003`): `categories`, `list_items`, `shopping_history`, `meta` (revision counter).

## 5. Business Rules & Constraints

- Every mutation runs in one transaction together with the purge, the revision bump and the published summary.
- Changes are idempotent by client id; repeating a delete or restore is a success.
- Shopping items carry no category, priority, effort or prerequisite; a to-do needs an existing active category.
- A restore is refused when it would exceed the open limit; a category restore is refused when its name is taken.
- The lists are part of the nightly database backup; a restore shows the state at backup time.
- Touch targets are at least 56 px on the wall and 44 px on the phone.
- No login: the request guard (allowed hosts, same-origin mutations) is the only access control.

Known limitations (not verified): the import format was written from the documented JSON schema and has not been
checked against a real export of the old app; behaviour on the real tablet and on real phones, and
`network.allowedHosts` with the real NAS name, still need a manual check.

## 6. Related Documentation

- [Dashboard Foundation domain](domain-dashboard-foundation.md)
- [Architecture reference](guidelines/architecture-reference.md), [security guidelines](guidelines/security-guidelines.md),
  [UX guidelines](guidelines/ux-guidelines.md), [testing guidelines](guidelines/testing-guidelines.md)
- Runbook section "Listen" in `infrastructure/README.md`

## 7. Change Log

| Date | Epic | Change |
|------|------|--------|
| 2026-11-01 | Shopping List and To-dos (`shopping-list-todos`) | Shopping and to-do lists in SQLite with categories, suggestions and tombstones, the REST API and summary source, request guard, optimistic client, wall tile with detail view, phone list page `/listen`, one-time import command, runbook section and soak test. |
