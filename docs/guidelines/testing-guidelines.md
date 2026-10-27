# Testing Guidelines

Cross-stack testing and verification rules live here. Framework- and
language-specific conventions remain in the layer coding guidelines.

## Requirements Traceability

When tests are created or changed to implement a PRD or technical specification:

- Add a nearby comment that lists every requirement and acceptance criterion the
  test covers.
- Preserve identifiers verbatim using the source document's `F-*`, `FR-*`, `NFR-*`,
  and `AC-*` forms.
- Keep the comment adjacent to the relevant test or test group so coverage remains
  clear when tests are moved or refactored.
- Do not invent requirement identifiers for tests that are not derived from a PRD or
  technical specification.

## Epic Verification Baseline

The shared `verify-epic` skill supplies the generic acceptance-criteria verification
workflow. Apply the following project-specific baseline whenever that skill runs.

### Required inputs and scope

- Verification requires both `specs/prd-<epic-slug>.md` and
  `specs/spec-<epic-slug>.md`. A missing technical specification is a blocker, not
  optional context.
- Determine the affected layers from the PRD, specification, and implementation
  touchpoints. Inspect and run gates only for affected layers.

- `frontend/` — widgets/screens, i18n, animations, Vitest tests, Playwright E2E.
- `backend/` — endpoints and their contract, integrations (weather, calendar, news),
  caching and fallback behavior, SQLite persistence, Vitest tests.
- `infrastructure/` — only when an AC depends on it (container build, compose
  config, health checks).

- Read the relevant architecture, coding, infrastructure, security, and UX
  guidelines before assessing an affected layer. Those files remain authoritative
  for implementation and user-experience requirements.

### Repository test and quality gates

Use the repository's configured commands and narrow test selectors when practical.
The current full-layer baseline is:

```bash
# frontend (from frontend/)
pnpm exec vitest run
pnpm exec eslint .
pnpm exec prettier --check .
pnpm exec tsc --noEmit
pnpm exec vite build
pnpm exec playwright test

# backend (from backend/)
pnpm exec vitest run
pnpm exec eslint .
pnpm exec prettier --check .
pnpm exec tsc --noEmit

# infrastructure (from repo root)
docker compose -f infrastructure/docker-compose.yml config --quiet
```

- Tests never call real external services (weather, calendar, news); they use fakes
  or recorded fixtures. No gate needs a real API key.
- SQLite and temporary directories are used directly; Docker is only needed to build
  or run the containers.

- Use read-only lint and format checks. Never use a convenience script that applies
  fixes; it violates the verifier's read-only contract.
- Discover test projects and commands from current configuration and CI before
  execution; update this baseline when repository tooling changes.
- Before a suite that actually depends on a containerized service, check Docker and
  use the repository's existing compose stack. Do not require Docker for in-memory
  suites.
- Never skip a blocked suite silently. Distinguish unavailable infrastructure from
  failed product behavior and apply the shared skill's deferred-to-CI rule only
  when Docker unavailability is the sole remaining evidence gap.
- A failing test, format, lint, type-check, or build gate blocks every affected
  acceptance criterion.

### Browser click-through and UX verification

User-facing epics require an explicit browser click-through in addition to automated
tests and code inspection. This evidence supplements acceptance-criterion coverage;
it never replaces missing automated tests.

1. Determine whether the epic has a user-facing flow that can be exercised in the
   running application. Record `not applicable` only when it does not.
2. Derive a click-through plan from the PRD's acceptance criteria and functional
   requirements: target route or screen, user actions, expected outcome, and any
   requested screenshot.
3. Execute the plan with the browser-test tool configured in the repository (e.g.
   Playwright) and record pass/fail evidence against each relevant AC and FR. Do not
   install a tool or invent an E2E harness solely for verification. If required
   browser evidence cannot be produced with existing tooling, report
   `MANUAL_VALIDATION_REQUIRED`.
4. During the click-through, assess `ux-guidelines.md`.
   Check in particular: legibility from a distance on the tablet, design tokens
   instead of hard-coded values, no hard-coded UI strings, smooth animations without
   jank, behavior on stale or missing data (offline/error states), and layout at the
   tablet's resolution and orientation.
5. Fold every click-through and UX finding back into AC assessment. A failed flow or
   UX requirement prevents `PASS` and `DEFERRED`; a successful click-through cannot
   replace a missing automated test, which remains `PARTIAL` with `TEST_NOT_FOUND`.
6. When screenshot capture is requested, save descriptive evidence under
   `e2e/screenshots/<epic-slug>/`.
7. Start only the application processes needed for the flow when they are not
   already running, wait for readiness, and tear down only what you started.

## Review-Driven Fixes

When `address-pr-review` applies a valid review fix:

- For runtime behavior or a failing unit/integration test, use the smallest
  Red-Green-Refactor slice. Add or extend the relevant existing test, confirm the
  intended failure, implement the minimal fix, and rerun the same targeted checks
  through Green and refactoring.
- For non-behavioral remediation such as lint, formatting, analyzer-only, pure
  build, or secret-removal changes, apply the smallest direct fix and rerun the
  exact blocking command instead of creating an artificial test-first cycle.
- Run the smallest relevant verification set for every touched layer and report one
  of these exact outcomes:
  - `✅ PASS` — all required local tests, lint, and builds for the touched area pass.
  - `🟡 DEFERRED (to CI)` — integration coverage is the only remaining gap and is
    blocked solely by unavailable Docker-backed dependencies; CI must still pass.
  - `⚠️ PARTIAL` — the fix exists, but required local verification is failing,
    missing, or blocked for another reason.
  - `❌ FAIL` — the intended fix is absent or its reproducer still fails.

Docker unavailability never converts another failure or evidence gap into
`🟡 DEFERRED (to CI)`.

## Delivery Readiness

Before `finish-local` or `open-pr` may finish a delivery:

- every in-scope epic must have a `verify-epic` verdict of `FULLY VERIFIED` or —
  only when CI exists — `VERIFIED-PENDING-CI`;
- every acceptance criterion must be `✅ PASS`; without CI, an AC that could not be
  tested locally stays `⚠️ PARTIAL` and blocks unless the user explicitly accepts the
  gap (recorded in the merge commit and report);
- all applicable local test, lint, format, type-check, and build gates must pass,
  except for the Docker-only integration gap represented by
  `VERIFIED-PENDING-CI`; and
- the merge commit (`finish-local`) or the pull request's Verification section
  (`open-pr`) must state the verdict and acceptance-criterion pass count for each epic.

Both skills trust the completed verification report rather than rerunning these
gates, but they must not finish a delivery when this readiness contract is missing
or failed.
