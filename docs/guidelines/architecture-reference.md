# Architecture Reference

Monorepo with three parts — `frontend/`, `backend/` and `infrastructure/` — deployed
together as Docker containers on a Synology NAS and used on a wall tablet and phones in
the home network. Cross-cutting decisions live here; layer-specific rules live in the
respective coding guidelines.

## Tech Stack

| Layer    | Choice |
| -------- | ------ |
| Frontend | React, Vite, TypeScript (pnpm); Tailwind CSS; animation library <TODO: offen> |
| Backend  | Node.js, Fastify, TypeScript |
| Database | SQLite (lists, cache, settings) |
| Infra    | Docker + Docker Compose on a Synology NAS (Container Manager), home network only |
| CI/CD    | None yet (local repository) |

## High-Impact Decisions

### TypeScript across frontend and backend

One language for both layers keeps the stack small and the container lean, and the
ecosystem has solid libraries for calendar (ICS/CalDAV) and HTTP integrations. The
frontend and backend still share no code unless a generator is adopted explicitly.

### Backend as integration gateway

The frontend never calls external services directly. The backend fetches weather,
calendars and news, caches results in SQLite and exposes one stable internal API.
API keys and calendar credentials therefore live only on the NAS, and the wall tablet
keeps showing the last cached data when an external service or the internet is down.

### Calendar sources

Events come from a shared Apple (iCloud) calendar and two Google work calendars
(one per person), merged into one view. Access method per source (ICS link, CalDAV,
API): <TODO: offen>. Calendar access is read-only.

### Existing shopping list is reused

A shopping list app (Tailwind, running on the NAS) already exists. Whether it is
integrated, embedded or rebuilt inside this repository is <TODO: offen> and is decided
in the epic that covers lists.

### Display-first design

The primary target is a wall-mounted tablet in a browser (kiosk-style, fullscreen)
that runs for days without interaction. Visual quality and animation are explicit
goals, constrained by tablet performance and long-term stability.

## Domain Documentation Discovery

When reverse-engineering a domain for `docs/domain-*.md`, including through the
`init-docs` skill, analyse the complete implemented workflow rather than one
application layer in isolation.

- Scan `frontend/src/` and `backend/src/` for every domain. Include
  `infrastructure/` when the behavior depends on deployed configuration, scheduling,
  persistent storage, or network topology. Tests live in `frontend/src/**/*.test.ts(x)`,
  `frontend/e2e/**/*.spec.ts` and `backend/src/**/*.test.ts` / `backend/test/**`.
- Where backend definitions exist, treat them as the source of truth for domain
  models and API contracts, and identify the frontend types that mirror them. Use
  frontend definitions as the source only for frontend-only models.
- For implemented APIs, backend routes, DTOs, validators, status codes, and error
  mappings are the authoritative HTTP contract. Do not assume persistence types are
  also wire formats.
- Compare frontend API calls and mirrored types with the backend contract (route
  version, method, payload shape, nullability, enums, validation, statuses, errors).
  Record contract drift explicitly; do not silently reconcile it in documentation.
- Trace synchronous and asynchronous behavior end to end: user interaction and
  state, backend validation and business logic, persistence and messaging side
  effects, and relevant infrastructure.
- When identifying test coverage, find tests in every affected layer using the
  repository's actual test locations. Report differently located tests as
  convention drift rather than assuming a folder exists.

## Product Roadmap Rules

Roadmap epics must be independently demonstrable vertical slices across whichever
layers are needed to deliver the capability. Prefer slices that deliver a testable
user-facing capability, and avoid layer-only epics unless that layer delivers
independently demonstrable value.

Every epic in `specs/roadmap.md` must include:

```markdown
**Affected layers:** <frontend / backend / infrastructure>
```

List only the canonical layer names that the epic affects.

The roadmap's `**Ticket:**` header is the authoritative delivery ticket once the
roadmap exists. If it is absent or `—`, fall back to a ticket extracted from the
delivery branch. Consult an uncommented `Ticket:` value in `specs/briefing.md` only
before a roadmap exists; commented placeholders are never ticket values. A delivery
without a real ticket remains valid: omit the ticket prefix rather than inventing
one or using placeholder text.

Declare every epic using the heading format
`### N. <Epic Name> (<epic-slug>)`. The parenthesized slug is canonical for all
downstream PRD, specification, implementation, verification, reconciliation, and
review steps; they must use it verbatim rather than derive a new slug from the epic
name. Prefer a readable kebab-case slug, and never change it after the delivery
chain has started. Only roadmap-less runs may fall back to kebab-casing the epic
name.

## Technical Specification Rules

Technical specifications use the canonical roadmap slug and are stored at
`specs/spec-<epic-slug>.md`. They must:

- preserve the PRD's `F-*`, `FR-*`, `NFR-*`, and `AC-*` identifiers verbatim for
  end-to-end traceability;
- identify every affected layer;
- apply all relevant architecture, coding, infrastructure, security, and UX
  guidelines;
- define a complete, backend-owned API contract before frontend work consumes it,
  including the versioned route, request and response shapes, status codes, and an
  i18n-ready error shape;
- scope each implementation-plan item to one layer and make cross-layer dependencies
  explicit, with the backend contract preceding its frontend consumer; and
- exclude options that violate established guidelines unless the conflict and reason
  for reconsidering the guideline are stated explicitly.

The corresponding PRD is stored at `specs/prd-<epic-slug>.md`.
