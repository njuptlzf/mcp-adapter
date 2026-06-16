---
phase: 05-type-decoupling-entry-point-refactor
plan: 02
type: execute
wave: 1
subsystem: agent-paths / config
requirements:
  - DECOUPLE-07
dependency_graph:
  requires: []
  provides:
    - agent-dir.ts with MCP_AGENT_DIR / PI_CODING_AGENT_DIR fallback
  affects:
    - agent-dir.ts
    - __tests__/agent-paths-integration.test.ts
tech_stack:
  added: []
  patterns:
    - environment-variable fallback chain for backward compatibility
key_files:
  created: []
  modified:
    - agent-dir.ts
    - __tests__/agent-paths-integration.test.ts
decisions:
  - Used nullish coalescing (`??`) to prefer MCP_AGENT_DIR over PI_CODING_AGENT_DIR while treating empty strings as unset via `.trim()`.
  - Preserved the existing `~` / `~/...` / absolute path normalization and the default `join(homedir(), ".pi", "agent")` behavior.
  - Added integration tests that reset both env vars in `afterEach` to prevent cross-test contamination.
metrics:
  duration_seconds: 1232
  completed_at: 2026-06-16T03:36:16Z
  tasks: 2
  files_modified: 2
---

# Phase 05 Plan 02: Agent Directory Env Decoupling Summary

**One-liner:** `agent-dir.ts` now reads `MCP_AGENT_DIR` first, falls back to `PI_CODING_AGENT_DIR`, and keeps the default Pi directory path unchanged.

## What Changed

- `agent-dir.ts` — `getAgentDir()` now resolves `MCP_AGENT_DIR` as the primary environment variable and uses `PI_CODING_AGENT_DIR` as a backward-compatible fallback. The existing path normalization (`~`, `~/...`, absolute paths) and the default `join(homedir(), ".pi", "agent")` behavior are unchanged.
- `__tests__/agent-paths-integration.test.ts` — Added two integration tests:
  1. `default resolver honors MCP_AGENT_DIR and returns the agent-specific path`
  2. `default resolver falls back to PI_CODING_AGENT_DIR when MCP_AGENT_DIR is unset`
  Updated `afterEach` to reset both `MCP_AGENT_DIR` and `PI_CODING_AGENT_DIR`.

## Commits

| Hash | Type | Message | Files |
|------|------|---------|-------|
| `1d0085b` | feat | `feat(05-02): add MCP_AGENT_DIR support with PI_CODING_AGENT_DIR fallback` | `agent-dir.ts` |
| `48cc1a6` | test | `test(05-02): verify MCP_AGENT_DIR priority and PI_CODING_AGENT_DIR fallback` | `__tests__/agent-paths-integration.test.ts` |

## Verification Results

| Check | Command | Result | Notes |
|-------|---------|--------|-------|
| MCP_AGENT_DIR present in source | `grep -n "MCP_AGENT_DIR" agent-dir.ts` | ✅ | Line 8 |
| PI_CODING_AGENT_DIR fallback present | `grep -n "PI_CODING_AGENT_DIR" agent-dir.ts` | ✅ | Line 8 |
| Default Pi directory preserved | `grep -n 'join(homedir(), ".pi", "agent")' agent-dir.ts` | ✅ | Line 10 |
| Task files type-check | `npx tsc --noEmit --project tsconfig.json` filtered to task files | ✅ | No errors in `agent-dir.ts` or `__tests__/agent-paths-integration.test.ts` |
| Integration tests pass | `npx vitest run __tests__/agent-paths-integration.test.ts` | ✅ | 4 passed |
| Full project type-check | `npx tsc --noEmit` | ⚠️ | Fails on pre-existing unrelated error in `adapters/pi-adapter.ts:112` from parallel Wave 1 work (see Deviations) |

## Deviations from Plan

### Impact Analysis Warning

- **GitNexus impact analysis** for `getAgentDir` returned **CRITICAL** risk (14 upstream processes affected, 5 modules). The risk is due to `getAgentDir` being a central path-resolution utility used by auth, token, cache, and onboarding flows. The actual change is backward-compatible (no signature change, no default behavior change), so the CRITICAL rating reflects blast radius rather than a breaking change. Per `AGENTS.md`, this warning is recorded here and execution proceeded.

### Pre-existing TypeScript Failure

- **Found during:** Task 2 verification / overall verification
- **Issue:** `npx tsc --noEmit` fails with `adapters/pi-adapter.ts(112,47): error TS2344: Type 'Function' does not satisfy the constraint '(...args: any) => any'`.
- **Root cause:** The error originates from uncommitted modifications in `adapters/pi-adapter.ts` that are part of parallel Wave 1 work (plan 05-03, `PiSamplingProvider` integration). `agent-dir.ts` and the integration test file are not involved.
- **Action taken:** Scoped out of this plan per deviation scope boundary (only auto-fix issues directly caused by the current task's changes). Left untouched to avoid merge conflicts with parallel work.
- **Impact:** Plan success criterion "`npx tsc --noEmit` passes" is not satisfied at the workspace level, but the task-specific files compile cleanly and all targeted tests pass.

## Known Stubs

None. All modified code is wired to real environment variables and existing resolver behavior.

## Threat Flags

None. The change only reorders an existing environment-variable read and adds a fallback; no new trust boundary or network/file surface was introduced beyond what is already documented in the plan's threat model.

## Self-Check

- [x] `agent-dir.ts` modified and committed
- [x] `__tests__/agent-paths-integration.test.ts` modified and committed
- [x] Integration tests pass
- [x] Task-specific TypeScript check passes
- [x] Commits recorded in git log
