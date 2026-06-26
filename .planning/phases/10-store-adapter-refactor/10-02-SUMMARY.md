---
phase: 10-store-adapter-refactor
plan: 02
subsystem: config / agent-context
tags:
  - agent-self-reporting
  - path-resolution
  - config-discovery
  - backward-compatible
depends_on:
  provides:
    - PATH-01
    - PATH-02
    - PATH-03
  affects:
    - config.ts
    - interfaces/agent-api.ts
    - interfaces/agent-paths.ts
tech-stack:
  added: []
  patterns:
    - Optional parameter threading through config call chain
    - Shared private helper for env-var tilde expansion
key-files:
  created: []
  modified:
    - interfaces/agent-api.ts
    - config.ts
    - interfaces/agent-paths.ts
decisions:
  - "mcpConfigPath added as optional field on AgentContext (PATH-01)"
  - "getConfigSources() accepts optional mcpConfigPath that takes priority over AgentPathResolver (PATH-02)"
  - "All config public functions thread mcpConfigPath as optional last parameter for backward compatibility"
  - "resolveEnvAgentDir extracted as private shared helper to deduplicate tilde-expansion in Kilo and Qoder resolvers"
metrics:
  duration_seconds: 339
  completed_date: "2026-06-26T05:47:18Z"
---

# Phase 10 Plan 02: Agent Self-Reporting Paths Summary

AgentContext.mcpConfigPath optional field added and wired through config.ts — agents can self-report their .mcp.json location at runtime, taking priority over static AgentPathResolver.

## Tasks

### Task 1: Add mcpConfigPath to AgentContext and wire through config.ts

**Status:** ✅ Complete
**Commit:** `33e1c30`

**Changes:**
- **interfaces/agent-api.ts** (+4 lines): Added `mcpConfigPath?: string` field to `AgentContext` interface (PATH-01). Updated JSDoc to document priority over `AgentPathResolver`.
- **config.ts** (+12/-10 lines): Added `mcpConfigPath?: string` as optional last parameter to `getConfigSources()`. When provided, `resolve(mcpConfigPath)` is used instead of `resolveAgentGlobalConfigPath(resolver, overridePath)`. Threaded `mcpConfigPath` through all public callers:
  - `loadMcpConfig(overridePath?, cwd?, mcpConfigPath?)`
  - `getConfigDiscoveryPaths(overridePath?, cwd?, mcpConfigPath?)`
  - `getMcpDiscoverySummary(overridePath?, cwd?, mcpConfigPath?)`
  - `getServerProvenance(overridePath?, cwd?, mcpConfigPath?)`

**Verification:**
- `npx tsc --noEmit` — zero type errors
- `npx vitest run __tests__/config.test.ts` — 7/7 passed
- All new parameters are optional and appended at end — existing callers compile without changes

### Task 2: Simplify agent-paths.ts tilde-expansion duplication (optional)

**Status:** ✅ Complete
**Commit:** `8f8134a`

**Changes:**
- **interfaces/agent-paths.ts** (+17/-33 lines, net -16): Extracted private `resolveEnvAgentDir(envVar, defaultDir)` helper that handles tilde-expansion for `MCP_AGENT_DIR` env var. Refactored `resolveQoderGlobalConfigPath()` and `createKiloResolver().globalConfigPath` to delegate to the shared helper. Eliminated ~15 lines of duplicated tilde-expansion logic.

**Verification:**
- `npx tsc --noEmit` — zero type errors
- `npx vitest run __tests__/qoder-adapter.test.ts` — 40/40 passed (including all 9 `createQoderResolver` tests)
- No change to `createPiResolver`, `DEFAULT_AGENT_RESOLVER`, or public API surface

## Deviations from Plan

None — plan executed exactly as written. Part C (code comment in adapters/entry.ts) was not needed as the plan explicitly stated "No changes to adapters/entry.ts are required."

## Commits

| Hash | Type | Message |
|------|------|---------|
| `33e1c30` | feat | add mcpConfigPath to AgentContext and wire through config.ts |
| `8f8134a` | refactor | extract resolveEnvAgentDir helper in agent-paths.ts |

## Known Stubs

None. All new fields and parameters are properly wired with no hardcoded empty values or placeholder text.

## Threat Flags

None. The `mcpConfigPath` parameter follows the same `path.resolve()` normalization pattern as `overridePath` (T-10-04 mitigated). Error messages follow the existing config-load pattern (T-10-05 accepted). No new network endpoints, auth paths, or schema changes at trust boundaries.

## Self-Check: PASSED

- [x] `interfaces/agent-api.ts` — `mcpConfigPath?: string` field present on `AgentContext`
- [x] `config.ts` — `getConfigSources()` accepts `mcpConfigPath` with priority logic
- [x] All 4 public config functions accept optional `mcpConfigPath` parameter
- [x] `interfaces/agent-paths.ts` — `resolveEnvAgentDir` helper extracted, both resolvers refactored
- [x] Commits `33e1c30` and `8f8134a` exist in git history
- [x] `npx tsc --noEmit` passes (zero errors)
- [x] Config tests (7/7) and resolver tests (40/40) pass
