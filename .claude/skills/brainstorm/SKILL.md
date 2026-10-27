---
name: brainstorm
description: >
  Creates a Product Requirements Document (PRD) for a given epic.
  Use this skill when asked to brainstorm, create a PRD, or flesh out an epic into requirements.
  Takes an epic name as input and produces a structured PRD in the specs/ folder
  through an iterative question-and-answer refinement loop.
---

# Brainstorm Skill — Epic-to-PRD Generator

You are a product analyst. Your job is to produce a complete **Product Requirements Document (PRD)** for the epic the user provides.

## Inputs

- **Epic name**: provided by the user in the prompt (e.g. "Dropshipment Returns").
- **Epic slug (optional explicit canonical value)**: when the caller supplies a canonical
  slug, use it verbatim. This is required for review-time re-entry after `roadmap.md` has
  been cleared; do not derive a replacement from the epic name.
- **Roadmap context**: read `specs/roadmap.md` for strategic context, priorities, and app goals.
- **Briefing context**: read `specs/briefing.md` when present for the original app goals,
  constraints, and product framing; do not block if it is absent.
- **Related specs**: scan other files in `specs/` for relevant prior decisions, shared
  terminology, and cross-epic dependencies. Treat them as context, not authority over this
  epic's roadmap scope.
- **Project guidance**: read whichever of `AGENTS.md`, `docs/domain-index.md`,
  `docs/guidelines/ux-guidelines.md`, `docs/guidelines/architecture-reference.md`, and
  `CLAUDE.md` exist. Use them to preserve the repository's domain
  language and ground recommended options; missing files are not blockers.
- **Architecture reference**: if the repository defines an `architecture-advisor` agent,
  consult it for architecture-aware guidance; otherwise read the repo's architecture
  reference doc `docs/guidelines/architecture-reference.md` and fall back to general
  product/architecture best practices. Never block on a missing agent or doc (see
  Workflow Rules below).

## Output

Create (or update) the PRD file at: `specs/prd-<epic-slug>.md`.

**Resolving `<epic-slug>` (canonical).** An explicit caller-supplied canonical slug wins.
Otherwise the slug is defined by the roadmap, not re-invented here: find this epic's heading in `specs/roadmap.md`
(`### N. <Epic Name> (<epic-slug>)`) and use the **declared slug in the parentheses**
verbatim for the file name (e.g. `specs/prd-dropshipment-returns.md`). Only if no roadmap
entry exists (roadmap-less run) fall back to `kebab-case(<Epic Name>)`. Do **not** assume
`kebab-case(name)` always equals the declared slug — the roadmap's slug wins so every
downstream skill resolves the same filename.

## PRD Structure

Use exactly this structure:

```markdown
# PRD: <Epic Name>

> **Status:** Draft
> **Confidence:** <N>%
> **Created:** <date>
> **Last updated:** <date>

## 1. Problem Statement
<!-- What problem are we solving and why does it matter? -->

## 2. Goals & Success Metrics
<!-- What does success look like? How will we measure it? -->

## 3. User Stories & Personas
<!-- Who benefits and what do they need? -->

## 4. Features
<!-- List each feature with a short description -->

### Feature N: <Name>
- Description:
- Acceptance Criteria:
  - AC 1
  - AC 2

## 5. Functional Requirements
<!-- Behavioral requirements — what the system must do -->

## 6. Non-Functional Requirements
<!-- Performance, security, scalability, observability, compliance, etc. -->

## 7. Out of Scope
<!-- Explicitly list what this epic does NOT cover -->

## 8. Dependencies & Risks
<!-- External dependencies, integration risks, unknowns -->

## 9. Iteration Log
<!-- Append a dated entry for each refinement cycle -->

### Iteration 1 — <date>
- Questions asked: N
- Questions resolved: N
- Confidence: N% → N%
- Summary of changes: ...

---

## Open Questions

<!-- Questions for the user. Remove each question once answered and reconciled. -->

### Q1: <Question text>
<!-- 2–4 options, each a genuinely different choice; never duplicate/pad. Append (Recommended — <one-sentence reason>) to one of them.
     Letter each option (A, B, C, D…) so it can be referenced by letter alone (e.g. "go with B"). -->
- [ ] A. <description> **(Recommended — <one-sentence reason why>)**
- [ ] B. <description>
- [ ] C. <description>
- [ ] D. <description>
```

## Workflow Rules

Follow these rules strictly:

### 1. Initial Draft
- Read `specs/roadmap.md` to understand strategic context and app goals.
- Read the available project-context and guideline files listed under Inputs before drafting.
- Review related existing specs for decisions or dependencies that this PRD must acknowledge
  without copying their technical design into the product requirements.
- Produce the first draft of the PRD based on the epic name and roadmap context.
- Fill in as much as you can from the roadmap and domain knowledge.
- Set initial confidence level (typically 30–50% for a first draft).

### 2. Question Generation
- For every open requirement, ambiguous behavior, or major-impact functionality, generate a clarifying question.
- Give each question a stable, sequential identifier (`Q1`, `Q2`, …) across the PRD's
  lifetime. Never reuse an identifier after its question is reconciled and removed.
- **If the repository defines an `architecture-advisor` agent, consult it** before
  finalizing questions that have architectural implications (e.g., data storage, event
  patterns, API design, integration approaches); it will help craft better questions and
  provide architecture-aligned recommended options. **If no such agent exists, do not
  block** — read the repo's architecture reference doc (e.g. `docs/guidelines/architecture-reference.md`)
  if present, and otherwise rely on general best practices to shape the questions.
- Place **all questions at the bottom** of the PRD file under the `## Open Questions` section.
- Each question must have **2–4 mutually distinct options** — aim for 4, but only when there are genuinely that many meaningfully different choices. **Never pad the list to hit a count** by duplicating an option or restating one with slightly different wording; if only 2 or 3 real choices exist, list only those.
- Each option must use `- [ ]` checkbox syntax so the user can easily select one, and must be
  **lettered** (`A.`, `B.`, `C.`, `D.`, in that order — no "Option" prefix) so it can be
  referenced tersely (e.g. "go with B", "combine A and C").
- **Mark exactly one of the existing options `(Recommended)`** by appending the tag to that option. The recommendation is an **annotation on one of the distinct options above — never a separate, extra, or duplicated option**, and never a re-worded copy of another option's decision. Base the recommendation on UX best practices and the architecture reference of this project (discover them from the architecture reference/`architecture-advisor` rather than assuming a specific stack); use the architecture-advisor's recommendation when the question has architectural relevance.
- **The recommended option must always include a brief one-sentence reason why it is recommended**, written inline in that option's own description (e.g. `**(Recommended — <one-sentence reason>)**`). Keep it to a single concise sentence; never expand it into extra options or multi-paragraph justifications.
- **Never select an answer automatically.** All checkboxes must remain unchecked `[ ]` unless the user explicitly asks you to pick.

### 3. Waiting for Answers
- After writing questions to the file, **stop and tell the user** to review the PRD and select answers in the file.
- Do **not** ask questions interactively in the chat. All questions go in the file only.

### 4. Reconciliation
- When the user returns (e.g. says "continue", "reconcile", or "next iteration"):
  - Re-read the PRD file.
  - Find all questions where the user has checked an option (`[x]`).
  - **Validate exactly one selection per question.** A well-formed answer has **one and
    only one** `[x]` for a question. If a question has **multiple** boxes checked (which
    would reconcile into contradictory requirements) or an answered-looking question is
    otherwise malformed, do **not** guess — leave that question unresolved and, at the end
    of the pass, tell the user which questions need a single choice. Reconcile only the
    cleanly-answered (exactly-one-`[x]`) questions.
  - **Reconcile** each answered question: convert the selected option into a direct PRD
    statement, requirement, or acceptance criterion in the appropriate section.
    If the user's answer includes an implementation choice, preserve its product-level
    intent and constraints but do not copy frameworks, schemas, protocols, or other
    technical design into the PRD.
  - **Remove** the reconciled questions from the `## Open Questions` section.
  - Append a new entry to the `## 9. Iteration Log` documenting what changed; never
    overwrite earlier entries.
  - Recalculate and update the **Confidence** level.

### 5. Iterate
- After reconciliation, if confidence is **below 90%**, generate new clarifying questions for any remaining gaps or ambiguities introduced by the latest answers.
- Repeat the cycle (questions → user answers → reconcile) until confidence reaches **90% or higher**.
- Calibrate confidence conservatively: below 50% means core scope or flows are undefined;
  50–74% means main features exist but high-impact requirements remain open; 75–89% means
  only minor or edge-case questions remain; 90%+ requires no unresolved high-impact product
  decision and complete feature/requirement/AC coverage.
- **Ready requires BOTH** confidence **≥ 90%** **and** an **empty `## Open Questions`
  section** (every question reconciled — no leftover unchecked or malformed ones). A PRD is
  not ready while any open question remains, even at ≥ 90% confidence.
- Before marking the PRD ready, remove or resolve every `[TBD]`, placeholder, and knowingly
  incomplete section. A high confidence score must not mask missing requirement content.
- Ensure every functional and non-functional requirement is either covered by at least one
  clear, testable acceptance criterion or explicitly identified as out of scope for this epic.
- Once confidence ≥ 90% **and no open questions remain**, update the PRD file's own
  `> **Status:**` line from `Draft` to `Ready` (and refresh `**Last updated**`) — the file's
  header must reflect the same "ready" state you're about to announce, not just the chat
  message. Then inform the user that the PRD is ready for review and no further questions
  are needed.
- **Point them to the next step:** run `/write-spec "<Epic Name>"` — pass the epic's
  human-readable name (the same one used here), not the slug. `write-spec` enforces its own
  PRD-≥-90% pre-flight gate, so it will refuse to start until this PRD reaches 90%.

## Important Constraints

- **No technical decisions in the PRD.** Do not prescribe database schemas, API designs, specific libraries, or implementation details. Focus on *what* and *why*, not *how*.
- **Stay product-focused.** Write requirements from the perspective of business value, user needs, and measurable outcomes.
- **Be specific in acceptance criteria.** Each AC should be testable and unambiguous.
- **Use stable identifiers for traceability.** Number features, functional requirements,
  non-functional requirements, and acceptance criteria consistently (for example `F-1`,
  `FR-1`, `NFR-1`, `AC-1`). Do not renumber surviving items during reconciliation; append
  new identifiers so downstream specs and reports keep valid references.
- **Respect existing domain language.** Use terminology consistent with the repository's own domain — discover it from the roadmap, existing specs, docs, and code rather than assuming a specific domain.
