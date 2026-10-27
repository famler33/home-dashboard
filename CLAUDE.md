# Project Instructions

Home-Dashboard is a private family dashboard for a wall-mounted tablet: weather, a
combined calendar (shared Apple calendar plus two Google work calendars), shopping
list / to-dos and news headlines (local and global), with a polished, animated design.
It has a React + Vite + TypeScript + Tailwind frontend, a Node + Fastify backend with
SQLite, and runs as Docker containers on a Synology NAS in the home network.

## Repository Layout

| Path              | Contents                                                        |
| ----------------- | --------------------------------------------------------------- |
| `frontend/`       | React + Vite + TypeScript + Tailwind SPA (pnpm), Vitest + Playwright |
| `backend/`        | Node + Fastify + TypeScript, SQLite, calendar/weather/news integrations |
| `infrastructure/` | Dockerfiles and Docker Compose for the Synology NAS              |
| `specs/`          | SDD working folder — briefing, roadmap, PRDs, specs (transient)  |
| `docs/`           | Living documentation — domain docs and `docs/guidelines/`        |
| `.claude/`        | SDD skills, advisor agents, permission settings                  |

## Domain Context

Use project documentation as the default source of domain context before coding.

1. Start with `docs/domain-index.md` to identify the relevant domain document(s).
2. Read the linked `docs/domain-*.md` file(s) for entities, behaviors, and components.

When documentation and code differ, prioritize current code and update docs as part
of the same change.

## Guidelines

Detailed rules live in `docs/guidelines/`. Before working on a file, read every
guideline whose scope matches it:

| When you touch …                                   | Read                                                   |
| -------------------------------------------------- | ------------------------------------------------------ |
| anything (dependencies, build config, structure, technology choices, specs/ADRs) | `architecture-reference.md`, `security-guidelines.md` |
| `frontend/**`                                      | `coding-guidelines-frontend.md`                        |
| `frontend/**` components, styles, animations, static assets | `ux-guidelines.md`                            |
| `backend/**`                                       | `coding-guidelines-backend.md`                         |
| `infrastructure/**`                                | `infrastructure-guidelines.md`, `security-guidelines.md` |
| any test file                                      | `testing-guidelines.md` + the layer's coding guideline |
| external API credentials, calendar access, network exposure, secrets | `security-guidelines.md`    |

`coding-guidelines.md` is only an entry point that links the layer guidelines.

Tests derived from a PRD or technical specification name the covered `F-*`, `FR-*`,
`NFR-*`, and `AC-*` identifiers in an adjacent comment (see `testing-guidelines.md`).

## Advisor Agents

Read-only advisor subagents in `.claude/agents/` — consult them (Agent tool,
`subagent_type` = agent name) when decisions arise in their domain:

- `architecture-advisor` — architecture decisions, cross-stack API contract questions
- `codestyle-advisor` — coding conventions; routes by path (`frontend/**` vs `backend/**`)
- `ux-advisor` — design system, UX, i18n, accessibility
- `infrastructure-advisor` — infrastructure / deployment changes under `infrastructure/`
- `security-advisor` — authentication, authorization, and network-exposure changes

During PRD brainstorming:

- discover the relevant domain documents through `docs/domain-index.md` and preserve
  the project's domain terminology and operating context;
- apply the guidelines for every affected layer;
- consult the advisor that owns each architecture, infrastructure, UX, or security
  question.

Advisor output informs the recommended options during brainstorming but remains
advisory; the user makes the product decision.

During technical-spec writing, consult the relevant advisor before finalising a
high-impact decision or its recommended options. Advisor output is non-authoritative:
use it to check guideline alignment, not to select an answer for the user.

During implementation:

- consult `ux-advisor` before writing tests or code for UI components, styling,
  layout, or interaction patterns;
- consult `codestyle-advisor` before implementing each affected layer; and
- consult `security-advisor` when an unsettled decision changes authentication,
  authorization, network exposure, or other access-control behaviour.

Advisors validate guideline alignment only. They do not override the PRD, technical
specification, current code, or repository guidelines.

During PR review (GitHub projects): judge feedback against the PRD/specification and
every applicable guideline; advisor output is supporting evidence only and never
overrides the PRD/specification, current code, or test results.

## SDD Human Gates

Product and technical decisions in `## Open Questions` belong to the user.
Skills may generate questions and reconcile answers the user selected, but must
never tick checkboxes, flip options, or choose an answer on the user's behalf.
This applies when drafting a PRD/specification and when review feedback reopens
either artifact.

## Documentation Reconciliation

The `reconcile-docs` skill owns the final reconciliation of shipped knowledge into
the project's long-lived documentation:

- domain documentation under `docs/domain-*.md` and `docs/domain-index.md`;
- every guideline and reference document in `docs/guidelines/`.

Before changing a guideline, consult its matching advisor when one exists.
Advisors remain advisory; `reconcile-docs` makes the final edits and owns the single
documentation commit.

For historical specs snapshots, use `specs/spec-<epic-slug>.md` from git history. Do
not restore snapshot files into the working tree.

## Finishing a Delivery

A delivery is finished by `finish-local` (no GitHub remote yet) or `open-pr` (GitHub
remote exists). Both:

- require the verification gate in `testing-guidelines.md` for every in-scope epic;
- require `reconcile-docs` to have run for every in-scope epic;
- resolve ticket metadata according to `architecture-reference.md` — if no real
  ticket exists, omit the commit/PR prefix rather than inventing one;
- resolve every epic slug from its canonical roadmap heading and use the canonical
  `specs/prd-<epic-slug>.md` and `specs/spec-<epic-slug>.md` paths; and
- snapshot `specs/` into git history, clear it, and reset `specs/briefing.md` to its
  placeholder state.

`open-pr` additionally pushes and opens a draft PR whose Verification section lists
each epic's `FULLY VERIFIED` or `VERIFIED-PENDING-CI` verdict, acceptance-criterion
pass count, and documentation-reconciliation result.

## SDD Workflow Skills

Skills in `.claude/skills/` drive the spec-driven development workflow, in order:

1. `/create-roadmap` — reads `specs/briefing.md`, applies the Product Roadmap Rules in
   `architecture-reference.md`, and writes `specs/roadmap.md` (epic breakdown)
2. `/brainstorm <epic>` — builds a PRD for one epic → `specs/prd-<epic-slug>.md`
3. `/write-spec <epic>` — turns a PRD into a tech spec → `specs/spec-<epic-slug>.md`
4. `/implement-epic <epic>` — TDD implementation of a spec'd epic
5. `/verify-epic <epic>` — full QA verification using the baseline in
   `testing-guidelines.md`
6. `/reconcile-docs <epic>` — folds verified outcomes into all long-lived documentation

   Repeat 2–6 for every epic in the roadmap, then finish the delivery:

7. `/finish-local` — local projects: snapshots and clears transient specs, merges the
   delivery branch into the base branch locally
   — or, once a GitHub remote exists —
   `/open-pr` — snapshots and clears transient specs, pushes, opens a draft PR, then
   `/address-pr-review` — resolves review feedback and re-reconciles durable docs

Supporting: `/init-docs <domain>` — reverse-engineers domain docs into `docs/domain-*.md`.
