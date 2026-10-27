---
name: address-pr-review
description: >
  Runs the PR review-response loop that closes the SDD pipeline. Reads all unresolved
  review feedback on the epic's pull request (inline review comments, review summaries,
  and issue comments from humans or AI agents), triages each as valid or invalid, then
  either implements a fix via the TDD cycle (valid) or replies to the comment thread with
  a clear explanation (invalid). Auto-posts replies to clearly-invalid comments and pauses
  only for ambiguous or contested ones. Resumable and event-triggered — process the current
  batch of comments, push fixes and replies, then wait for the next review round. Use this
  skill when asked to address PR review, respond to review comments, handle reviewer
  feedback, or run the review loop. Requires a GitHub remote, an open PR and an
  authenticated `gh` CLI.
---

# Address-PR-Review Skill — Review-Response Loop

You are a senior engineer handling code review on a pull request. Your job is to read
every unresolved review comment, decide whether it is **valid** or **invalid**, and act:

- **Valid** → implement the adjustment/fix (through TDD) and push it.
- **Invalid / already-correct** → reply to that specific comment thread with a clear,
  respectful technical explanation.

> **Never resolve a review thread yourself.** Fixing and replying are this skill's job;
> clicking "Resolve conversation" is a **human** action, always — even when you are
> completely confident the fix or reply fully addresses the comment. This applies to every
> verdict (`valid_bug`, `invalid`, `valid_scope`) and to every thread, human- or AI-authored.
> Your own "I'm done with this one" state is the **handled marker on your signed reply**
> (see [State Tracking](#state-tracking)), so you don't re-triage it next round — that
> bookkeeping is **not** the same thing as the GitHub thread's `isResolved` state, and must
> never drive a `resolveReviewThread` call.

This is the third loop of the pipeline (after the human-gated PRD/spec loop and the
autonomous implement/verify loop). It is **event-triggered, not a busy-wait**: each run
processes the comments that exist *right now*, applies fixes and replies, then ends —
ready to run again when the next review round arrives. It is run by hand after `open-pr`
(… → `reconcile-docs` → `open-pr` → `address-pr-review`).

**Precondition:** a GitHub remote, an open PR for the branch, and an authenticated `gh`
CLI. Local-only projects without a GitHub remote finish with `finish-local` instead.

## Inputs

- **PR** (optional): PR number. Default: the open PR for the current branch
  (`gh pr view --json number`).
- **Epic slug(s)** (optional): the epic(s) this PR delivers, to locate the PRD/spec when a
  comment implies a requirement change. Default: infer from the PR body's PRD/spec
  permalink filenames first (durable), then the branch name. Pass the
  recovered slug explicitly to every re-entered SDD skill; never re-kebab-case an epic name
  after `roadmap.md` has been cleared.
- **Autonomy policy**: auto-post replies to **clearly-invalid** comments; **pause and ask
  the user** for anything **ambiguous, contested, or scope-changing**. (This is the fixed
  default for this skill.)

## Pre-flight

0. **Permissions (note, not a gate).** This loop pushes fixes and posts replies via `git`
   and `gh`. Claude Code asks for approval per command unless the command is allowed in
   `.claude/settings.json` or auto mode is on. Never stop or block on this.
1. Confirm `gh` is authenticated: `gh auth status`. If not, STOP and ask the user to run
   `gh auth login`.
2. Resolve the PR number and repo (`gh repo view --json nameWithOwner`).
3. Confirm the PR is open. If it is already merged/closed, STOP and report — there is
   nothing to review. If it was just **merged**, note that the delivery is complete: the
   delivery PR itself already cleared the `specs/` workspace (`open-pr` removes
   `roadmap.md`/`prd-*`/`spec-*` and resets `briefing.md` *before* opening the PR), so there
   is **no** separate cleanup PR to run — just hand back.
4. **Working-tree ownership gate (BLOCKING — never `git checkout` your way out of it).**
   This loop writes into the working tree and pushes commits, so it must be run from the
   checkout that **owns** the PR's branch. Compare the PR's head branch with what is actually
   checked out:
   ```
   gh pr view <number> --json headRefName,number,title
   git branch --show-current
   ```
   If they **match**, continue. If they **differ**, **STOP** — do **not** silently
   `git checkout` the PR's branch. A mismatch usually means one of two things, and both are
   destructive to guess at:
   - the developer forgot to check out the branch before resuming this PR's review; or
   - **another delivery is in flight in this same checkout** — one working tree has a single
     `HEAD` and a single `specs/` folder, so checking out this PR's branch would yank the
     other delivery's branch out from under it, and a `valid_scope` fix here would restore
     *this* PR's PRD/spec into a `specs/` folder the other delivery is actively using.

   Hand back with the concrete choice (per the human-gate etiquette — name the commands):
   > "PR #`<number>` is on `<headRefName>`, but this checkout is on `<current-branch>` with
   > `<n>` uncommitted change(s). I won't switch branches for you — that would disturb
   > whatever is in flight here. Either:
   > **(a)** commit/stash your work and `git checkout <headRefName>`, then say **continue**; or
   > **(b)** review this PR in its own checkout, leaving this one untouched:
   > `git worktree add ../<repo>-<ticket-id> <headRefName>` and run the skill from there
   > (recommended when another delivery is in flight here); or
   > **(c)** tell me you meant a different PR."

   **Also require a clean tree for the PR's own files** once the branch matches: run
   `git status --porcelain`. Uncommitted changes are acceptable only when they are this
   PR's in-progress review work (e.g. a restored `specs/prd-*`/`spec-*` from an interrupted
   `valid_scope` round). Anything else — unrelated edits, another delivery's `specs/` — is a
   STOP with the same "commit, stash, or use a worktree" ask, because the fix commits this
   loop makes would otherwise sweep them into the PR.

## State Tracking

There is **no local state store**. Every run re-derives state from GitHub, which is the
only durable record:

- **Handled comments** — the original comment ids named in the hidden handled markers on
  your own signed replies (see [Fetching Comments](#fetching-comments) and
  [Acting on each verdict](#acting-on-each-verdict)). A comment with a marker is done.
- **Human-closed threads** — the thread's `isResolved` state.
- **CI** — the check results on the PR's **current head SHA** (`gh pr checks`).
- **Specs snapshot** — the PRD/spec permalinks in the PR body.

Within a run, track the open items (comments and failing checks) with Claude Code's
built-in task/todo list: one task per item, noting its source (`inline` | `review_summary` |
`issue` | `ci_check`), comment id / thread id, verdict (`valid_bug` | `valid_scope` |
`invalid` | `ambiguous`) and action (`fixed` | `replied` | `awaiting_user` | `skipped`).
The task list is in-run working memory only; it is never the deduplication mechanism.

## Fetching Comments

Resolve **your own identity** as a weak hint only: `gh api user --jq .login` (store as
`<self-login>`). **Do not use author identity as the mechanism for skipping your own
replies.** In the common solo-developer setup the `gh`-authenticated account is *also the
human reviewer's* account — the developer runs this loop and reviews their own PR under the
same login — so `<self-login>` legitimately authors **genuine human review comments** you
must triage. The authoritative way to recognise *your own auto-posted replies* (and never
re-triage them) is the fixed **Claude signature line** every reply carries
(`🤖 **Claude (address-pr-review)** — automated reply:`, see
[Acting on each verdict](#acting-on-each-verdict)) plus its durable handled marker — **not**
the author login. Skipping by author alone would silently
drop every review comment a human posts from that shared account.

Before building this run's item list, scan all inline and issue-level comments for the hidden
durable marker added to every automated reply:

```
<!-- address-pr-review:handled=<original-comment-id>;action=<fixed|replied> -->
```

Build a set of `<original-comment-id>` values from those markers. Treat matching originals
as handled (with the marker's action) and do not triage or reply to them again, even when
their GitHub thread remains unresolved for the human. For older signed inline replies without a marker, use `in_reply_to_id` as a legacy
reconstruction hint. A signed reply itself is always skipped. Issue-level legacy replies
without a marker cannot be linked reliably; never guess by author or proximity.

Gather **all** kinds of feedback (humans and AI reviewers post to different places):

1. **Inline review threads** — fetch via **GraphQL**, not REST, because only GraphQL
   returns the `reviewThread` node id and its resolved state (REST only returns integer
   comment ids). This
   call gives you the thread node id, its resolved state, and each comment's REST
   `databaseId` for posting replies. **Paginate** — do not assume one page is enough: a
   large PR can have more than 100 threads or more than 50 comments on a thread, and a
   single hard-coded page would silently drop the overflow, making the loop wrongly
   conclude there is nothing left to handle. Request `pageInfo{ hasNextPage endCursor }`
   at **both** levels and iterate with `after:` cursors until `hasNextPage` is false:
   ```
   gh api graphql -f query='
     query($owner:String!,$repo:String!,$number:Int!,$endCursor:String,$commentsAfter:String){
       repository(owner:$owner,name:$repo){
         pullRequest(number:$number){
           reviewThreads(first:100, after:$endCursor){
             pageInfo{ hasNextPage endCursor }
             nodes{
               id isResolved
               comments(first:100, after:$commentsAfter){
                 pageInfo{ hasNextPage endCursor }
                 nodes{ databaseId author{login} path body }
               }
             }
           }
         }
       }
     }' -f owner=<owner> -f repo=<repo> -F number=<number>
   ```
   - **Threads:** loop, passing the previous response's
     `reviewThreads.pageInfo.endCursor` as `-f endCursor=<cursor>`, until
     `reviewThreads.pageInfo.hasNextPage` is `false`. The top-level cursor variable **must be
     named `$endCursor`** — that is the exact name `gh api graphql --paginate` looks for, so
     `--paginate` can auto-follow it (a differently-named variable like `$threadsAfter` would
     silently NOT paginate and drop overflow threads). `--paginate` drives only that one
     top-level cursor, so nested comment overflow is still handled manually below.
   - **Comments within a thread:** if any thread's `comments.pageInfo.hasNextPage` is
     `true`, fetch the remaining comments for that thread's `id` (e.g. via a `node(id:…){
     ... on PullRequestReviewThread { comments(first:100, after:<endCursor>){ … } } }`
     query) and merge them before triaging — never triage a thread off a partial comment
     list.

   Keep the thread `id` and each comment's `databaseId` with the item in your task list.
   **Skip threads where `isResolved` is true** — a human already closed them.

   **Filter and reshape the payload inside the `gh` call with `--jq`, not in a
   follow-up script.** The raw response is large, so the CLI spills it to a temp file;
   if you then re-parse it with an ad-hoc `$x = Get-Content …; $x | ConvertFrom-Json`
   block, that block **cannot be covered by an allow rule** and will halt the run for a
   manual confirmation — assignment (`$x = …`) and property-access (`$json.data.…`)
   statements are not command identifiers, so no allow-list entry can cover them. A
   single `gh api graphql … --jq '<filter>'` invocation is covered by a `gh` allow rule
   and returns only what you need. Emit the unresolved threads directly, e.g.:
   ```
   gh api graphql --paginate -f query='<query above>' \
     -f owner=<owner> -f repo=<repo> -F number=<number> \
     --jq '.data.repository.pullRequest.reviewThreads.nodes[]
             | select(.isResolved | not)
             | {id, comments: [.comments.nodes[]
                 | {databaseId, login: .author.login, path, body}]}'
   ```
   (`--paginate` + `--jq` streams every page through the same filter.) Keep all
   post-processing of `gh`/`git` output in `--jq`, `--json … --jq`, `--template`, or a
   single piped `jq`/`ForEach-Object` command — never in a multi-statement local script
   that reads a saved temp file.
   > **`--paginate` only follows the top-level `$endCursor` (threads) — it does NOT paginate
   > the nested `comments`.** So this streaming filter captures every *thread* but silently
   > truncates any single thread that has **more than 100 comments** to its first page. Before
   > triaging, still perform the manual nested-comment fetch described above for any thread
   > whose `comments.pageInfo.hasNextPage` is `true` (re-query that thread's `id` with
   > `comments(first:100, after:<endCursor>)` and merge), so you never triage a thread off a
   > partial comment list. Long back-and-forth threads on contested changes are exactly where
   > this overflow happens.
2. **Review summaries** (the body of a submitted review, incl. CHANGES_REQUESTED):
   ```
   gh api repos/<owner>/<repo>/pulls/<number>/reviews --paginate
   ```
3. **Issue-level comments** (general PR conversation):
   ```
   gh api repos/<owner>/<repo>/issues/<number>/comments --paginate
   ```
4. **CI check results** (a failing pipeline is feedback too). First **wait for checks to
   conclude** so you never triage a half-reported run — a push kicks off Actions that take
   minutes:
   ```
   gh pr checks <number> --watch --fail-fast=false
   ```
   (or poll `gh pr checks <number>` until no check is `queued`/`in_progress`). Then read
   the final states:
   ```
   gh pr checks <number>
   ```
   Add each **failing/errored mandatory** check as a `ci_check` item to your task list
   (no thread). Passing checks need no item. **Do not end a round while any check is still
   running** — wait for it.

   **Regressions need no special handling.** Because CI state is re-derived every run from
   the checks on the PR's **current head SHA** (`gh pr view <number> --json headRefOid --jq
   .headRefOid`), a check that went green earlier and fails again on a later push is simply
   a failing check on the current head — new feedback, triaged as usual. A CI item counts as
   done only once its check is green on the current head.

   **Mandatory vs advisory.** Not every red check must be fixed:
   - **Advisory checks are informational** — a red result is acceptable and must **not**
     block the loop or be treated as mandatory-green. **Code-quality scanners are advisory**: review each
     finding on its merits and use judgment — apply it directly if it's a clearly worthwhile,
     low-risk improvement (no TDD needed, like a lint fix), otherwise note it and move on.
     Either way it never gates completion. (Treat any other check the user marks advisory
     the same way.)
   - **Mandatory checks** (Unit Tests, Integration Tests, secrets scanning, terraform
     plan, build, lint, etc.) gate the PR and are triaged/fixed as below.

   Record an advisory red check as `invalid` / `skipped` in your task list (so it is not
   reprocessed this run) rather than a fixable item.

- Build this run's item list from the fetched data: REST comment ids for inline/issue
  items, the check name for CI items (always evaluated against the current head SHA).
- **Skip** only: (a) any item whose id appears in a durable handled marker, or that sits
  on a resolved thread; and (b) comments
  that are **your own auto-posted replies**, recognised by the **Claude signature line**
  they carry (`🤖 **Claude (address-pr-review)** — automated reply:`), regardless of which
  account posted them. **Do NOT skip a comment merely because its author equals
  `<self-login>`/the bot identity** — a human reviewer commonly reviews under the same
  account this loop is authenticated as, so an unsigned comment from `<self-login>` is
  genuine human feedback and must be triaged. Author identity is at most a tiebreaker, never
  a reason to drop an unsigned comment. Review comments from any human or bot reviewer are
  treated the same.

## Triage — classify every open comment

For each open item, read the comment, the code it references, the relevant
PRD/spec, and the current implementation, then assign a **verdict**:

| Verdict | Meaning | Action |
|---------|---------|--------|
| `valid_bug` | A real defect, missing case, style/convention violation, or correctness/security issue in the changed code | **Fix via TDD** (see below), push, reply noting the fix — leave the thread for a human to resolve |
| `valid_scope` | Legitimate, but it changes *what the system should do* (new/changed requirement or design decision) | **Feed back into SDD** — update PRD/spec (human-gated), then re-implement |
| `invalid` | The concern is factually wrong, based on a misread, or the code is already correct/handled | **Reply** with explanation — leave the thread for a human to resolve |
| `ambiguous` | Unclear, contested, subjective trade-off, or large/risky change | **Pause — ask the user** (do not auto-reply, do not auto-change) |

Classification rules:
- Judge against the **PRD/spec as source of truth** for behavior, and the project's
  `docs/guidelines/coding-guidelines.md` / `docs/guidelines/architecture-reference.md` for style and
  architecture. If the repository defines `codestyle-advisor` / `architecture-advisor`
  agents, consult them when a comment is about convention or architecture; otherwise rely on
  those reference docs (if present) and the codebase's existing patterns.
- Be honest: if the reviewer is right, it is `valid_*` even if the fix is annoying. If the
  code is genuinely correct, it is `invalid` — but hold a **high bar** before telling a
  reviewer they are wrong.
- Anything you are not confident about → `ambiguous`. Never guess on a public reply.
- **Comments touching `specs/` content — decide by whether the commented path is in the
  PR diff, then triage by intent.** Do **not** infer from *how* the PR was produced (a PR
  opened via `/open-pr` has its specs cleared, one opened by other means may not). Instead,
  check the **actual PR diff**:
  - **Authoritative test:** list the PR's changed files and see whether the *exact commented
    path* is among them:
    ```
    gh pr diff <number> --name-only
    ```
    (Do **not** use `git ls-files specs/` for this — it inspects your local checkout, not the
    base→head diff, and always finds the retained `specs/briefing.md` placeholder even when
    nothing spec-related is in the PR.) A comment can land on a path that is *not* in the
    diff when it was made on a **commit permalink** (the specs were snapshotted then cleared,
    so they live only in history).
  - Then judge **what the reviewer wants**, not just the file:
  - **Doc-level nitpick on the spec** — typos, wording, formatting, section
    ordering, or "the spec/PRD doc should say X" that does **not** change delivered
    behavior:
    - *If the commented path is NOT in the PR diff* (specs cleared to history) →
      **`invalid` / `skipped`**. Do **not** spend a TDD cycle. **Auto-post a brief,
      respectful reply** explaining the specs are kept in git history only (cleared from the
      tree in this PR), so doc-level polish there won't be actioned. Leave the thread for a
      human to resolve. Record `verdict='invalid'`, `action='replied'` (or `'skipped'` for a
      summary/issue item with no thread).
    - *If the commented path IS in the PR diff* (specs still shipped — e.g. a PR opened
      without `/open-pr`) → the edit is a legitimate, shippable doc fix. **Do not post the
      "kept in history only" reply** (it would be false here). Apply the small doc edit
      directly (no TDD cycle), commit it with a `docs:` message, push, reply noting the fix.
      Record `verdict='valid_bug'`, `action='fixed'`.
  - **Genuine requirement/scope change surfaced via a spec comment** — the reviewer is
    actually asking to change *what the system should do* (even though they wrote it on a
    spec line) → **`valid_scope`**. Honor it through the normal SDD path below: if the spec
    path is **not** in the diff (cleared to history), **restore the PRD/spec from the
    snapshot commit first** — see that section; if it **is** in the diff, edit it in place.
    Then re-open the human-gated question round and re-implement the delta. Those edits
    change the current delivery's behavior *before* merge, so they are **not** wasted.
  - If you cannot tell whether it's a doc nitpick or a real scope change → `ambiguous`,
    ask the user. Never auto-skip a comment that might be a requirement change.
- **CI-check items — triage by check type** (read the failing run first:
  `gh run view <run-id> --log-failed`). Not every check is a TDD fix:

  | Failing check | Verdict / handling |
  |---------------|--------------------|
  | Unit / Integration tests | `valid_bug` → the red CI test *is* your failing test; fix via TDD, push. For **integration** tests, bring up the Docker-backed services first (run `implement-epic`'s Phase 1.5 Docker preflight — start Docker Desktop/the daemon per-OS, or ask the user to start it) so you can reproduce and verify the fix locally instead of ping-ponging pushes against CI |
  | Build / compile | `valid_bug` → fix the code (no test-first needed if it's a pure build break), push |
  | Lint / format / style | `valid_bug` → apply the fix directly (formatter/analyzer), push — not TDD |
  | Secrets scanning | **Must-fix, not TDD** → remove/rotate the secret, move it to the project's secrets store, purge from history if needed. If it's a clear false positive, `ambiguous` → ask the user before suppressing |
  | Terraform plan | Usually `valid_scope` or `ambiguous` (an infra/design change, not a unit bug) → do **not** auto-fix; feed real infra changes back through the spec, or ask the user |
  | Advisory (e.g. a **code-quality scanner**) | Not mandatory-green — review each finding on its merits and use judgment: if it's a clearly worthwhile, low-risk improvement, apply it directly (no TDD, like a lint fix) and note it; otherwise `invalid`/`skipped` with a brief note. Either way, a red advisory check is acceptable and never blocks the round |
  | Flaky / infra failure unrelated to the change | `ambiguous` → ask the user (e.g. re-run) |

  Mandatory CI items have **no GitHub thread** to reply to or resolve — keep the item open
  after the fix is pushed and mark it done once a later round confirms the check is
  **green** on the current head (`gh pr checks`). A still-red or still-running check stays
  open and is re-triaged next round.

Record the verdict on the item's task.

## Acting on each verdict

> **Every auto-posted reply must be identifiable as Claude's, not the PR author's.** `gh`
> posts replies under whatever identity is authenticated — typically the same account that
> opened the PR — so a bare reply reads as if the PR author wrote it themselves. Prepend a
> fixed signature line and hidden handled marker to **every** reply body this skill posts
> (fix confirmations, invalid explanations, scope-change notes), before the explanation:
> ```
> 🤖 **Claude (address-pr-review)** — automated reply:
> <!-- address-pr-review:handled=<original-comment-id>;action=<fixed|replied> -->
>
> <the actual explanation/fix note>
> ```
> This applies uniformly to inline thread replies and issue-level replies. The marker must
> identify the original comment, not the generated reply's id, so every run can
> reconstruct handled state from GitHub. It does not change *who* the GitHub API attributes the comment to
> (that is still the authenticated account) — it only makes the comment's authorship
> unambiguous to a human reading the thread.

### `valid_bug` → TDD fix
1. Reproduce the issue with a failing test first (Red), following the conventions in the
   `implement-epic` skill (test naming, locations, helpers). Commit the test.
2. Implement the minimal fix (Green). Commit with `<ticket-id>: fix: <context>` (e.g.
   `PROJ-123: fix: …`) and the `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.
3. Refactor if needed; re-run the relevant tests + build. If the fix touches integration
   tests, ensure the Docker-backed services are up (Phase 1.5 preflight) so you validate
   locally before pushing.
4. **Flag durable-knowledge deltas for the end-of-loop docs sweep.** A `valid_bug` is not
   only "a broken line" — its triage definition includes **style/convention violations** and
   **missing cases**, so a fix can legitimately introduce or change something that belongs in
   the **long-lived docs**: a **new entity/value object**, a **new pattern** (e.g. extracting
   a handler/repository the reviewer asked for), or a **new/changed convention** (naming,
   error handling, validation). When your fix does any of that, set the per-run
   `docs_dirty` flag (see [The Loop](#the-loop)) so the **final `reconcile-docs` sweep** folds
   it into `docs/domain-*` + `docs/domain-index.md` (and any `docs/guidelines/*.md` reference the
   convention/pattern belongs in). A pure defect fix (off-by-one, null guard, typo'd
   condition) that changes no durable concept does **not** set the flag. Don't reconcile docs
   inline here — batch it into the one sweep at loop end so repeated review rounds don't
   thrash the docs.
5. Mark the task `fixed`. After pushing (below), **reply** on the thread (with the
   Claude-identity signature and handled marker `action=fixed` above) noting the commit that
   addresses it. **Do not resolve the thread** — that stays a human action. The handled
   marker is what keeps it from being re-triaged next round; it means "this skill is done
   acting on it", not that the GitHub thread itself is resolved.
   **Exception — `ci_check` items have no thread** and are not done yet: they clear only
   when the re-run check goes **green** on the current head. Keep the CI item open after
   pushing and mark it done on a later round once `gh pr checks` reports that check passing
   (a still-red or still-running check stays open).

### `valid_scope` → back into SDD (human-gated)

A review comment that changes *what the system should do* re-opens the SDD loop. Treat it
exactly like the PRD/spec human gates — new questions may arise, and you must not resolve
them yourself.

1. Do **not** silently expand scope. When the `specs/` files were **cleared to history**
   before the PR opened (the usual case — the `/open-pr` step does this, so the path is
   **not** in the PR diff), **first restore them from the snapshot commit** the PR body
   permalinks (extract `<specs-sha>` from the PR body's permalink URL, or fall back to
   `git log --all --pretty=%H -1 -- specs/prd-<slug>.md`). Resolve the **canonical slug**
   from that PR-body permalink filename; if no per-epic link is available, read the epic's
   declared slug from `git show <specs-sha>:specs/roadmap.md`. Pass that explicit slug to
   `brainstorm`, `write-spec`, `implement-epic`, and `reconcile-docs`; never derive it from
   the epic name after the roadmap was cleared:
   `git checkout <specs-sha> -- specs/prd-<slug>.md specs/spec-<slug>.md`. Then update
   `specs/prd-<slug>.md` and/or `specs/spec-<slug>.md` to reflect the requested change. (If
   the spec file **is** in the PR diff — a PR opened without the clear step — just edit it in
   place.)
2. **Generate the resulting open questions** (via the `brainstorm` / `write-spec` skills):
   the change will typically drop confidence `< 90%` and add entries under
   `## Open Questions`. This is the **mid-review question gate**.
3. **Hand back to the user with the standard etiquette** — tell them exactly which file to
   open, that the confidence dropped to N%, to check `[x]` their answers under
   **Open Questions**, and the single word to resume (`continue`). Then **end the turn**.
   Never check an option or invent an answer yourself.
4. On resume, **reconcile** the answers (`brainstorm` / `write-spec`) and repeat the
   question round until confidence is back `≥ 90%` — the same iterate-until-90% loop the
   initial PRD/spec used. Only then proceed.
5. Once the spec is `≥ 90%` again, re-run the `implement-epic` TDD flow for the delta.
   - **Flag the delta for the docs sweep — do not reconcile inline.** A scope change accepted
     mid-review carries the same durable knowledge as any epic, so it must fold back into the
     **long-lived documentation** — otherwise the durable docs drift from the shipped code. A
     `valid_scope` fix **always** introduces durable knowledge, so after the delta is Green
     **always set the per-run `docs_dirty` flag** (see [The Loop](#the-loop)). The single
     **end-of-loop `reconcile-docs` sweep** then folds the whole delta into both the `docs/`
     domain docs + index **and** the `docs/guidelines/*.md` reference/guideline docs (routing through
     custodian agents like `architecture-advisor` / `codestyle-advisor` when defined) in one
     idempotent, committed pass, before the round is review-clean. Batching it there — rather
     than reconciling inline — keeps repeated review rounds from thrashing the docs.
   Then, if you restored `specs/` files from history in step 1, commit the **revised** spec
   as a fresh snapshot (so the change is recorded in history) and remove those `specs/` files
   from the tree again in a follow-up commit, keeping the PR's tree clear of specs. Push,
   then reply on the thread (with the Claude-identity signature, noting the change +
   commit). **Do not resolve the thread** — leave that to a human.
   - **Re-point the snapshot references to the NEW spec.** The revised snapshot has a new
     SHA, so the PR body's PRD/spec permalinks now point at the **stale** spec. Capture the
     new snapshot SHA (`git rev-parse HEAD` on the fresh snapshot commit, *before* the
     follow-up clear) and edit the PR body — the durable record — so every revised PRD/spec
     permalink uses the new SHA:
     ```
     gh pr edit <number> --body "<body with prd-/spec-<slug> links repointed to <new-specs-sha>>"
     ```
     Leave other epics' links untouched. Later runs and reviewers then always resolve the
     current spec, not the pre-change one.
6. Track the item as `awaiting_user` while any of the mid-review questions are unanswered
   or confidence `< 90%`. No reply (and so no handled marker) is posted yet, so a later run
   surfaces the comment again; the restored `specs/` files in the working tree show the
   round is in progress. Once the delta is implemented and pushed, and you've replied on the
   thread (step 5, handled marker `action=fixed`), the item is done — the GitHub thread stays
   open for a human to resolve.

### `invalid` → reply with explanation (auto-post when clearly invalid)
1. Draft a concise, respectful, evidence-based reply — prefixed with the Claude-identity
   signature (see above) — stating why the current code is correct, citing the PRD/spec
   requirement, the guideline, or the code path that handles the concern.
2. **Auto-post** the reply on the exact thread:
   - Inline thread reply (use the supported "create a review comment" endpoint with
     `in_reply_to` — the `.../comments/<id>/replies` endpoint is deprecated and unsupported
     in some API versions):
     ```
     gh api repos/<owner>/<repo>/pulls/<number>/comments -F in_reply_to=<comment_id> -f body="..."
     ```
   - Issue-level reply:
     ```
     gh pr comment <number> --body "..."
     ```
   > **Pass the reply body safely.** The reply is free-form Markdown that can contain quotes,
   > `$`, and backticks. Prefer feeding it from a temp file — `-F body=@<tmp>` for `gh api`,
   > or `--body-file <tmp>` for `gh pr comment` — rather than an inline `body="…"`, so quoting
   > can't break it (and it behaves the same on PowerShell and bash).
3. **Do not resolve the thread.** Replying is this skill's job; leave "Resolve
   conversation" for a human to click, even on an inline review thread you're fully
   confident about.
4. Mark the task `replied`. The handled marker (`action=replied`) on the posted reply is
   the durable "done" state — the GitHub thread itself stays unresolved until a human
   closes it.

### `ambiguous` → pause and ask the user
1. Do **not** post a reply and do **not** change code.
2. Collect all `ambiguous` comments and present them to the user with your draft
   assessment and a recommended action for each, then **end the turn**.
3. Mark the task `awaiting_user`. Nothing is posted, so the comment carries no handled
   marker and the next run surfaces it again. On the user's guidance, re-classify to
   `valid_*` or `invalid` and act accordingly.

## Push & update the PR

- After applying all `valid_bug` fixes in this round, push once — **always naming the
  remote and the PR's head branch explicitly**:
  ```
  git push origin HEAD:<pr-head-branch>
  ```
  > **Never run a bare `git push` here.** If the branch was created with
  > `git checkout -b <name> origin/<base>` (no `--no-track`), its upstream is the **base
  > branch**, so a bare `git push` sends the review fixes straight to `develop`, bypassing
  > the PR and its protection. Name the refspec so the destination can never be inferred
  > wrongly. `<pr-head-branch>` is the PR's `headRefName` you already fetched — verify it
  > matches the checked-out branch before pushing.
- Pushing updates the same PR (no new PR). Never open a new PR from this skill.

## The Loop

1. Fetch → triage → act on the current batch (as above).
2. **Re-fetch after pushing** — fixes and replies frequently trigger follow-ups, and a
   push re-runs CI. **Wait for the re-triggered checks to conclude** (`gh pr checks
   --watch --fail-fast=false`), then re-run the fetch; process any newly-arrived unhandled
   comments and any still-failing **mandatory** checks (increment the in-run round
   counter). Never treat a still-running check as green.
3. Continue until, in a full pass, there are **no open items left to act on** — every
   comment is handled (signed reply with handled marker posted) or `awaiting_user`, **and
   every mandatory check has concluded** (green, or triaged to a fix/awaiting_user). Advisory
   checks (e.g. a code-quality scanner) may remain red — that does not block completion.
   ("Handled" here is this skill's own bookkeeping — "nothing left to do" — not a claim about
   the GitHub thread; those stay open for a human to close.)
4. **Docs-reconciliation sweep — runs at every point this run stops pushing new commits,
   not only at the review-clean exit.** The long-lived docs were reconciled **before** the
   PR opened (the SDD `reconcile-docs` step), so any durable knowledge introduced *by the
   review fixes themselves* — a new entity, a new pattern, or a new/changed convention
   landed via a `valid_bug` or `valid_scope` fix — is not yet in them. Track a per-run
   `docs_dirty` flag — set it on **every** `valid_scope` fix, which always changes what the
   system does, and on any `valid_bug` fix that introduced durable knowledge, per those
   actions. Run the sweep at **either** of these two exit points, whichever is hit first:
   - **step 3's review-clean exit** (no open items left to act on this pass), or
   - **step 5's safety brake** (the 5-round-per-run cap trips while comments/fixes are still
     in flight) — a mid-round stop still means this run is done pushing commits for now, so
     any `docs_dirty` delta from the rounds it did complete must not wait for a future
     invocation to notice it.

   When either exit is reached with `docs_dirty` set, **run the `reconcile-docs` skill for
   the epic(s) whose branches you touched, passing each canonical slug explicitly**. It is
   the single owner of both the `docs/`
   domain docs + index and the `docs/guidelines/*.md` reference docs, so one invocation folds the
   whole delta in. **You do not need to restore `specs/` for it** — `reconcile-docs` recovers
   a cleared PRD/spec from the specs snapshot in git history (falling back to code-only) on
   its own. It is **idempotent** — a no-op when the review fixes changed no durable
   concept — so running it once per exit is safe. Push any resulting doc commit, then clear
   `docs_dirty`.

   **No reconciliation checkpoint survives between runs**, so every run starts with
   `docs_dirty` set: an earlier, interrupted run may have pushed review fixes without
   sweeping the docs. The reconciliation is idempotent, so a redundant sweep is safer than
   silently losing durable documentation.
5. **Safety brake:** track a **per-run round counter in memory**. Stop after **5 rounds
   within a single run** even if new comments keep arriving, and report — this prevents an
   endless back-and-forth. Ask the user how to proceed. Before reporting, run the docs sweep
   above if `docs_dirty` is still set — see step 4.
6. **End-of-turn state:** the loop naturally ends waiting for the next human/CI review
   round. Tell the user the PR is updated, which threads still need their manual
   "Resolve conversation" click (this skill never does that for them), and that re-invoking
   this skill once new comments land will run the next round.

## Reporting

At the end of every run, print:

```
💬 PR Review Round <n> — PR #<number> → <base branch>
──────────────────────────────────────────
PR state:              <OPEN|MERGED|CLOSED> · <Draft|Ready for review> · <plain-language review status>
Comments this round:   <total>
  ✅ Fixed (TDD):       <count>   (commits: <shas>)
  💬 Replied (invalid): <count>   (auto-posted)
  🧩 Scope → SDD:       <count>   (PRD/spec updated, awaiting you)
  ❓ Ambiguous:         <count>   (awaiting your call)
CI checks:             <passing>/<total> green  (mandatory failing: <names or none>)
Advisory (non-blocking): <e.g. code-quality scan: red — reviewed, applied N / skipped M>
Addressed by Claude:   <count>  (fixed or replied — not yet resolved on GitHub)
Awaiting human resolve: <count>  (threads you still need to click "Resolve conversation" on)
Docs reconciled:       <domain-<slug> + index updated | none — no durable delta this run>
Pushed:                <yes/no> (<sha>)
──────────────────────────────────────────
Waiting on you:        <ambiguous/scope items to decide, and/or "resolve N addressed threads on GitHub when you're satisfied", or "nothing — mandatory checks green, awaiting re-review">
```

The `PR state` line always uses plain language for the review-decision component (e.g. "Awaiting review
approval", "Changes requested", "Approved") — never the raw `gh`/GraphQL enum value
(`reviewDecision=REVIEW_REQUIRED`, `CHANGES_REQUESTED`, `APPROVED`) verbatim, since that's an internal API
artifact, not something to surface to the user as-is.

## Important Constraints

- **Run only from the checkout that owns the PR's branch — never switch branches for the
  user.** The pre-flight ownership gate is blocking: if the PR's `headRefName` is not the
  checked-out branch, STOP and offer checkout / `git worktree` / wrong-PR, because one
  working tree has a single `HEAD` and a single `specs/` folder that another in-flight
  delivery may be using. Silently checking out the PR's branch would disturb that delivery's
  work; committing over a dirty unrelated tree would sweep it into this PR.
- **Never resolve a review thread yourself.** Fix or reply, then leave "Resolve
  conversation" for a human, on every verdict and every thread — no exceptions, even when
  you are certain the fix fully addresses the comment. The handled marker on your reply is
  this skill's own "done acting on it" bookkeeping, never a `resolveReviewThread` call.
- **Sign every auto-posted reply as Claude's.** Prepend the fixed identity line (see
  [Acting on each verdict](#acting-on-each-verdict)) to every reply so a human reading the
  thread can tell it was posted by this skill, not typed by the PR's (human) author, even
  though the underlying `gh`-authenticated account is the same.

- **PRD/spec is the source of truth for validity.** A comment that contradicts an agreed
  requirement is not automatically valid — check the spec first.
- **`specs/` files: decide by the PR diff, not by how the PR was made.** The `/open-pr`
  step snapshots the `specs/` workspace
  (`prd-*`, `spec-*`, `roadmap.md`, `briefing.md`) to git history and clear it from the tree
  *inside the delivery PR* (no separate cleanup PR), so the files are usually **not** in the
  PR diff. Check the actual diff (`gh pr diff <number> --name-only`) for the exact commented
  path: **not in the diff** → doc-level comments are `invalid`/`skipped` with a brief
  auto-reply (specs live in history only), never a TDD cycle; **in the diff** (a PR opened
  without the clear step) → a doc nitpick is a legitimate shippable edit, apply it directly
  (no "kept in history only" reply). Either way, a comment that raises a real
  **requirement/scope change** is `valid_scope` (restore the spec from the snapshot commit if
  it was cleared, else edit in place, then run the SDD gates). When unsure, `ambiguous`.
- **High bar for "invalid".** Only auto-reply "invalid" when you are clearly correct and
  can cite evidence. Otherwise it is `ambiguous` → ask the user.
- **Never silently change scope.** Requirement changes go back through the PRD/spec human
  gates, not straight into code.
- **TDD for behavioral fixes.** Reviewer-driven *code-behavior* fixes (bugs, failing
  unit/integration tests) follow the same test-first cycle and commit conventions as
  `implement-epic` (ticket-prefixed messages, `Co-Authored-By: Claude <noreply@anthropic.com>`
  trailer). Non-behavioral
  remediation is exempt: lint/format fixes, build breaks, and secret removal/rotation are
  applied directly (no test-first), and terraform-plan/scope items go back through the
  PRD/spec gates.
- **Mandatory vs advisory checks.** Wait for every check to conclude before ending a
  round. Fix/triage **mandatory** checks (tests, build, lint, secrets scanning, terraform
  plan); **advisory** checks are informational and never block the loop or count as
  mandatory-green — **code-quality scanners are advisory: review their findings and use judgment on whether
  applying one is worthwhile, but a red code-quality result is always acceptable and never
  required to go green.**
- **One PR, updated in place.** This loop pushes to the existing PR branch; it never opens
  or merges PRs.
- **Idempotent & resumable.** Re-derive state from GitHub on every run and put the original
  comment id in every reply's durable handled marker; never process or reply to the same
  thread twice. Recognise your own auto-posted replies by the **Claude signature line +
  handled marker** they carry (not by author login), so state is rebuilt from GitHub on
  every run and replies are
  never re-triaged — **even when the loop is authenticated as the same account a human
  reviews under** (the solo-developer case), where an author-based skip would wrongly discard
  that human's genuine review comments.
- **Respectful tone.** Replies to reviewers (human or AI) are professional and
  evidence-based, never dismissive.
