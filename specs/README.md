# Specs

SDD working folder — transient by design:

| File | Written by | Purpose |
| ---- | ---------- | ------- |
| `briefing.md` | you (by hand) | Entry point of a delivery: WHAT should be built |
| `roadmap.md` | `create-roadmap` | Epic breakdown, dependencies, build order |
| `prd-<epic-slug>.md` | `brainstorm` | Product requirements per epic (`F-*`, `FR-*`, `NFR-*`, `AC-*`) |
| `spec-<epic-slug>.md` | `write-spec` | Implementation-ready technical specification per epic |

When a delivery is finished, `finish-local` (local repository) or `open-pr` (GitHub)
snapshots these files into git history, removes roadmap/PRDs/specs from the working
tree and resets `briefing.md` to its placeholder state. Lasting knowledge lives in
`docs/` and `docs/guidelines/*.md`, maintained by `reconcile-docs`.
