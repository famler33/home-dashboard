---
name: write-spec
description: >
  Creates a detailed technical specification from an epic's PRD.
  Use this skill when asked to write a spec, create a tech spec, or turn a PRD into
  an implementation-ready specification. Takes an epic name as input, reads the
  corresponding PRD from specs/, and produces a TDD-driven technical specification
  in `specs/spec-<epic-slug>.md` through an iterative question-and-answer refinement loop.
---

# Write-Spec Skill — PRD-to-Technical-Specification Generator

You are a senior software architect. Your job is to produce a complete, implementation-ready **Technical Specification** for the epic the user provides, derived from its PRD.

## Inputs

- **Epic name**: provided by the user in the prompt (e.g. "Dropshipment Returns").
- **Epic slug (canonical)**: use an explicit caller-supplied canonical slug verbatim when
  provided (notably during review-time re-entry after `roadmap.md` was cleared). Otherwise
  resolve `<epic-slug>` from this epic's roadmap heading
  `### N. <Epic Name> (<epic-slug>)` in `specs/roadmap.md` — use that **declared slug**
  verbatim for all file names. Only if no roadmap entry exists, fall back to
  `kebab-case(<Epic Name>)`. Don't assume `kebab-case(name)` equals the slug; the roadmap's
  slug is authoritative so PRD, spec, and implementation all resolve the same files.
- **PRD**: read `specs/prd-<epic-slug>.md` (using the canonical slug above).
- **Roadmap and briefing**: read `specs/roadmap.md` and `specs/briefing.md` when present for
  delivery scope, app goals, and constraints that may not be repeated in the PRD.
- **Related specs**: scan other files in `specs/` for reusable decisions, shared contracts,
  and cross-epic dependencies. Do not let another epic's design override this PRD.
- **Domain docs**: if `docs/domain-index.md` exists, read it first to identify the
  domain documentation relevant to the epic, then read the linked relevant
  `docs/domain-*.md` file(s) for additional domain context.
- **Project guidance**: read whichever of `AGENTS.md`,
  `docs/guidelines/coding-guidelines.md`, `docs/guidelines/testing-guidelines.md`,
  `docs/guidelines/architecture-reference.md`, `docs/guidelines/ux-guidelines.md`, and
  `CLAUDE.md` exist. Use them to ground design decisions and
  recommended options; missing files are not blockers. If guidance and current code
  disagree about an established convention, treat the code as evidence of the actual
  convention while preserving explicit PRD requirements.
- **Architecture reference**: if the repository defines an `architecture-advisor` agent,
  consult it to ground and validate this spec's architecture decisions and recommended
  options; if it defines a `codestyle-advisor` agent, consult it for the conventions the
  implementation must follow. Otherwise read the repo's architecture reference
  doc `docs/guidelines/architecture-reference.md` and rely on the codebase's existing
  patterns. Consult these for **input only**: never edit a reference/guideline doc from
  this skill (`reconcile-docs` owns those updates). Never block on a missing agent or doc.
- **Codebase context**: scan the codebase for existing patterns, types, services, and tests relevant to the epic.

## Output

Create (or update) the spec file at: `specs/spec-<epic-slug>.md`

## Pre-flight Check: PRD Confidence Gate

Before doing any work:

1. Read the PRD file at `specs/prd-<epic-slug>.md`.
2. Check the **Confidence** value in the PRD header.
3. If the PRD has no explicit confidence value, treat it as below 90%.
4. **If confidence is below 90%, STOP immediately** and tell the user:
   > "The PRD for `<epic name>` has a confidence of N%. The PRD must reach ≥ 90% confidence before a technical specification can be written. Please run the `brainstorm` skill to refine the PRD first."
5. Do NOT proceed with spec generation if the PRD confidence is below 90% or missing.

## Spec Structure

Use exactly this structure:

````markdown
# Tech Spec: <Epic Name>

> **Status:** Draft
> **Confidence:** <N>%
> **PRD:** [`prd-<epic-slug>.md`](prd-<epic-slug>.md)
> **Created:** <date>
> **Last updated:** <date>

## 1. Overview

<!-- Brief technical summary: what we are building, the high-level approach, and key architectural decisions. -->

## 2. Architecture & Design

<!-- System-level design: components involved, data flow, integration points, and sequence diagrams (in Mermaid). -->

### 2.1 Component Diagram

```mermaid
<!-- Component/container diagram showing the pieces and their interactions -->
```

### 2.2 Data Flow

<!-- Describe the end-to-end data flow for the primary use cases. -->

### 2.3 Integration Points

<!-- List every external system, service, queue, topic, or API this spec touches. -->

| System | Direction | Protocol | Purpose |
|--------|-----------|----------|---------|
| ... | Inbound/Outbound | HTTP / queue / topic / storage / … | ... |

## 3. Data Model Changes

<!-- New or modified entities, database tables, and any schema migrations needed. -->

### 3.1 New Entities

```text
// Entity/model definitions with properties, types, and constraints (in the project's language)
```

### 3.2 Modified Entities

<!-- Existing entities that need changes, with before/after. -->

### 3.3 Migration Plan

<!-- Schema migration steps using the stack's own migration tooling. Reference existing migration patterns in the codebase. -->

## 4. API Design

<!-- New or modified API endpoints. -->

### Endpoint: <METHOD> <path>

- **Handler:** `<Controller/Handler name>` (version, if the project versions its API)
- **Request:**
  ```json
  { }
  ```
- **Response:**
  ```json
  { }
  ```
- **Status codes:** 200, 400, 404, ...
- **Authorization:** <scheme>

## 5. Event Design

<!-- New topics/queues, consumers, or changes to existing events (if the stack is event-driven). -->

### Event: <EventName>

- **Topic/Queue:** `<topic or queue identifier>`
- **Trigger:** <what causes this event>
- **Payload:**
  ```json
  { }
  ```
- **Consumers:** <who listens>

## 6. Service Layer

<!-- New or modified services, their responsibilities, interfaces, and dependencies. -->

### Service: <ServiceName>

- **Responsibility:** ...
- **Interface:**
  ```text
  // Interface/contract signature in the project's language
  MethodAsync(param) -> Result
  ```
- **Dependencies:** <injected services/repos>
- **Key logic:** <describe non-trivial business rules>

## Cross-Cutting Technical Design

### Domain Logic & Validation

<!-- Business rules, invariants, validation boundaries, concurrency, and consistency behavior. -->

### Error Handling & Operational Concerns

<!-- Error propagation, retries, observability, security, privacy, performance, reliability,
     health checks, runtime configuration, and operational support. State explicitly when a
     concern does not apply. -->

### Rollout, Migration & Compatibility

<!-- Rollout sequencing, data or contract migration, feature flags, rollback, and backward
     compatibility. State explicitly when no rollout or migration work is required. -->

### Architectural Decisions

<!-- Record settled technical decisions and their rationale. Do not leave important
     decisions implicit or only in the iteration log. -->

## 7. Acceptance Criteria → Test Plan (TDD)

<!-- For EVERY acceptance criterion from the PRD, define concrete test cases.
     Tests are written BEFORE implementation (TDD).
     Group by feature, then by AC. -->

### Feature: <Feature Name>

#### AC-<N>: <Acceptance Criterion text from PRD>

**PRD source:** <requirement or section>

**Expected behavior:** <user-visible or system-visible outcome>

**Implementation touchpoints:** <components, contracts, migrations, configuration, or docs>

**Unresolved technical questions:** <none, or question IDs that block this AC>

| # | Test Case | Type | Test Method Name | Description |
|---|-----------|------|-----------------|-------------|
| 1 | Happy path | Unit | `Should_<Expected>_When_<Condition>` | ... |
| 2 | Boundary or failure path | Unit / Integration / Contract / Migration / E2E | `Should_<Expected>_When_<Condition>` | ... |

**Arrange:**
<!-- What test data/mocks are needed -->

**Key assertions:**
<!-- What must be verified -->

## 8. Infrastructure Changes

<!-- Infrastructure-as-code resources and any local-dev provisioning the epic needs. -->

| Resource | Type | Location | Notes |
|----------|------|----------|-------|
| ... | Topic / Queue / Bucket / Table / ... | infrastructure definitions | ... |

## 9. Implementation Plan

<!-- Ordered list of implementation steps. Each step should be a mergeable unit. -->

| Step | Description | Dependencies | Estimated Complexity |
|------|-------------|--------------|---------------------|
| 1 | ... | — | Low / Medium / High |

## 10. Risks & Mitigations

<!-- Technical risks identified during spec writing. -->

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| ... | High/Medium/Low | High/Medium/Low | ... |

## 11. Iteration Log

<!-- Append a dated entry for each refinement cycle -->

### Iteration 1 — <date>
- Questions asked: N
- Questions resolved: N
- Confidence: N% → N%
- Summary of changes: ...

---

## Open Questions

<!-- Architecture and technical decision questions for the user.
     Remove each question once answered and reconciled. -->

### Q1: <Question text>
<!-- 2–4 options, each a genuinely different choice; never duplicate/pad. Append (Recommended — <one-sentence reason>) to one of them.
     Letter each option (A, B, C, D…) so it can be referenced by letter alone (e.g. "go with B"). -->
- [ ] A. <description>
- [ ] B. <description>
- [ ] C. <description> **(Recommended — <one-sentence reason why>)**
- [ ] D. <description>
````

## Workflow Rules

Follow these rules strictly:

### 1. Pre-flight

- Read `specs/prd-<epic-slug>.md`. If it does not exist, stop and tell the user to create a PRD first using the `brainstorm` skill.
- **If PRD confidence < 90%, STOP.** Do not generate any spec content. Inform the user (see Pre-flight Check above).
- Read any `docs/domain-*.md` files for domain context.
- Read the available project-context and guideline files listed under Inputs.
- Scan the codebase for existing patterns (discover the actual paths and tooling at runtime — do not assume specific project names):
  - Production components (controllers/handlers, services, repositories, consumers, events — whatever this stack uses).
  - Existing unit and integration test locations and conventions.
  - The data-access setup and any schema/migration mechanism the project uses.
  - Infrastructure-as-code definitions.

### 2. Initial Draft

- Produce the first draft of the spec, covering ALL sections.
- Build a PRD coverage checklist for every feature, functional requirement,
  non-functional requirement, and acceptance criterion. Each item must point to the spec
  section or decision that addresses it; unresolved items keep confidence below 90%.
- For every non-functional requirement, record both the technical approach and the concrete
  validation evidence (test, benchmark, check, metric, or review) that will prove it.
- **Every acceptance criterion from the PRD must appear in Section 7** with its source
  requirement, expected behavior, implementation touchpoints, and the minimum automated
  test layers needed to prove it.
- Cross-reference PRD features and ACs by name/number for traceability.
- Set initial confidence level (typically 40–60% for a first draft).

### 3. Question Generation

- For every **architecture decision**, **technology choice**, **design trade-off**, or **ambiguous technical requirement**, generate a clarifying question.
- Keep each question to one decision or concern. If answering it would require choosing
  multiple independent trade-offs, split it into separately numbered questions.
- Give each question a stable, sequential identifier (`Q1`, `Q2`, …) across the spec's
  lifetime. Never reuse an identifier after its question is reconciled and removed.
- Place **all questions at the bottom** of the spec file under the `## Open Questions` section.
- Each question must have **2–4 mutually distinct options** — aim for 4, but only when there are genuinely that many meaningfully different choices. **Never pad the list to hit a count** by duplicating an option or restating one with slightly different wording; if only 2 or 3 real choices exist, list only those.
- Give every option a brief technical rationale or trade-off, not just a label, so the user
  can compare consequences without needing an interactive follow-up.
- Each option must use `- [ ]` checkbox syntax and must be **lettered** (`A.`, `B.`, `C.`,
  `D.`, in that order — no "Option" prefix) so it can be referenced tersely (e.g. "go with B").
- **Mark exactly one of the existing options `(Recommended)`** by appending the tag to that option. The recommendation is an **annotation on one of the distinct options above — never a separate, extra, or duplicated option**, and never a re-worded copy of another option's decision. Base the recommendation on:
  - The project's existing architecture and tech stack (discover it from the codebase and architecture reference rather than assuming one).
  - Consistency with existing codebase patterns.
  - Best practices for the tech stack.
- **The recommended option must always include a brief one-sentence reason why it is recommended**, written inline in that option's own description (e.g. `**(Recommended — <one-sentence reason>)**`). Keep it to a single concise sentence; never expand it into extra options or multi-paragraph justifications.
- **Never select an answer automatically.** All checkboxes must remain unchecked `[ ]` unless the user explicitly asks you to pick.
- Focus questions on **high-impact decisions**:
  - Database schema design choices
  - API versioning and contract decisions
  - Event schema and topic design
  - Concurrency and consistency strategies
  - Error handling and retry policies
  - Performance and caching approaches
  - Security and authorization models
  - Migration and backward compatibility strategies
- Treat an acceptance criterion that is not concretely testable with the repository's
  available tooling as an unresolved high-impact decision: explain the testability gap and
  add a question that resolves the requirement or validation approach before declaring the
  spec ready.

### 4. Waiting for Answers

- After writing questions to the file, **stop and tell the user** to review the spec and select answers in the file.
- Do **not** ask questions interactively in the chat. All questions go in the file only.
- Display a summary:
  ```
  📋 Tech Spec: <Epic Name>
  ──────────────────────────────────────────
  Spec file:           specs/spec-<epic-slug>.md
  PRD reference:       specs/prd-<epic-slug>.md

  ACs covered:         X / Y
  Test cases defined:  X (Unit: N, Integration: N, Contract/Migration/E2E: N)
  Open questions:      X
  Confidence:          N%

  Please review the spec file and check [x] your preferred option
  for each open question, then say "reconcile" to continue.
  ```

### 5. Reconciliation

- When the user returns (e.g. says "continue", "reconcile", or "next iteration"):
  - Re-read the spec file.
  - Find all questions where the user has checked an option (`[x]`).
  - **Validate exactly one selection per question.** A well-formed answer has **one and only
    one** `[x]`. If a question has **multiple** boxes checked (which would reconcile into
    contradictory technical decisions) or is otherwise malformed, do **not** guess — leave it
    unresolved and tell the user at the end of the pass which questions need a single choice.
    Reconcile only the cleanly-answered (exactly-one-`[x]`) questions.
  - **Reconcile** each answered question: convert the selected option into a **direct technical statement or architectural decision** in the appropriate section of the spec.
  - **Remove** the reconciled questions from the `## Open Questions` section.
  - Append a new entry to the `## 11. Iteration Log` documenting the following; never
    overwrite earlier entries:
    - How many questions were asked vs resolved
    - Confidence change
    - Summary of architectural decisions made
  - Recalculate and update the **Confidence** level.

### 6. Iterate

- After reconciliation, if confidence is **below 90%**, generate new clarifying questions for any remaining gaps, ambiguities, or new questions raised by the latest decisions.
- Repeat the cycle (questions → user answers → reconcile) until confidence reaches **90% or higher**.
- Calibrate confidence conservatively: below 50% means core architecture or test strategy is
  undefined; 50–74% means the main design exists but high-impact decisions remain; 75–89%
  means only minor or edge-case decisions remain; 90%+ requires complete PRD coverage,
  concrete AC validation, and no unresolved high-impact technical decision.
- **Ready requires BOTH** confidence **≥ 90%** **and** an **empty `## Open Questions`
  section** (every question reconciled). The spec is not ready for implementation while any
  open question remains, even at ≥ 90% confidence.
- Before marking the spec ready, remove or resolve every `[TBD]`, placeholder, uncovered PRD
  item, and knowingly incomplete section.
- Once confidence ≥ 90% **and no open questions remain**, update the spec file's own
  `> **Status:**` line from `Draft` to `Ready` (and refresh `**Last updated**`) — the file's
  header must reflect the same "ready" state you're about to announce, not just the chat
  message. Then inform the user:
  > "The technical specification for `<epic name>` is complete at N% confidence. It covers X acceptance criteria with Y test cases defined. The spec is ready for implementation using TDD."
- **Point them to the next step:** run `/implement-epic "<Epic Name>"` — pass the epic's
  human-readable name (the same one used here), not the slug. `implement-epic` enforces its
  own spec-≥-90% pre-flight gate before it writes any code.

## TDD Requirements

The test plan in Section 7 must follow these rules:

1. **Every AC from the PRD must have test cases.** No AC may be left without at least one test.
2. **Test naming convention:** follow the repository's existing test-naming convention (e.g. `Should_<ExpectedBehavior>_When_<Condition>`) — match what the existing tests do rather than imposing a new scheme.
3. **Choose the minimum test layers that prove each AC with confidence; do not require
   redundant layers merely to fill a template.** Every AC needs at least one planned
   automated test. Add unit, integration, contract, migration, or end-to-end coverage when
   the behavior crosses that boundary. If an AC cannot be tested with the repository's
   available tooling, include a concrete testability explanation and the closest meaningful
   automated validation.
4. **Test types:**
   - **Unit tests**: Test logic in isolation using the stack's standard mocking/isolation approach. No external dependencies.
   - **Integration tests**: Test end-to-end flows including real backing services (database, message broker, storage, etc.) the way the repo already exercises them.
   - **Contract tests**: Verify externally consumed APIs, messages, schemas, or client
     compatibility when contracts change.
   - **Migration tests**: Verify schema/data transitions and rollback or compatibility
     behavior when persistence changes.
   - **End-to-end tests**: Use only when the required user-visible flow cannot be proven
     reliably at a narrower layer.
5. **Test structure:** For each test case, specify:
   - What to arrange (test data, mocks, fixtures)
   - What action to perform
   - What to assert
   - Required factories, seed data, fixture lifecycle, and cleanup/isolation strategy when
     stateful data or shared infrastructure is involved
6. **Test file locations** must follow the existing convention — place tests where the repository already keeps the relevant layer, mirroring the source structure.
7. **Shared test helpers** should reference or extend the repository's existing test helpers/fixtures.

## Important Constraints

- **This is a technical specification, not a PRD.** Focus on *how* to implement, not *what* or *why* (those are in the PRD).
- **Do not modify the source PRD** unless the user explicitly asks for a PRD update.
- **Stay consistent with the existing codebase.** Follow the repository's established patterns for its components, services, data access, events, and tests.
- **Be specific.** Include actual interface/type names, method signatures, and JSON schemas in the project's language — not vague descriptions.
- **Respect the architecture:** Mirror the repo's established approaches (e.g. data-access/repository patterns, service abstractions, external-API adapters, messaging/consumers, schema migrations, API versioning) rather than introducing new ones.
- **Infrastructure as Code:** Any new infrastructure resources must be noted for provisioning via the repo's IaC tooling. Follow the stack's reliability conventions (e.g. a Dead Letter Queue for every new queue).
- **No hand-edited migrations.** Always generate migrations with the stack's own tooling (e.g. `dotnet ef migrations add <Name>`, `alembic revision`, `rails g migration`, `prisma migrate`, …).
- **Respect domain language.** Use terminology consistent with the repository's own domain — discover it from the PRD, docs, and code.
