---
name: open-pr
description: >
  Opens the delivery pull request for the SDD chain when running it by hand — the step
  between implement-epic/verify-epic and address-pr-review. Snapshots the specs/ workspace
  (roadmap, PRDs, specs) into git history, clears those files from the tree and restores
  specs/briefing.md to its pre-delivery base state, pushes the branch, and opens ONE **draft**
  PR whose body permalinks the PRD/spec by commit SHA. Requires a GitHub remote and an
  authenticated gh CLI; for a project without a GitHub remote use finish-local instead.
  Use this skill when asked to open the delivery PR,
  ship the branch, or finalize an epic set into a pull request.
---

# Open-PR Skill — Snapshot Specs, Clear Them, Open the Delivery PR

You are a delivery engineer opening the pull request that ships a delivery built through
the SDD chain (`create-roadmap → brainstorm → write-spec → implement-epic → verify-epic →
reconcile-docs`). It snapshots the `specs/` artifacts into git history, removes them from
the tree (so the PR diff is code + docs only), restores `briefing.md` to its pre-delivery
base state, pushes, and opens one **draft** PR that permalinks the specs by commit SHA.

> **For a project without a GitHub remote use `finish-local` instead.** It applies the same
> snapshot/clear/briefing-restore procedure and merges locally — no push, no PR.

> **Precondition.** This skill requires a GitHub remote (`git remote get-url origin` points
> to GitHub) and an authenticated `gh` CLI. If there is no remote, STOP and point the user
> to `finish-local`.

> **Approvals.** Claude Code asks for approval per command (`git`, `gh`) unless those
> commands are allowed in `.claude/settings.json` or auto mode is on.

## When to run this

Run it **once**, after `implement-epic` (and any optional `verify-epic`) reports the
epic(s) on the current branch are complete — all ACs PASS, tests green, build clean — and
you are ready to open the PR. It opens **one** PR for the current branch (the whole
delivery in the by-hand single-PR flow). It does **not** merge; merging stays a human
decision after review + CI.

Do **not** run it while any epic is still unimplemented, and do not run it twice for the
same branch (it is idempotent — see Step 1).

## Inputs

- **Branch** (optional): the feature branch to open the PR from. Default: the current
  branch (`git branch --show-current`). It must **not** be the base/integration branch.
- **Base branch** (optional): the branch the PR targets. If not supplied, **prefer
  `origin/HEAD`'s target** (`git symbolic-ref --short refs/remotes/origin/HEAD`) — that is
  the repo's actual designated default branch, whatever it is named, so auto-targeting it
  is safe even when that name is `main` or `master`. **Only when `origin/HEAD` cannot be
  resolved**, fall back to checking for `develop` / `staging` / `main` / `master` in that
  order — but if more than one of those exists, or the one found could plausibly be the
  **production/release branch rather than an integration branch** (e.g. a repo whose sole
  long-lived branch is `main`/`master` and is also what gets deployed), **ask the user**
  instead of guessing. The "never target release/production unless explicitly asked" rule
  is about picking a branch the static fallback list *can't* disambiguate from an
  `origin/HEAD`-confirmed default (e.g. don't auto-target `release/2.4`, `hotfix/x`, or
  `prod` as a base) — it is not a reason to skip a repo's real, `origin/HEAD`-confirmed
  default just because it happens to be named `main`/`master`.
- **Ticket id** (optional): used to prefix the PR title and commits. Derive it in this
  order: (1) the `**Ticket:**` line in `specs/roadmap.md`, (2) the `Ticket:` line in
  `specs/briefing.md`, (3) extract it from the branch name (e.g. `PROJ-123` from
  `feature/PROJ-123-…`). Only if none yields one, ask the user. Read the value from an
  **uncommented** `Ticket:` line only — take the token after the colon up to the next
  whitespace or inline `#` comment, and **ignore any `#`-commented line** (the reset
  `briefing.md` placeholder is `# Ticket: PROJ-XXXX`, so a `#`-prefixed line is a template,
  not a value). **In resume mode** (specs already cleared — see Step 2 item 0), skip (1)/(2)
  and derive from the **branch name**: the cleared `roadmap.md` is gone and the reset
  `briefing.md` holds only that commented placeholder, which must not leak into the title.
- **Roadmap / PRDs / specs**: `specs/roadmap.md`, `specs/prd-*.md`, `specs/spec-*.md` —
  read to build the per-epic PR body (epic names, slugs, outcomes). **In resume mode** read
  them from history instead, via `git show <specs-sha>:specs/<file>`, since the tree no
  longer has them.

## Pre-flight (BLOCKING gates — fail fast)

1. **GitHub auth.** Run `gh auth status`. If not authenticated (and no `GH_TOKEN` /
   `GITHUB_TOKEN` is set), STOP and ask the user to run `gh auth login` or export a token
   with `repo` scope, then re-invoke. Do not touch the branch before auth is confirmed.
2. **Be on the branch you are shipping — but never switch branches over live work.**
   Determine the branch: default to the current checkout (`git branch --show-current`). If
   the user supplied a **different** branch name, only check it out
   (`git checkout <branch>`) when the current tree is **clean** and the currently checked-out
   branch is not another delivery mid-flight (no open PR of its own with unaddressed review
   work). Otherwise **STOP** and hand back the choice — one working tree has a single `HEAD`
   and a single `specs/` folder, so switching would yank another delivery's branch away and
   leave its `specs/` for this one to trample:
   > "You asked me to ship `<branch>`, but this checkout is on `<current-branch>` with
   > `<n>` uncommitted change(s). Either **(a)** commit/stash and say **continue** so I can
   > check out `<branch>`; or **(b)** ship it from its own checkout —
   > `git worktree add ../<repo>-<ticket-id> <branch>` — leaving this one untouched."

   Once resolved, every step below — snapshot, clear, commits — happens on that branch. All
   of Steps 1–5 operate on the **currently checked-out** branch; `<branch>` in this skill
   always means that branch.
3. **Branch safety.** Confirm that branch is **not** the base/integration branch and is not
   detached. If it is, STOP and ask the user which feature branch to ship. (Running the
   by-hand chain from the base branch is the common mistake — implementation commits then
   land on the base branch. If that already happened, help the user move the commits onto a
   feature branch before continuing.)
4. **Readiness.** Confirm the epics on this branch are actually done (implementation
   committed, tests green). This skill trusts `implement-epic`/`verify-epic` — it does not
   re-verify — but do not open a PR for an empty or half-built branch.
5. **Clean worktree.** Run `git status --porcelain`. This skill makes snapshot/clear commits,
   so unrelated uncommitted changes could be swept into them. If the tree has changes outside
   the expected `specs/` surface, STOP and ask the user to commit, stash, or discard them
   first. (Uncommitted `specs/` changes are expected — they become the snapshot in Step 2.)
5a. **Documentation reconciliation (blocking).** Invoke `reconcile-docs` once for every epic
   being shipped, passing its canonical roadmap slug explicitly. The skill is idempotent, so
   run it even when `implement-epic` appears to have done so already. Do not snapshot or open
   the PR unless every reconciliation completes and its doc changes are committed; this gate
   prevents callers from skipping the mandatory Reconciliation phase by invoking `open-pr`
   directly after implementation.
6. **Merge-policy check (blocking — spec permalinks depend on it).** This delivery
   keeps the PRD/spec history *only* as snapshot commits on the branch; they survive the merge
   under their original SHA **only if the PR is merged with a merge commit**. Rebase-merge
   rewrites commit SHAs and squash drops the snapshot commits, so either method invalidates
   the promised durable PR-body permalinks. Check
   the repo's merge settings before snapshotting or clearing anything:
   ```
   gh api repos/<owner>/<repo> --jq '{merge: .allow_merge_commit, rebase: .allow_rebase_merge, squash: .allow_squash_merge}'
   ```
   If `merge` is **false**, STOP before snapshotting or clearing anything. Ask the user to
   enable merge commits (or choose a different durable spec-storage design) and then re-run.
   Always make the "Create a merge commit; do not rebase or squash" instruction prominent
   in the PR body.
7. **Snapshot the base branch's `briefing.md` state before anything touches it — never use
   the delivery working copy as a fallback.**
   Step 3 resets `briefing.md` once the PR is opened, and it must reset to whatever the file
   contained **before this delivery started**, not a hardcoded template (a prior delivery may
   have customized the placeholder wording, added team notes, etc.).
   > **Why not just read the working tree's current `specs/briefing.md`?** By the time
   > `open-pr` runs, the working tree's `briefing.md` is always **this delivery's own**
   > briefing (`create-roadmap` read it as input at the very start of the chain; nothing
   > since then would have changed it back). Snapshotting *that* and "restoring" to it later
   > is a silent no-op — it leaves the new story's content sitting in `briefing.md` after
   > merge instead of resetting it, defeating the whole point of Step 3. The reliable source
   > is the **resolved base branch**. First test
   > `git cat-file -e origin/<base-branch>:specs/briefing.md`. If it exists, capture
   > `git show origin/<base-branch>:specs/briefing.md` verbatim. If it does not exist, record
   > the state as `absent`; do not snapshot this delivery's working copy.

   Keep the result as `briefing_original_state` (`present` | `absent`) plus, for `present`,
   `briefing_original_content` (verbatim). No store is needed: the resolved base branch is
   the durable ground truth, so in a fresh session simply re-derive both from
   `origin/<base-branch>` again.

## Workflow

### Step 1 — Idempotency check (before anything destructive)

Check whether a PR already exists for this branch **before** snapshotting, clearing, or
committing anything:

```
gh pr list --head <branch> --state all --json url,state
```

Run it plainly — do **not** append POSIX-only redirections like `2>/dev/null || true`,
which write a stray `nul` file on Windows PowerShell. **Distinguish a real "no PR" from a
failed query:** only a **successful** call that returns `[]` means "no PR yet". If the call
**errors / exits non-zero** (transient GitHub API failure, auth hiccup), **STOP** and retry
later — do **not** fall through to the destructive snapshot/clear steps, or you could clear
the specs on a branch that already has an open PR. On a successful result:

- An entry with `state = OPEN` → a PR is already open for this branch. **Skip the rest** and
  just report its URL (idempotent re-run).
- Only `CLOSED` / `MERGED` entries (no open one) → the previous PR is gone. If it is
  `MERGED`, the delivery already shipped — **stop and report** rather than opening a second
  PR. If it is `CLOSED` (abandoned), continue only if the branch has genuinely new commits to
  ship; mention the prior closed PR in your report.
- Empty (`[]`) → no PR yet; continue.

### Step 2 — Snapshot the specs into history (if not already committed)

The permalinks in the PR body point to a commit that still **contains** every `specs/`
file. Ensure such a commit exists on the branch:

0. **Resume guard — did a previous run already clear the specs?** If a prior attempt
   committed the Step 3 clear but failed before `gh pr create`, the specs are already gone
   from HEAD, so a naive re-run would snapshot/permalink a commit with **no** specs, and it
   can no longer read the roadmap/PRDs for the body. Detect and recover deterministically:

   a. **Find the cleanup commit by its subject** (do not assume it is HEAD — there may be
      later commits, e.g. after a CLOSED PR). Search the branch for the single-mode subject
      `<ticket-id>: chore: clear specs workspace for next story`, or a per-epic subject
      `<ticket-id>: chore: clear <slug> specs (kept in history at <sha>)`:
      ```
      git log --format="%H %s" <base-branch>..HEAD    # locate the clear commit <clear-sha>
      ```
      If no such commit exists, this is a normal (non-resume) run — continue to item 1.
      > **Match only *this* delivery's `<ticket-id>` prefix.** If the branch was cut off
      > another delivery's still-unmerged branch, `<base-branch>..HEAD` also contains **that**
      > delivery's cleanup commit. Recovering from it would permalink a foreign delivery's
      > specs. Require the subject's ticket prefix to equal this run's `<ticket-id>`; if the
      > only clear commit found carries a different ticket, ignore it (treat as "no such
      > commit") and surface the mis-rooted branch to the user rather than recovering.

   b. **Recover `<specs-sha>` from the cleanup commit's parent** — the commit *before* the
      clear still holds every spec — and **verify** the expected spec paths actually exist
      there before trusting it:
      ```
      git rev-parse <clear-sha>^        # → <specs-sha>
      git ls-tree -r --name-only <specs-sha> -- specs/   # confirm roadmap/PRD/spec are present
      ```
      If the expected specs are **not** in `<specs-sha>`, stop and surface the inconsistency
      rather than opening a PR with broken permalinks.

   c. **Read spec content and ticket from history, not the cleared tree.** In resume mode the
      working tree no longer has the specs and `briefing.md` is restored to the base state
      (possibly absent), so:
      - derive the `<ticket-id>` from the **branch name** (not the restored `briefing.md`);
      - read roadmap/PRD/spec for the PR body via `git show <specs-sha>:specs/<file>`.

      Then **do not snapshot or clear again** — skip straight to **Step 4 (push)** using the
      recovered `<specs-sha>`.

   (Non-final per-epic runs keep `roadmap.md`/`briefing.md` tracked and use the per-epic
   cleanup subject, so match on the subject in item (a), not on whether `roadmap.md` is
   tracked.)

1. If `git status --porcelain specs/` shows uncommitted changes under `specs/`, commit them
   as the snapshot (the resulting HEAD holds all specs):
   ```
   git add specs/
   git commit -m "<ticket-id>: docs: specs snapshot for <slug> (roadmap, PRD, spec)" -m "Snapshot the roadmap, PRD and spec for this epic before clearing specs/ so the requirements live in git history after specs/ is cleared." -m "Co-Authored-By: Claude <noreply@anthropic.com>"
   ```
   Use the delivery's `<slug>` (or a short delivery slug when shipping several epics at
   once). If `specs/` is already fully committed (nothing to snapshot), skip this commit.

2. **Capture the snapshot SHA** — the current HEAD still holds every spec:
   ```
   git rev-parse HEAD    # → record as <specs-sha>; this commit still holds all specs
   ```
   All PR-body permalinks use this `<specs-sha>` (never the branch HEAD, which loses the
   files in Step 3).

   **The PR body is the durable record of `<specs-sha>`.** `address-pr-review` needs it later
   to restore the PRD/spec from history; it reads the SHA from the PR body's permalinks (or
   falls back to `git log --all -- specs/prd-<slug>.md`). So the body must always carry the
   permalinks built from `<specs-sha>` (see Step 5).

### Step 3 — Clear the specs from the tree

Immediately before pushing, remove the spent SDD artifacts and reset `briefing.md` in one
commit on the branch. Because this lands *before* the PR is created, it never dismisses an
approval and never breaks a link.

Remove only the spec files that are actually **tracked** — `git rm` errors on a pathspec
glob that matches nothing, which would abort the cleanup:

```
# List the tracked spec files first:
git ls-files specs/roadmap.md specs/prd-*.md specs/spec-*.md
# → if that prints any paths, pass exactly those to `git rm`; if it prints nothing, skip the rm.
git rm <the tracked spec paths listed above>
```

Restore the base branch's exact briefing state captured in pre-flight:

```
# briefing_original_state=present:
#   write briefing_original_content back to specs/briefing.md byte-for-byte
# briefing_original_state=absent:
git rm --ignore-unmatch specs/briefing.md
```

If the base state was not captured, STOP and reconstruct it from the resolved base branch; never
restore the current delivery briefing or invent a generic placeholder.

Then commit:

```
git add -A specs/
git commit -m "<ticket-id>: chore: clear specs workspace for next story" -m "Remove this delivery's roadmap/PRDs/specs and restore briefing.md to its pre-delivery base state (including absence) so the merged base branch starts the next story clean. The specs remain in this branch's history (see <specs-sha>); durable knowledge already landed in the long-lived docs." -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4 — Push

Push the **named** branch (not `HEAD`, so a stray checkout can't push the wrong ref):

```
git push -u origin <branch>
```

> **Never a bare `git push`.** Always name the remote and branch. If the branch was created
> with `git checkout -b <name> origin/<base>` (without `--no-track`), its upstream is the
> **base branch**, and a bare push would put the whole delivery on `develop`, bypassing the
> PR. Check with `git rev-parse --abbrev-ref '@{upstream}'`; if it resolves to the base
> branch, run `git branch --unset-upstream` first. The `-u` above then sets the correct
> upstream.

### Step 5 — Open the pull request as a draft

Resolve the repo URL for permalinks (`gh repo view --json url --jq .url` →
`https://github.com/<owner>/<repo>`). Create **one** PR targeting the base branch, **as a
draft** — it should be reviewable before it's marked ready for human review:

```
gh pr create --draft --base <base-branch> --head <branch> \
  --title "<ticket-id>: <concise epic set summary>" \
  --body-file <tmp-body-file>
```

**Reviewers (optional).** Ask the user whether reviewers should be requested. Only if they
name logins, run `gh pr edit <number> --add-reviewer <login>[,<login>…]`. Never invent or
guess logins; if the user declines, skip this.

> **Pass the body via a file, not inline.** The generated body is Markdown that can contain
> quotes, `$`, backticks, and newlines, which break inline `--body "…"` (differently on
> PowerShell vs bash). Write it to `<tmp-body-file>` and pass `--body-file <tmp-body-file>`
> (or `--body-file -` via stdin), then delete the temp file afterward — this is
> shell-agnostic and quote-safe. Do the same for every `--title`/`--body` and
> `gh pr comment`/reply below.
>
> **Shell portability of the multi-line examples.** The `\` at the end of lines above is
> **bash** line-continuation; in PowerShell it is not — use a backtick `` ` `` or put the
> whole `gh` invocation on one line. Adapt the example to the shell you are actually running.

- Prefix the title with `<ticket-id>` (same rule as `implement-epic`); ask the user only if
  none can be derived.
- The body must list, **per epic**: the epic name, a one-line outcome, **commit-permalink**
  links to its PRD and spec — `<repo-url>/blob/<specs-sha>/specs/prd-<slug>.md` and
  `<repo-url>/blob/<specs-sha>/specs/spec-<slug>.md`, using the `<specs-sha>` captured in
  Step 2 (the files are no longer on the branch HEAD, so **never** link the branch) — and
  its verify-epic result (AC pass count). Add a short **Verification** section confirming
  all ACs `✅ PASS`, tests green, and build clean, plus a one-line note that the `specs/`
  workspace was cleared in this same PR and remains in history at `<specs-sha>`. End the
  body with the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Flipping Draft → Ready is not this skill's job.** Run `/address-pr-review` to process
  review feedback; once every comment is addressed **and** every affected thread is
  manually resolved on GitHub **and** required checks are green, mark the PR ready yourself
  with `gh pr ready <number>`.

### Step 6 — Report

Report the PR URL. The delivery is shipped, as a **draft** awaiting review — the next step is `/address-pr-review` to handle that feedback. **Do not
merge the PR** — that stays a human decision after review + CI, and **do not** mark it
ready yourself until every addressed thread is manually resolved on GitHub and required
checks are green.

```
🚀 Delivery PR opened (Draft)
──────────────────────────────────────────
PR:        <url>  (draft; reviewers: <logins | none requested>)
Base:      <base-branch>  ←  Head: <branch>
Specs:     snapshotted at <specs-sha>, cleared from the tree in this PR (history-only)
Epics:     <slug-1>, <slug-2>, …  (all ACs ✅ PASS)
→ Next:    run /address-pr-review to handle review feedback. Once every thread is addressed
           and manually resolved and checks are green, run `gh pr ready <number>`. Do not
           merge — a human merges after approval + green CI.
```

## Per-epic (stacked) variation — optional

If you are shipping **one PR per epic** (stacked PRs), run this skill once per epic branch, and adjust two things:

- **Base = the parent ref** — the previous epic's branch in build order, or the resolved
  base branch (the detected integration branch, e.g. `develop`/`staging`/`main`/`master`) for the
  first epic (stacked PRs). GitHub auto-retargets a child PR to the base branch when its
  parent merges.
- **Clear only this epic's specs** in Step 3, using the same tracked-file guard as the
  single-mode Step 3 (only `git rm` paths that `git ls-files` confirms are tracked, so an
  already-cleared file doesn't abort the command):
  ```
  git ls-files specs/prd-<slug>.md specs/spec-<slug>.md   # → only the tracked ones
  git rm <the tracked paths that came back>
  ```
  **Keep** `roadmap.md` and `briefing.md` until the **final** epic's PR — later epics'
  `brainstorm`/`write-spec` still read them — then clear `roadmap.md` and restore
  `briefing.md` to its pre-delivery base state (from the pre-flight snapshot) in that last
  epic's PR only. Use the **per-epic** cleanup commit message
  `<ticket-id>: chore: clear <slug> specs (kept in history at <specs-sha>)`, rather than the single-mode
  "clear specs workspace for next story" subject.

## Important Constraints

- **Shared procedure with `finish-local`.** The snapshot/clear commit messages and the
  briefing restore behavior here are the same ones `finish-local` uses. Do not diverge on
  those shared strings.
- **Clear specs *before* the PR opens, inside this same PR.** Never leave `specs/` in the
  tree at PR-open time. Restore `briefing.md` to the base branch's exact pre-delivery state:
  byte-for-byte content when it existed, or absence when it did not. Never substitute the
  current delivery briefing or a generic placeholder. There is **no** separate post-merge
  cleanup PR.
- **Open as a draft; never resolve threads yourself.** Open with `--draft`, request
  reviewers only with logins the user named (never invent them), and leave "Resolve
  conversation" to a human on every thread — this skill (and `address-pr-review`) only
  fixes/replies. Only flip Draft → Ready (`gh pr ready`) once every comment is addressed,
  every affected thread is **manually** resolved on GitHub, and required checks are green.
- **Link by commit permalink, never the branch.** The specs are gone from the branch HEAD
  after Step 3, so the PR body must permalink `<specs-sha>`, not the branch.
- **Merge commit only — spec history depends on it.** The PRD/spec snapshot survives only
  as commits on the delivery branch; after merge they stay reachable **only if the PR is
  merged with a merge commit preserving their original SHAs. Rebase-merge rewrites those
  SHAs; squash drops the commits. Both invalidate the PR-body permalinks. Tell the
  reviewer/merger to use **Create a merge commit**, never rebase or squash, and require a
  repo ruleset/branch-protection setting that keeps merge commits available.
- **Idempotent.** Never open a second PR for a branch that already has one.
- **Open, don't merge.** Opening the PR is this skill's terminal action.
- **Auth first.** A failed `gh auth` must stop the skill before it snapshots or clears
  anything — never leave the branch half-shipped.
