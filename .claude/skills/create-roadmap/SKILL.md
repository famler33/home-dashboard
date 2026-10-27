---
name: create-roadmap
description: >
  Creates a product roadmap from a project briefing. Reads specs/briefing.md and
  produces specs/roadmap.md containing the right number of epics to deliver the
  functionality described in the briefing. The number of epics is decided by the work
  itself — the amount of change, dependencies between changes, and how tightly or
  loosely coupled the capabilities are — not a fixed count. Resolves epic dependencies
  so the product can be built and tested incrementally. Use this skill when asked to
  create a roadmap, generate epics from a briefing, or plan an epic breakdown.
---

# Create-Roadmap Skill

You are a senior product manager and technical program manager. Your job is to take a
project briefing and produce a roadmap of epics that achieves the functionality in the
briefing, ordered so the product can be built and tested incrementally.

## Input

This skill takes **no required parameters**. It always reads the project briefing and
writes the roadmap.

Optional: the user may point to a different briefing path in their prompt. If none is
given, default to `specs/briefing.md`.

You decide how many epics the roadmap needs — see [Deciding the Number of
Epics](#deciding-the-number-of-epics). Do not ask the user for an epic count and do not
apply a fixed cap; let the work determine it.

Example prompts:

- `/create-roadmap`
- `Use the /create-roadmap skill`
- `Create a roadmap from the briefing`

> ⚠️ **If `specs/briefing.md` (or the specified briefing) does not exist, stop and ask
> the user:**
> "I couldn't find `specs/briefing.md`. Please provide the briefing document before I
> generate the roadmap."
> Do NOT invent briefing content.

## Project Context

Before generating the roadmap, read the following to ground the epics in the project:

| Source | Path | Purpose |
|--------|------|---------|
| **Briefing** | `specs/briefing.md` | The functionality the roadmap must achieve |
| **Project Instructions** | `CLAUDE.md` | Project conventions and constraints |
| **Architecture Reference** | `docs/guidelines/architecture-reference.md` | Architecture patterns and design decisions (if present) |
| **Domain Docs** | `docs/domain-index.md` | Existing domain context (if present) |

### Briefing format (what `specs/briefing.md` should contain)

The briefing is **hand-written by a human** — it is the entry point of the whole delivery
chain, not produced by a skill. Free-form prose describing the desired functionality is
enough, but include these optional header lines near the top so the ticket id and work
type flow through the rest of the pipeline **without stopping to ask**:

```markdown
Ticket: PROJ-4711      # optional — carried verbatim into roadmap → branch name → commit/PR prefixes
Type: feature          # optional — feature | fix | chore; sets the working-branch prefix (default: feature)

<free-form description of the functionality this delivery must achieve — WHAT, not HOW>

## Goals
**In Scope:**
- <intended outcome>

**Out of Scope:**
- <explicitly excluded>

## Constraints / Guardrails
- <non-negotiable requirement downstream skills must honor, even if it looks like "how">
```

Goals and Constraints are optional sections but, when present, should be treated
as **authoritative over the free-form prose** if the two disagree — bullets win.

If `Ticket:` is omitted, the roadmap header records `—` and downstream skills fall back to
extracting the ticket from the branch name (or asking). If `Type:` is omitted, it is
inferred from the content, defaulting to `feature`. Provide both when you want the
chain to name branches and commits automatically.

> **`Ticket:` / `Type:` are read from *uncommented* lines only.** Extract the value from a
> line whose first non-whitespace characters are `Ticket:` / `Type:` (not `#`), taking the
> token after the colon up to the next whitespace or inline `#` comment. A `#`-commented
> line is a **template/placeholder, not a value** — this is exactly how the pipeline resets
> `briefing.md` between deliveries (`# Ticket: PROJ-XXXX`, `# Type: feature`), so an
> unedited placeholder must be treated as *no ticket / no type declared*, never extracted
> as the literal `PROJ-XXXX` / `feature`. Downstream skills (`finish-local`,
> `open-pr`) apply the same rule.

## Output File

| File | Path | Purpose |
|------|------|---------|
| **Roadmap** | `specs/roadmap.md` | The epic breakdown and build order |

If `specs/roadmap.md` already exists, warn the user that it will be overwritten and
ask for confirmation before replacing it.

## Core Rules

- **Achieve the briefing.** Every capability described in the briefing must be covered
  by at least one epic. Do not add scope that is not implied by the briefing.
- **Right-size the number of epics.** Let the work decide how many epics there are, not
  a fixed number. Judge the scope from the amount of change, the dependencies between
  changes, and how tightly or loosely coupled the capabilities are — see [Deciding the
  Number of Epics](#deciding-the-number-of-epics). Prefer the fewest cohesive number of
  epics that cleanly cover the briefing. A small, tightly-coupled briefing may be a
  single epic; a large one with several independent slices needs more. Never split
  cohesive work just to hit a number, and never merge unrelated or heavily-dependent
  work just to reduce the count.
- **Resolve dependencies.** Order epics so that each epic depends only on epics that
  come before it. The sequence must allow the product to be **built and tested
  incrementally** — each epic should leave the system in a working, testable state.
- **Each epic is independently valuable and testable.** An epic should represent a
  vertical slice that can be implemented, tested, and demonstrated on its own once its
  dependencies are met.
- **Describe WHAT, not HOW.** Epics capture capabilities and outcomes, not detailed
  technical designs. Leave technical decisions to the spec phase.
- **The slug declared in the roadmap heading is canonical.** Downstream skills
  (`/brainstorm`, `/write-spec`, `/implement-epic`, `/verify-epic`, `/reconcile-docs`) are
  **invoked with the epic's human-readable name**, but they resolve the per-epic file names
  (`specs/prd-<slug>.md`, `specs/spec-<slug>.md`) by reading the **declared slug verbatim**
  from this epic's heading `### N. <Epic Name> (<epic-slug>)` — they do **not** re-derive it
  by kebab-casing the name. So the slug you write in the parentheses is the single source of
  truth every skill uses. **Prefer `kebab-case(<Epic Name>)`** for readability and so the
  name and slug stay obviously linked (`Dropshipment Returns` → `dropshipment-returns`); when
  a name doesn't kebab-case cleanly (`API v2`, `CI/CD Pipeline`), either rename the epic or
  declare an explicit clean slug — the declared slug still governs, since downstream reads it
  verbatim. Keep the heading format `### N. <Epic Name> (<epic-slug>)` so both are explicit.
  Once the chain has started, **never change an epic's slug** — the file names are already
  resolved from it. The slug governs file names, the name governs prose (PRD/spec titles).

## Deciding the Number of Epics

There is **no fixed target and no cap**. Decide the count by analysing the work implied
by the briefing:

- **Amount of change.** Estimate the volume of work per capability. A briefing that
  implies a large amount of change usually warrants more epics so each stays a
  manageable, independently testable slice; a small briefing may need only one.
- **Dependencies between changes.** Map what must exist before what. Deep dependency
  chains suggest sequential epics ordered by dependency; capabilities that can be built
  independently can become parallel-ready epics.
- **Coupling / decoupling.** Keep tightly-coupled capabilities (shared data model, same
  bounded context, changed together) inside one epic. Split cleanly-decoupled
  capabilities (distinct concerns, separately deployable/testable) into separate epics.
- **Independent testability.** Each epic must leave the system in a working, testable
  state on its own once its dependencies are met. If a candidate epic can't be tested
  without another, consider merging them or reordering.

Apply the smallest-count-that-fits principle: choose the fewest cohesive epics that
satisfy all four considerations. Briefly record the reasoning that drove the count in
the roadmap's Overview and in the final summary, so the choice is transparent. If the
briefing is large enough to produce many epics (e.g. more than ~6), that is fine as long
as each epic is justified by the analysis above — do not artificially cap the number.

## Workflow

1. **Read the briefing** and any available project context. Note the briefing's
   `Ticket:` line if it declares one (e.g. `Ticket: PROJ-4711`) — it is carried into the
   roadmap header verbatim; **do not invent one** if the briefing has none. Likewise note
   any `Type:` line (`feature` / `fix` / `chore`) describing the nature of the work; if the
   briefing declares none, infer it from the briefing's content, defaulting to `feature`.
2. **Extract the required capabilities** implied by the briefing.
3. **Analyse the work** — estimate amount of change, map dependencies, and assess
   coupling to decide the right number of epics (see [Deciding the Number of
   Epics](#deciding-the-number-of-epics)).
4. **Group capabilities into epics** accordingly — the fewest cohesive epics that cover
   everything while keeping each independently testable.
5. **Determine dependencies** between epics and order them so they can be built and
   tested incrementally.
6. **Write `specs/roadmap.md`** using the template below. Copy the briefing's `Ticket:`
   value into the header's `**Ticket:**` field, or leave `—` if the briefing declares none.
   Set `**Type:**` from the briefing's `Type:` line, or the type you inferred (default
   `feature`).
7. **Present a summary** to the user (epic count with the reasoning behind it, build
   order, and any capability not yet covered).

## Roadmap Template

```markdown
# Roadmap

> **Source Briefing:** specs/briefing.md
> **Ticket:** <ticket id from the briefing's `Ticket:` line, e.g. PROJ-4711, or `—` if none>
> **Type:** <feature | fix | chore — the nature of the work, from the briefing's `Type:` line; default `feature`>
> **Created:** <date>
> **Epic Count:** <count>

## Overview

<2-4 sentence summary of what the product does, based on the briefing, the overall
build strategy, and a brief note on why the roadmap has this number of epics (amount of
change, dependencies, coupling).>

## Build Order

The epics below are ordered so the product can be built and tested incrementally. Each
epic depends only on epics listed before it.

## Epics

### 1. <Epic Name> (`<epic-slug>`)

**Goal:** <What this epic delivers and why it comes first.>

**Capabilities:**
- <Capability from the briefing>
- <Capability from the briefing>

**Depends on:** _None_

**Testable outcome:** <How you can verify this epic works on its own.>

---

### 2. <Epic Name> (`<epic-slug>`)

**Goal:** <What this epic delivers.>

**Capabilities:**
- <Capability from the briefing>

**Depends on:** `<epic-slug of prerequisite>`

**Testable outcome:** <How you can verify this epic works.>

---

<...repeat for as many epics as the work justifies — see "Deciding the Number of Epics"...>

## Dependency Summary

| Epic | Depends On |
|------|------------|
| `<epic-slug-1>` | _None_ |
| `<epic-slug-2>` | `<epic-slug-1>` |
| `<epic-slug-3>` | `<epic-slug-1>`, `<epic-slug-2>` |

## Briefing Coverage

| Briefing Capability | Covered By Epic |
|---------------------|-----------------|
| <capability> | `<epic-slug>` |
```

## Summary Format

After writing the roadmap, present:

```
🗺️  Roadmap Generated
──────────────────────────────────────────
File:        specs/roadmap.md
Source:      specs/briefing.md

Epics:       <count>
Sizing:      <1-line reason for this count — amount of change / dependencies / coupling>
Build order: <epic-slug-1> → <epic-slug-2> → ...

✅ All briefing capabilities are covered.
→ Next: run /brainstorm "<Epic Name>" to flesh out the first epic
        (pass the epic's human-readable name from the roadmap heading, NOT the slug —
         brainstorm resolves the canonical slug from the matching roadmap heading
         (falling back to kebab-case(name) only if no roadmap entry exists) and uses
         the name in the PRD title).
```
