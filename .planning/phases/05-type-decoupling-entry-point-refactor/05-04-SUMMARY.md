---
phase: 05-type-decoupling-entry-point-refactor
plan: 04
subsystem: ui / rendering
wave: 2
tags: [decouple, uisystem, renderoutput, pi-tui, elicitation]
dependency_graph:
  requires:
    - 05-01-PLAN.md
    - 05-03-PLAN.md
  provides:
    - 05-05-PLAN.md
  affects:
    - elicitation-handler.ts
    - tool-result-renderer.ts
    - adapters/pi-renderer.ts
    - __tests__/elicitation-handler.test.ts
    - __tests__/tool-result-renderer.test.ts
    - __tests__/pi-renderer.test.ts
tech_stack:
  added:
    - adapters/pi-renderer.ts
    - __tests__/pi-renderer.test.ts
  patterns:
    - Generic UISystem form API for elicitation
    - RenderOutput string abstraction with Pi-specific Text wrapper in boundary adapter
key_files:
  created:
    - adapters/pi-renderer.ts
    - __tests__/pi-renderer.test.ts
  modified:
    - elicitation-handler.ts
    - tool-result-renderer.ts
    - __tests__/elicitation-handler.test.ts
    - __tests__/tool-result-renderer.test.ts
decisions:
  - Kept local ExtensionUIFormValue / ExtensionUIFormSelectOption aliases for shared value semantics while using FormConfig/FormResult/FormField from interfaces/agent-api.ts.
  - Mapped form field default property to the generic FormField `default` instead of Pi-specific `defaultValue`.
  - Left Pi Text wrapping out of tool-result-renderer.ts; the Pi boundary will be wired in 05-05 via adapters/pi-adapter.ts and piRenderWrapper.
metrics:
  duration: "7 minutes"
  completed_date: "2026-06-16T04:11:31Z"
  tasks_completed: 3
  files_changed: 6
---

# Phase 5 Plan 04: Elicitation & Renderer Type Decoupling Summary

Refactored the elicitation handler and tool-result renderer to use agent-agnostic abstractions (`UISystem`, `FormConfig`, `RenderOutput`) and moved Pi TUI `Text` wrapping into a dedicated boundary adapter.

## What Changed

| File | Change |
|------|--------|
| `elicitation-handler.ts` | Replaced `@earendil-works/pi-coding-agent` `ExtensionUIContext` with `UISystem` / `FormConfig` / `FormResult` / `FormField` from `./interfaces/agent-api.ts`. Removed Pi-specific form request/result/field types and switched form defaults to the generic `default` property. |
| `tool-result-renderer.ts` | Removed all `@earendil-works/pi-tui` and `@earendil-works/pi-coding-agent` imports. Now uses `McpToolResult`/`ContentBlock` from `./types.ts` and returns plain `RenderOutput` strings. |
| `adapters/pi-renderer.ts` | New boundary adapter exporting `RenderOutput` and `piRenderWrapper`, wrapping string output into Pi TUI `Text` at origin `(0, 0)`. |
| `__tests__/elicitation-handler.test.ts` | Updated assertions to match generic `FormField` shape (`default` instead of `defaultValue`). |
| `__tests__/tool-result-renderer.test.ts` | Removed Pi type imports; now imports `McpToolResult` from `./types.ts` and asserts string output directly. |
| `__tests__/pi-renderer.test.ts` | New unit test verifying string renderer output is wrapped in Pi TUI `Text`. |

## Verification

```bash
npx tsc --noEmit
npx vitest run __tests__/elicitation-handler.test.ts __tests__/tool-result-renderer.test.ts
```

Results:

- `npx tsc --noEmit`: ✅ passed
- `__tests__/elicitation-handler.test.ts`: ✅ 5 tests passed
- `__tests__/tool-result-renderer.test.ts`: ✅ 13 tests passed
- `__tests__/pi-renderer.test.ts`: ✅ 1 test passed

## GitNexus Impact Analysis

Per `AGENTS.md`, upstream impact analysis was run before editing the target symbols:

- `handleElicitationRequest`: **HIGH** risk — upstream callers include `McpServerManager.createClient`, `McpServerManager.createConnection`, and `checkConnections`.
- `renderMcpToolResult`: **LOW** risk — no upstream callers detected.
- `renderMcpProxyToolCall`: **LOW** risk — no upstream callers detected.

The HIGH risk for `handleElicitationRequest` is expected: the function is called during MCP client setup and the refactor only changes its `options.ui` type from a Pi-specific context to the generic `UISystem` contract. No call sites outside this file are affected by the type change because the surrounding registration logic in `server-manager.ts` still receives a concrete `UISystem`-compatible object.

## Deviations from Plan

None. Plan executed exactly as written.

## Auth Gates

None.

## Known Stubs

None. All new files are fully wired; no placeholder values or TODOs were introduced.

## Threat Flags

No new security-relevant surface was introduced. `tool-result-renderer.ts` continues to return plain strings only, with no execution or interpretation of embedded markup. `elicitation-handler.ts` preserves existing form result validation before constructing tool parameters.

## Self-Check: PASSED

- [x] `adapters/pi-renderer.ts` exists and exports `RenderOutput` + `piRenderWrapper`
- [x] `elicitation-handler.ts` has zero `@earendil-works` imports and zero `ExtensionUIContext` references
- [x] `tool-result-renderer.ts` has zero `@earendil-works` imports and zero `new Text` calls
- [x] All task commits recorded (`25c7fb4`, `7c46e37`, `9e28c03`)
- [x] Targeted tests and TypeScript type-check pass
