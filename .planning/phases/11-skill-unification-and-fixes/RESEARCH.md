# Phase 11: Skill Unification & Post-Phase-10 Fixes - Research

**Researched:** 2026-06-26
**Domain:** Skill documentation unification, config resolver fix, upstream-merge registry
**Confidence:** HIGH

## Summary

Phase 11 addresses three legacy problems left after Phase 10: (1) a critical config resolver bug in `bin/kilo-mcp-server.ts` where Kilo's global config path was silently ignored, (2) three fragmented skills (`deploy-mcp-adapter`, `generate-mcp-config`, `mcp-adapter-test`) with circular cross-references and hardcoded static path files, and (3) missing capability-gate transparency for agent integration.

**Critical finding:** The majority of Phase 11 work has **already been executed in the working tree** (uncommitted). The `bin/kilo-mcp-server.ts` resolver fix (DEC-04), the unified `skills/mcp-adapter/` skill with 4 reference files (DEC-01/02/03), the deprecation banners on all three old skills, the `special-cases.md` registry updates (DEC-05), and the README capability explanation are all present. TypeScript compilation passes, all 590 tests pass, and Kilo deployment verification passes.

**Primary recommendation:** The planner should treat this phase as a **completion and gap-fixing phase**, not a greenfield implementation phase. The primary remaining work is: (1) migrate the missing `deploy-examples.md` file (broken reference in the unified skill), (2) fix a broken anchor link in `deploy.md`, (3) add the missing `deploy-examples.md` entry to `special-cases.md`, and (4) commit all uncommitted changes and verify `npm run upstream:check` exits 0.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **DEC-01**: Merge three skills into a single `mcp-adapter` skill with internal Phase 1-3 organization. Old skills marked deprecated, retained for 2 version cycles.
- **DEC-02**: All path references migrate from static `agent-paths/<id>.md` to `AGENT_ADAPTERS[i].resolverFactory()` dynamic resolution.
- **DEC-03**: Capability-gate consumes `capabilities` field at skill entry — transparent display, never terminates (all agents support mcp proxy).
- **DEC-04**: `bin/kilo-mcp-server.ts` explicitly passes `createKiloResolver().globalConfigPath()` to `loadMcpConfig()`.
- **DEC-05**: New `skills/mcp-adapter/` directory marked as `fork-only/ours` in special-cases registry. Old three skills retained for backward compatibility.

### the agent's Discretion
- Whether to use PATH-01 self-reporting (`AgentContext.mcpConfigPath`) vs direct `loadMcpConfig` third argument for DEC-04 (both approaches documented; current implementation uses `loadMcpConfig` third argument).
- Structure of reference files within `skills/mcp-adapter/references/` (5 files per DEC-01: generate.md, deploy.md, verify.md, resolver.md, deploy-examples.md).

### Deferred Ideas (OUT OF SCOPE)
- Deleting the old three skill directories (retained for 2 version cycles per DEC-01).
- Migrating the existing static `agent-paths/<id>.md` files content into resolver.md (they are deprecated in-place with a README.md notice).
- Qoder vs Kilo implementation convergence (F4 — architectural constraint, not a bug).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEC-01 | Skill unification — single entry point | ✅ Already implemented: `skills/mcp-adapter/SKILL.md` (207 lines) + 4 reference files exist in working tree |
| DEC-02 | Resolver dynamic — eliminate agent-paths hardcoding | ✅ Already implemented: `resolver.md` (116 lines) replaces static files; all references use `AGENT_ADAPTERS[i].resolverFactory()` |
| DEC-03 | Capability-gate check | ✅ Already implemented: Phase 0 in SKILL.md + Capability-Gate Decision section in resolver.md |
| DEC-04 | Fix kilo-mcp-server resolver | ✅ Already implemented: `bin/kilo-mcp-server.ts:116-117` passes `kiloResolver.globalConfigPath()` |
| DEC-05 | upstream-merge compatibility | ✅ Partially done: 6 entries added to special-cases.md; **GAP**: `deploy-examples.md` entry missing |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Config path resolution | API / Backend | — | `interfaces/agent-paths.ts` owns resolver factories; `config.ts` consumes them via `getConfigSources` |
| Skill documentation | Documentation | — | `skills/` directory is documentation-only; no runtime code impact |
| Capability transparency | Documentation | API / Backend | `AGENT_ADAPTERS[i].capabilities` is the data source; skill docs present it to users |
| Upstream-merge tracking | Documentation | — | `special-cases.md` registry tracks fork-only files; `scripts/upstream-divergence.ts` validates |
| Config loading bug fix | API / Backend | — | `bin/kilo-mcp-server.ts` entry point; `config.ts:loadMcpConfig` handles path resolution |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (no new packages) | — | — | Phase 11 is documentation + 1-line code fix; no external dependencies added |

**Installation:** No package installation needed. Phase 11 modifies only `.ts` and `.md` files.

**Version verification:** N/A — no new packages introduced. All existing dependencies (`@modelcontextprotocol/sdk`, `vitest`, `tsx`) remain unchanged.

## Package Legitimacy Audit

> No external packages are installed in this phase. All changes are to existing source files and documentation.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User says "对接agent" / "deploy mcp-adapter"
        │
        ▼
┌─────────────────────────────────┐
│  skills/mcp-adapter/SKILL.md   │  ← Single entry point (DEC-01)
│  Phase 0: Identify + Cap-Gate  │
└──────────┬──────────────────────┘
           │
     ┌─────┼─────┐
     ▼     ▼     ▼
  Phase 1  Phase 2  Phase 3
  Generate  Deploy   Verify
     │       │        │
     ▼       ▼        ▼
┌─────────┐ ┌────────┐ ┌────────┐
│generate │ │deploy  │ │verify  │
│  .md    │ │  .md   │ │  .md   │
└────┬────┘ └───┬────┘ └───┬────┘
     │          │          │
     └──────────┼──────────┘
                ▼
    ┌───────────────────────┐
    │   references/         │
    │   resolver.md         │  ← Dynamic path resolution (DEC-02)
    │   AGENT_ADAPTERS[]   │     replaces static agent-paths/<id>.md
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │  interfaces/          │
    │  agent-api.ts        │  ← AGENT_ADAPTERS registry (single source of truth)
    │  agent-paths.ts      │  ← createKiloResolver/createPiResolver/createQoderResolver
    └───────────────────────┘
```

Data flow: User intent → unified SKILL.md (Phase 0 capability-gate) → reference file (generate/deploy/verify) → resolver.md (dynamic path via AGENT_ADAPTERS) → interfaces/agent-paths.ts (concrete resolver factory).

### Recommended Project Structure
```
skills/
├── mcp-adapter/                    # NEW (Phase 11) — unified skill
│   ├── SKILL.md                    # Single entry: Phase 0-3 workflow
│   └── references/
│       ├── resolver.md             # Dynamic path resolution (replaces agent-paths)
│       ├── generate.md             # Phase 1: config generation
│       ├── deploy.md               # Phase 2: deployment branches
│       ├── verify.md               # Phase 3: verification matrix
│       └── deploy-examples.md      # ⚠️ MISSING — referenced but not yet created
├── deploy-mcp-adapter/             # DEPRECATED — banner added, content unchanged
├── generate-mcp-config/            # DEPRECATED — banner added, content unchanged
├── mcp-adapter-test/               # DEPRECATED — banner added, content unchanged
│   └── references/
│       └── agent-paths/            # DEPRECATED — README.md notice added
│           ├── README.md           # NEW: deprecation notice
│           ├── _template.md        # Retained for backward compat
│           ├── kilo.md             # Retained for backward compat
│           ├── pi.md               # Retained for backward compat
│           └── qoder.md            # Retained for backward compat
└── upstream-merge/
    └── references/
        └── special-cases.md        # UPDATED: +6 entries for skills/mcp-adapter/
```

### Pattern 1: Registry-Driven Documentation (D-07)
**What:** All agent-specific paths and capabilities are discovered dynamically from `AGENT_ADAPTERS` in `interfaces/agent-api.ts`. No static per-agent documentation files are maintained in the unified skill.
**When to use:** Whenever a skill needs agent-specific path or capability information.
**Example:**
```bash
# Source: skills/mcp-adapter/references/resolver.md (lines 13-15)
# Dynamic discovery — replaces hardcoded agent-paths/<id>.md files
grep -B1 -A5 "id:" interfaces/agent-api.ts | grep -E "(id:|displayName:|capabilities:|resolverFactory:)" | head -60
```

### Pattern 2: Deprecation Banner (DEC-01 migration)
**What:** Old skills receive a deprecation banner at the top (after frontmatter), pointing to the new unified skill. Content is otherwise unchanged for backward compatibility and upstream-divergence stability.
**When to use:** When replacing a skill with a unified alternative.
**Example:**
```markdown
> ⚠️ **DEPRECATED** — 此 skill 已被 [`/mcp-adapter`](../mcp-adapter/SKILL.md) 统一入口取代。
> 功能已完整迁移至 `skills/mcp-adapter/SKILL.md`（Phase 2: Deploy Adapter）。
> 保留此文件仅用于向后兼容，新用户请使用 `/mcp-adapter`。
```

### Pattern 3: PATH-01 Self-Reporting Config Path
**What:** `AgentContext.mcpConfigPath` allows an agent to self-report its config path at runtime, overriding the default resolver-based resolution.
**When to use:** When a bin entry knows which agent it serves (e.g., `kilo-mcp-server.ts` knows it's Kilo).
**Example:**
```typescript
// Source: bin/kilo-mcp-server.ts (lines 115-117) — ALREADY IMPLEMENTED
const kiloResolver = createKiloResolver();
const config = loadMcpConfig(args.configPath, process.cwd(), kiloResolver.globalConfigPath());
// OR via PATH-01 (alternative, not currently used):
// const ctx: AgentContext = adaptKiloContext({
//   cwd: process.cwd(), hasUI: false,
//   mcpConfigPath: kiloResolver.globalConfigPath()
// });
```

### Anti-Patterns to Avoid
- **Hardcoding agent paths in skill docs:** The old skills hardcoded `skills/mcp-adapter-test/references/agent-paths/<id>.md` references. The unified skill uses `AGENT_ADAPTERS[i].resolverFactory()` dynamically. Never re-introduce static per-agent path files.
- **Circular skill references:** The old `deploy-mcp-adapter` said "run generate-mcp-config first" while `mcp-adapter-test` referenced `deploy-mcp-adapter` for deploy-verify. The unified skill eliminates all cross-skill references — phases are internal to one skill.
- **Breaking upstream-divergence stability:** Old skill files must retain their original content (only the deprecation banner is added). Rewriting old skill content would create merge conflicts with upstream.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent path resolution | Hardcoded path tables in skill docs | `AGENT_ADAPTERS[i].resolverFactory().globalConfigPath()` | New agents auto-discovered; no doc edits needed (D-07) |
| Capability matrix | Manual capability tables | `AGENT_ADAPTERS[i].capabilities` | Single source of truth; auto-updated when registry changes |
| Config source discovery | Custom config loading logic | `loadMcpConfig(overridePath, cwd, mcpConfigPath)` | Handles all precedence rules, import expansion, validation |
| Upstream-merge tracking | Manual file lists | `special-cases.md` registry + `npm run upstream:check` | Automated divergence detection; prevents merge surprises |

**Key insight:** The entire skill unification is built on the D-07 registry pattern. Adding a new agent requires zero skill file edits — `resolver.md` auto-discovers via `AGENT_ADAPTERS`. This is the core design principle that makes the unified skill maintainable.

## Runtime State Inventory

> Phase 11 involves a rename/refactor (skill migration + path resolver change). Runtime state audit required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — skills are pure documentation; no database or datastore involved | None |
| Live service config | None — skill files are not loaded by any running service at runtime | None |
| OS-registered state | None — no OS-level registrations (Task Scheduler, launchd, systemd) reference skill paths | None |
| Secrets/env vars | None — no secret keys or env var names reference skill paths. `MCP_AGENT_DIR` env var is consumed by `interfaces/agent-paths.ts` (code, not skill docs) and is unchanged | None |
| Build artifacts | None — skill `.md` files are not compiled or built. `bin/kilo-mcp-server.ts` change is source-only; `npx tsc --noEmit` passes with zero errors | None |

**The canonical question:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?*

Answer: **None.** Skill files are documentation consumed by AI agents at read time — there is no caching, no build step, no runtime registration. The `bin/kilo-mcp-server.ts` change is a source-level fix that takes effect on next process start (no persisted state). The `special-cases.md` registry is consumed by `scripts/upstream-divergence.ts` at check time — no persistence.

## Common Pitfalls

### Pitfall 1: Stale CONTEXT.md — Resolver Bug Already Fixed
**What goes wrong:** The CONTEXT.md (F1/DEC-04) describes `bin/kilo-mcp-server.ts:115` as calling `loadMcpConfig(args.configPath)` without the Kilo resolver. But the actual working tree code at lines 115-117 ALREADY passes `kiloResolver.globalConfigPath()` as the third argument.
**Why it happens:** The CONTEXT.md was written during investigation before the fix was applied. The fix was applied in a prior manual execution but never committed, so the working tree has the fix but git HEAD does not.
**How to avoid:** The planner must recognize that Task 1 (DEC-04) is **already complete** — no code changes needed. The verification step (`npm run verify:deploy -- --agent kilo`) should pass immediately.
**Warning signs:** If the planner adds a task to "fix" the resolver, it will produce a no-op diff against the working tree.

### Pitfall 2: Missing deploy-examples.md — Broken References
**What goes wrong:** `skills/mcp-adapter/SKILL.md` line 206 references `references/deploy-examples.md` and `deploy.md` references it 3 times (lines 49, 105, 113). But this file does **not exist** in `skills/mcp-adapter/references/`. The directory only contains: deploy.md, generate.md, resolver.md, verify.md.
**Why it happens:** The PLAN's Task 4 only creates generate.md, deploy.md, verify.md — it does not include deploy-examples.md. But the SKILL.md (created in Task 3) references it. The original file exists at `skills/deploy-mcp-adapter/references/deploy-examples.md` (403 lines, 15155 bytes) and was supposed to be migrated per DEC-01's structure (line: `deploy-examples.md # 部署代码模板（保留）`).
**How to avoid:** The planner MUST add a task to copy `skills/deploy-mcp-adapter/references/deploy-examples.md` → `skills/mcp-adapter/references/deploy-examples.md` and add it to the `special-cases.md` registry.
**Warning signs:** Any user following the unified skill's deploy phase will encounter a 404/broken link when trying to access deployment code templates.

### Pitfall 3: Broken Anchor Link in deploy.md
**What goes wrong:** `deploy.md` line 105 references `deploy-examples.md#custom-agent-integration` and line 113 references `deploy-examples.md#custom-agent-integration`. But the old deploy-examples.md has heading `## Branch C: Custom Agent` (line 238), which generates anchor `#branch-c-custom-agent`, not `#custom-agent-integration`.
**Why it happens:** The anchor names were written speculatively during skill creation without verifying against the actual source file headings.
**How to avoid:** When migrating deploy-examples.md, either (a) fix the deploy.md references to use `#branch-c-custom-agent`, or (b) add a heading `### Custom Agent Integration` to the migrated file.
**Warning signs:** GitHub renders the link but it doesn't scroll to the correct section.

### Pitfall 4: upstream:check Reports Stale Entries
**What goes wrong:** `npm run upstream:check` currently exits 1 with "6 stale entries" — the 6 new untracked files in `skills/mcp-adapter/` show as "registry entry no longer diverged" because they don't exist in git's index yet.
**Why it happens:** The `scripts/upstream-divergence.ts` script compares against git HEAD. Untracked files aren't in HEAD, so the script can't detect their fork-only divergence.
**How to avoid:** All new files must be **committed** before `npm run upstream:check` will recognize them. The PLAN's must_have "npm run upstream:check exits 0" can only pass after commit.
**Warning signs:** Running upstream:check before committing will always report new files as stale.

### Pitfall 5: AGENTS.md GitNexus Constraint
**What goes wrong:** The project's `AGENTS.md` requires running `gitnexus_impact` before editing any symbol, and `gitnexus_detect_changes` before committing. If the executor ignores these, it violates project constraints.
**Why it happens:** The AGENTS.md is a GitNexus-specific instruction file that may not be visible to all tooling.
**How to avoid:** For Phase 11, the only `.ts` file modified is `bin/kilo-mcp-server.ts` (already done). The executor should still run `gitnexus_impact({target: "loadMcpConfig"})` if any further code changes are made. For the documentation-only changes, GitNexus impact analysis is not applicable.
**Warning signs:** AGENTS.md states "NEVER edit a function, class, or method without first running gitnexus_impact on it."

## Code Examples

### Current State: kilo-mcp-server.ts (DEC-04 ALREADY FIXED)
```typescript
// Source: bin/kilo-mcp-server.ts (lines 28-35, 115-117) — CURRENT WORKING TREE
import { createKiloResolver } from "../interfaces/agent-paths.ts";  // Line 32 — already imported
// ...
// Line 115-117:
// 1. Load config with Kilo resolver (DEC-04: was using DEFAULT_AGENT_RESOLVER = Pi)
const kiloResolver = createKiloResolver();
const config = loadMcpConfig(args.configPath, process.cwd(), kiloResolver.globalConfigPath());
```

### config.ts: loadMcpConfig Signature (PATH-01 from Phase 10)
```typescript
// Source: config.ts (lines 190-200)
export function loadMcpConfig(overridePath?: string, cwd = process.cwd(), mcpConfigPath?: string): McpConfig {
  let config: McpConfig = { mcpServers: {} };
  for (const source of getConfigSources(overridePath, cwd, DEFAULT_AGENT_RESOLVER, mcpConfigPath)) {
    const loaded = readValidatedConfig(source.readPath, `MCP config from ${source.readPath}`);
    if (!loaded) continue;
    config = mergeConfigs(config, expandImports(loaded, cwd));
  }
  return config;
}
// getConfigSources (line 202-205): mcpConfigPath takes priority over resolver
function getConfigSources(overridePath?, cwd?, resolver = DEFAULT_AGENT_RESOLVER, mcpConfigPath?) {
  const userPath = mcpConfigPath
    ? resolve(mcpConfigPath)                              // PATH-01: self-reported path wins
    : resolveAgentGlobalConfigPath(resolver, overridePath);
  // ...
}
```

### AGENT_ADAPTERS Registry (DEC-02 dynamic source)
```typescript
// Source: interfaces/agent-api.ts (lines 197-248)
export const AGENT_ADAPTERS: AgentAdapterDescriptor[] = [
  {
    id: "kilo",
    displayName: "Kilo",
    factory: () => new KiloAdapter(),
    resolverFactory: createKiloResolver,        // ← consumed by resolver.md
    capabilities: { ui: false, sampling: false, renderer: false },  // ← consumed by Phase 0
    createVerificationContext: (input, adapter) => adaptKiloContext(input, adapter as KiloAdapter),
  },
  // ... pi, qoder entries
];
```

### special-cases.md Entry Format (DEC-05)
```markdown
| `skills/mcp-adapter/SKILL.md` | `fork-only` | Phase 11: unified mcp-adapter skill replaces deploy/generate/test; upstream has no skills/ dir | `ours` |
```
Current registry has 28 entries (lines 9-37 in special-cases.md). Footer: "2026-06-26 (Phase 11 skill unification + post-Phase-10 fixes; 28 anchored entries)".

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Three separate skills with circular refs | Single unified `mcp-adapter` skill | Phase 11 (2026-06-26) | User confusion eliminated; single entry point |
| Static `agent-paths/<id>.md` per-agent files | Dynamic `AGENT_ADAPTERS[i].resolverFactory()` | Phase 11 DEC-02 | New agents auto-discovered; zero doc edits |
| No capability transparency | Capability-gate at Phase 0 entry | Phase 11 DEC-03 | Users see what's available before deploying |
| `DEFAULT_AGENT_RESOLVER = createPiResolver()` silently used by Kilo | Explicit `createKiloResolver()` passed | Phase 11 DEC-04 | `~/.kilo/mcp.json` now consulted correctly |

**Deprecated/outdated:**
- `skills/mcp-adapter-test/references/agent-paths/<id>.md` (kilo.md, pi.md, qoder.md, _template.md): Deprecated with README.md notice. Retained for 2 version cycles.
- Old three skills (deploy-mcp-adapter, generate-mcp-config, mcp-adapter-test): Deprecated with banners. Retained for 2 version cycles.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `deploy-examples.md` file should be copied verbatim from `skills/deploy-mcp-adapter/references/deploy-examples.md` | Common Pitfalls / Code Examples | If the file needs content updates (not just copy), additional editing required |
| A2 | The broken anchor `#custom-agent-integration` should be fixed to `#branch-c-custom-agent` | Common Pitfalls | Alternatively, a new heading could be added to deploy-examples.md |
| A3 | `npm run upstream:check` will pass after committing the 6 new files | Common Pitfalls | If the divergence script has a bug with newly-committed fork-only files, manual investigation needed |
| A4 | `adapter-implementation.md` (9465 bytes in old deploy-mcp-adapter/references/) is NOT needed by the unified skill | Architecture Patterns | If deploy.md or SKILL.md references it indirectly, it would need migration too |

## Open Questions

1. **Should deploy-examples.md content be updated during migration?**
   - What we know: The old file (403 lines) references `pi-mcp-adapter` package paths and has Qoder/Kilo templates. The unified skill's deploy.md references it for "complete template" sections.
   - What's unclear: Whether the old file's import paths (e.g., `import { createQoderResolver } from "pi-mcp-adapter/interfaces/agent-paths.ts"`) need updating to match the unified skill's conventions.
   - Recommendation: Copy verbatim — the file is user-facing documentation showing npm package usage, and `pi-mcp-adapter` is the published package name. No path changes needed.

2. **Should the agent-paths/README.md deprecation notice be added to special-cases.md?**
   - What we know: It's already in the registry (line 37: `skills/mcp-adapter-test/references/agent-paths/README.md`).
   - What's unclear: The other 4 static files (kilo.md, pi.md, qoder.md, _template.md) in that directory are NOT in the registry. Should they be?
   - Recommendation: No — they are pre-existing files from earlier phases. Only new Phase 11 files need registry entries. The README.md deprecation notice is the only new file in that directory.

3. **Is the current `loadMcpConfig` third-argument approach sufficient, or should PATH-01 `mcpConfigPath` on AgentContext also be set?**
   - What we know: DEC-04 offers two approaches. Current implementation uses `loadMcpConfig(args.configPath, process.cwd(), kiloResolver.globalConfigPath())` — the third argument approach. The PATH-01 approach (setting `ctx.mcpConfigPath`) is documented as an alternative.
   - What's unclear: Whether downstream code that reads `ctx.mcpConfigPath` (if any) would benefit from also having it set.
   - Recommendation: The current approach is sufficient. `loadMcpConfig` is the only consumer of the config path in `bin/kilo-mcp-server.ts`. The `adaptKiloContext` call on line 127 doesn't pass `mcpConfigPath`, but that's fine — config loading already happened on line 117.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All TypeScript execution | ✓ | v22+ (implied by tsx/npx) | — |
| tsx | `bin/kilo-mcp-server.ts` runtime, `scripts/deploy-verify.ts` | ✓ | via npx | — |
| vitest | Test suite (590 tests) | ✓ | 3.2.6 (implied by config comments) | — |
| git | upstream:check, commit | ✓ | present | — |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:** None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.6 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npm test` (runs `test:prebuild` + `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEC-04 | Kilo resolver used in config loading | smoke | `npm run verify:deploy -- --agent kilo` | ✅ `scripts/deploy-verify.ts` |
| DEC-01 | Unified skill files exist | manual | `ls skills/mcp-adapter/SKILL.md skills/mcp-adapter/references/*.md` | ✅ (4/5 files exist) |
| DEC-02 | No hardcoded agent-paths in unified skill | manual | `grep -r "agent-paths/<id>" skills/mcp-adapter/` (should return 0 active refs) | ✅ |
| DEC-03 | Capability-gate present in SKILL.md | manual | `grep -i "capability" skills/mcp-adapter/SKILL.md` | ✅ |
| DEC-05 | upstream:check exits 0 | integration | `npm run upstream:check` | ❌ Currently exits 1 (stale entries) |
| Type safety | Zero TypeScript errors | unit | `npx tsc --noEmit` | ✅ Exit 0 |
| Test suite | All tests pass | unit+integration | `npm test` | ✅ 590 passed, 10 skipped |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npx vitest run --reporter=verbose`
- **Per wave merge:** `npm test && npm run verify:deploy -- --agent kilo && npm run upstream:check`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `skills/mcp-adapter/references/deploy-examples.md` — missing file, causes broken references in SKILL.md and deploy.md
- [ ] Fix broken anchor `#custom-agent-integration` → `#branch-c-custom-agent` in `deploy.md` (lines 105, 113)
- [ ] Add `skills/mcp-adapter/references/deploy-examples.md` entry to `special-cases.md` registry
- [ ] Commit all uncommitted changes to resolve `upstream:check` stale entries

## Security Domain

> Phase 11 does not introduce authentication, session management, or cryptography. The only `.ts` change (`bin/kilo-mcp-server.ts`) passes a local filesystem path to an existing config loader — no new attack surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — no auth changes |
| V3 Session Management | no | N/A — no session changes |
| V4 Access Control | no | N/A — no access control changes |
| V5 Input Validation | yes (minor) | `loadMcpConfig` already validates config paths via `readValidatedConfig`; no new inputs |
| V6 Cryptography | no | N/A — no crypto changes |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Config path injection | Tampering | `loadMcpConfig` uses `resolve()` on `mcpConfigPath` — no path traversal risk (local filesystem only) |
| Skill content injection | Spoofing | Skill `.md` files are consumed by AI agents, not executed as code — no injection vector |

## Sources

### Primary (HIGH confidence)
- `bin/kilo-mcp-server.ts` (lines 28-35, 115-117) — verified DEC-04 fix is present in working tree
- `interfaces/agent-api.ts` (lines 161-248) — verified AGENT_ADAPTERS registry structure, capabilities, resolverFactory
- `interfaces/agent-paths.ts` (lines 1-91) — verified createKiloResolver, createPiResolver, createQoderResolver, DEFAULT_AGENT_RESOLVER
- `config.ts` (lines 190-259) — verified loadMcpConfig signature and getConfigSources mcpConfigPath precedence
- `skills/mcp-adapter/SKILL.md` (207 lines) — verified unified skill content and Phase 0-3 structure
- `skills/mcp-adapter/references/resolver.md` (116 lines) — verified dynamic resolution and capability-gate
- `skills/mcp-adapter/references/generate.md` (151 lines) — verified config generation workflow
- `skills/mcp-adapter/references/deploy.md` (151 lines) — verified deployment branches and broken deploy-examples.md references
- `skills/mcp-adapter/references/verify.md` (148 lines) — verified test matrix workflow
- `skills/upstream-merge/references/special-cases.md` (52 lines) — verified 28 entries, 6 new for Phase 11
- `skills/deploy-mcp-adapter/references/deploy-examples.md` (403 lines) — verified source file for migration, anchors
- `README.md` (lines 22-35) — verified Kilo capability explanation
- Git working tree status — verified all changes are uncommitted (M + ??)

### Secondary (MEDIUM confidence)
- `npm test` output — 590 passed, 10 skipped, 55 test files, exit 0
- `npm run verify:deploy -- --agent kilo` output — exit 0, "✅ Kilo verification passed"
- `npm run upstream:check` output — exit 1, 6 stale entries (untracked files)
- `npx tsc --noEmit` output — exit 0, zero errors

### Tertiary (LOW confidence)
- None — all findings verified against actual source files in this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all changes verified against source
- Architecture: HIGH — all patterns verified against existing code; resolver.md, SKILL.md, and reference files read in full
- Pitfalls: HIGH — all 5 pitfalls discovered by direct codebase inspection and verification command execution
- Gap analysis: HIGH — deploy-examples.md missing confirmed by directory listing; broken anchor confirmed by heading grep; stale entries confirmed by upstream:check output

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (30 days — stable documentation phase, no fast-moving dependencies)
