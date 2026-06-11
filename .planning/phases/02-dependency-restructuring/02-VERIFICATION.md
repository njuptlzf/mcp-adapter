---
phase: 02-dependency-restructuring
plan: 01
type: verification
verified: 2026-06-10
verdict: passed
---

# Phase 2 Verification: Dependency Restructuring

## Goal

Replace the hardcoded `getPiGlobalConfigPath` with an agent-aware path abstraction so the universal adapter can be reused by non-Pi agents (Claude, Cursor, etc.). Pi behavior must stay byte-identical.

## Verdict: PASSED

## Must-Haves Verification

### Truths

| Truth | Status | Evidence |
|---|---|---|
| Pi users keep reading/writing `~/.pi/agent/mcp.json` with zero behavior change | PASS | `__tests__/config.test.ts` (7/7) passes without edits; `getPiGlobalConfigPath(undefined)` returns identical path; `PI_CODING_AGENT_DIR` honored via `getAgentDir()` |
| Non-Pi agents can supply an agent identifier and get their own global config path | PASS | `__tests__/agent-paths-integration.test.ts:42-49` — custom resolver returns `/tmp/claude/mcp.json` |
| Project-level `.mcp.json` and `.pi/mcp.json` discovery still works | PASS | `config.ts:201-203` — `projectPath` and `projectPiPath` logic preserved; 7/7 discovery tests pass |
| Existing config tests pass unchanged | PASS | `__tests__/config.test.ts` — zero edits, 7/7 pass |

### Artifacts

| Artifact | Min Lines | Actual | Status |
|---|---|---|---|
| `interfaces/agent-paths.ts` | 30 | 36 | PASS |
| `config.ts` rewired | n/a | `getAgentGlobalConfigPath` + resolver threading in `getConfigSources` | PASS |
| `agent-dir.ts` annotated | n/a | JSDoc comment on `getAgentPath` referencing resolver | PASS |
| `__tests__/agent-paths.test.ts` | 40 | 57 | PASS |

### Key Links

| From | Via | Pattern | Found |
|---|---|---|---|
| `config.ts` | import | `resolveAgentGlobalConfigPath` | YES (line 6) |
| `config.ts` | default resolver | `DEFAULT_AGENT_RESOLVER` / `createPiResolver` | YES (lines 95, 99, 202) |

## Test Results

| Suite | Count | Status |
|---|---|---|
| `__tests__/agent-paths.test.ts` | 4 | ALL PASS |
| `__tests__/agent-paths-integration.test.ts` | 3 | ALL PASS |
| `__tests__/config.test.ts` (regression) | 7 | ALL PASS |
| `__tests__/pi-adapter.test.ts` (regression) | 13 | ALL PASS |
| `__tests__/integration.test.ts` (regression) | 9 | ALL PASS |
| Full suite (`npx vitest run`) | 351 | 349 pass, 2 fail |

**Pre-existing failures** (confirmed in Phase 1 VERIFICATION.md): `__tests__/interactive-visualizer-server.test.ts` — 2 tests fail because `examples/interactive-visualizer/dist/*` artifacts don't exist. Unrelated to Phase 2.

## Type Check

`npx tsc --noEmit` — passes with 0 errors.

## Backward Compatibility

- `getPiGlobalConfigPath` exported, signature unchanged, behavior byte-identical.
- 4 occurrences remain in `config.ts` (definition + 3 internal callers: `previewCompatibilityImports:531`, `ensureCompatibilityImports:541`, `getServerProvenance:596`).
- `loadMcpConfig()`, `getConfigDiscoveryPaths()`, `getMcpDiscoverySummary()`, `getServerProvenance()` all work unchanged — resolver is internal default.

## Public Surface (new exports from `index.ts`)

```ts
export { DEFAULT_AGENT_RESOLVER, createPiResolver, resolveAgentGlobalConfigPath };
export type { AgentPathResolver, AgentId };
```

## Success Criteria — Phase 2

- [x] AgentPathResolver abstraction is defined, exported, and tested.
- [x] Pi users experience zero behavior change (7/7 existing `__tests__/config.test.ts` tests pass without edits).
- [x] A non-Pi agent can supply its own resolver and get a distinct config path.
- [x] Phase 1 deliverables (interfaces, adapter, MAPPING.md, deps) remain intact and verified.
- [x] No sampling/elicitation handler changes (deferred to Phase 3 per D-12/D-13/D-14).
- [x] No threat-model or security-surface change (no new I/O, no new network, no new env vars beyond honoring existing `PI_CODING_AGENT_DIR`).

## Deviations from Plan

None. The plan was executed as written. One additional cleanup commit removed an unused `getAgentPath` import in `config.ts` (discovered during code review gate; `getPiGlobalConfigPath` no longer references `getAgentPath` directly because it's now a wrapper around `resolveAgentGlobalConfigPath`).

## Conclusion

Phase 2 goal achieved. The universal adapter is now genuinely agent-aware: any agent can supply a `AgentPathResolver` and get its own global config path without touching Pi-specific internals. Pi users see zero change.
