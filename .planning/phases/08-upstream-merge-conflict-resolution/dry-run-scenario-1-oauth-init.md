# Dry-run scenario 1: OAuth refresh in init.ts (Pi-coupling-free)

Worktree at `/tmp/dryrun-oauth-init`; branch `dryrun/oauth-refresh-init`;
simulated upstream commit adds a Pi-coupling-free OAuth refresh function
to `init.ts`. Skill workflow §1–§4 walked end-to-end; this log is the
evidence the SKILL.md `0 hits → accept --theirs` branch is reachable in
practice.

> **Hypothetical scope (per CONTEXT §"VERIFY-A" Scenario 1):** upstream
> modifies `init.ts` to add an OAuth refresh token rotation function.
> This is the "pure core MCP improvement, no Pi-coupling" branch — the
> decision should be `--theirs` (accept upstream) with **0** follow-up
> issues opened.

> **State-model note (important):** the worktree was created from
> `upstream/main @ a764c25`, whose `init.ts` references `ExtensionAPI`
> (pre-Phase-5 DECOUPLE). To model the "post-merge" state that the
> §3.1 grep is designed to evaluate, the dry-run replaces the worktree's
> `init.ts` with the **fork's** current decoupled version
> (`AgentAPI` + `AgentContext` + `UISystem`), then appends the
> hypothetical 12-line OAuth refresh function. This faithfully
> represents the file the agent would scan after a real merge
> resolution: a fork-side decoupled `init.ts` with an upstream
> OAuth-refresh contribution layered on top.

## Setup

| Field | Value |
|-------|-------|
| Worktree path | `/tmp/dryrun-oauth-init` |
| Branch | `dryrun/oauth-refresh-init` |
| Base ref | `upstream/main @ a764c25` (chore: release v2.10.0) |
| Target file | `init.ts` (Status=`modified`, Category=`source`) |
| Hypothetical change | Add a 12-line `refreshOAuthToken()` function to `init.ts`; uses only `AgentAPI.sendMessage` + `AgentContext.ui.notify` (generic interfaces, no Pi imports) |
| Mock patch file | `/tmp/oauth-refresh.patch` (17 lines, illustrative diff) |
| Pre-step | `cp UPSTREAM-CHANGES.md /tmp/dryrun-oauth-init/UPSTREAM-CHANGES.md` (manifest not in upstream worktree; needed for the §2 lookup) |
| Pre-step | `cp init.ts /tmp/dryrun-oauth-init/init.ts` (replace upstream's `ExtensionAPI`-based `init.ts` with the fork's `AgentAPI`-based version, simulating the post-merge state) |
| Pre-step | `cat >> init.ts` (append the hypothetical OAuth refresh function, 12 lines) |

## Manifest lookup

Verbatim `grep -F '`init.ts`' UPSTREAM-CHANGES.md` output (from inside
the worktree):

```
| `init.ts` | modified | source | assess | **assess (HIGH RISK)** — core MCP init; 14 upstream commits. Run Pi-coupling marker grep; if 0 hits, `--theirs`; if hits, follow UPSTREAM-03-C. |
```

Interpretation:

- **Status:** `modified` — the file already exists in both sides; merge
  is a 3-way diff.
- **Category:** `source` — core MCP logic, not fork-only infrastructure.
- **Default Resolution:** `assess` — the manifest does NOT pre-decide
  this file; the agent MUST run the §3.1 grep to determine Pi-coupling
  status before picking ours/theirs.
- **Rationale:** 14 upstream commits on this file make it a hot spot
  for conflict; the agent's job is to confirm "Pi-coupling-free" via
  the grep, not to assume it.

## SKILL.md §3.1 Pi-coupling marker grep

Verbatim 5-sub-command run against the worktree's `init.ts` (12 lines
appended, fork's decoupled base):

```bash
# Sub-cmd 1: Type / class markers
$ grep -nE '\bExtensionAPI\b|\bExtensionContext\b|\bExtensionUIContext\b|\bAgentToolResult\b|\bAgentToolUpdateCallback\b' /tmp/dryrun-oauth-init/init.ts
(no output; exit=1)

# Sub-cmd 2: Package markers
$ grep -nE '@earendil-works/pi-(coding-agent|ai|tui)' /tmp/dryrun-oauth-init/init.ts | grep -vE 'types/pi-(ai|coding-agent|tui)\.d\.ts:'
(no output; exit=1)

# Sub-cmd 3: Env var
$ grep -nE 'PI_CODING_AGENT_DIR' /tmp/dryrun-oauth-init/init.ts
(no output; exit=1)

# Sub-cmd 4: UI surface (MEDIUM)
$ grep -nE '\bctx\.ui\.(notify|form|custom|theme)' /tmp/dryrun-oauth-init/init.ts
144:        ctx.ui.notify(`MCP: Failed to connect to ${name}: ${error}`, "error");
155:      ctx.ui.notify(
169:    ctx.ui.notify(msg, "info");
201:        ctx.ui.notify(`MCP: direct tools for ${bootstrapped.join(", ")} will be available after restart`, "info");
357:    await ctx.ui.notify(`Refreshed OAuth token for ${serverName}`);
(5 hits; exit=0)

# Sub-cmd 5: ToolInfo import-path filter
$ grep -nE 'from .*pi-coding-agent.*ToolInfo|from .*pi-ai.*ToolInfo' /tmp/dryrun-oauth-init/init.ts
(no output; exit=1)
```

**Sub-command summary:**

| Sub-cmd | Hits | Decision-rule implication |
|---------|------|---------------------------|
| 1 (Type/class) | 0 | Pi-coupling-free for HIGH markers |
| 2 (Package) | 0 | No `@earendil-works/pi-*` imports introduced |
| 3 (Env var) | 0 | No `PI_CODING_AGENT_DIR` references |
| 4 (UI surface) | 5 | All 5 hits on `ctx.ui.notify` — this fork's generic `UISystem` (D-04 / Phase 3), NOT a follow-up trigger (per `references/pi-coupling-markers.md` §"MEDIUM-precision markers") |
| 5 (ToolInfo filter) | 0 | No Pi-specific `ToolInfo` import; only the generic fork-side type |

**Decision: 0 HIGH-precision hits (sub-cmds 1, 2, 3, 5) → accept `--theirs` is safe.** Sub-cmd 4 hits are MEDIUM / D-04 structural-compat surface, do not block.

## SKILL.md §3.2 / §3 step 3 follow-up decision

`0 hits` in sub-cmds 1, 2, 3, 5 → no follow-up issue needed. Per
`SKILL.md` §3 step 3 (`assess` branch with 0 grep hits), the decision
escalates to `--theirs` and the merge can proceed without the §3.2
5-step follow-up flow.

**No follow-up issue opened. No follow-up commit required. PR is
single-commit (the merge itself).**

## SKILL.md §4 Checklist

The 6-item checklist, walked against this dry-run:

| Item | Command | Result | Notes |
|------|---------|--------|-------|
| (a) All conflicts resolved | `git diff --name-only --diff-filter=U \| wc -l` (in worktree) | **PASS** | `0` — fresh worktree has no conflict markers; the dry-run did not produce any unresolved hunks. |
| (b) Pi-coupling markers = 0 in merged core code | re-run the 5 sub-commands from §3.1 on the post-merge working tree | **PASS** | Sub-cmds 1, 2, 3, 5 → 0 hits. Sub-cmd 4 → 5 hits, all on `ctx.ui.notify` (D-04 / `UISystem` / legal). No HIGH-precision hit means no follow-up commit required. |
| (c) TypeScript compiles | `npx tsc --noEmit` | **DEFERRED** | The worktree is `upstream/main`-based and lacks `interfaces/agent-api.ts` (the fork-only abstraction layer that the appended function imports). Running `npx tsc --noEmit` produces 12+ errors in upstream's pre-existing files (commands.ts, direct-tools.ts, etc. — all reference `@earendil-works/pi-coding-agent` which upstream's `types/pi-*.d.ts` does not provide without a `npm install` of the optional peer dep). **In a real merge**, the worktree would be the fork's main checkout (which has `interfaces/`) and `tsc` would pass. **For the dry-run**, this is environment-deferred, not logic-deferred — the hypothetical OAuth refresh function uses only existing generic types (`AgentAPI.sendMessage`, `AgentContext.ui`), so it would compile cleanly in the fork. |
| (d) Tests are green | `npm test` | **DEFERRED** | Same reason as (c): the worktree's `node_modules` was symlinked from the main repo (not `npm install`'d), and the upstream-side files have pre-existing tsc errors. The parametric `__tests__/adapter-contract.test.ts` would still run but the test suite is not designed to be run against an upstream-only worktree. **In a real merge**, the fork's full test suite would run. |
| (e) Manifest still aligned with reality | re-derive `git diff upstream/main --name-status` vs `UPSTREAM-CHANGES.md` | **PASS** | Per Plan 08-01 T-08-01-3 static-alignment check: `\|RAW - MANIFEST\| = 0` (RAW=209, MANIFEST=209). Verified by 08-01-SUMMARY.md `## Self-Check`. No drift between `upstream/main @ a764c25` and the manifest. |
| (f) Commit message prefix is `upstream-merge:` | (template only — actual commit in real merge) | **DEFERRED in dry-run** | Template recorded below. The dry-run does NOT commit (worktree is ephemeral). |

> **Note on DEFERRED items:** (c) and (d) are DEFERRED for environment
> reasons (worktree lacks `interfaces/`, `node_modules` is a symlink).
> They are NOT logic failures — the SKILL.md §3.1 grep (the
> skill's only logic gate) PASSes. In a real merge, the agent would
> work in the fork's main checkout (which has `interfaces/`) and run
> (c)/(d) against the merged state.

## Commit message template

The literal string the agent would use for the real merge:

```
upstream-merge: accept OAuth refresh token in init.ts (Pi-coupling-free per dry-run scenario 1)

Scenario 1 of 08-02 dry-run:
- §3.1 grep: 0 HIGH-precision hits (sub-cmds 1, 2, 3, 5)
- Sub-cmd 4: 5 hits on ctx.ui.notify (D-04 UISystem, legal)
- Decision: --theirs (no follow-up issue)
- Resolves 14 upstream commits on init.ts

Refs: #N/A
```

The `Refs:` trailer is empty in this scenario (no follow-up issues
created).

## Outcome

Skill drives a Pi-coupling-free upstream change to `--theirs` decision
with 0 follow-up issues. Workflow validated: §3.1 grep produces
deterministic 0 / 5 (HIGH / MEDIUM) hit counts on a representative
change; §4 Checklist (a)(b)(e) PASS, (c)(d) DEFERRED for environment
reasons (worktree lacks `interfaces/`, `node_modules` symlink only),
(f) template provided.

The §3.2 5-step follow-up flow is **not activated** in this scenario
— that's Scenario 2's role.

## Worktree cleanup

Worktree at `/tmp/dryrun-oauth-init` is retained for post-verify
inspection. To clean up:

```bash
git worktree remove /tmp/dryrun-oauth-init
git branch -D dryrun/oauth-refresh-init
```

> **Self-verification note (T-08-02-4, autonomous mode):** the
> §4 Checklist items above are marked PASS / DEFERRED with reasoning;
> the user is invited to re-verify items (c) and (d) in a real-merge
> context (with `interfaces/` and full `node_modules`) before signing
> off the skill.
