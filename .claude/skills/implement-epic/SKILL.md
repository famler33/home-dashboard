---
name: implement-epic
description: >
  Implements an epic from its technical specification using TDD.
  Use this skill when asked to implement an epic, build a feature from a spec,
  or code an epic. Takes an epic name as input, reads the corresponding spec
  from specs/, implements tests first (TDD), then functionality, verifies all
  acceptance criteria pass, and commits changes in small, atomic commits.
---

# Implement-Epic Skill — Spec-to-Code TDD Implementation Agent

You are a senior software engineer. Your job is to **implement** the epic the user provides by following its technical specification, using strict Test-Driven Development (TDD).

## Inputs

- **Epic name**: provided by the user in the prompt (e.g. "Dropshipment Returns").
- **Epic slug (canonical)**: use an explicit caller-supplied canonical slug verbatim when
  provided (notably during review-time re-entry after `roadmap.md` was cleared). Otherwise
  resolve `<epic-slug>` from this epic's roadmap heading
  `### N. <Epic Name> (<epic-slug>)` in `specs/roadmap.md` — use that **declared slug**
  verbatim for all file names. Only if no roadmap entry exists, fall back to
  `kebab-case(<Epic Name>)`. Don't assume `kebab-case(name)` equals the slug; the roadmap's
  slug is authoritative so the spec, PRD, and code all resolve the same files.
- **Tech spec**: read `specs/spec-<epic-slug>.md` (using the canonical slug above).
- **PRD**: read `specs/prd-<epic-slug>.md` for acceptance criteria and business context.
- **Domain docs**: if `docs/domain-*.md` files exist, read them for additional domain context.
- **Project guidance**: read whichever of `AGENTS.md`, `docs/domain-index.md`,
  `docs/guidelines/coding-guidelines.md`, `docs/guidelines/architecture-reference.md`,
  `docs/guidelines/ux-guidelines.md`, and `CLAUDE.md` exist. If guidance and
  current code disagree about an established convention, treat the code as evidence of the
  actual convention, but never use it to override an explicit approved spec decision.
- **Architecture reference**: if the repository defines an `architecture-advisor` agent,
  consult it when architecture decisions arise during implementation; otherwise read the
  repo's architecture reference doc `docs/guidelines/architecture-reference.md` and
  rely on the codebase's existing patterns. Never block on a missing agent or doc (see Phase 1 and Phase 2 below).
- **Codebase**: scan the repository's source and test directories to learn its structure, patterns, services, repositories, and test conventions. Discover the actual layout at runtime — do not assume specific project or folder names.

## Pre-flight Check: Spec Confidence Gate

> **Permissions (not a gate).** The TDD loop runs `git`, the build/test tooling, `docker`
> and file edits. Claude Code asks for approval per command unless those commands are
> allowed in `.claude/settings.json` (the kit ships one) or auto mode is on — proceed
> normally either way; never stop or block on this.

Before doing any work:

1. Read the spec file at `specs/spec-<epic-slug>.md`.
2. Read the PRD at `specs/prd-<epic-slug>.md` and check its **Confidence** value. Treat a
   missing confidence value as below 90%. If PRD confidence is below 90%, STOP and tell the
   user to refine it with `brainstorm` before implementation. This defense-in-depth check is
   required even though `write-spec` also gates on PRD confidence: the PRD may have changed
   after the spec was written.
3. Check the **Confidence** value in the spec header **and the `## Open Questions` section**.
   Treat a missing or unparseable confidence value as below 90%.
4. **If confidence is below 90%, OR the `## Open Questions` section still has any entry,
   STOP immediately** and tell the user:
   > "The spec for `<epic name>` has a confidence of N% and M unresolved open question(s).
   > The spec must reach ≥ 90% confidence **with no open questions** before implementation
   > can begin. Please run the `write-spec` skill to refine and reconcile the spec first."
5. Do NOT proceed with implementation unless the spec is **both** ≥ 90% confidence **and**
   has an empty `## Open Questions` section — a leftover question means a requirement is
   still undecided, even at high confidence.

## Branch Detection

Before making any commits:

1. Run `git branch --show-current` to get the current branch name.
2. **Base-branch safety gate (BLOCKING — check before writing any code or commits).** This
   skill commits directly onto the current branch, so it must **never** run on the
   base/integration branch or a detached HEAD — otherwise the epic's commits land on
   `develop`/`main` instead of a feature branch, and no later step can cleanly undo that
   (`finish-local`'s / `open-pr`'s own branch checks run too late, after the commits already exist).
   - **Detached HEAD** (`git branch --show-current` prints nothing) → STOP and ask the user
     to check out a feature branch first.
   - **On an integration branch** — detect it the same way the rest of the pipeline does:
     the current branch is `develop` / `staging` / `main` / `master`, or it matches the
     target of `origin/HEAD` (`git symbolic-ref --short refs/remotes/origin/HEAD` returns
     `origin/<branch>` — strip the `origin/` prefix before comparing to the current branch
     name) → **STOP** and tell the user:
     > "`implement-epic` commits onto the current branch, but you are on the base branch
     > `<branch>`. Create and check out a feature branch first (e.g.
     > `git checkout -b feature/<ticket-id>-<epic-slug>`), then re-run."
   - Only continue once you are on a non-base feature branch.
3. Derive `<ticket-id>` in the same order the rest of the pipeline uses — don't ask the
   user before checking the artifacts that likely already declare it: (1) the
   `**Ticket:**` line in `specs/roadmap.md`'s header, if that file exists, (2) the
   `Ticket:` line in `specs/briefing.md`, if that file exists (an **uncommented** line —
   a `# Ticket: PROJ-XXXX` placeholder does not count, see `create-roadmap`), (3) extract
   it from the current branch name (e.g. `PROJ-123` from `feature/PROJ-123-some-description`
   or `PROJ-123/some-description`).
4. Store the first match as `<ticket-id>` for use in all commit messages.
5. If none of the three sources yields a ticket id, ask the user for the ticket identifier
   to use in commit prefixes.

## Commit Hygiene — never sweep `specs/` into a code commit

Every commit this skill makes (`test:`, `feat:`, `refactor:`) must stage **only the
production and test files it just changed** — always `git add <the specific files>`, **never
`git add -A` / `git add .`**. Reason: the `specs/*.md` files (roadmap, PRD, spec) sit
**uncommitted** in the working tree while you implement (they are snapshotted later, by
`finish-local` — or `open-pr` once a GitHub remote exists), so a blanket `git add` would
fold them into a code commit and corrupt the intended snapshot/clear history. Leave
`specs/`, and anything outside the epic's code/test surface, untouched.

## Implementation Workflow

Follow this workflow strictly, in order:

### Phase 1 — Understand & Plan

1. **Read the spec** (`specs/spec-<epic-slug>.md`) completely.
2. **Read the PRD** (`specs/prd-<epic-slug>.md`) to understand business context and acceptance criteria.
3. **Read domain docs** (`docs/domain-*.md`) if they exist.
4. **Scan the codebase** (discover the actual paths and tooling at runtime — do not assume specific project names) for:
   - Existing production patterns (e.g. controllers, services, repositories, consumers, events, mappers, validators — whatever this stack uses).
   - Existing unit and integration test locations and conventions.
   - The data-access setup and any schema/migration mechanism the project uses.
   - Shared test helpers or fixtures.
5. **Establish a baseline before editing.** Run the smallest existing build and test
   commands that cover the affected area. Record pre-existing failures separately and do not
   fix them unless they are directly coupled to the epic. If a baseline failure prevents
   meaningful validation, report the blocker rather than attributing it to the new work.
6. **Consult the `architecture-advisor` agent if the repository defines one** — share the spec summary and planned approach; it will validate alignment with the architecture reference and flag any decisions that need attention before coding begins. **If no such agent exists, do not block** — read the repo's architecture reference doc (e.g. `docs/guidelines/architecture-reference.md`) if present and mirror the codebase's existing patterns instead.
7. **Build an implementation plan** from the spec's Section 9 (Implementation Plan) and Section 7 (Test Plan).
   - Order work by dependencies: data model → repositories → services → controllers/consumers/events → integration.
   - Each step must be a small, atomic, committable unit.
8. **Build a complete per-AC traceability checklist** without merging, skipping, or
   paraphrasing away distinct acceptance criteria. For every AC, record:
   - AC identifier and full text.
   - Required production-code touchpoints.
   - Required automated tests.
   - Required supporting changes such as configuration, migrations, contracts, fixtures,
     generated artifacts, CI, or documentation.
   - The validation command or test suite that proves the AC.
   - Current TDD status: `not-started`, `red`, `green`, `refactored`, or `verified`.
9. **Track progress** using Claude Code's built-in task/todo list. Add one item per implementation step with a clear description, and **prefix every item's label with the epic slug** (e.g. `<epic-slug>-step-<N>: …`) so items stay unambiguous when several epics are worked on in one session.

### Phase 1.5 — Integration-Test Environment (Docker) Preflight

Integration tests usually need live backing services (a database, message broker, cache,
LocalStack, etc.) that the repo spins up as **containers** — via **Testcontainers**, a
`docker-compose.yml` / `compose.yaml`, or a documented target such as `make test-integration`.
If those containers can't run, the integration suite is **silently skipped** and the only
validation left is the PR's CI check on GitHub Actions (a slow feedback loop). **Do not let
that happen inside the loop** — prepare the environment up front so integration tests
actually run locally.

1. **Discover the test categories.** Determine whether this repo separates **unit** from
   **integration** tests (and any other category — e2e, contract, …). Look at test
   project/folder names, framework markers/traits/tags (e.g. `[Trait("Category","Integration")]`,
   `@Tag("integration")`, pytest markers, `*IntegrationTests`), and the CI workflow's test
   jobs. Record the exact command to run **each** category separately — never assume a single
   `test` command covers integration tests.

2. **Detect whether integration tests need Docker.** Inspect the integration tests and repo
   for container usage: a `docker-compose*.y*ml` / `compose.y*ml`, Testcontainers/LocalStack
   usage, or a test/CI step that runs `docker`. If nothing containerized is needed, skip the
   rest of this preflight.

3. **Check the Docker daemon.** Run `docker info` (or `docker ps`). If it succeeds, Docker is
   ready — go to step 5.

4. **If the daemon is not running, start it — platform-aware — then poll until ready.**
   Detect the OS/host and act accordingly, re-running `docker info` in a short poll loop
   (e.g. every 5s, up to ~120s) until it succeeds:
   - **Windows** (this repo's default host): start Docker Desktop. Discover its path rather
     than hardcoding it — try, in order: `Start-Process "docker desktop"` (the app is
     registered), else the install path from `Get-Command 'Docker Desktop' -ErrorAction
     SilentlyContinue`, else the common locations `"$Env:ProgramFiles\Docker\Docker\Docker
     Desktop.exe"` / `"$Env:LOCALAPPDATA\Docker\Docker Desktop.exe"`. Use the first that
     exists. Wait for the engine to come up.
   - **macOS**: `open -a Docker`.
   - **Linux / Ubuntu / WSL**: try `sudo service docker start` or `sudo systemctl start docker`;
     under WSL, if no native daemon is installed, prefer enabling Docker Desktop's WSL
     integration (start Docker Desktop on the Windows side).
   - **If you cannot start it** (not installed, no permission, or it doesn't become ready
     within the timeout): **pause and ask the user** to start Docker themselves — tell them
     exactly what you need running — and **wait**. On resume, re-check `docker info` and
     continue. **Never skip integration tests silently.**

5. **Bring up the compose stack (only if the repo uses one).** Testcontainers manage their
   own container lifecycle, so no manual step is needed there. If instead the integration
   tests expect an already-running stack, start it **in advance**:
   `docker compose -f <file> up -d --wait` (discover the file at runtime), wait for health,
   run the tests, then tear it down with `docker compose -f <file> down -v` once the epic's
   integration run is complete. Reuse whatever helper/`make`/script target the repo already
   provides rather than hand-rolling commands.

6. **Record the outcome** so later phases (and the Final Report) know the environment state:
   - **`docker_ready`** → integration tests run in the loop as normal (Phase 2/3/4).
   - **`docker_unavailable`** (user declined or couldn't provide it) → **tell the user
     explicitly** that integration tests could **not** be run locally and will only be
     validated by the PR's CI check (GitHub Actions). Local gates then relax to
     **unit tests + build**, the **integration gate shifts to CI**, and this must be called
     out in the Final Report. Prefer resolving Docker over deferring — CI is the slow path.
   - **No CI to defer to (local-first project).** If there is no GitHub remote or the repo
     has no CI pipeline (e.g. no `.github/workflows/`), `docker_unavailable` cannot be
     deferred: `verify-epic` then marks the affected ACs ⚠️ PARTIAL (`TEST_NOT_RUN`), not
     🟡 DEFERRED, and the epic is not DONE. Tell the user and either get Docker running or
     record the user's explicit acceptance of the untested gap in the Final Report before
     `finish-local`.

### Phase 2 — TDD Implementation Loop

For each implementation step, follow this strict TDD cycle:

#### Step A: Write Tests First (Red)

1. Create or update test files following the spec's Section 7 (Test Plan).
2. Place **unit tests** and **integration tests** in the locations the repository already uses, mirroring the source structure.
3. Follow the repository's existing **test file naming** and **test method naming** conventions — match what the existing tests do rather than imposing a new scheme.
4. Reuse the project's existing test helpers/fixtures.
5. Use the stack's standard mocking/isolation approach for unit tests — no external dependencies.
6. Run the project's test command (discover it from the repo — its test tooling, task runner, or CI config) to confirm the new tests **fail** (Red phase).
7. **Commit the failing tests** with message:
   ```
   <ticket-id>: test: add tests for <concise context>

   Add unit/integration tests for <what is being tested>.
   Tests are written before implementation following TDD.
   These tests define the expected behavior per acceptance criteria.

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

#### Step B: Implement Functionality (Green)

1. Write the **minimum code** needed to make the tests pass.
2. **If an architecture decision arises** (new pattern, new integration, new convention, structural change) and the repository defines an `architecture-advisor` agent, **consult it** before proceeding — for **validation and guidance only**. It confirms the approach aligns with the architecture reference; it must **not** update `docs/guidelines/architecture-reference.md` here (that is a long-lived doc, reconciled once from the verified state by the separate Reconciliation phase). **Record the decision in your report** so `reconcile-docs` can persist it. **If no such agent exists, do not block** — check the architecture reference doc if present, mirror existing codebase patterns, and record any notable decision in your report.
3. Follow the existing codebase patterns and conventions — mirror what the project already does rather than introducing new ones. Match the repo's established approaches for things like data access/repositories, service abstractions, external-API adapters, messaging/consumers, event publishing, API versioning, and schema migrations. Never hand-edit generated migration files.
4. Run the project's test command to confirm the tests **pass** (Green phase).
5. If tests fail, fix the implementation (not the tests) until all pass.
6. **Commit the implementation** with message:
   ```
   <ticket-id>: feat: implement <concise context>

   Implement <what was built> to satisfy acceptance criteria.
   <Brief explanation of the approach and key decisions.>

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

#### Step C: Refactor (Refactor)

1. Review the code for clarity, duplication, and adherence to project conventions.
2. **If the repository defines a code-style custodian agent, consult it** for the code you
   added/changed — for **validation and guidance only**. It checks the code against the
   repo's coding guidelines. If a **new convention** is established or an existing one evolves
   during this work, it must **not** update the guideline doc here — that long-lived doc is
   reconciled once, from the verified state, by the separate Reconciliation phase
   (`reconcile-docs`). **Record the new/changed convention in your report** so `reconcile-docs`
   can fold it into the guideline doc.
3. Ensure code follows the repository's configured formatter/linter and style rules (e.g. `.editorconfig`, the language's standard linter, or whatever the repo defines) — match the existing code's formatting, naming, and idioms rather than imposing your own.
4. Run tests again to confirm refactoring didn't break anything.
5. If refactoring changes are significant, **commit** with message:
   ```
   <ticket-id>: refactor: clean up <concise context>

   Refactor <what was cleaned up> for clarity and consistency.
   No behavioral changes — all existing tests still pass.

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

### Phase 3 — Initial Verification

After all implementation steps are complete:

1. **Run the full unit test suite** using the repository's test runner.
2. **Run the integration test suite** using the repository's test runner (if the project
   has one). Ensure the **Docker environment from Phase 1.5 is up** first — if it is
   `docker_unavailable`, do not silently pass this step: note that integration tests are
   deferred to the PR's CI check and continue with unit tests + build.
3. **Build/compile the whole project** using the repository's build tooling to catch compilation errors.
   Compare warnings with the pre-edit baseline: do not introduce new warnings, and report
   unrelated pre-existing warnings separately rather than expanding scope to fix them.
4. Fix any compilation errors, new warnings, or test failures caused by the epic before
   proceeding.

### Phase 4 — Full Epic Verification (independent verify-epic subagent)

Run the **complete verify-epic process** as defined by the installed **`verify-epic` skill** (resolve it by name from wherever skills are installed — `.claude/skills/verify-epic/` (project) or `~/.claude/skills/verify-epic/` (user) — rather than assuming a fixed path). This is a mandatory gate — the epic is not done until verify-epic produces a positive report: **every AC either ✅ PASS, or 🟡 DEFERRED (to CI)** in the Docker-unavailable case (see Phase 1.5 / verify-epic), with **0 PARTIAL and 0 FAIL**.

**Delegate this to an independent verification subagent — do not verify your own work in your own context.** Verification must be done by a separate agent with a *fresh context* so it grades the implementation objectively (no "marking your own homework" bias):

1. Launch a separate subagent whose job is to run the **`verify-epic` skill** for this epic. `verify-epic` is **read-only**, so the subagent only inspects code and runs tests — it changes nothing.
2. Give it complete context in the prompt (it is stateless): the epic name/slug, the paths to `specs/prd-<epic-slug>.md` and `specs/spec-<epic-slug>.md`, the test project locations, **and the Phase 1.5 Docker/integration-test environment state** (whether Docker is ready and the exact command to run each test category). Instruct it to **ensure the Docker environment is up before running integration tests** (re-run the Phase 1.5 preflight if needed), execute all verify-epic phases (extract ACs → run unit + integration tests → code inspection → verification report), and **return the full report**. If Docker cannot be provided, it must report integration ACs as deferred-to-CI rather than silently passing them.
3. Consume the returned report — do **not** re-derive the AC statuses yourself. The subagent's PASS/DEFERRED/PARTIAL/FAIL verdicts are the authoritative gate.

### Phase 5 — Fix Loop (iterate until fully verified)

If the verify-epic report contains **any** ⚠️ PARTIAL or ❌ FAIL acceptance criteria, or any failing tests:

> **🟡 DEFERRED (to CI) is not a failure — do not loop on it.** An AC marked DEFERRED means
> its code and unit tests pass and the only thing outstanding is an integration test that
> couldn't run locally because Docker was declared `docker_unavailable` (Phase 1.5). There is
> nothing to fix — re-running the fix loop cannot turn it PASS locally. Treat DEFERRED ACs as
> **provisionally satisfied, pending CI**: exclude them from the fix loop, but carry them into
> the Final Report and mark the epic **DONE-pending-CI** (its integration tests must go green
> in the PR's CI before merge). Only PARTIAL/FAIL/failing-test items drive the loop below.
> (If Docker *can* be brought up, prefer resolving it and getting a real PASS over deferring.)

1. **Analyze each failure/partial** — Determine the root cause:
   - Missing production code → implement it.
   - Missing test → write the test first (TDD), then verify the implementation.
   - Failing test → fix the implementation (not the test, unless the test itself is buggy).
   - Incomplete implementation → complete it.

2. **Apply the TDD cycle** (Phase 2 steps A→B→C) for each fix:
   - Write/update tests first if needed, commit them.
   - Implement/fix the production code, commit it.
   - Refactor if needed, commit it.

3. **Re-run verification via a *fresh* verify-epic subagent** (Phase 4) after all fixes are applied — launch a new subagent each time so every re-verification starts from a clean, unbiased context rather than reusing the previous verifier.

4. **Repeat** this Fix Loop until the verify-epic report shows:
   - **Every AC is ✅ PASS, or 🟡 DEFERRED (to CI)** — 0 PARTIAL, 0 FAIL. DEFERRED is allowed
     **only** in the Docker-unavailable case and marks the epic DONE-pending-CI, not fully
     verified locally.
   - **All tests that ran pass** (0 failures; integration tests may be deferred to CI when
     Docker is unavailable).
   - **Build succeeds** with no errors.

⚠️ **Safety limit**: If the Fix Loop has iterated 5 times and issues remain, STOP and report the remaining issues to the user with a detailed summary of what was attempted and what still fails. Ask the user for guidance before continuing.

### Phase 6 — Final Report

Once verify-epic produces a positive report (every AC ✅ PASS, or 🟡 DEFERRED-to-CI when
Docker was unavailable; 0 PARTIAL/FAIL; all tests that ran green), produce the final summary:

```
✅ Implementation Complete: <Epic Name>
══════════════════════════════════════════════════

Spec:               specs/spec-<epic-slug>.md
PRD:                specs/prd-<epic-slug>.md

Acceptance Criteria Coverage:
  Total ACs:        X
  Covered by code:  X / X
  Covered by tests: X / X
  Tests passing:    X / X
  Deferred to CI:   X   (integration ACs not run locally — Docker unavailable; must go green in CI before merge)

Files Changed:
  Production code:  N files
  Test code:        N files
  Migrations:       N files

Commits Made:       N

Verification:       <✅ All acceptance criteria verified via verify-epic |
                     🟡 Verified pending CI — X AC(s) DEFERRED (integration tests run in the PR's CI, not locally)>
Fix Loop Iterations: N (0 = passed on first verification)
Integration tests:  <ran locally via Docker | deferred to PR CI — Docker unavailable | n/a — no integration suite>
Docs:               ⏳ Pending mandatory Reconciliation phase (`/reconcile-docs`, runs next from
                    this verified state) — pre-scan: <architecture/convention decisions recorded
                    during implementation for that phase to persist (new pattern/integration/
                    convention, or an evolved coding/architecture guideline/reference) — or "none">

<All acceptance criteria are implemented, tested, and verified. |
 All acceptance criteria are implemented; X integration AC(s) are DEFERRED to the PR's CI —
 the epic is DONE-pending-CI and must not be merged until those checks pass.>
```

**Next step (running the chain by hand).** `implement-epic` completes the **Implementation**
phase (working code + tests, verified in-loop). It deliberately does **not** reconcile the
long-lived docs — that is a separate **Reconciliation** phase that must run once, from the
settled verified state, not from inside Implementation. It also does **not** finish the
delivery — that lives in the `finish-local` skill (or `open-pr` once a GitHub remote exists).

> ⚠️ **Docs are not reconciled yet — this run is not shippable on its own.** Before `/finish-local` (or `/open-pr`),
> the epic's knowledge must be folded into the durable docs from the verified state:
>
> **Next step:** run **`/reconcile-docs "<Epic Name>"`** to update `docs/domain-<slug>.md` +
> the `docs/domain-index.md` index and any affected `docs/guidelines/*.md` reference docs. Skipping it
> ships code with drifted docs.

The chain is run one skill at a time, by hand. After this report:

1. **Run `/reconcile-docs "<Epic Name>"` (required)** — the Reconciliation phase. It folds
   this epic's outcomes into the long-lived docs from the verified state and commits them onto
   the working branch so they ride along with the delivery. It is idempotent.
2. Finish the delivery:
   - **Local-first (no GitHub remote yet):** run `/finish-local` — it snapshots `specs/` into
     a commit, clears them from the tree, and merges the branch locally into the base branch.
   - **Once a GitHub remote exists:** run `/open-pr` instead — it snapshots `specs/` into git
     history, clears them from the tree, resets `briefing.md`, pushes, and opens one PR. You
     do not need to run raw `git push` / `gh pr create` yourself. Then run
     `/address-pr-review` to handle reviewer feedback on the open PR.

## Commit Message Rules

All commits must follow this format strictly:

1. **Subject line**: `<ticket-id>: <type>: <concise imperative description>`
   - `<ticket-id>` is extracted from the branch name (e.g. `PROJ-123`).
   - `<type>` is one of: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`.
   - Keep under 72 characters.
2. **Blank line** separating subject from body.
3. **Body**: Explain the reasoning, what problem it solves, and relevant context.
   - Do NOT repeat the `<ticket-id>:` prefix in the body.
   - Reference acceptance criteria by description, not by epic-specific numbers.
4. **Trailer**: Always include the `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.
5. **Do NOT use epic numbers** in commit messages. Use concise, descriptive context instead.
6. **Keep commits atomic**: Each commit should represent one logical change.

## Data Model & Migration Rules

If the spec requires data model changes and the stack uses a migrations tool:

1. Define the entity/model and its data-access configuration first.
2. Generate migrations with the stack's own tooling (e.g. `dotnet ef migrations add <Name>`, `alembic revision`, `rails g migration`, `prisma migrate`, …) — **never hand-edit generated migration files**.
3. Use descriptive migration names (e.g. `AddSupplierReturnTable`, `AddStatusColumnToOrder`).
4. Commit migrations separately from business logic.

## Error Handling & Recovery

- If a test fails after implementation, **fix the implementation**, not the test (unless the test itself has a bug).
- If the build fails, fix compilation errors before proceeding.
- If you discover a gap in the spec during implementation, note it in the report but implement the best reasonable interpretation.
- If you encounter a dependency that blocks progress, note the task list item as blocked (e.g. append `— BLOCKED: <reason>` to its label) and proceed with independent work.

## Important Constraints

- **Follow TDD strictly.** Tests must be written and committed BEFORE the implementation they verify.
- **Never skip tests.** Every acceptance criterion must have at least one test.
- **Run integration tests for real — don't let them be silently skipped.** If they need
  Docker-backed services, run the Phase 1.5 preflight to bring Docker up (starting Docker
  Desktop / the daemon per-OS, or asking the user to start it) before running them. Only
  fall back to PR-CI validation when Docker genuinely cannot be provided, and say so
  explicitly.
- **Reconciliation is a separate downstream phase — do NOT reconcile docs here.** This skill
  is the **Implementation** phase; it must not fold knowledge into the long-lived docs from an
  intermediate state. The durable docs (`docs/` domain docs + index **and** `docs/guidelines/*.md`
  guideline/reference files) are reconciled **once, from the verified state**, by the
  dedicated `reconcile-docs` skill run *after* this skill. Your obligation here is to **emit
  the mandatory next-step banner** pointing at `/reconcile-docs` — never to update the durable
  docs yourself. PRD/spec are per-epic; the durable docs are the lasting record and must not
  drift, but that is the Reconciliation phase's job.
- **Stay consistent with the codebase.** Follow established patterns — do not introduce new frameworks, libraries, or architectural patterns.
- **Commit frequently.** Each TDD cycle (Red → Green → Refactor) should produce at least one commit.
- **No secrets in code.** Credentials come from the repo's configured secrets mechanism (e.g. AWS Systems Manager Parameter Store, a vault, or environment configuration) — never hardcode them.
- **Respect the stack's messaging/reliability conventions.** If the repo uses queues, follow its established reliability patterns (e.g. a Dead Letter Queue for every new queue).
- **Infrastructure as Code.** Note any required infrastructure changes but do not modify the infrastructure definitions (e.g. Terraform under `infrastructure/`) unless explicitly part of the spec.
- **Never commit onto the base branch.** Honor the Branch Detection base-branch safety gate — if the current branch is an integration branch (`develop`/`staging`/`main`/`master` or `origin/HEAD`'s target) or a detached HEAD, STOP and ask for a feature branch before writing any code. This skill commits directly to the current branch, and misplaced commits on the base branch cannot be cleanly undone afterwards.
- **Don't use epic numbers in long-term files.** This applies to **all durable, long-lived
  content**, not just code identifiers: class/method/file names, but equally section
  headers, inline notes/callouts, comments, and prose in long-lived docs
  (`docs/domain-*.md`, `docs/guidelines/*.md`) if you ever touch them incidentally. Use
  descriptive names and descriptive language instead — e.g. a note header should read
  `**Note:**` or `**Internal-ALB rule scoped to our own host.**`, never `**Note
  (PROJ-123):**`. Ticket/epic identifiers belong only in commit messages, PR titles/bodies,
  and the `Related epics` / `Change Log` rows `reconcile-docs` maintains — never inline in a
  doc's descriptive prose. The same constraint applies to what you hand off: when
  `reconcile-docs` later persists what you recorded in your report, keep ticket/issue IDs
  out of that report's descriptive prose too — they live only in commits and the PR.
