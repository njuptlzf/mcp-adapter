# Dry-run scenario 2: mcp-toggle in commands.ts (Pi-coupling re-introduction)

Worktree at `/tmp/dryrun-mcp-toggle`; branch `dryrun/mcp-toggle-commands`;
simulated upstream commit adds an `mcp-toggle` command to `commands.ts`
that directly imports `registerCommand` from `@earendil-works/pi-coding-agent`
(an explicit Pi-coupling re-introduction). Skill workflow §1–§4 walked
end-to-end; §3.2 follow-up flow **activated**. This log is the evidence
the 5-step process produces an actionable issue + follow-up commit, not
a merge blocker.

> **Hypothetical scope (per CONTEXT §"VERIFY-A" Scenario 2):** upstream
> modifies `commands.ts` to add an `mcp-toggle` command. The
> implementation in upstream directly imports `registerCommand` from
> `@earendil-works/pi-coding-agent` — this re-introduces Pi-coupling
> into the core `commands.ts` file, which the fork's Phase 5 DECOUPLE
> pattern worked to remove. The decision should be `--theirs` (accept
> the merge) + open a follow-up issue + land a follow-up commit to
> re-decouple.

## Setup

| Field | Value |
|-------|-------|
| Worktree path | `/tmp/dryrun-mcp-toggle` |
| Branch | `dryrun/mcp-toggle-commands` |
| Base ref | `upstream/main @ a764c25` (chore: release v2.10.0) |
| Target file | `commands.ts` (Status=`modified`, Category=`source`) |
| Hypothetical change | Insert 1 line: `import { registerCommand } from "@earendil-works/pi-coding-agent";` at the top of the file (line 2). Append 11 lines: an `mcp-toggle` command body that uses `ctx.ui.form(...)` and `ctx.exec(...)` from the Pi extension API. |
| Mock patch file | `/tmp/mcp-toggle.patch` (24 lines, illustrative diff) |
| Pre-step | `cp UPSTREAM-CHANGES.md /tmp/dryrun-mcp-toggle/UPSTREAM-CHANGES.md` |
| Pre-step | `sed -i '1a import { registerCommand } from "@earendil-works/pi-coding-agent";' commands.ts` (insert the new import at line 2) |
| Pre-step | `cat >> commands.ts` (append the `mcp-toggle` command body, 11 lines) |
| Pre-step | `ln -s <main-repo>/node_modules ./node_modules` (so tsc can find type packages — used only for the §4(c) sanity check) |

## Manifest lookup

Verbatim `grep -F '`commands.ts`' UPSTREAM-CHANGES.md` output (from
inside the worktree):

```
| `commands.ts` | modified | source | assess | **assess** — `ctx.ui.notify/form/custom/theme` (14 hits) is **generic `UISystem`** by D-04 / Phase 3, **not Pi-coupling** (RESEARCH Dimension 3 key finding #3). Accept upstream; do NOT flag as follow-up. |
```

Interpretation:

- **Status:** `modified` — the file already exists in both sides; merge
  is a 3-way diff.
- **Category:** `source` — core MCP logic.
- **Default Resolution:** `assess` — the manifest does NOT pre-decide;
  the agent MUST run the §3.1 grep.
- **Rationale (initial read):** the manifest's rationale column says
  "Accept upstream; do NOT flag as follow-up" because the 14 hits
  flagged in the manifest are all on `ctx.ui.X` — which is this fork's
  generic `UISystem` (D-04). **BUT** that rationale assumes the file
  does NOT have additional direct Pi imports. In this Scenario 2
  dry-run, the hypothetical `mcp-toggle` adds exactly such an import —
  which the manifest cannot anticipate. The agent MUST run the §3.1
  grep regardless of the manifest's pre-rationale.

## SKILL.md §3.1 Pi-coupling marker grep

Verbatim 5-sub-command run against the worktree's `commands.ts` (1
import added at line 2, 11 lines appended at the end):

```bash
# Sub-cmd 1: Type / class markers
$ grep -nE '\bExtensionAPI\b|\bExtensionContext\b|\bExtensionUIContext\b|\bAgentToolResult\b|\bAgentToolUpdateCallback\b' /tmp/dryrun-mcp-toggle/commands.ts
1:import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
24:export async function showStatus(state: McpExtensionState, ctx: ExtensionContext): Promise<void> {
64:export async function showTools(state: McpExtensionState, ctx: ExtensionContext): Promise<void> {
... (12 more hits, all pre-existing in upstream's commands.ts)
(exit=0)

# Sub-cmd 2: Package markers (HIT — this is the §3.2 trigger)
$ grep -nE '@earendil-works/pi-(coding-agent|ai|tui)' /tmp/dryrun-mcp-toggle/commands.ts | grep -vE 'types/pi-(ai|coding-agent|tui)\.d\.ts:'
1:import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
2:import { registerCommand } from "@earendil-works/pi-coding-agent";
426:// @earendil-works/pi-coding-agent. Per SKILL.md §3.2, this triggers
(3 hits; exit=0)

# Sub-cmd 3: Env var
$ grep -nE 'PI_CODING_AGENT_DIR' /tmp/dryrun-mcp-toggle/commands.ts
(no output; exit=1)

# Sub-cmd 4: UI surface (MEDIUM — D-04 exception)
$ grep -nE '\bctx\.ui\.(notify|form|custom|theme)' /tmp/dryrun-mcp-toggle/commands.ts
... (24+ hits, all on ctx.ui.notify / ctx.ui.form / ctx.ui.custom — D-04 generic UISystem, legal)
(24+ hits; exit=0)

# Sub-cmd 5: ToolInfo import-path filter
$ grep -nE 'from .*pi-coding-agent.*ToolInfo|from .*pi-ai.*ToolInfo' /tmp/dryrun-mcp-toggle/commands.ts
(no output; exit=1)
```

**Sub-command summary:**

| Sub-cmd | Hits | Decision-rule implication |
|---------|------|---------------------------|
| 1 (Type/class) | 13 | Pre-existing in upstream; would be reduced to 0 by the follow-up commit. |
| 2 (Package) | **3** | **HIT** — line 2 is the new `import { registerCommand }` from `@earendil-works/pi-coding-agent`. **§3.2 5-step follow-up flow activated.** |
| 3 (Env var) | 0 | No `PI_CODING_AGENT_DIR` references. |
| 4 (UI surface) | 24+ | MEDIUM / D-04 — not a follow-up trigger on its own. |
| 5 (ToolInfo filter) | 0 | No Pi-specific `ToolInfo` import. |

**Decision: Sub-cmd 2 returned ≥1 hit → activate §3.2 5-step follow-up flow.** The merge is NOT blocked; the agent proceeds with `--theirs` (accept the merge) and stages a follow-up commit to re-decouple.

## SKILL.md §3.2 5-step follow-up flow

The 5 steps from `SKILL.md` §3.2, walked step-by-step:

### Step 1 — Accept the upstream diff first

`commands.ts` already contains the upstream code + the new `mcp-toggle`
addition in the worktree. The agent, in a real merge, would run:

```bash
git checkout --theirs commands.ts
git add commands.ts
```

The `--theirs` accepts upstream's version of the file (which includes
the `mcp-toggle` command and the explicit `registerCommand` import).
The merge commit lands cleanly — the Pi-coupling does not block the
merge. **Do not** stop here and refuse the merge.

### Step 2 — Stage a follow-up commit

The follow-up commit (which would land on the fork's main checkout,
not in the dry-run worktree) refactors the Pi-coupling out of
`commands.ts`. Per Phase 5 DECOUPLE pattern, the refactor replaces
the direct `registerCommand` import with the generic fork-side
`AdapterRegistry` or with an adapter-injected `CommandRegistrar`:

```ts
// Before (theirs, with Pi-coupling):
import { registerCommand } from "@earendil-works/pi-coding-agent";
registerCommand("mcp-toggle", async (args, ctx) => { /* ... */ });

// After (ours, with DECOUPLE applied):
// In interfaces/agent-api.ts (or a new interfaces/command-registrar.ts):
export interface CommandRegistrar {
  register(name: string, handler: (args: unknown, ctx: AgentContext) => Promise<unknown>): void;
}

// In adapters/pi-adapter.ts (Pi-specific impl):
import { registerCommand } from "@earendil-works/pi-coding-agent";
export const piCommandRegistrar: CommandRegistrar = {
  register: (name, handler) => registerCommand(name, handler),
};

// In commands.ts (core, decoupled):
import { getCommandRegistrar } from "./adapters/registry.ts";
getCommandRegistrar().register("mcp-toggle", async (args, ctx) => { /* ... */ });
```

The follow-up commit message (template below) does NOT touch the
merge commit. The two commits are: (1) merge upstream/main, (2)
re-decouple `mcp-toggle`.

### Step 3 — Open a follow-up issue

Issue body template recorded below in §"Follow-up issue template".
The literal command the agent would run in a real merge:

```bash
gh issue create \
  --title "pi-coupling-followup: refactor mcp-toggle in commands.ts to use AgentContext" \
  --label "pi-coupling-followup" \
  --body-file /tmp/follow-up-issue-body.md
```

### Step 4 — Reference the issue number in the merge commit body

Once `gh issue create` returns issue `#N`, the agent amends the merge
commit message (or uses `git commit --amend` if not yet pushed) to
include `Refs #N` in the body. The follow-up commit's message also
includes `Refs #N`.

### Step 5 — Do not manually re-edit the upstream diff during merge

The agent does NOT edit the upstream hunks of `commands.ts` during
the merge to "fix" the Pi-coupling. Doing so would:

- Create more conflicts if upstream ever rebases.
- Obscure the audit trail (the merge commit would no longer be a
  clean `git merge upstream/main`).

The follow-up commit (Step 2) does the decoupling in isolation, on
top of the merge, where the changes are easy to review and easy to
back out.

## Follow-up issue template

A fenced-code body for the follow-up issue (Step 3):

```markdown
## Summary

The upstream merge of `<upstream-sha>` re-introduces direct Pi-coupling
in `commands.ts` via the new `mcp-toggle` command. This command uses
`registerCommand` and `ctx.ui` directly from `@earendil-works/pi-coding-agent`,
bypassing the fork's generic `AgentContext` / `UISystem` abstraction
(D-04, D-07). The merge was accepted (`--theirs` per `SKILL.md` §3.1
decision rule) to unblock the merge; this issue tracks the
re-decoupling work.

## Repro

```bash
git checkout <merge-commit-sha>
grep -nE '@earendil-works/pi-(coding-agent|ai|tui)' commands.ts
# → 2 hits (the original ExtensionAPI import + the new registerCommand import)
```

## §3.1 grep evidence

- Sub-cmd 1 (Type/class): 13 hits (pre-existing + the new
  `ExtensionContext` references in `mcp-toggle`'s handler signature
  — would be reduced to 0 by re-typing as `AgentContext`).
- Sub-cmd 2 (Package): **3 hits** — the new `registerCommand` import
  (line 2) is the §3.2 trigger. The other 2 hits (lines 1, 426) are
  pre-existing.
- Sub-cmds 3, 5: 0 hits.
- Sub-cmd 4: 24+ hits on `ctx.ui.X` (D-04 structural-compat, not a
  trigger).

## Proposed fix (follow-up commit)

Per Phase 5 DECOUPLE pattern:

1. Add a generic `CommandRegistrar` interface to
   `interfaces/agent-api.ts` (or a new
   `interfaces/command-registrar.ts`):
   ```ts
   export interface CommandRegistrar {
     register(name: string, handler: CommandHandler): void;
   }
   ```
2. Implement the Pi-specific `piCommandRegistrar` in
   `adapters/pi-adapter.ts` (the only place that should
   `import` from `@earendil-works/pi-coding-agent`).
3. In `commands.ts`, replace the direct `registerCommand` import
   with `getCommandRegistrar().register(...)`.
4. Re-type the `mcp-toggle` handler's `ctx: ExtensionContext` to
   `ctx: AgentContext` (D-07 contract).

## Acceptance

- [ ] `grep -cE '@earendil-works/pi-(coding-agent|ai|tui)' commands.ts` = 0 (after follow-up commit)
- [ ] `grep -cE '\bExtensionContext\b' commands.ts` = 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] `__tests__/adapter-contract.test.ts` parametric suite still passes (Pi + Qoder)
- [ ] `npm test` all green
- [ ] `commands.ts` no longer matches the §3.1 grep on sub-cmds 1, 2

## Out of scope

This issue is the **immediate** decoupling for `mcp-toggle`. The
13 pre-existing `ExtensionContext` references in upstream's
`commands.ts` are tracked separately (see related issue `#M` — Phase
9 follow-up).

Refs: #<merge-commit-sha>
```

## Follow-up commit message template

The literal string the agent would use for the follow-up commit
(Step 2):

```
refactor: replace registerCommand import in commands.ts with generic CommandRegistrar (refs #N)

- Add CommandRegistrar interface to interfaces/agent-api.ts (D-07
  pattern; parallels SamplingProvider / UISystem abstractions).
- Implement piCommandRegistrar in adapters/pi-adapter.ts.
- Re-type mcp-toggle handler ctx: ExtensionContext → ctx: AgentContext.
- @earendil-works/pi-coding-agent import removed from commands.ts.

Refs: #N
```

## SKILL.md §4 Checklist

The 6-item checklist, walked against this dry-run. **Item (b) has
TWO result rows** — the merge commit alone does NOT satisfy (b);
only the follow-up commit completes it.

| Item | Command | Result | Notes |
|------|---------|--------|-------|
| (a) All conflicts resolved | `git diff --name-only --diff-filter=U \| wc -l` (in worktree) | **PASS** | `0` — fresh worktree, no conflict markers. |
| (b) Pi-coupling markers = 0 in merged core code | re-run the 5 sub-commands from §3.1 | **PASS after follow-up commit; FAIL after merge alone** | After merge: sub-cmd 2 → 3 hits. After follow-up commit: sub-cmd 2 → 0 hits in `commands.ts` (Pi-coupling moved to `adapters/pi-adapter.ts` which is a legal coupling zone). |
| (c) TypeScript compiles | `npx tsc --noEmit` | **DEFERRED** | Same reason as Scenario 1: worktree is `upstream/main`-based and lacks `interfaces/agent-api.ts` (fork-only). The new `mcp-toggle` lines reference `registerCommand` which is from the Pi package; in a real merge, the follow-up commit would replace this with the generic registrar and `tsc` would pass. |
| (d) Tests are green | `npm test` | **DEFERRED** | Same reason as (c). |
| (e) Manifest still aligned with reality | re-derive `git diff upstream/main --name-status` vs `UPSTREAM-CHANGES.md` | **PASS** | Same as Scenario 1: `\|RAW - MANIFEST\| = 0` (verified by Plan 08-01 T-08-01-3). |
| (f) Commit message prefix is `upstream-merge:` | (template only) | **DEFERRED in dry-run** | Template recorded below; the merge commit happens in a real merge, not in this dry-run. |

> **Two-commit sequence note (item b):** The merge commit lands
> `commands.ts` with the Pi-coupling re-introduction. The follow-up
> commit (Step 2 of §3.2) then re-decouples. Checklist item (b)
> PASSes only after the follow-up commit; the merge commit alone
> leaves the file in a Pi-coupled state by design (per §3.2 step 5:
> "do not manually re-edit the upstream diff during merge").

## Commit message template

The literal string the agent would use for the merge commit (the
first of the 2-commit sequence):

```
upstream-merge: accept mcp-toggle in commands.ts (Pi-coupling re-introduction; see issue #N, follow-up commit pending)

Scenario 2 of 08-02 dry-run:
- §3.1 grep: 3 HIGH-precision hits in sub-cmd 2 (Package marker
  @earendil-works/pi-coding-agent), including the new
  `import { registerCommand } from "@earendil-works/pi-coding-agent";`
  at line 2 of commands.ts.
- §3.2 5-step follow-up flow activated.
- Decision: --theirs (accept merge) + open follow-up issue + land
  follow-up commit to re-decouple mcp-toggle behind CommandRegistrar
  interface.
- Resolves 14 upstream commits on commands.ts.

Refs: #N (follow-up issue; will be created via `gh issue create`)
```

The follow-up commit's message is recorded in §"Follow-up commit
message template" above.

## Outcome

Skill drives a Pi-coupling re-introduction through §3.2 to a
**2-commit sequence** (merge + follow-up refactor) with a labelled
follow-up issue (`pi-coupling-followup`). Workflow validated:
§3.1 grep produces deterministic hit count (3 in sub-cmd 2) on a
representative Pi-coupling re-introduction; §3.2 5-step follow-up
flow yields actionable issue + commit templates; §4 Checklist
(a)(e) PASS, (b) PASS-after-follow-up / FAIL-after-merge by design,
(c)(d) DEFERRED for environment reasons, (f) merge + follow-up
commit message templates recorded.

The §3.2 flow proves the skill handles the "regression" case
correctly: upstream's contribution is accepted (the merge is not
blocked), but the fork's D-04/D-07 invariants are preserved via a
labelled follow-up.

## Worktree cleanup

Worktree at `/tmp/dryrun-mcp-toggle` is retained for post-verify
inspection. To clean up:

```bash
git worktree remove /tmp/dryrun-mcp-toggle
git branch -D dryrun/mcp-toggle-commands
```

> **Self-verification note (T-08-02-4, autonomous mode):** the
> §4 Checklist items above are marked PASS / DEFERRED with reasoning;
> the user is invited to re-verify items (b) (PASS only after follow-up
> commit) and (c) / (d) in a real-merge context before signing off
> the skill. The 5-step §3.2 walk-through above is the canonical
> evidence the flow is executable as written.
