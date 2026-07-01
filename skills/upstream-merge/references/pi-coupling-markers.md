# Pi-coupling markers (reference)

The grep template in `SKILL.md` §4.1 is a 5-sub-command recipe; this page is
the per-marker inventory behind it. For each marker: which sub-command
detects it, why it's HIGH/MEDIUM/DELETED precision, and the false-positive
profile that drove the classification.

> **Reading order:** Start with §"HIGH-precision markers" (the 7 things you
> never want to miss), then §"MEDIUM-precision markers" (the 1 generic-API
> surface that LOOKS Pi-coupled but isn't), then §"DELETED markers" (the 8
> `pi.<method>` call patterns the original CONTEXT-03-B draft listed, with
> the rationale for their removal).

## HIGH-precision markers

These 7 markers identify direct Pi-coupling. Any hit in core MCP source
(`init.ts`, `mcp-*.ts`, `commands.ts`, `proxy-modes.ts`, etc.) is a
**follow-up issue** per `SKILL.md` §4.2b.

| # | Marker | Sub-cmd in §4.1 | Why HIGH | False-positive profile |
|---|--------|-----------------|----------|------------------------|
| 1 | `\bExtensionAPI\b` | 1 (Type/class) | Pi's extension API class; not used in this fork. | 0 (fork uses `AgentAPI`, not `ExtensionAPI`). |
| 2 | `\bExtensionContext\b` | 1 | Pi's extension context class. | 0. |
| 3 | `\bExtensionUIContext\b` | 1 | Pi's UI context class. | 0. |
| 4 | `\bAgentToolResult\b` | 1 | Pi's tool-result type. | 0 (fork uses generic `result.content` shape). |
| 5 | `\bAgentToolUpdateCallback\b` | 1 | Pi's tool-update callback type. | 0. |
| 6 | `PI_CODING_AGENT_DIR` | 3 (Env var) | Pi's env var; DECOUPLE-07 moved it to `AgentPathResolver`. | 0 outside `agent-dir.ts` (and even there only via the env reader). |
| 7 | `@earendil-works/pi-(coding-agent\|ai\|tui)` + bare `earendil-works` token | 2 (Package) | Direct import from Pi packages; any leak into core is a follow-up. | The `types/pi-*.d.ts` declarations are excluded by the §4.1 grep via `grep -vE 'types/pi-(ai\|coding-agent\|tui)\.d\.ts:'`. |

> **Blast radius if missed (advisory as of v3.1, 2026-07-01):** a HIGH-precision hit
> in `core MCP source` (init.ts, mcp-*.ts, proxy-modes.ts, etc.) signals
> Pi-coupling re-entering the core. Per Phase 13 policy change, Pi-coupling
> is now **advisory** — accept `--theirs` and optionally log a follow-up
> issue. The blast radius is reduced because the adapter layer
> (`adapters/pi-adapter.ts`) provides runtime isolation even when types
> leak. See `docs/upstream-merge-retrospective.md` §2.1.3 for the full
> rationale.

## MEDIUM-precision markers

The 1 MEDIUM marker identifies a **structural-compatibility** surface —
the same shape as Pi's UI API, but the fork owns it as a generic
interface. Hits in `commands.ts` and `index.ts` are **expected** and
**not** a follow-up trigger.

| # | Marker | Sub-cmd in §4.1 | Why MEDIUM | False-positive profile |
|---|--------|-----------------|------------|------------------------|
| 1 | `\bctx\.ui\.(notify\|form\|custom\|theme)` | 4 (UI surface) | Pi-style API surface, but this fork exposes it as a generic `UISystem` interface per D-04 (Phase 3). The `ctx.ui` chain is the canonical agent-agnostic UI access pattern. | Hits in `commands.ts` (14× per `UPSTREAM-CHANGES.md`) are legal — they're this fork's `UISystem` impl, not upstream re-introduction. Do **not** flag as follow-up. |

> **Exception rule (D-04):** When sub-command 4 returns hits **AND** the
> hits are inside `commands.ts` / `index.ts` / `adapters/<agent>/*`, treat
> as legal coupling and proceed with `--theirs`. Only when sub-command 4
> returns hits inside `mcp-*.ts` / `init.ts` / `proxy-modes.ts` /
> `direct-tools.ts` should you escalate.

## DELETED markers

The 8 `pi.<method>` call patterns from the original CONTEXT-03-B draft,
plus `ToolInfo` (unqualified) and `AgentToolUpdateCallback` flagging
strategy. These are catalogued here so future maintainers can see why
they are absent from `SKILL.md` §4.1.

| # | Pattern | Why DELETED | Where to find (if needed) |
|---|---------|-------------|---------------------------|
| 1 | `` `pi\.registerTool` `` | Substring collision with `agentapi.registerTool` (fork's generic adapter call) — 14 false positives per dry-run. | This file, §"DELETED markers". |
| 2 | `` `pi\.on\(` `` | Substring collision with `agentapi.on(` and any other `X.on(` call. | This file. |
| 3 | `` `pi\.exec\(` `` | Substring collision with `agentapi.exec(`. | This file. |
| 4 | `` `pi\.sendMessage\(` `` | Substring collision with `agentapi.sendMessage(` (Phase 1 D-07 generic method). | This file. |
| 5 | `` `pi\.getAllTools\(` `` | Substring collision with `agentapi.getAllTools(` (Capability Gate per D-03). | This file. |
| 6 | `` `pi\.registerCommand\(` `` | Substring collision with any adapter's `registerCommand(` call. | This file. |
| 7 | `` `pi\.registerFlag\(` `` | Substring collision with any adapter's `registerFlag(` call. | This file. |
| 8 | `` `pi\.getFlag\(` `` | Substring collision with any adapter's `getFlag(` call. | This file. |

> **Future-proofing:** Do **not** reintroduce any of these 8 patterns in
> `SKILL.md` §4.1's grep template without re-verifying against the latest
> codebase. The original CONTEXT-03-B draft was empirically tested and
> failed: every `agentapi.X` call (the fork's generic adapter convention
> per D-07) produced a false positive. The corrected template in §4.1
> uses `\b` word boundaries to avoid this collision.

### `ToolInfo` import-path filter

`ToolInfo` is intentionally NOT in the HIGH table above because it exists
in **two** shapes in this fork:

- **Generic** — defined in `interfaces/agent-api.ts` (fork-owned, D-07
  abstraction). Imports look like:
  ```ts
  import type { ToolInfo } from '../interfaces/agent-api';
  ```
- **Pi-specific** — defined in `@earendil-works/pi-coding-agent`. Imports
  look like:
  ```ts
  import type { ToolInfo } from '@earendil-works/pi-coding-agent';
  ```

`SKILL.md` §4.1 sub-command 5 uses the import-path filter
(`from .*pi-coding-agent.*ToolInfo|from .*pi-ai.*ToolInfo`) to catch only
the Pi-specific import. The generic `ToolInfo` is legal coupling and
should never trigger a follow-up issue.

> **Rationale for filter:** Without the import-path filter, every file
> using the generic `ToolInfo` (a common type in this fork) would
> generate a false positive. The corrected filter is a 2-line grep and
> has 0 false positives in the current codebase (verified by
> `dry-run-scenario-2-mcp-toggle-commands.md` §"SKILL.md §4.1 Pi-coupling
> marker grep").

## PR template

A body template for the PR opened at the end of `SKILL.md` §5(f):

```
## Upstream merge <short-sha>

- Base ref: upstream/main @ <upstream-sha>
- Files merged: <N> (ours: <a> / theirs: <b> / assess: <c> / manual: <d>)
- Conflicts resolved: <M>
- Pi-coupling re-introductions: <K>
- Follow-up issues: #<N>, #<N>
- Manifest staleness: |raw - manifest| = <Δ> (acceptable ≤ 10)
- Checklist: 6/6 PASS

Refs: <list of follow-up issues>
```

Use the `Refs:` trailer to link any follow-up issues created via the
§4.2b flow. The PR body should be auto-generated by the agent, then
reviewed by a human before merge.
