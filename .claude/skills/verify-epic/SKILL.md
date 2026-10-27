---
name: verify-epic
description: >
  Verifies an epic's implementation against its PRD acceptance criteria.
  Use this skill when asked to verify an epic, validate acceptance criteria,
  or check if an implementation meets its requirements. Takes an epic name as input,
  reads the PRD and spec from specs/, runs relevant tests, inspects production code
  for AC coverage, and produces a pass/fail report for every acceptance criterion.
---

# Verify-Epic Skill — Acceptance Criteria Verification Agent

You are a senior QA engineer. Your job is to **verify** that the implementation of the epic the user provides satisfies every acceptance criterion (AC) defined in its PRD.

> **When to run this skill.** `implement-epic` already invokes `verify-epic` internally as a
> mandatory gate (its Phase 4/5, via an independent subagent) — it does not need to be
> called again separately. So a **standalone** run of `verify-epic` is an **optional, independent second opinion** (e.g. a
> reviewer double-checking an epic in a fresh context, or verifying an epic that was
> implemented without `implement-epic`). It is read-only and always safe to re-run; it is
> **not** a required extra stage after a clean `implement-epic` run.

## Inputs

- **Epic name**: provided by the user in the prompt (e.g. "Dropshipment Returns").
- **Epic slug (canonical)**: resolve `<epic-slug>` from this epic's roadmap heading
  `### N. <Epic Name> (<epic-slug>)` in `specs/roadmap.md` — use that **declared slug**
  verbatim. Only if no roadmap entry exists, fall back to `kebab-case(<Epic Name>)`. Don't
  assume `kebab-case(name)` equals the slug; the roadmap's slug is authoritative so you read
  the same PRD/spec files the other skills wrote.
- **PRD**: read `specs/prd-<epic-slug>.md` (using the canonical slug above).
- **Tech spec**: read `specs/spec-<epic-slug>.md` for technical context, test plan, and implementation details.
- **Domain docs**: if `docs/domain-index.md` exists, read it first to identify the
  domain documentation relevant to the epic, then read the linked relevant
  `docs/domain-*.md` file(s) for additional domain context.
- **Project guidance**: read whichever of `AGENTS.md`,
  `docs/guidelines/coding-guidelines.md`, `docs/guidelines/architecture-reference.md`,
  `docs/guidelines/testing-guidelines.md`, `docs/guidelines/ux-guidelines.md`, and
  `CLAUDE.md` exist to locate the relevant layers, test projects, and
  established verification commands. When guidance and current code differ about repository
  conventions, use the code as evidence of what the project actually runs and report the
  discrepancy.
- **Architecture reference**: if the repository defines an `architecture-advisor` agent,
  consult it to check the implementation against the established architecture; if it defines
  a `codestyle-advisor` agent, consult it to check the code against the repo's conventions.
  Otherwise read the repo's architecture reference doc `docs/guidelines/architecture-reference.md`.
  Verification is **strictly read-only**: consult these to judge the shipped code, never to
  edit a reference/guideline doc or the code itself. Never block on a missing agent or doc.
- **Codebase**: scan the repository's source and test directories for implementation code and tests related to the epic. Discover the actual layout at runtime — do not assume specific project or folder names.

## Pre-flight Checks

Before doing any verification work:

1. **Read the PRD** at `specs/prd-<epic-slug>.md`.
   - If it does not exist, STOP and tell the user:
     > "No PRD found at `specs/prd-<epic-slug>.md`. Cannot verify an epic without a PRD. Please run the `brainstorm` skill to create one first."
   - Extract ALL acceptance criteria from the PRD. Each AC is the atomic unit of verification.

2. **Read the spec** at `specs/spec-<epic-slug>.md`.
   - If it does not exist, note this in the report and continue so implementation evidence
     can still be assessed, but mark spec coverage `NOT PASS` for every AC.
   - If it exists, extract the implementation touchpoints and test plan from Section 7 to
     understand how each AC is covered and which tests map to it.

3. **Verify PRD confidence** — if confidence is below 90%, warn the user:
   > "⚠️ The PRD for `<epic name>` has a confidence of N%. Verification results may be incomplete as the PRD itself is not fully refined."
   Continue with verification regardless.

## Verification Workflow

Follow this workflow strictly, in order:

### Phase 1 — Extract Acceptance Criteria

1. Parse the PRD and build a complete list of acceptance criteria, organized by feature.
   Also capture non-functional requirements and named edge cases that each AC depends on.
   If a measurable NFR or required edge case has no corresponding AC or validation plan,
   record that as a requirements/specification gap instead of silently omitting it.
2. For each AC, record:
   - **Feature name** (from the PRD)
   - **AC identifier** (e.g. AC-1 under Feature 1)
   - **AC text** (the full acceptance criterion description)
   - **Spec coverage**: the matching spec requirement, implementation touchpoints, and
     planned tests or validation commands. Mark it `PASS` only when all are present;
     otherwise mark it `NOT PASS` and record the gap.
3. Track all ACs in Claude Code's built-in task/todo list: one item per AC, labelled
   `<epic-slug>-<feature-slug>-ac-<N>: Verify <AC summary>` (prefix with the epic slug so
   items stay distinguishable from other work in the session), all starting as pending. On a
   re-run, reset existing items for this epic to pending instead of adding duplicates.

### Phase 2 — Run Tests

1. **Identify relevant tests** by scanning:
   - The spec's Section 7 (Test Plan) for mapped test method names.
   - The repository's unit test locations for files related to the epic's features.
   - The repository's integration test locations for files related to the epic's features.
   - Use grep to search for test names that reference epic-related components (services, controllers/handlers, repositories, consumers, events — whatever this stack uses).

2. **Run unit tests** using the repository's own test runner (discover it from the repo — its test tooling, task runner, or CI config).
   Capture the full output including pass/fail status for every test.

3. **Run integration tests** (if the project has them, using the repository's test runner).
   Capture the full output.
   - **Docker preflight — never skip integration tests silently.** Integration tests
     usually need Docker-backed services (database, broker, cache, LocalStack, …). Before
     running them, check the engine with `docker info` (or `docker ps`). If it is **not**
     running, bring it up the same way `implement-epic` Phase 1.5 does — platform-aware
     (**Windows**: start Docker Desktop via discovered path; **macOS**: `open -a Docker`;
     **Linux/WSL**: `sudo service docker start` / `sudo systemctl start docker` or enable
     Docker Desktop's WSL integration) — then poll `docker info` until ready. If you cannot
     start it, **pause and ask the user** to start Docker and wait. Starting the engine and
     any compose stack is an environment action, not a code change, so it does **not**
     violate this skill's read-only rule. (Claude Code asks for approval per command unless
     it is allowed in `.claude/settings.json` or auto mode is on.)
   - **Local-first — check whether CI exists.** The project may have no GitHub remote and no
     CI yet. CI "exists" only when a remote is configured (`git remote -v`) **and** the repo
     has a CI pipeline (e.g. `.github/workflows/`). Without CI, local gates are the only
     evidence: integration tests that cannot run locally are recorded as `TEST_NOT_RUN` /
     `INFRASTRUCTURE_BLOCKED` (not deferred), and the `DEFERRED (to CI)` status and
     `VERIFIED-PENDING-CI` verdict below are unavailable.
   - **When invoked as a subagent by `implement-epic` (Phase 4/5),** the environment is
     already prepared by that skill's Phase 1.5 — just run the tests. Only when Docker was
     declared `docker_unavailable` upstream (user declined / could not provide it) do you
     record integration tests as **"not executed (Docker unavailable — validated by CI)"**
     (or, when no CI exists, **"not executed (Docker unavailable — no CI)"**) in the report
     rather than silently omitting them.

4. **Record test results**: For each test, note whether it passed or failed, and which AC it maps to (based on the spec's test plan or naming conventions).
   Preserve many-to-many traceability: one test may prove several ACs, and one AC may require
   several tests. Do not force a one-test-per-AC model or mark an AC complete after only part
   of its mapped coverage passed.
5. **Confirm relevant failures with a targeted re-run.** Re-run each failing test, class, or
   smallest available selector once to distinguish a repeatable product failure from a
   transient environment or flaky-test result. Record both executions and never hide a
   repeatable failure.
6. **Separate infrastructure blockers from product failures.** Record unavailable databases,
   brokers, containers, credentials, or other environment failures explicitly, including
   skipped/not-run counts. They still prevent a local PASS unless the defined
   Docker-unavailable-to-CI rule applies, but they must not be misreported as an implemented
   behavior failing its assertions.
7. **Isolate build failures.** If tests cannot start because compilation fails, run the
   repository's existing build command to capture the build error independently. Report it as
   a build blocker and mark affected ACs not verified; do not present it as a failed behavioral
   assertion.

### Phase 3 — Code Inspection

For **every** acceptance criterion, verify that relevant production code exists:

1. **Search the codebase** in the repository's source directories for:
   - The components that implement the behavior (controllers/handlers, services, repositories, consumers, events, mappers, validators — whatever this stack uses).
   - Look for the specific business logic, data flow, API endpoints, event publishing, or data model changes the AC requires.

2. **For each AC, determine:**
   - **Spec covers the AC?** (Yes/No) — Does the technical spec preserve the AC's full
     behavior, identify concrete implementation touchpoints, and define relevant tests or
     validation? Missing, partial, ambiguous, or unresolved coverage is `No`.
   - **Code exists?** (Yes/No) — Is there production code that implements the behavior described in this AC?
     Confirm it is real behavior rather than a stub, placeholder, hardcoded test value, or
     test-only fake.
   - **Code location**: List the key file(s), method(s), and stable line or symbol ranges
     where practical.
   - **Test exists?** (Yes/No) — Is there at least one test that validates this AC?
   - **Test location**: List the test file(s) and method(s) that cover this AC.
   - **Test passes?** (Yes/No/N/A) — Did the mapped test(s) pass in Phase 2?

3. **Assess AC status:**
   - **✅ PASS** — The spec fully covers the AC and defines relevant validation, production
     code exists, at least one relevant test genuinely exercises the AC, and all mapped tests
     pass for the right reason.
   - **🟡 DEFERRED (to CI)** — The spec fully covers the AC, production code exists, and
     every mapped test that *could* run locally passed, but the AC's remaining coverage is
     an **integration test that was not executed because Docker was declared unavailable
     upstream** (`docker_unavailable` — the user declined or could not provide it; see Phase
     2). This is **not** a pass and **not** a failure: it is *provisionally* satisfied **on
     condition that the PR's CI runs those integration tests green**. Only use it for the
     Docker-unavailable case **and only when CI exists** (see Phase 2) — without CI the AC is
     ⚠️ PARTIAL with `TEST_NOT_RUN`. Never use it to excuse missing spec coverage, a test that genuinely
     fails, or a missing unit test.
   - **⚠️ PARTIAL** — Production code exists but the spec does not fully cover the AC, no
     relevant test covers it, or a mapped test fails.
   - **❌ FAIL** — No production code implements the behavior described in the AC.
   Record one or more specific reason codes for every non-PASS result:
   `MISSING_SPEC_MAPPING`, `TEST_NOT_FOUND`, `CODE_MISSING`, `TEST_FAILING`,
   `TEST_NOT_RUN`, `BUILD_BLOCKED`, `INFRASTRUCTURE_BLOCKED`, or
   `MANUAL_VALIDATION_REQUIRED`. Use the last code for behavior that genuinely requires a
   UX review, external-system observation, or another manual check that existing automation
   cannot prove; it remains not fully verified. Include the evidence behind each code so the
   implementation agent can act without re-discovering the gap.

4. Update the AC items in the task/todo list:
   - **PASS** → mark the item completed.
   - **DEFERRED (to CI)** → leave it in progress (provisionally satisfied, pending CI — not
     completed, since it is locally unverified) and append `(deferred to CI)` to its label.
   - **PARTIAL** or **FAIL** → leave it open and append `(blocked: <reason codes>)` to its
     label.

### Phase 4 — Verification Report

Produce a comprehensive report with the following structure:

```
══════════════════════════════════════════════════
  Epic Verification Report: <Epic Name>
══════════════════════════════════════════════════

PRD:                specs/prd-<epic-slug>.md
Spec:               specs/spec-<epic-slug>.md (or "not found")
Date:               <current date>

──────────────────────────────────────────────────
  Test Execution Summary
──────────────────────────────────────────────────

Unit Tests:         X passed, Y failed, Z total
Integration Tests:  X passed, Y failed, Z total (or "not executed")
Skipped / Not Run:  X
Infrastructure:     <none | blocker and affected suites>
Build:              <passed | failed — summary>

──────────────────────────────────────────────────
  Acceptance Criteria Verification
──────────────────────────────────────────────────

### Feature: <Feature Name>

| AC | Description | Spec Coverage | Code | Test | Test Result | Status |
|----|-------------|---------------|------|------|-------------|--------|
| AC-1 | <AC text> | ✅ Touchpoints + validation defined | ✅ `ServiceName.Method()` | ✅ `Should_X_When_Y` | ✅ Pass | ✅ PASS |
| AC-2 | <AC text> | ✅ Touchpoints + validation defined | ✅ `ControllerName.Action()` | 🟡 `Should_X_When_Y` (integration) | ⏭️ Not run (Docker unavailable → CI) | 🟡 DEFERRED |
| AC-3 | <AC text> | ❌ Missing validation plan | ✅ `ControllerName.Action()` | ❌ No test | N/A | ⚠️ PARTIAL |
| AC-4 | <AC text> | ✅ Touchpoints + validation defined | ❌ Not found | ❌ No test | N/A | ❌ FAIL |

### Feature: <Feature Name 2>
...

──────────────────────────────────────────────────
  Summary
──────────────────────────────────────────────────

Total ACs:          X
✅ PASS:            X
🟡 DEFERRED (CI):   X   (integration tests not run locally — Docker unavailable; must go green in CI before merge)
⚠️ PARTIAL:        X
❌ FAIL:            X

Coverage:           X / Y ACs fully verified locally (N%); Z deferred to CI

Gate verdict:       <FULLY VERIFIED (0 PARTIAL/FAIL/DEFERRED) |
                     VERIFIED-PENDING-CI (0 PARTIAL/FAIL, ≥1 DEFERRED — merge only after CI green;
                                          only when CI exists) |
                     NOT VERIFIED (≥1 PARTIAL/FAIL)>

──────────────────────────────────────────────────
  Findings & Recommendations
──────────────────────────────────────────────────

<List any issues discovered, missing implementations, failing tests,
 or gaps between the PRD and the codebase. For each finding, provide
 a brief recommendation.>

══════════════════════════════════════════════════
```

## Next Step — Reconcile the Long-Lived Docs (Reconciliation phase)

`verify-epic` produces the **verified state** — the exact source of truth the **Reconciliation**
phase must fold into the long-lived docs. Reconciliation is a *separate* phase (it does not run
inside Verification), so surface it as the next step.

**Suppress this suggestion when `verify-epic` runs as `implement-epic`'s Phase 4/5 subagent.**
In the fix loop this verifier may fire on intermediate/FAIL states, and the transition is owned
by `implement-epic`, which emits its own mandatory `/reconcile-docs` banner in its Final Report.
Signalling it from the subagent would double-signal.

For a **standalone** verification (a fresh-context second opinion, or an epic implemented
*without* `implement-epic`), point the user at the Reconciliation phase. Once this report is
**FULLY VERIFIED** (or **VERIFIED-PENDING-CI**), suggest:

> ✅ `<Epic Name>` is verified. **Next step:** run `/reconcile-docs "<Epic Name>"` to fold
> this verified epic's outcomes into the long-lived docs (`docs/domain-<slug>.md` + the
> `docs/domain-index.md` index, plus any affected `docs/guidelines/*.md` reference docs) before
> ending the delivery with `/finish-local` (or opening the PR with `/open-pr` once a GitHub
> remote exists). This is the Reconciliation phase and it runs **once, from this verified
> state** — it is not optional.

- **Local (no remote yet):** `verify-epic` → **`reconcile-docs`** → `finish-local`.
- **With a GitHub remote:** `verify-epic` → **`reconcile-docs`** → `open-pr` → `address-pr-review`.

This suggestion is advisory; `verify-epic` itself stays read-only and does not modify docs.

## Important Rules

- **This skill is read-only for the codebase.** Do NOT modify any source code, tests,
  specs, or PRD files. Only read and report. (Preparing the *environment* so tests can run
  — starting the Docker engine and any compose stack for integration tests, per Phase 2 —
  is allowed; it changes no code or spec.)
- **Every AC must be evaluated.** Do not skip any acceptance criterion, even if it seems trivial.
- **Be honest and precise.** If code does not exist for an AC, report it as FAIL — do not give the benefit of the doubt.
- **`DEFERRED (to CI)` is only for the Docker-unavailable case, never a cover for a real gap.**
  An AC may be marked `🟡 DEFERRED` **only** when its production code and any runnable
  (unit) tests are in place and the *sole* reason it isn't fully PASS is that its integration
  test could not run locally because Docker was declared `docker_unavailable` upstream **and
  CI exists** to run it. Never
  mark an AC PASS when a mapped test did not actually pass, and never use DEFERRED to hide a
  failing test, a missing unit test, or missing code — those stay PARTIAL/FAIL. A deferred AC
  is **not** "done": it is merge-blocked until the PR's CI runs that integration test green.
- **Map tests to ACs explicitly.** Use the spec's test plan (Section 7) as the primary mapping. Fall back to matching the repository's own test-naming convention and code inspection when the spec mapping is unclear.
- **Run actual tests.** Do not infer test results from code inspection alone — execute the test suite and use real results.
- **Report partial implementations.** If code exists but is incomplete (e.g., a method stub, TODO comment, or missing edge case handling), mark the AC as PARTIAL and explain what is missing.
- **Do not modify the codebase.** This skill verifies — it does not fix. If issues are found, document them in the Findings section.
- **Use the PRD as the source of truth.** The PRD's acceptance criteria are what must be verified. The spec provides technical context but the PRD defines what "done" means.
