# Phase 10: StoreAdapter Base Class & Agent Self-Reporting Paths — CONTEXT

**Created:** 2026-06-26
**Source:** gsd-map-codebase + gstack-openclaw-investigate 深度架构调查
**Codebase Knowledge:** `.planning/codebase/` (7 documents, 2042 lines)

---

## Problem Statement

The current "for every MCP-compatible agent" architecture requires writing a dedicated adapter class (~250-370 lines) per agent type. QoderAdapter (346行) and KiloAdapter (298行) share ~90% identical code (7/8 AgentAPI methods, 4 Maps, event simulators, exec, bufferedMessages, fire()). Adding a new agent = ~5 new files (~900 lines cumulative for 3 agents).

Additionally, `AgentPathResolver` requires hardcoded default paths per agent (`~/.pi/agent/`, `~/.qoder/agent/`, `~/.kilo/`). Agents cannot self-report their `.mcp.json` location at runtime.

## Investigation Findings

### 1. Adapter Code Overlap (Evidence from QoderAdapter vs KiloAdapter)

| Method | QoderAdapter | KiloAdapter | Match |
|--------|-------------|-------------|-------|
| `registerTool` | `Map.set()` | `Map.set()` | ✅ 100% |
| `registerCommand` | `Map.set()` | `Map.set()` | ✅ 100% |
| `registerFlag` | `Map.set({...})` | `Map.set({...})` | ✅ 100% |
| `on` | `Set.add()` | `Set.add()` | ✅ 100% |
| `getAllTools` | `Map→ToolInfo[]` | `Map→ToolInfo[]` | ✅ 100% |
| `getFlag` | `Map.get()` | `Map.get()` | ✅ 100% |
| `exec` | `child_process.spawn` | `child_process.spawn` | ✅ 100% |
| `sendMessage` | channel→Query.streamInput→buffer | channel→sendMessageFn→buffer | ❌ Only diff |
| `fire()` private | Promise.all + catch | same | ✅ 100% |
| `fireSessionStart/Shutdown/ToolRegistered` | same | same | ✅ 100% |
| `bufferedMessages` (32-limit FIFO) | same | same | ✅ 100% |
| `attachChannel/detachChannel` | same | same | ✅ 100% |

**Only unique code per adapter:**
- Qoder: `attachQuery/Query.streamInput` routing (SDK-specific)
- Kilo: `attachSendMessage/sendMessageFn` callback (generic)
- Console prefix: `[mcp-adapter/qoder]` vs `[mcp-adapter/kilo]`
- UI: Qoder has `setStatus:undefined, theme:undefined`; Kilo has `setStatus:no-op, theme:{fg:identity}`

### 2. Path Resolution (Evidence from agent-paths.ts)

- `createQoderResolver()` (lines 59-65) and `createKiloResolver()` (lines 72-89) both reimplement tilde-expansion logic
- `MCP_AGENT_DIR` env var already exists as proto-self-reporting mechanism
- `config.ts:202` already accepts optional `resolver: AgentPathResolver` parameter — extensible
- `DEFAULT_AGENT_RESOLVER = createPiResolver()` is the only blocker for non-Pi agents

### 3. upstream-merge Impact (Verified)

- StoreAdapter has **zero Pi imports** → §3.1 grep scanning area reduced by 69%
- `special-cases.md` needs +3 entries (store-adapter.ts, qoder-adapter.ts updated status, kilo-adapter.ts updated status)
- `upstream-divergence.ts` requires **zero changes** (registry-driven)
- 12-category matrix requires **zero changes** (`adapters/<agent>/*` already covers store-adapter.ts)

### 4. Concerns from Codebase Map

- **C-01**: "Universal" adapter is per-agent, not category-based
- **C-02**: Hardcoded default paths per agent
- **C-09**: Each new agent requires 5+ new files
- **C-12**: AgentPathResolver cannot express self-reported paths
- **C-17**: No agent auto-detection
- **C-18**: No self-reporting mechanism for `.mcp.json`

## Design Decisions (to be locked)

### STORE-01: Extract `StoreAgentAdapter` base class
Consolidate shared logic (4 Maps, 7/8 methods, event simulators, exec, bufferedMessages) into `adapters/store-adapter.ts`. QoderAdapter and KiloAdapter become thin wrappers that only provide their unique `sendMessage` routing.

### STORE-02: Inject sendMessage as constructor parameter
`StoreAgentAdapter` accepts `sendMessage: (message, options?) => void` in constructor. Qoder wraps `Query.streamInput`, Kilo wraps a simple callback.

### STORE-03: AgentProfile for per-agent configuration
Each agent provides a lightweight `AgentProfile` object: `{ id, displayName, prefix, ui?, sendMessage? }`. The `AGENT_ADAPTERS` registry maps profiles to adapters.

### STORE-04: Keep PiAdapter unchanged
PiAdapter is a pass-through pattern (delegates to `ExtensionAPI`), fundamentally different from in-memory store pattern. No merge needed — the two patterns are complementary.

### STORE-05: No changes to `createMcpAdapter` entry point
`createMcpAdapter(agentapi, ctx, config, cache)` signature is frozen per D-07. StoreAdapter is an implementation detail, not an interface change.

### PATH-01: Add `mcpConfigPath?: string` to `AgentContext`
When set, it takes priority over `AgentPathResolver.globalConfigPath()`. Allows agents to self-report their `.mcp.json` location.

### PATH-02: Config layer reads `ctx.mcpConfigPath` first
`config.ts:202` `getConfigSources()` checks `ctx.mcpConfigPath` before falling back to `AgentPathResolver`. Backward compatible — existing agents continue to use resolvers.

### PATH-03: `MCP_AGENT_DIR` remains as env-var based self-reporting
Already works. The new `ctx.mcpConfigPath` is a programmatic alternative for agents with SDK-level config path discovery.

### UP-01: Add `adapters/store-adapter.ts` to special-cases.md
Status: `fork-only`, Decision: `ours`. Zero Pi imports, zero conflict risk.

### UP-02: Update qoder/kilo adapter statuses to `decoupled-wrapper`
Reflects their new role as thin wrappers. Decision remains `ours`.

## Affected Files

| File | Change | Lines |
|------|--------|-------|
| `adapters/store-adapter.ts` | **NEW** | ~100 |
| `adapters/qoder-adapter.ts` | Modified (346→~50) | -296 |
| `adapters/kilo-adapter.ts` | Modified (298→~50) | -248 |
| `interfaces/agent-api.ts` | Modified (AGENT_ADAPTERS + mcpConfigPath) | +10 |
| `interfaces/agent-paths.ts` | Optionally simplified | -20 |
| `skills/upstream-merge/references/special-cases.md` | +3 entries | +5 |
| `__tests__/adapter-contract.test.ts` | Adapted for StoreAdapter | ~20 |

**Net code reduction:** ~450 lines removed, ~100 added = **~350 lines net reduction**

## Verification Strategy

1. **Parametric contract test**: `describe.each(AGENT_ADAPTERS)` must pass for all 3 agents
2. **QoderAdapter behavior parity**: Qoder-specific `Query.streamInput` routing unchanged
3. **KiloAdapter behavior parity**: Kilo-specific `sendMessageFn` callback unchanged
4. **upstream-divergence check**: `npm run upstream:check` exits 0 after registry update
5. **TypeScript compilation**: `npx tsc --noEmit` passes
6. **Full test suite**: `npm test` passes (parametric + integration + E2E)

## References

- `.planning/codebase/ARCHITECTURE.md` — System architecture
- `.planning/codebase/CONCERNS.md` — 20 concerns (C-01, C-02, C-09, C-12, C-17, C-18 are addressed)
- `.planning/codebase/TESTING.md` — Test infrastructure
- `skills/upstream-merge/SKILL.md` — Merge conflict resolution skill
- `skills/upstream-merge/references/special-cases.md` — Special cases registry
- `adapters/qoder-adapter.ts` (346 lines) — Source for extraction
- `adapters/kilo-adapter.ts` (298 lines) — Source for extraction
- `adapters/pi-adapter.ts` (237 lines) — Reference (unchanged)
