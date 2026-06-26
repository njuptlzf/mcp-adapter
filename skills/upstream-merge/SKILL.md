---
name: upstream-merge
description: >
  Fork-maintainer workflow for syncing https://github.com/nicobailon/pi-mcp-adapter
  into njuptlzf/mcp-adapter. Reads `skills/upstream-merge/references/special-cases.md`
  for hand-curated special cases AND runs `scripts/upstream-divergence.ts` for live
  cross-check against `git diff upstream/main --name-status`; falls back to the
  12-category per-file default-resolution matrix (inlined in §3.2) for files not in
  the registry. Applies ours/theirs/manual decisions per a 4-section decision tree.
  Triggers the 5-step follow-up issue flow when Pi-coupling is re-introduced.
  Use when user says "merge upstream", "sync fork", "upstream conflict",
  "resolve upstream merge", or "/upstream-merge".
---

# Upstream Merge (fork-maintainer)

Drives the `njuptlzf/mcp-adapter` fork through a deterministic merge of
upstream `nicobailon/pi-mcp-adapter` changes. The 4 sections below form a
left-to-right workflow: invoke at the right moment → look up the file →
apply the decision → verify.

## 1. When to invoke

Invoke this skill at any of the three points in the fork-maintainer workflow:

- **(a) Pre-flight, after `git fetch upstream` and before `git merge upstream/main`.** This is the primary entry point — run `npm run upstream:check` (§2) to surface live divergence, then walk the per-file decision tree before any conflict appears.
- **(b) In-flight, after `git pull upstream main` produces a merge conflict.** Open the skill, look up each conflicting file's `Default Resolution` in the manifest, and apply the decision (run the §3.1 grep for `assess` rows first).
- **(c) Targeted cherry-pick, before `git cherry-pick <upstream-sha>`.** Same flow as (b), scoped to the files touched by the cherry-picked commit.

> **GnuTLS workaround:** If `git fetch upstream` fails with GnuTLS / SSL errors in this environment, use `GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream --tags` (this is the only network-config quirk in this fork's environment — verbatim from `08-LEARNINGS.md` L-4).

## 2. Read the special-cases registry and run the divergence check

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

- **Exit 0** — no stale entries. The `diverged-but-not-registered` count is a warning (per D-34: treated as `assess` by the 12-category matrix in §3.2); proceed with the merge.
- **Exit 1** — stale entries present (registry lists a file that is no longer in `git diff upstream/main --name-status`). STOP and clean stale registry entries before merging.
- **Exit 2** — fatal: `git fetch upstream` failed AND the GnuTLS workaround also failed, OR the registry parse produced 0 entries. Investigate before proceeding (the GnuTLS workaround per L-4 is `GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream --tags`; the script retries with it automatically).

Files NOT in the registry are resolved by the 12-category per-file default-resolution matrix inlined in §3.2 below — no need to add them to the registry.

## 3. Decision tree

Walk these steps in order, branching on the manifest row for each changed file.

**Step 1 — Identify Category.** Read the `Category` column (adapter / interface / source / skill / test / docs / config / planning / agents_meta / other). This alone answers ~70% of cases (see "Fast-path summary" below).

**Step 2 — Branch on `Default Resolution`:**

| Default Resolution | Action |
|--------------------|--------|
| `ours` | `git checkout --ours <path>`; mark "ours" in the merge commit body; jump to §4 Checklist |
| `theirs` | `git checkout --theirs <path>`; run `npx tsc --noEmit`; jump to §4 Checklist |
| `assess` | Run the §3.1 Pi-coupling marker grep; 0 hits → `--theirs`; ≥1 hit → §3.2 follow-up flow |
| `manual` | Open the editor; for each hunk, prefer upstream if generic, prefer ours if Pi-coupled; see §3.3 rule of thumb |

**Fast-path summary by Category** (covers `ours` / `theirs` rows without grep):

- `adapters/<agent>/*`, `adapters/entry.ts`, `skills/*`, `.planning/*`, `AGENTS.md`, `CLAUDE.md`, `.claude/*` → **always `ours`** (fork-only or agent-specific).
- `interfaces/*` (agent-api.ts, agent-paths.ts, sampling.ts, etc.) → **`manual`** (line-by-line; upstream remains Pi-specific per D-01..D-03).
- `package.json`, `vitest.config.ts`, `tsconfig.json`, `.gitignore`, `.npmignore` → **`manual`** (line-by-line, prefer fork's structural choices).
- `__tests__/*`, `tests/*`, `examples/*`, `types.ts`, `utils.ts`, `errors.ts`, `logger.ts` → **`assess`** (run §3.1 grep).
- Core MCP source (`init.ts`, `mcp-*.ts`, `lifecycle.ts`, `proxy-modes.ts`, `direct-tools.ts`, `commands.ts`, `state.ts`, `oauth-handler.ts`, `elicitation-handler.ts`, `sampling-handler.ts`, `tool-result-renderer.ts`) → **`assess`** (run §3.1 grep).
- `types/pi-*.d.ts` → **`ours`** (fork-side type declarations for Pi per D-21; declarations ≠ coupling).
- `README.md`, `MAPPING.md`, `CHANGELOG.md`, `OAUTH.md` → **`assess` via intent alignment** (preserve "Universal MCP Adapter" framing per D-18/D-19/D-20).

**Step 3 — Special cases:**

- File is `new` (Status column) + Category ∈ {adapter, interface, skill, planning} → `--ours` (we own the directory; upstream shouldn't add files here).
- File is `deleted` in upstream + still referenced locally → keep ours, add `// deprecated: removed in upstream; kept for fork back-compat` JSDoc (the `panel-keys.ts` precedent from Plan 08-01).

### 3.1 Pi-coupling marker grep (corrected template)

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

> **Note:** The 8 `pi.<method>` call patterns from the original CONTEXT-03-B draft (8 entries enumerated in `references/pi-coupling-markers.md` §"DELETED markers") are **DELETED** — they produce systematic false positives on `agentapi.X` generic adapter calls. They are catalogued only in `references/pi-coupling-markers.md` §"DELETED markers" so future maintainers can see why they are absent. Do NOT reintroduce them in the §3.1 template without re-verifying against the latest codebase.

### 3.2 Per-file default resolution (12-category matrix) and 5-step follow-up flow

#### 3.2a Per-category default resolution

The 12-category per-file default-resolution matrix (sourced from D-23; inlined here per **D-35** so the fast-path and the slow-path special-cases registry are visible in one place). Every diverged file not in `references/special-cases.md` defaults to the action in this table; the special-cases registry overrides only when a file genuinely cannot be resolved by category rules.

| Category | Default | Rationale | Source |
|---|---|---|---|
| `adapters/<agent>/*` | `ours` | Fork-only; upstream doesn't add adapters | D-21 |
| `adapters/entry.ts` | `ours` | Frozen signature per D-07 | D-07 |
| `skills/*` | `ours` | Fork-only skill additions | D-21 |
| `interfaces/*` | `manual` | Fork-generic; upstream remains Pi-specific | D-01..D-03 |
| `package.json` / `vitest.config.ts` / `tsconfig.json` | `manual` | Line-by-line; prefer fork structural choices | D-21 |
| `.gitignore` / `.npmignore` | `manual` | Line-by-line; prefer fork structural choices | D-21 |
| `__tests__/*` / `tests/*` | `assess` | Run §3.1 grep; mostly legal but watch for new test fixtures | D-24 |
| Core MCP source (`init.ts`, `mcp-*.ts`, ...) | `assess` | Always run §3.1 grep; check D-04 wrapper boundaries | D-24, D-04 |
| `bin/*` | `ours` | Fork-only bin entries; upstream has no `bin/` directory | D-21 |
| `types.ts` / `utils.ts` / `errors.ts` / `logger.ts` | `assess` | Universal utility files; Pi-coupling unlikely but check | D-24 |
| `README.md` / `MAPPING.md` / `CHANGELOG.md` / `OAUTH.md` | `assess` (intent) | Preserve "Universal MCP Adapter" framing | D-18..D-20 |
| `AGENTS.md` / `CLAUDE.md` / `.claude/*` | `ours` | Fork-specific | D-21 |
| `.planning/*` | `ours` | Planning artifacts are fork-specific | D-21 |
| `types/pi-*.d.ts` | `ours` | Fork-side type declarations for Pi (declarations ≠ coupling) | D-21 |

This matrix covers ~70% of files; the remaining ~10% are the special cases in `references/special-cases.md`. The §3.1 grep runs on `assess` rows before any `--theirs` decision.

#### 3.2b 5-step follow-up flow (Pi-coupling re-introduction)

When the §3.1 grep returns ≥1 hit (in sub-commands 1-3, 5; or hits 4 with non-`ctx.ui` Pi-coupling source), the merge is **not** blocked. The follow-up flow extracts the Pi-coupling in a separate commit and tracks it with a labelled issue:

1. **Accept the upstream diff first.** `git checkout --theirs <path> && git add <path>`. Do **not** block the merge on the Pi-coupling; the merge commit lands cleanly.
2. **Stage a follow-up commit** that refactors the Pi-coupling out. Use the Phase 5 DECOUPLE pattern: extract to an adapter (`adapters/<agent>/*`), wrap behind `AgentContext.ui`, or route through the generic `RenderOutput` interface (see D-04 / D-07).
3. **Open a follow-up issue** with title prefix `pi-coupling-followup:` and label `pi-coupling-followup`. The issue body should reference the merge commit SHA and the offending file.
4. **Reference the issue number in the merge commit body** (e.g., `Refs #N`). The follow-up commit's message should also include the issue reference.
5. **Do not manually re-edit the upstream diff during merge.** Editing upstream hunks to "fix" the Pi-coupling creates more conflicts and obscures the audit trail; let the follow-up commit do the work in isolation.

### 3.3 `manual` review rule of thumb

For `manual` rows, accept upstream hunks unless they touch a function signature that generic code depends on — the canonical example is `createMcpAdapter(agentapi, ctx, config, cache)` in `adapters/entry.ts`; that signature is frozen per D-07 and any upstream change to it is rejected (`git checkout --ours`).

## 4. Checklist

Run all 6 checks before committing the merge. Each is a single command the agent can execute and inspect. A merge is not done until every item is recorded with PASS / N/A / FAIL.

- **(a) All conflicts resolved** — `git diff --name-only --diff-filter=U | wc -l` returns 0. If > 0, there are still unresolved hunks; re-walk the decision tree.
- **(b) Pi-coupling markers = 0 in merged core code** — re-run the 5 sub-commands from §3.1 against the post-merge working tree; the only acceptable hits are inside `adapters/`, `types/`, or `__tests__/` (legal coupling zones). For Scenario-2-style Pi-coupling re-introductions, this passes only **after** the §3.2 follow-up commit lands, not after the merge commit alone.
- **(c) TypeScript compiles** — `npx tsc --noEmit` exits 0.
- **(d) Tests are green** — `npm test` (which runs `test:prebuild` then the full vitest suite) exits 0. The quick alternative is `npx vitest run __tests__/adapter-contract.test.ts` for the parametric adapter contract.
- **(e) Divergence check passes — `npm run upstream:check` exits 0** (no stale registry entries; `diverged-but-not-registered` warnings are acceptable, see §3.2a category defaults). The cross-check script replaces the Phase 8 manifest-gap ≤ 10 check; per D-34, exit 1 means stale entries require registry cleanup before the merge commit.
- **(f) Commit message prefix is `upstream-merge:`** — e.g., `upstream-merge: sync v2.10.0 (N files, M conflicts resolved)`. The body should list `ours` / `theirs` / `assess` row counts and any `Refs #N` follow-up issue links.

When all 6 items PASS, push the merge branch and open a PR per the standard fork workflow (see `references/pi-coupling-markers.md` §"PR template" for the body).
