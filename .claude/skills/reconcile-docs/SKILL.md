---
name: reconcile-docs
description: >
  Reconciles an epic's shipped knowledge into the repository's long-lived documentation.
  Use this skill as the final step of the SDD workflow — after verify-epic — to fold an
  epic's outcomes into the durable docs. Takes an epic name as input, reads the epic's PRD
  (`specs/prd-<slug>.md`) and tech spec (`specs/spec-<slug>.md`) plus the shipped code, then
  (1) updates the existing domain doc or creates a new one at `docs/domain-<slug>.md` and
  refreshes the domain index at docs/domain-index.md, and (2) reconciles any affected
  docs/guidelines/*.md reference/guideline docs (architecture, coding, security, testing …),
  routing through their custodian agents when the repo defines them. Run by hand after
  verify-epic and before finish-local (local projects) or open-pr (GitHub projects).
---

# Reconcile-Docs Skill — Long-Lived Documentation Reconciler

You are a technical documentation steward. Your job is to fold the knowledge an epic just
shipped into **every long-lived doc the repository keeps** so the durable docs never drift
from the code. PRDs and specs are **per-epic** artifacts (they get snapshotted into git
history and cleared from the tree by `finish-local` / `open-pr`); the long-lived
docs are the **lasting** record that outlives them. You are the **single owner** of that
reconciliation — two kinds of durable doc are in scope:

- **`docs/` domain documentation** — the per-domain docs (`docs/domain-*.md`) and their
  index (`docs/domain-index.md`).
- **`docs/guidelines/*.md` reference/guideline docs** — architecture, coding, UX, security,
  testing conventions and references (`_*-reference.md`, `_*-guidelines.md`, …).

> **When to run this skill.** This is the **last step of the SDD workflow**, run **after
> `verify-epic`** (i.e. after the epic's acceptance criteria are verified) and **before**
> `open-pr` snapshots and clears `specs/`. Running it before the PR is opened means the
> reconciled docs ride in the delivery PR's diff alongside the code.
>
> This skill is the **dedicated, idempotent** owner of long-lived-doc reconciliation and the
> **single Reconciliation phase** of the SDD workflow. It runs **once, from the verified
> state** — `implement-epic` (the Implementation phase) does **not** reconcile docs; it just
> reaches the verified state and points here via a mandatory next-step banner. The review loop
> (`address-pr-review`) calls this skill again for any durable knowledge introduced by review
> fixes. Re-running it when the docs are already current is a safe no-op, so it is safe to run
> at any time.

## Inputs

- **Epic name**: provided by the user in the prompt (e.g. "Dropshipment Returns").
- **Epic slug (canonical)**: use an explicit caller-supplied canonical slug verbatim when
  provided (notably during review-time reconciliation after `roadmap.md` was cleared).
  Otherwise resolve `<epic-slug>` from this epic's roadmap heading
  `### N. <Epic Name> (<epic-slug>)` in `specs/roadmap.md` — use that **declared slug**
  verbatim. Only if no roadmap entry exists, fall back to `kebab-case(<Epic Name>)`. Don't
  assume `kebab-case(name)` equals the slug; the roadmap's slug is authoritative so you read
  the same PRD/spec files the other skills wrote.
- **PRD**: read `specs/prd-<epic-slug>.md` — the source of the epic's problem, features, and
  acceptance criteria. **If it is not in the working tree** (e.g. this is a post-PR review
  sweep and `open-pr` already cleared `specs/` to history), recover it from the **specs
  snapshot in git history** — see [Locating a cleared PRD/spec](#locating-a-cleared-prdspec-git-snapshot-fallback).
- **Tech spec**: read `specs/spec-<epic-slug>.md` — the source of the epic's architecture,
  data model, APIs, events, and service layer. Same git-snapshot fallback as the PRD when it
  is not in the working tree.
- **Shipped code**: the actual implementation in the repository is the **primary source of
  truth**. The PRD/spec describe intent; the code is what really shipped — cross-check them.
- **Existing docs**: everything already under `docs/` (any `docs/domain-*.md` and the index
  `docs/domain-index.md`) **and** every `docs/guidelines/*.md` reference/guideline doc. Discover the
  layout at runtime — do not hardcode filenames; a repo may have some, all, none, or extra.
- **Custodian agents** (if defined): a repo may define an agent that owns a given reference
  doc (e.g. `architecture-advisor` for an architecture reference, `codestyle-advisor` for
  the coding guidelines). Route that doc's update through its custodian agent when present.

## Output

- **A domain doc** at `docs/domain-<domain-slug>.md` — updated in place if the epic belongs
  to an existing domain, or newly created if the epic introduces a new domain.
- **The domain index** at `docs/domain-index.md` — a row added or refreshed for the domain
  doc above.
- **Any affected `docs/guidelines/*.md` reference/guideline docs** — updated for new patterns /
  conventions / rules the epic introduced (via custodian agents when defined).
- **A `docs:` commit** carrying the changes you made directly (custodian agents may commit
  the files they own separately).

> **Domain slug vs epic slug.** A domain doc is named for the **domain**, not the epic. Many
> epics can enrich the **same** domain doc. Prefer mapping the epic into an existing
> `docs/domain-*.md` whose subject it extends; only create a new `docs/domain-<slug>.md` when
> the epic genuinely introduces a **new** domain. When creating a new one, default its slug to
> the epic slug unless an obviously broader domain name fits better.

## Locating a cleared PRD/spec (git-snapshot fallback)

The primary Reconciliation phase runs **before** `finish-local` / `open-pr` snapshots and
clears `specs/`, so the PRD/spec are normally right there in the working tree. But when this
skill is invoked **after** that — most importantly the `address-pr-review` **end-of-loop docs
sweep** — a **specs snapshot** has already been committed and `specs/` removed from the
tree. Do **not** hard-fail in that case; recover the content from history:

1. **Find the snapshot commit SHA**, in this order:
   - the **PRD/spec permalink** in the open PR's body, if a PR exists (it points at the snapshot SHA);
   - else `git log --all --pretty=%H -1 -- specs/prd-<epic-slug>.md` — the last commit that
     still contained the file.
2. **Read the files from that commit without checking them out**:
   `git show <sha>:specs/prd-<epic-slug>.md` and `git show <sha>:specs/spec-<epic-slug>.md`.
   Do **not** restore them into the tree — you only need their content, and the PR's tree must
   stay clear of `specs/`.
3. If even history has no PRD/spec (a repo that never used the SDD spec flow), **degrade to
   code-only reconciliation**: the shipped code is the primary source of truth anyway (plus
   the existing docs and, in a review sweep, the review comments/diff). Note in your report
   that the PRD/spec were unavailable.

## Pre-flight Checks

Before doing any reconciliation work:

1. **Obtain the PRD** for `<epic-slug>`.
   - Prefer `specs/prd-<epic-slug>.md` in the working tree.
   - If it is absent, recover it from the **specs snapshot in git history** (see
     [Locating a cleared PRD/spec](#locating-a-cleared-prdspec-git-snapshot-fallback)).
   - If it exists **nowhere** (tree *or* history), do not hard-stop while there is shipped
     code to document: **degrade to code-only reconciliation** and say so in the report. Only
     STOP when there is *also* no corresponding production code — then tell the user:
     > "No PRD found for `<epic-slug>` (working tree or git history) and no shipped code to
     > document. Cannot reconcile. Please run `brainstorm` (and the rest of the chain) first."

2. **Obtain the spec** at `specs/spec-<epic-slug>.md` — same tree-then-snapshot lookup. If it
   exists in neither, note it and continue using the PRD + shipped code. The spec adds
   technical detail (data model, APIs, events) but is not strictly required.

3. **Confirm the epic is implemented & verified.** This skill documents what actually
   shipped. If there is no corresponding production code, or `verify-epic` has not reported
   the ACs as PASS/DEFERRED, warn the user:
   > "⚠️ `<epic name>` does not appear implemented/verified yet. Docs reconciliation runs
   > **after** verify-epic. Proceeding will document intent, not shipped behavior."
   Ask whether to continue.

## Reconciliation Workflow

Follow this workflow in order.

### Phase 1 — Gather the knowledge

1. Extract from the **PRD**: the problem statement, the domain this epic belongs to, its
   features, key user-facing behaviors, and acceptance criteria.
2. Extract from the **spec** (if present): the entities/data model, API endpoints, events
   published/consumed, service-layer responsibilities, and integration points.
3. Cross-check both against the **shipped code** (discover the repo's source layout at
   runtime — do not assume folder names). The code is authoritative: document what the code
   actually does, correcting any drift from the PRD/spec.

### Phase 2 — Locate the target domain doc

1. Enumerate existing domain docs: list `docs/domain-*.md` and read `docs/domain-index.md`
   if they exist. (The `docs/` folder may not exist yet — that's expected on the first run;
   you will create it.)
2. Decide **update vs create**:
   - **Update** an existing `docs/domain-<slug>.md` when this epic extends a domain that is
     already documented (new/changed behavior within that subject area).
   - **Create** a new `docs/domain-<domain-slug>.md` when the epic introduces a domain not
     yet covered by any existing domain doc.
3. If the decision is genuinely ambiguous (the epic could belong to more than one existing
   domain, or it's unclear whether it warrants a new doc), **ask the user** which domain doc
   to target rather than guessing.

### Phase 3 — Write or update the domain doc

Use this structure for a domain doc (adapt to, and stay consistent with, the structure of
any domain docs the repo already has — match their tone and headings):

```markdown
# Domain: <Domain Name>

> **Last updated:** <date>
> **Related epics:** <Epic Name> (`<epic-slug>`)[, previous epics …]

## 1. Overview
<!-- What this domain is responsible for, in durable terms (not tied to one epic). -->

## 2. Key Concepts & Entities
<!-- The core domain entities/aggregates and what they mean. Data model essentials. -->

## 3. Workflows & Behaviors
<!-- The main flows/business rules the domain implements. -->

## 4. Interfaces
<!-- APIs/endpoints, events published & consumed, integration points. -->

## 5. Business Rules & Constraints
<!-- Invariants, validation rules, edge cases that must always hold. -->

## 6. Related Documentation
<!-- Links to related domain docs and any docs/guidelines reference docs. -->

## 7. Change Log
<!-- Append one dated row per epic that touches this domain. -->
| Date | Epic | Change |
|------|------|--------|
| <date> | <Epic Name> (`<epic-slug>`) | <what this epic added/changed> |
```

Rules for writing:

- **Write durable, epic-agnostic prose.** Describe the domain's steady-state behavior, not
  "this epic did X". The per-epic framing belongs only in **Related epics** and the
  **Change Log** row.
- **Never write ticket/issue IDs into the doc body.** Long-lived docs describe *current
  state*, not *the change that produced it* — a `PROJ-1234`, issue-tracker key, GitHub issue/PR
  number, or "as of ticket X" reference does not belong in the prose, headings, section
  titles, **or the Change Log row** (which identifies the change by epic name and slug, not
  by ticket). Ticket traceability lives in the *ephemeral/change* layers only — the
  branch name, commit messages (Phase 6), and the PR — never in the durable doc. If the
  PRD/spec/code you read mentions a ticket, describe the resulting behavior generically and
  drop the identifier.
- **When updating**, merge — do not rewrite. Add/adjust only the sections the epic actually
  changed, append a **Change Log** row, refresh **Last updated** and **Related epics**, and
  leave everything else intact.
- **Consolidate; never leave a rule the doc already states another way.** Merging is not just
  appending — before adding a business rule, acceptance criterion, or behavior, check whether
  an existing one already covers it, and reconcile the overlap instead of stacking a duplicate:
  - If the epic **generalizes** an existing specific rule (e.g. a new "any status other than
    `InProcess` is refused" rule now subsumes an older standalone "`Cancelled` is refused"
    criterion), replace the specific one with the general rule. If the specific case is worth
    keeping discoverable (someone will search the doc for "cancelled"), **fold it into the
    general rule as an explicit callout** — *"any status other than `InProcess` — `Cancelled`
    included — …"* — rather than keeping it as a separate criterion.
  - If the epic adds a **specific** case already implied by an existing general rule, don't add
    a new criterion; extend the general rule's callout only if the case is non-obvious.
  - Two criteria that describe the **same underlying rule** are the drift this skill exists to
    prevent — they diverge the next time only one gets updated. When you remove or fold a
    criterion, renumber the remaining ones so references stay contiguous.
  The Change Log records the history, so nothing is lost by removing a now-redundant criterion —
  never keep one "for historical reasons" in the durable body.
- **When creating**, fill every section from the PRD/spec/code; keep it concise but complete.
- **Skip sections that don't apply** (e.g. no events) rather than padding them.

### Phase 4 — Update the domain index

Maintain `docs/domain-index.md` as the catalog of all domain docs. If it does not exist,
create it with this structure:

```markdown
# Domain Documentation Index

> The durable domain documentation for this repository. Each row links a domain doc.
> Updated by the `reconcile-docs` skill as epics ship.

| Domain | Doc | Summary | Last updated |
|--------|-----|---------|--------------|
| <Domain Name> | [domain-<slug>](domain-<slug>.md) | <one-line summary> | <date> |
```

- **Add a row** when you created a new domain doc.
- **Refresh the existing row** (summary + last-updated) when you updated one.
- Keep rows sorted alphabetically by Domain unless the file already uses another order.

### Phase 5 — Reconcile the reference/guideline docs (`docs/guidelines/*.md`)

The `docs/` domain docs capture *what the domain does*; the `docs/guidelines/*.md` reference docs
capture *how we build* — patterns, conventions, and cross-cutting rules. An epic that
introduces a **new pattern** (e.g. a new handler/repository/integration approach), a
**new/changed convention** (naming, error handling, validation), or a **new UX/security/
testing rule** must fold that into the matching reference doc too.

1. **Enumerate** every `docs/guidelines/*.md` present (e.g. `architecture-reference.md`,
   `coding-guidelines.md`, `security-*.md`, `testing-*.md`, …). Do **not** assume any
   particular file exists — a repo may have some, all, none, or additional ones.
2. **For each, decide if this epic changed anything that belongs in it** — new pattern →
   architecture; new convention → coding; new UX/security/testing rule → the matching
   guideline doc. Use the **shipped code as the source of truth**, cross-checked against the
   PRD/spec. Most epics touch few or none of these — that's expected.
3. **Update each affected doc, preferring its custodian agent when the repo defines one:**
   - If a **custodian agent** owns the doc (e.g. `architecture-advisor` /
     `codestyle-advisor`), **route the update through that agent** so it is captured per the
     agent's own rules — and let the agent commit its own file (don't double-commit it).
   - Otherwise **edit the file directly**, following its existing structure, tone, and
     section conventions.
4. **Skip docs that need no change** — reconciliation is additive/corrective, not a rewrite.
   If the repo has no `docs/guidelines/*.md` docs, note that and move on.
5. **Write epic-agnostic prose here too — no ticket/epic identifiers in the doc body.**
   Just like the domain docs (Phase 3), `docs/guidelines/*.md` reference docs describe durable,
   steady-state rules and architecture, not "what epic N changed". Never write a section
   header, note/callout, or explanatory sentence that embeds a ticket ID (e.g. `**Note
   (PROJ-123):**`, `see PROJ-123 below`) — describe the rule or correction in plain
   descriptive language instead (`**Note:**`, `see the <section name> below`). If you want
   to record *when/why* something changed for future maintainers, that belongs in the
   commit message/PR, not the doc's prose — these reference docs have no per-epic
   "Change Log" section the way domain docs do, so there is no durable place for a ticket
   ID to live in them at all.

### Phase 6 — Commit

Stage the docs you edited directly (`docs/` and any `docs/guidelines/*.md` you did not route to a
custodian agent) and commit as a single documentation commit (TDD-exempt — docs only).
Derive `<ticket-id>` from the current branch name (e.g. `PROJ-123`); omit the prefix if the
branch carries no ticket id.

```
<ticket-id>: docs: reconcile long-lived docs for <Epic Name>

Fold <Epic Name> outcomes into the durable documentation:
<created|updated> docs/domain-<slug>.md, refreshed docs/domain-index.md[, updated
<docs/guidelines docs>]. Keeps the durable docs aligned with the shipped code.

Co-Authored-By: Claude <noreply@anthropic.com>
```

- Commit **only** documentation changes (under `docs/` and `docs/guidelines/*.md`). Do not touch
  source, tests, or specs.
- **Custodian agents commit the files they own** — avoid double-committing those.
- If nothing needed changing (docs already current — e.g. this same run already reconciled
  them via `implement-epic` Phase 6), make **no commit** and say so in the report.

### Phase 7 — Report

Produce a short summary:

```
══════════════════════════════════════════════════
  Docs Reconciliation Report: <Epic Name>
══════════════════════════════════════════════════

Domain doc:   <created|updated|unchanged> docs/domain-<slug>.md
Index:        <row added|row refreshed|unchanged> docs/domain-index.md
Reference:    <which docs/guidelines/*.md updated (+custodian agent) | none needed>
Commit:       <sha + subject | "none — docs already current">

Summary:      <one or two lines on what durable knowledge was folded in>
══════════════════════════════════════════════════
```

## Where this fits in the SDD workflow

This skill is the **last per-epic step** of the delivery chain, run **after
`verify-epic`** and **before `finish-local` / `open-pr`**: after `implement-epic` / the
optional `verify-epic` re-check reports the epic PASS, run `/reconcile-docs "<Epic Name>"`.
Because it runs before the specs snapshot clears `specs/`, the reconciled docs land in the
delivery's diff.

### Next step

- **More epics in the roadmap:** continue with `/brainstorm` for the next epic.
- **All epics done, local project:** run `/finish-local` (snapshots `specs/`, clears them,
  resets `briefing.md`, merges the delivery branch locally).
- **All epics done, GitHub remote exists:** run `/open-pr` (same snapshot/cleanup, then
  pushes and opens the delivery PR).

## Important Rules

- **Docs-only skill.** Never modify source code, tests, PRDs, or specs. You **read** the
  PRD/spec/code and **write** only under `docs/` and `docs/guidelines/*.md`.
- **Code is the source of truth.** Document what actually shipped. Where the PRD/spec and
  the code disagree, follow the code and note the correction in the affected doc.
- **Durable, not per-epic.** Docs describe steady-state behavior/conventions. Keep per-epic
  attribution to the *Related epics* line and the *Change Log* row.
- **Ticket-agnostic doc content, everywhere.** Never write ticket/issue IDs (`PROJ-1234`,
  issue-tracker keys, issue/PR numbers) into any long-lived doc — `docs/domain-*.md` **or**
  `docs/guidelines/*.md` — in section headers, note/callout labels, or explanatory sentences.
  Describe *what* changed and *why* in plain language, so a future reader never has to chase
  a ticket. The only identifiers a durable doc carries are the **epic name and slug** on the
  domain doc's *Related epics* line and its *Change Log* row — not ticket numbers. Keep
  ticket traceability in the commit message and PR only; `docs/guidelines/*.md` docs have no
  per-epic Change Log at all, so there is no durable place for a ticket ID to live in them
  either.
- **Idempotent & additive.** Re-running must be safe: merge into existing docs, don't
  rewrite; make no commit when nothing changed.
- **No redundant or subsumed rules.** Never leave two rules/criteria describing one behavior.
  When an epic generalizes an existing specific rule, replace (or fold) the specific one into
  the general rule rather than keeping both; the Change Log — not a duplicate criterion — holds
  the history. See Phase 3's consolidation rule.
- **One domain per doc, many epics per domain.** Prefer enriching an existing
  `docs/domain-*.md` over spawning near-duplicate domain docs.
- **Always keep the index in sync** with the domain docs you create or update.
- **Prefer custodian agents for the docs they own.** Route `docs/guidelines/*.md` updates through
  the repo's custodian agent (e.g. `architecture-advisor` / `codestyle-advisor`) when one is
  defined, and let it commit its own file; edit in place only when there is none.
- **Match existing conventions.** If the repo already has these docs, mirror their
  structure, headings, and tone instead of imposing this template verbatim.
