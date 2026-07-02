<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **mcp-adapter** (2995 symbols, 6394 relationships, 261 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/mcp-adapter/context` | Codebase overview, check index freshness |
| `gitnexus://repo/mcp-adapter/clusters` | All functional areas |
| `gitnexus://repo/mcp-adapter/processes` | All execution flows |
| `gitnexus://repo/mcp-adapter/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

## Branch Policy (HARD RULE)

> **绝对不允许直接提交到main分支** (2026-07-02, enforced by `.githooks/pre-push`
> and `.github/workflows/no-direct-main-push.yml`)

Every change — including upstream-merge commits, hotfixes, follow-ups, and
documentation edits — MUST go through a pull request. There are NO exceptions
for trivial edits, single-line fixes, or "I'm the only owner" scenarios.

### Standard PR workflow

1. **Branch from `main`**: `git checkout main && git checkout -b <type>/<name>`
   - Types: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `upstream-merge/`
   - For upstream-merge: `upstream-merge/<version>` (e.g., `upstream-merge/v2.10.0`)
2. **Push the branch**: `git push -u origin <branch>`
3. **Open a PR**: `gh pr create --base main --head <branch>` (or use the
   GitHub web UI if `gh` is unavailable)
4. **Wait for CI**: `gh pr checks --watch`. The `pr-divergence-check` workflow
   MUST be green for upstream-merge PRs.
5. **Merge the PR**: `gh pr merge --squash --delete-branch` (or `--merge` for
   fast-forward cases)
6. **Verify**: `git fetch origin && git log --oneline origin/main -5`

### Why this rule exists

- **pre-push hook** (`.githooks/pre-push`) blocks `git push origin main` — this
  is a hard client-side safety net for force-push mistakes and lost commits
- **no-direct-main-push CI** (`.github/workflows/no-direct-main-push.yml`)
  detects any direct push that bypasses the hook (e.g., via `--no-verify`)
  and reports it as advisory
- **pr-divergence-check CI** runs `npm run upstream:check` on every PR, catching
  registry drift between PR open and merge

### Emergency bypass

`git push --no-verify origin main` — only for repo-owner emergencies (data
loss recovery, repo migration). The `no-direct-main-push` CI will report this
as an advisory warning. Document the reason in the merge commit body.

### Cross-references

- `.githooks/pre-push` — the actual hook script
- `.github/workflows/no-direct-main-push.yml` — the CI detection
- `skills/upstream-merge/SKILL.md §1` — Step 0 (feature branch creation) and
  the "Anti-pattern: commit directly to main" note
- `skills/upstream-merge/SKILL.md §5.5` — the full PR sub-flow for upstream-merge
