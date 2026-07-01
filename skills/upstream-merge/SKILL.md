---
name: upstream-merge
description: >
  Fork-maintainer workflow for syncing https://github.com/nicobailon/pi-mcp-adapter
  into njuptlzf/mcp-adapter. Two-step git flow: merge `upstream/main` into the
  fork's `main` first (decision tree applies here), then propagate fork's
  `main` into the working branch — skipped if already on `main`. Reads
  `skills/upstream-merge/references/special-cases.md` for hand-curated special
  cases AND runs `scripts/upstream-divergence.ts` for live cross-check against
  `git diff upstream/main --name-status`; falls back to the 12-category per-file
  default-resolution matrix (inlined in §4.2) for files not in the registry.
  Applies ours/theirs/manual decisions per a 4-section decision tree. Triggers
  the 5-step follow-up issue flow when Pi-coupling is re-introduced. Use when
  user says "merge upstream", "sync fork", "upstream conflict",
  "resolve upstream merge", or "/upstream-merge".
---

# Upstream Merge (fork-maintainer)

Drives the `njuptlzf/mcp-adapter` fork through a deterministic merge of
upstream `nicobailon/pi-mcp-adapter` changes. The flow has two layers:

- **§1 Two-step git branch flow** — the order of merges across branches.
  Read this first to know where the decision tree runs.
- **§2–§5 Per-file decision tree** — invoked within Step 1 of the branch
  flow. Look up the file, apply the decision, verify.

## 1. Two-step git merge flow

The fork has two long-lived branches that the upstream merge must handle
separately:

| Branch | Role | Notes |
|---|---|---|
| `main` (fork's main) | **Upstream change buffer** | The decision tree in §4 runs here. Long-lived but rarely committed to directly. |
| `<working-branch>` (e.g., `v1.0`) | Active fork development | Long-diverged from `main` (e.g., 227 commits ahead in this fork). |

**The merge is a deterministic two-step process:**

1. **Switch to `main`** — `git checkout main`. All Step 1 work happens here.
2. **Fetch upstream** — `git fetch upstream` (GnuTLS workaround per the §2
   note if needed).
3. **Run pre-flight** — `npm run upstream:check` (§3) to see live divergence.
4. **Step 1: `upstream/main` → `main`** — `git merge upstream/main`. Resolve
   conflicts using the decision tree (§4). The merge commit lands on `main`.
5. **Step 2: `main` → `<working-branch>`** — `git checkout <working-branch>
   && git merge main`. Generally a fast-forward or small diff because the
   working branch is already ahead of `main` with fork-specific work.
6. **Short-circuit** — if `<working-branch> == main`, skip step 5. The flow
   ends at Step 1.

**Anti-pattern (do not):** Running `git merge upstream/main` directly on
`<working-branch>`. This creates a large blast radius of conflicts between
the long-diverged working branch and upstream — the working branch has
hundreds of commits the upstream never saw. The two-step flow exists to
confine the conflict surface to the smaller `main` branch.

## 2. When to invoke

The decision tree (§4) is invoked within Step 1 of the two-step flow, at
any of three points:

- **(a) Pre-flight**, after `git fetch upstream` and before `git merge
  upstream/main`. Run `npm run upstream:check` (§3) to surface live
  divergence, then walk the per-file decision tree before any conflict
  appears.
- **(b) In-flight**, after `git pull upstream main` produces a merge
  conflict. Look up each conflicting file's `Default Resolution` in the
  manifest, and apply the decision (run the §4.1 grep for `assess` rows
  first).
- **(c) Targeted cherry-pick**, before `git cherry-pick <upstream-sha>`.
  Same flow as (b), scoped to the files touched by the cherry-picked
  commit.

After Step 1's merge commit lands and passes the §5 Checklist, run Step 2
(`git merge main` on the working branch) to propagate upstream changes.
If on `main` already, the flow ends at Step 1.

> **GnuTLS workaround:** If `git fetch upstream` fails with GnuTLS / SSL
> errors in this environment, use `GIT_SSL_NO_VERIFY=1 git -c
> http.sslVerify=false fetch upstream --tags` (verbatim from
> `08-LEARNINGS.md` L-4).

## 3. Read the special-cases registry and run the divergence check

Two inputs are required before any merge decision: (1) read `references/special-cases.md` for the 15-17 hand-curated cases (Phase 8 manifest footnotes + expansion), and (2) run `npm run upstream:check` to see live divergence against `upstream/main`. The script replaces the Phase 8 "manifest freshness" check: instead of comparing manifest row counts to `git diff` output, it classifies each diverged file as `registered` / `diverged-but-not-registered` / `stale` against the registry.

**How to look up a file in the registry:**

```bash
# By file path (quote the path with backticks to match the table cell)
grep -F '`init.ts`' skills/upstream-merge/references/special-cases.md

# By status (returns all rows in that bucket)
grep -E '^\| `.*` \| (fork-only|decoupled-wrapper|deleted-in-fork|sibling-config|framing-divergence)' skills/upstream-merge/references/special-cases.md
```

**Run the divergence check** (script replaces the Phase 8 `git diff ... | wc -l` + `grep -cE '^\| `'` sanity check):

```bash
# Default: ANSI color when stdout is a tty
npm run upstream:check

# Grep-friendly output (no escape sequences, suitable for piping / CI logs)
npx tsx scripts/upstream-divergence.ts --no-color
```

**Interpreting the script output:**

- **Exit 0** — no stale entries. The `diverged-but-not-registered` count is a warning (per D-34: treated as `assess` by the 12-category matrix in §4.2); proceed with the merge.
- **Exit 1** — stale entries present (registry lists a file that is no longer in `git diff upstream/main --name-status`). STOP and clean stale registry entries before merging.
- **Exit 2** — fatal: `git fetch upstream` failed AND the GnuTLS workaround also failed, OR the registry parse produced 0 entries. Investigate before proceeding (the GnuTLS workaround per L-4 is `GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream --tags`; the script retries with it automatically).

Files NOT in the registry are resolved by the 12-category per-file default-resolution matrix inlined in §4.2 below — no need to add them to the registry.

### 3.5 Conflict hunk independence check (NEW, v3.1)

Before resolving any conflict, classify each hunk's independence. This separates "easy wins" (different function in same file) from "needs agent judgment" (same function, same section):

```bash
# 列出所有 conflict hunk 所在函数
git diff --name-only --diff-filter=U | while read f; do
  awk '
    /^<<<<<<< / { hunk=1; start=NR; next }
    /^=======/ { hunk=0; sep=NR; next }
    /^>>>>>>> / { hunk=0; end=NR; next }
    hunk && match($0, /^(export )?(async )?function ([A-Za-z_][A-Za-z0-9_]*)/, m) { fn=m[2] }
    /^>>>>>>> / { print FILENAME ": hunk@" start "-" end " in function: " fn }
  ' "$f"
done
```

**Decision matrix** (4 categories, ordered from easiest to hardest):

| hunk 独立性 | 解决策略 | 自动化程度 |
|------------|---------|----------|
| 同文件 + 不同函数 | 保留两侧（拼接）| ✅ 全自动 |
| 同文件 + 同一函数不同段 | 视内容（追加/替换/包装 3 模式）| 🟡 半自动 |
| 同文件 + 同一函数同一段 | 强制 agent 阅读 + 决策（§4.4）| 🟡 半自动 |
| 同文件 + import 区域 | 检查 package 版本兼容性 | ✅ 全自动 |

Source: `docs/upstream-merge-retrospective.md` §1.3 (4 类别分类) + §2.2.2 (用户问题 2 回答).

## 4. Decision tree

Walk these steps in order, branching on the manifest row for each changed file.

**Step 1 — Identify Category.** Read the `Category` column (adapter / interface / source / skill / test / docs / config / planning / agents_meta / other). This alone answers ~70% of cases (see "Fast-path summary" below).

**Step 2 — Branch on `Default Resolution`:**

| Default Resolution | Action |
|--------------------|--------|
| `ours` | `git checkout --ours <path>`; mark "ours" in the merge commit body; jump to §5 Checklist |
| `theirs` | `git checkout --theirs <path>`; run `npx tsc --noEmit`; jump to §5 Checklist |
| `assess` | **Default `--theirs`** (prefer upstream improvements). §4.1 Pi-coupling marker grep is now **advisory** — 0 hits = clean accept; ≥1 hit = log warning, accept upstream, optionally create §4.2b follow-up issue (best-effort, not blocking). For same-function conflicts, follow §4.4 5-step protocol. |
| `manual` | Open the editor; for each hunk, prefer upstream if generic, prefer ours if Pi-coupled; see §4.3 rule of thumb |

**Fast-path summary by Category** (covers `ours` / `theirs` rows without grep):

- `adapters/<agent>/*`, `adapters/entry.ts`, `skills/*`, `.planning/*`, `AGENTS.md`, `CLAUDE.md`, `.claude/*` → **always `ours`** (fork-only or agent-specific).
- `interfaces/*` (agent-api.ts, agent-paths.ts, sampling.ts, etc.) → **`manual`** (line-by-line; upstream remains Pi-specific per D-01..D-03).
- `package.json`, `vitest.config.ts`, `tsconfig.json`, `.gitignore`, `.npmignore` → **`manual`** (line-by-line, prefer fork's structural choices).
- `__tests__/*`, `tests/*`, `examples/*`, `types.ts`, `utils.ts`, `errors.ts`, `logger.ts` → **`assess`** (run §4.1 grep).
- Core MCP source (`init.ts`, `mcp-*.ts`, `lifecycle.ts`, `proxy-modes.ts`, `direct-tools.ts`, `commands.ts`, `state.ts`, `oauth-handler.ts`, `elicitation-handler.ts`, `sampling-handler.ts`, `tool-result-renderer.ts`) → **`assess`** (run §4.1 grep).
- `types/pi-*.d.ts` → **`ours`** (fork-side type declarations for Pi per D-21; declarations ≠ coupling).
- `README.md`, `MAPPING.md`, `CHANGELOG.md`, `OAUTH.md` → **`assess` via intent alignment** (preserve "Universal MCP Adapter" framing per D-18/D-19/D-20).

**Step 3 — Special cases:**

- File is `new` (Status column) + Category ∈ {adapter, interface, skill, planning} → `--ours` (we own the directory; upstream shouldn't add files here).
- File is `deleted` in upstream + still referenced locally → keep ours, add `// deprecated: removed in upstream; kept for fork back-compat` JSDoc (the `panel-keys.ts` precedent from Plan 08-01).

### 4.1 Pi-coupling marker grep (corrected template)

Run the **5 sub-commands** below against the changed files. Each covers a distinct marker class. The `\b` word boundaries and the `types/pi-*.d.ts` exclusion are the corrections from RESEARCH Dimension 3 — without them, every `agentapi.X` call in this fork produces a systematic false positive (CONTEXT's original 8 `pi.X` patterns are DELETED for exactly this reason; see `references/pi-coupling-markers.md` §"DELETED markers").

```bash
# === 1. Type / class markers (HIGH precision) ===
git diff upstream/main --name-only -- '*.ts' | xargs grep -nE \
    '\bExtensionAPI\b|\bExtensionContext\b|\bExtensionUIContext\b|\
\bAgentToolResult\b|\bAgentToolUpdateCallback\b' \
    2>/dev/null

# === 2. Package markers (HIGH precision, exclude .d.ts declarations) ===
git diff upstream/main --name-only -- '*.ts' '*.json' | xargs grep -nE \
    '@earendil-works/pi-(coding-agent|ai|tui)' \
    2>/dev/null | grep -vE 'types/pi-(ai|coding-agent|tui)\.d\.ts:'

# === 3. Env var marker (HIGH precision) ===
git diff upstream/main --name-only -- '*.ts' | xargs grep -nE \
    'PI_CODING_AGENT_DIR' 2>/dev/null

# === 4. UI surface (MEDIUM precision — generic ctx.ui but Pi-style API) ===
git diff upstream/main --name-only -- '*.ts' | xargs grep -nE \
    '\bctx\.ui\.(notify|form|custom|theme)' 2>/dev/null

# === 5. ToolInfo (must filter by import path) ===
# Flag only ToolInfo from @earendil-works/pi-coding-agent or pi-ai;
# the generic one in interfaces/agent-api.ts is fork-owned.
git diff upstream/main --name-only -- '*.ts' | xargs grep -nE \
    'from .*pi-coding-agent.*ToolInfo|from .*pi-ai.*ToolInfo' 2>/dev/null
```

**Decision rule:** Sub-commands 1-3, 5 → 0 hits means Pi-coupling-free (accept `--theirs`). Sub-command 4 (`ctx.ui.X`) is a MEDIUM marker; hits in `commands.ts` are expected and are **not** a follow-up trigger — `ctx.ui` is this fork's generic `UISystem` interface (D-04 / Phase 3). See `references/pi-coupling-markers.md` for the full per-marker inventory and rationale.

> **Note:** The 8 `pi.<method>` call patterns from the original CONTEXT-03-B draft (8 entries enumerated in `references/pi-coupling-markers.md` §"DELETED markers") are **DELETED** — they produce systematic false positives on `agentapi.X` generic adapter calls. They are catalogued only in `references/pi-coupling-markers.md` §"DELETED markers" so future maintainers can see why they are absent. Do NOT reintroduce them in the §4.1 template without re-verifying against the latest codebase.

### 4.2 Per-file default resolution (12-category matrix) and 5-step follow-up flow

#### 4.2a Per-category default resolution

The 12-category per-file default-resolution matrix (sourced from D-23; inlined here per **D-35** so the fast-path and the slow-path special-cases registry are visible in one place). Every diverged file not in `references/special-cases.md` defaults to the action in this table; the special-cases registry overrides only when a file genuinely cannot be resolved by category rules.

| Category | Default | Rationale | Source |
|---|---|---|---|
| `adapters/<agent>/*` | `ours` | Fork-only; upstream doesn't add adapters | D-21 |
| `adapters/entry.ts` | `ours` | Frozen signature per D-07 | D-07 |
| `skills/*` | `ours` | Fork-only skill additions | D-21 |
| `interfaces/*` | `manual` | Fork-generic; upstream remains Pi-specific | D-01..D-03 |
| `package.json` / `vitest.config.ts` / `tsconfig.json` | `manual` | Line-by-line; prefer fork structural choices | D-21 |
| `.gitignore` / `.npmignore` | `manual` | Line-by-line; prefer fork structural choices | D-21 |
| `__tests__/*` / `tests/*` | `assess` | Run §4.1 grep; mostly legal but watch for new test fixtures | D-24 |
| Core MCP source (`init.ts`, `mcp-*.ts`, ...) | `assess` | Always run §4.1 grep; check D-04 wrapper boundaries | D-24, D-04 |
| `bin/*` | `ours` | Fork-only bin entries; upstream has no `bin/` directory | D-21 |
| `types.ts` / `utils.ts` / `errors.ts` / `logger.ts` | `assess` | Universal utility files; Pi-coupling unlikely but check | D-24 |
| `README.md` / `MAPPING.md` / `CHANGELOG.md` / `OAUTH.md` | `assess` (intent) | Preserve "Universal MCP Adapter" framing | D-18..D-20 |
| `AGENTS.md` / `CLAUDE.md` / `.claude/*` | `ours` | Fork-specific | D-21 |
| `.planning/*` | `ours` | Planning artifacts are fork-specific | D-21 |
| `types/pi-*.d.ts` | `ours` | Fork-side type declarations for Pi (declarations ≠ coupling) | D-21 |

This matrix covers ~70% of files; the remaining ~10% are the special cases in `references/special-cases.md`. The §4.1 grep runs on `assess` rows before any `--theirs` decision.

#### 4.2b Pi-coupling soft follow-up (advisory, non-blocking) (v3.1)

When the §4.1 grep returns ≥1 hit in core source, the merge is **not blocked**. Best-effort follow-up:

1. **Accept the upstream diff** (mandatory). `git checkout --theirs <path> && git add <path>`.
2. **Optionally open a follow-up issue** (best-effort, only if `gh` CLI authenticated). Skip if `gh` not authenticated.

> **Removed from v1** (2026-07-01, Phase 13): steps "Stage a follow-up commit that refactors the Pi-coupling out", "Open a follow-up issue" (now optional), and "Reference the issue number in the merge commit body" are removed from the mandatory path. Rationale: fork is downstream, not adversarial. The adapter layer (`adapters/pi-adapter.ts`) provides runtime isolation; Pi-coupling in core is log-only. See `docs/upstream-merge-retrospective.md` §2.1.3 for the full rationale.

### 4.3 `manual` review rule of thumb

For `manual` rows, accept upstream hunks unless they touch a function signature that generic code depends on — the canonical example is `createMcpAdapter(agentapi, ctx, config, cache)` in `adapters/entry.ts`; that signature is frozen per D-07 and any upstream change to it is rejected (`git checkout --ours`).

## 5. Checklist

Run all 7 checks before declaring the upstream-merge flow complete. Each is a single command the agent can execute and inspect. Steps (a)–(f) gate the Step 1 merge commit on `main`; step (g) gates the Step 2 propagation into the working branch. A merge is not done until every item is recorded with PASS / N/A / FAIL.

- **(a) All conflicts resolved** — `git diff --name-only --diff-filter=U | wc -l` returns 0. If > 0, there are still unresolved hunks; re-walk the decision tree.
- **(b) Pi-coupling markers advisory log (no longer blocking)** — re-run the 5 sub-commands from §4.1 against the post-merge working tree; record the total hit count in the merge commit body. The only acceptable hits are inside `adapters/`, `types/`, or `__tests__/` (legal coupling zones); any hit outside these zones is acceptable (advisory) but should be tracked for the next Pi-coupling reduction cycle. Per v3.1 Phase 13 policy change (2026-07-01), this check no longer blocks the merge — see §4.2b and `docs/upstream-merge-retrospective.md` §2.1.3.
- **(c) TypeScript compiles** — `npx tsc --noEmit` exits 0.
- **(d) Tests are green** — `npm test` (which runs `test:prebuild` then the full vitest suite) exits 0. The quick alternative is `npx vitest run __tests__/adapter-contract.test.ts` for the parametric adapter contract.
- **(e) Divergence check passes — `npm run upstream:check` exits 0** (no stale registry entries; `diverged-but-not-registered` warnings are acceptable, see §4.2a category defaults). The cross-check script replaces the Phase 8 manifest-gap ≤ 10 check; per D-34, exit 1 means stale entries require registry cleanup before the merge commit.
- **(f) Commit message prefix is `upstream-merge:`** — e.g., `upstream-merge: sync v2.10.0 (N files, M conflicts resolved)`. The body should list `ours` / `theirs` / `assess` row counts and any `Refs #N` follow-up issue links.
- **(g) Step 2 propagation complete (skipped if working branch is `main`)** — `git checkout <working-branch> && git merge main` succeeds as a fast-forward or a clean small merge. The working branch now contains the upstream changes from Step 1; if conflicts appear, they are fork-vs-fork, not upstream-vs-fork, and the resolution strategy is the fork's own (consult the relevant Phase plan, not the §4 decision tree). After Step 2, re-run (c) and (d) on the working branch to confirm the propagated state still builds and tests pass.

When steps (a)–(f) PASS, push the merge branch and open a PR per the standard fork workflow (see `references/pi-coupling-markers.md` §"PR template" for the body). When step (g) also PASS, the upstream-merge flow is fully complete on both `main` and the working branch.
