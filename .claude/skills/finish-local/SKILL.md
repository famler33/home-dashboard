---
name: finish-local
description: >
  Finishes a delivery in a local-only repository (no GitHub remote yet) — the local
  counterpart of open-pr. Runs the verification and documentation gates, snapshots the
  specs/ workspace (roadmap, PRDs, specs) into git history, clears those files from the
  tree and restores specs/briefing.md to its pre-delivery base state, then merges the
  delivery branch into the local base branch with a merge commit. Never pushes. Use this
  skill when asked to finish, close, wrap up or merge a delivery locally, or when the chain
  reaches its last step and the project has no GitHub remote.
---

# Finish-Local Skill — Local Delivery Close-Out

You close a finished delivery **without GitHub**: the same specs snapshot / cleanup that
`open-pr` performs, followed by a local merge instead of push + pull request.

The by-hand chain is: `create-roadmap → brainstorm → write-spec → implement-epic →
verify-epic → reconcile-docs` (repeat per epic) `→ finish-local`. Once the project has a
GitHub remote, use `open-pr` → `address-pr-review` instead.

> **Shared procedure with `open-pr`.** The snapshot commit, the clear commit (subjects,
> bodies, trailer) and the briefing restore rule are identical in both skills. If you change
> them here, change them in `open-pr` too.

> **Permissions.** Claude Code asks for approval per command unless the commands are allowed
> in `.claude/settings.json` or auto mode is on. Proceed normally either way.

## Inputs

- **Base branch** (optional): the integration branch to merge into. If not given, resolve it
  in pre-flight.
- **Scope** (optional): which epics this delivery covers. Default: every epic in
  `specs/roadmap.md`.

## Pre-flight (BLOCKING gates — fail fast)

1. **Local-only check.** Run `git remote -v`. If an `origin` on GitHub exists and `gh` is
   authenticated, tell the user that `open-pr` is the intended finish for this repository
   and ask whether to continue locally anyway. Continue only on explicit confirmation.
2. **Delivery branch.** The delivery branch is the current checkout
   (`git branch --show-current`). It must not be detached and must not be the base branch.
   If it is the base branch, STOP: implementation commits landed on the base branch — help
   the user move them onto a feature branch first.
3. **Resolve the base branch.** Use the user-supplied branch if given. Otherwise check which
   of `main` and `master` exist locally (`git rev-parse --verify --quiet <name>`): exactly
   one → use it; both or none → ask the user. Record it as `<base-branch>`.
4. **Clean worktree.** `git status --porcelain` may only show changes under `specs/`. Any
   other uncommitted change → STOP and ask the user to commit, stash, or discard it first.
5. **Ticket and epics.** Read `specs/roadmap.md`: the `**Ticket:**` header is the
   `<ticket-id>` (absent or `—` → fall back to the ticket in the branch name, e.g.
   `PROJ-123` from `feature/PROJ-123-…`; none → no prefix — never invent one). Resolve each
   in-scope epic's canonical slug from its `### N. <Epic Name> (<epic-slug>)` heading.
6. **Verification gate (blocking).** Every in-scope epic needs a `verify-epic` verdict of
   `FULLY VERIFIED` with every acceptance criterion ✅ PASS (see `docs/guidelines/testing-guidelines.md`).
   - Use the latest verify-epic report from this session if there is one; otherwise run
     `verify-epic` for that epic now.
   - Without CI there is no `VERIFIED-PENDING-CI`: ACs that could not be tested locally are
     ⚠️ PARTIAL. Continue only if the user explicitly accepts that gap; name the accepted
     ACs in the merge commit body and the report.
   - Any ❌ FAIL or unaccepted ⚠️ PARTIAL → STOP and hand back to `implement-epic`.
7. **Documentation gate (blocking).** Invoke `reconcile-docs` once per in-scope epic (it is
   idempotent). Continue only when every run completed and its doc changes are committed.
8. **Capture the base branch's `briefing.md` state — never use the working copy.** The
   working-tree `briefing.md` is this delivery's own briefing; restoring to it would be a
   silent no-op. Read the base branch instead:
   ```
   git cat-file -e <base-branch>:specs/briefing.md
   ```
   Exists → `briefing_original_state = present`, capture
   `git show <base-branch>:specs/briefing.md` verbatim as `briefing_original_content`.
   Missing → `briefing_original_state = absent`. In a fresh session, simply re-derive it.

## Workflow

### Step 1 — Idempotency check (before anything destructive)

- **Already merged?** `git merge-base --is-ancestor <branch> <base-branch>` succeeds → the
  delivery is already in the base branch. Report that and stop.
- **Already cleared?** Search `git log --format="%H %s" <base-branch>..HEAD` for this
  delivery's clear commit `<ticket-id>: chore: clear specs workspace for next story` (match
  **this** ticket prefix only). If found, `<specs-sha>` is its parent (`git rev-parse
  <clear-sha>^`); verify with `git ls-tree -r --name-only <specs-sha> -- specs/` that the
  roadmap/PRDs/specs are there, then skip to **Step 4**.

### Step 2 — Snapshot the specs into history

If `git status --porcelain specs/` shows uncommitted changes, commit them as the snapshot:

```
git add specs/
git commit -m "<ticket-id>: docs: specs snapshot for <slug> (roadmap, PRD, spec)" -m "Snapshot the roadmap, PRD and spec for this epic before clearing specs/ so the requirements live in git history after specs/ is cleared." -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

Use the epic's `<slug>`, or a short delivery slug when several epics ship together. Then
record the snapshot SHA — this commit still holds every spec:

```
git rev-parse HEAD    # → <specs-sha>
```

### Step 3 — Clear the specs from the tree

Remove only tracked spec files (`git rm` aborts on a glob that matches nothing):

```
git ls-files specs/roadmap.md specs/prd-*.md specs/spec-*.md
git rm <the tracked spec paths listed above>
```

Restore the captured briefing state:

```
# briefing_original_state=present: write briefing_original_content back to specs/briefing.md byte-for-byte
# briefing_original_state=absent:
git rm --ignore-unmatch specs/briefing.md
```

If the state was not captured, STOP and re-derive it from `<base-branch>`; never restore the
current delivery briefing or invent a placeholder. Then commit:

```
git add -A specs/
git commit -m "<ticket-id>: chore: clear specs workspace for next story" -m "Remove this delivery's roadmap/PRDs/specs and restore briefing.md to its pre-delivery base state (including absence) so the merged base branch starts the next story clean. The specs remain in this branch's history (see <specs-sha>); durable knowledge already landed in the long-lived docs." -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4 — Merge locally (merge commit only)

A merge commit keeps `<specs-sha>` reachable from the base branch; never rebase or squash.

```
git checkout <base-branch>
git merge --no-ff <branch> -m "<ticket-id>: Merge <branch>: <delivery title>" -m "Epics: <slug-1>, <slug-2>. Specs snapshot: <specs-sha>.[ Accepted untested ACs: <list>.]" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

- Omit the `<ticket-id>: ` prefix when there is no ticket.
- **Conflicts:** stop, show the conflicting files, and resolve them together with the user.
  Never resolve by discarding either side wholesale. After resolving, run the test, lint and
  build gates from `docs/guidelines/testing-guidelines.md` before committing the merge.
- **Do not push** and **do not delete** the delivery branch unless the user asks.

### Step 5 — Report

```
══════════════════════════════════════════════════
  Delivery finished locally: <delivery title>
══════════════════════════════════════════════════
Branch:          <branch>  →  merged into <base-branch> (<merge-sha>)
Epics:           <slug>: FULLY VERIFIED, <n>/<n> ACs PASS, docs reconciled
                 …
Accepted gaps:   <none | AC list>
Specs snapshot:  <specs-sha>
                 read later with: git show <specs-sha>:specs/prd-<slug>.md
Workspace:       specs/ cleared, briefing.md restored to base state
Next:            write a new specs/briefing.md on a new branch for the next delivery
══════════════════════════════════════════════════
```

## Important Constraints

- **Never push, never create a remote, never open a PR.** That is `open-pr`'s job.
- **Gates are blocking.** No snapshot, clear or merge before verification and documentation
  reconciliation pass.
- **Merge commit only** (`--no-ff`); never rebase, squash or fast-forward.
- **Never invent ticket ids**; no ticket → no prefix.
- **Never tick open questions or make product decisions** on the user's behalf.
