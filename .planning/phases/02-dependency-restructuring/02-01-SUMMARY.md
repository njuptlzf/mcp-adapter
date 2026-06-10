---
phase: 02-dependency-restructuring
plan: 01
type: execute
wave: 1
completed: 2026-06-10
tasks_completed: 3/3
test_result: 349 passed | 2 failed (pre-existing interactive-visualizer-server.test.ts — missing dist artifacts, unrelated to phase 2)
---

# Plan 02-01: Agent Path Abstraction — Summary

## Objective
Replace the hardcoded `getPiGlobalConfigPath` with an agent-aware path abstraction so the universal adapter can be reused by non-Pi agents. Pi behavior must stay byte-identical.

## What Was Built

**New module `interfaces/agent-paths.ts`** exports:
- `AgentId` — string literal union including `"pi" | "claude" | "cursor" | string`
- `AgentPathResolver` — interface with `agentId`, `globalConfigPath()`, optional `projectConfigName()`
- `createPiResolver()` — factory returning a Pi resolver wrapping `getAgentPath("mcp.json")`
- `DEFAULT_AGENT_RESOLVER` — module-level singleton, equals `createPiResolver()`
- `resolveAgentGlobalConfigPath(resolver?, overridePath?)` — resolver-driven global path resolver, with `overridePath` winning (preserves prior `getPiGlobalConfigPath` semantics)

**`config.ts` rewire:**
- `getPiGlobalConfigPath` is now a thin wrapper around `resolveAgentGlobalConfigPath(DEFAULT_AGENT_RESOLVER, overridePath)` — public surface unchanged.
- New exported `getAgentGlobalConfigPath(resolver?, overridePath?)` lets non-Pi consumers thread a custom resolver.
- `getConfigSources(overridePath?, cwd?, resolver?)` accepts an optional resolver; project-level Pi path now derives from `resolver.projectConfigName?.() ?? ".pi/mcp.json"`.

**`index.ts` re-exports** `DEFAULT_AGENT_RESOLVER`, `createPiResolver`, `resolveAgentGlobalConfigPath` (values) and `AgentPathResolver`, `AgentId` (types).

**`agent-dir.ts`** — JSDoc comment clarifying `getAgentPath` is the source of truth for the default Pi resolver.

## Tests

- `__tests__/agent-paths.test.ts` — 4 new unit tests: Pi default equals `getAgentPath("mcp.json")`, custom resolver passes through, `overridePath` honors `resolve()` semantics, `DEFAULT_AGENT_RESOLVER` exported and equals `createPiResolver()`.
- `__tests__/agent-paths-integration.test.ts` — 3 integration tests: `getConfigSources` not publicly exported, default resolver honors `PI_CODING_AGENT_DIR`, non-Pi resolver returns a distinct path.
- `__tests__/config.test.ts` — 7 pre-existing tests pass **unchanged** (regression guard for backward compat).

Total: **349/351 passing**. The 2 failures are in `interactive-visualizer-server.test.ts` (missing `examples/interactive-visualizer/dist/*` artifacts) — pre-existing, confirmed in Phase 1 SUMMARY, unrelated to phase 2.

## Files Modified

- `interfaces/agent-paths.ts` (new, 41 lines)
- `__tests__/agent-paths.test.ts` (new, 60 lines)
- `__tests__/agent-paths-integration.test.ts` (new, 50 lines)
- `config.ts` (+13/-3)
- `agent-dir.ts` (+2/-1)
- `index.ts` (+3/-0)

## Backward Compatibility

Pi users experience zero behavior change:
- `getPiGlobalConfigPath(undefined)` returns the same path as before
- All 7 existing `__tests__/config.test.ts` cases pass without edits
- 4 occurrences of `getPiGlobalConfigPath` remain in `config.ts` (definition + 3 internal callers)
- `loadMcpConfig()`, `getConfigDiscoveryPaths()`, `getMcpDiscoverySummary()`, `getServerProvenance()` all use the default resolver internally

## Verification Steps

| Check | Result |
|---|---|
| `npx tsc --noEmit` | passes (0 errors) |
| `npx vitest run __tests__/config.test.ts` | 7/7 pass, zero edits |
| `npx vitest run __tests__/agent-paths.test.ts __tests__/agent-paths-integration.test.ts` | 7/7 pass |
| `npx vitest run` (full suite) | 349/351 pass; 2 pre-existing failures in `interactive-visualizer-server.test.ts` |
| `grep -E "DEFAULT_AGENT_RESOLVER\|createPiResolver\|resolveAgentGlobalConfigPath\|AgentPathResolver" index.ts` | all 4 names present |
| `grep -c "getPiGlobalConfigPath" config.ts` | 4 (≥ 4 required) |
| Manual smoke: `getAgentGlobalConfigPath({ agentId: "claude", globalConfigPath: () => "/custom/path/mcp.json" })` | returns `"/custom/path/mcp.json"` |

## Out of Scope (Deferred)

- Sampling/elicitation handlers (D-12/D-13/D-14) — Phase 3 per D-12
- Concrete resolvers for Claude/Cursor/etc. — only the contract is provided here; agent-specific resolvers land in their respective adapter packages
- MAPPING.md updates — unchanged
