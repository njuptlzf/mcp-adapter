---
phase: 05-type-decoupling-entry-point-refactor
plan: 01
subsystem: core-types
status: complete
tags: [decoupling, types, pi-removal, mcp-tool-result]
dependencies:
  requires: [05-00]
  provides: [05-02, 05-03, 05-04]
  affects: [proxy-modes.ts, direct-tools.ts, tool-result-renderer.ts, sampling-handler.ts]
tech_stack:
  added: []
  patterns: [local-generic-result-type, adapter-boundary]
key_files:
  created: []
  modified:
    - types.ts
    - proxy-modes.ts
    - direct-tools.ts
decisions:
  - Kept McpImageContent.data field to match Pi's ImageContent shape and preserve tool-registrar.ts compatibility.
  - Placed McpToolResult<T>, McpTextContent, and McpImageContent next to existing McpContent definition in types.ts.
metrics:
  duration_minutes: 10
  completed_date: "2026-06-16T03:45:00Z"
  tasks_total: 3
  tasks_completed: 3
---

# Phase 5 Plan 1: Localize McpToolResult and Decouple proxy-modes / direct-tools

**One-liner:** Replaced remaining `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent` type imports in `types.ts`, `proxy-modes.ts`, and `direct-tools.ts` with local `McpToolResult<T>` and agent-agnostic abstractions from `interfaces/agent-api.ts`.

## What Changed

| Task | File | Change | Commit |
|------|------|--------|--------|
| 1 | `types.ts` | Added local `McpToolResult<T>`, `McpTextContent`, `McpImageContent`; removed `@earendil-works/pi-ai` import; updated `ContentBlock` alias | `2a98897` |
| 2 | `proxy-modes.ts` | Replaced Pi `AgentToolResult`/`ToolInfo` imports with `McpToolResult` from `types.ts` and `ToolInfo` from `interfaces/agent-api.ts`; renamed `getPiTools` → `getAgentTools` | `512ab70` |
| 3 | `direct-tools.ts` | Replaced Pi `AgentToolResult`/`AgentToolUpdateCallback`/`ExtensionContext` imports with `AgentContext` and `McpToolResult` | `d19943d` |

## Verification

- `npx tsc --noEmit` — **PASS** (exit 0)
- `npx vitest run --exclude='**/interactive-visualizer-server.test.ts'` — **PASS** (47 files, 464 tests)
- Plan acceptance grep checks — all zero Pi imports in modified files

### Requirement Traceability

- **DECOUPLE-01** — `proxy-modes.ts` and `direct-tools.ts` no longer import Pi `AgentToolResult`; local `McpToolResult` used.
- **DECOUPLE-03** — `direct-tools.ts` `ctx` typed as `AgentContext` instead of `ExtensionContext`.
- **DECOUPLE-04** — `proxy-modes.ts` imports generic `ToolInfo` from `interfaces/agent-api.ts`.

## Deviations from Plan

### Tooling Issues

**GitNexus impact DB unavailable during analysis**
- **Found during:** Pre-edit impact analysis
- **Issue:** `gitnexus impact` returned "LadybugDB unavailable ... Write-write conflict"; `gitnexus detect_changes` later returned CRITICAL risk level, but the risk was driven by unrelated uncommitted 05-02/05-03 changes (e.g., `sampling-handler.ts`, `adapters/pi-adapter.ts`), not by the 05-01 type-only edits.
- **Action:** Used `gitnexus context` as fallback to confirm callers (`index.ts` → `executeCall`, `index.ts` → `createDirectToolExecutor`). Proceeded with import/type-only changes since no function bodies were modified and blast radius was limited to type signatures.
- **Files modified:** `types.ts`, `proxy-modes.ts`, `direct-tools.ts`

## Known Stubs

None introduced by this plan. All changes are type/import replacements; no placeholder values or unwired data sources were added.

## Threat Flags

No new security-relevant surface was introduced. The `McpToolResult.content` shape was kept structurally identical to Pi's `AgentToolResult` (including `data` on image blocks) to satisfy threat-mitigation requirement **T-05-01-01**.

## Self-Check: PASSED

- [x] Modified files exist and contain expected exports
- [x] Commits `2a98897`, `512ab70`, `d19943d` exist in branch `v1.0`
- [x] `npx tsc --noEmit` passes
- [x] Full test suite (excluding interactive-visualizer) passes
