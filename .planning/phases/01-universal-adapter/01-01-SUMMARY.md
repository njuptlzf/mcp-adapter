---
phase: 01-universal-adapter
plan: 01-01
subsystem: universal-adapter
tags: [interfaces, adapter, pi, mcp, foundation]
dependency_graph:
  requires: []
  provides: [AgentAPI, AgentContext, UISystem, PiAdapter, adaptPiContext, MAPPING.md]
  affects: [package.json, index.ts, tsconfig.json]
tech_stack:
  added: []
  patterns: [adapter-pattern, type-erasure-at-boundary, optional-ui-capabilities]
key_files:
  created:
    - interfaces/agent-api.ts
    - adapters/pi-adapter.ts
    - MAPPING.md
    - __tests__/pi-adapter.test.ts
    - __tests__/integration.test.ts
  modified:
    - package.json
    - tsconfig.json
    - index.ts
decisions:
  - "D-01 sendMessage uses unknown message + unknown options"
  - "D-02 exec returns Promise<unknown>"
  - "D-03 all 8 AgentAPI methods are required"
  - "D-04 UISystem.notify is required; setStatus/form/custom optional"
  - "D-05 UISystem.setStatus/form/custom are optional"
  - "D-06 UISystem.theme.fg is optional"
  - "D-07 PiAdapter implements AgentAPI via direct pass-through"
  - "D-08 adaptPiContext converts ExtensionContext to AgentContext"
  - "D-09 @earendil-works/pi-coding-agent is now an optional peerDependency"
  - "D-10 @earendil-works/pi-ai and pi-tui are now optionalDependencies"
  - "D-15 piMcpAdapter named alias exported; default mcpAdapter unchanged"
  - "D-16 createMcpAdapter is NOT exported (implementation incomplete)"
  - "AgentContext.reload is optional and not populated by adaptPiContext (reload lives on ExtensionCommandContext, not the base ExtensionContext)"
metrics:
  duration_minutes: 9
  completed_date: 2026-06-10
---

# Phase 1 Plan 1: Universal Interfaces — Summary

One-liner: Generic `AgentAPI` / `UISystem` interfaces and a `PiAdapter` that bridges Pi's `ExtensionAPI`, plus MAPPING.md and backward-compatible exports, with all 8 API methods and 5 UI capabilities covered.

## What Shipped

- **`interfaces/agent-api.ts`** — Generic `AgentAPI` (8 required methods), `AgentContext`, `UISystem` (notify required, all others optional), and supporting types (`ToolInfo`, `ToolRegistration`, `CommandConfig`, `FlagConfig`, `FormConfig`, `FormResult`, `FormField`, `UIRenderer`, `UIOptions`).
- **`adapters/pi-adapter.ts`** — `PiAdapter implements AgentAPI` with direct pass-through to Pi's `ExtensionAPI` (type-erased at the boundary), plus `adaptPiContext(ctx: ExtensionContext): AgentContext` and an internal `adaptPiUI` that attaches `form`/`custom`/`theme.fg` only when present on the source UI.
- **`MAPPING.md`** — 8-row AgentAPI↔ExtensionAPI table, 5-row UISystem↔ExtensionUIContext table, AgentContext field mapping, type-mapping table, and an upstream-update checklist.
- **`package.json`** — `@earendil-works/pi-coding-agent` moved to `peerDependencies` (optional via `peerDependenciesMeta`); `@earendil-works/pi-ai` and `@earendil-works/pi-tui` moved to `optionalDependencies`; `interfaces/`, `adapters/`, and `MAPPING.md` added to `files`.
- **`index.ts`** — Added named exports `PiAdapter`, `adaptPiContext`, `piMcpAdapter` (alias of the default `mcpAdapter`), and type exports `AgentAPI`, `AgentContext`, `UISystem`. Default `mcpAdapter(pi: ExtensionAPI)` body unchanged.
- **`tsconfig.json`** — `include` extended with `interfaces/**/*.ts` and `adapters/**/*.ts` so `npx tsc --noEmit` covers the new code. Tests remain under vitest only (out of tsconfig scope) to keep pre-existing test type-errors out of the build gate.
- **Tests** — 13 PiAdapter unit tests + 9 integration tests. All 22 pass; full suite is 342/344 with 2 pre-existing failures in `interactive-visualizer-server.test.ts` (expects `examples/interactive-visualizer/dist/` artifacts that do not exist in the repo) — confirmed pre-existing on the base commit.

## Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | passes (no output) |
| `npx vitest run __tests__/pi-adapter.test.ts` | 13/13 pass |
| `npx vitest run __tests__/integration.test.ts` | 9/9 pass |
| `npx vitest run` (full) | 342/344 pass; 2 pre-existing failures unrelated to this plan |
| All 7 task files exist on disk | yes |
| All 7 task commits exist | yes (see commits below) |

## Deviations from Plan

1. **[Rule 3 — Blocking fix] `tsconfig.json` `include` extended** to `["*.ts", "interfaces/**/*.ts", "adapters/**/*.ts"]`. Without this, `npx tsc --noEmit` does not check the new code, so plan success criterion #1 ("TypeScript compiles") would not be meaningful.
2. **[Rule 3 — Blocking fix] `AgentContext.reload` omitted from `adaptPiContext`.** The plan listed `reload?` on `AgentContext`, but Pi's base `ExtensionContext` does not expose `reload` — it lives on `ExtensionCommandContext` only. Kept the interface member optional and simply did not populate it from the base context.
3. **[Rule 3 — Blocking fix] Test directory excluded from `tsconfig.json` `include`.** Initial draft included `__tests__/**` in `tsconfig`, which surfaced ~10 pre-existing type errors in unrelated test files (e.g. `config.test.ts`, `elicitation-handler.test.ts`). Per scope-boundary rules, those are out of scope; tests are validated by `npm test` only.
4. **Package distribution note:** After this change, `npm install pi-mcp-adapter` will no longer install `@earendil-works/pi-coding-agent`. Existing Pi users must add it to their own `package.json` (most do already, as it's a transitive dep of Pi itself). This is intentional per D-09 but is a behavioral change worth flagging in the next release notes.

No stubs, no deferred security surface, no threat-model discrepancies. Sampling/elicitation handlers were not touched in this plan (per D-12/D-13/D-14, that work belongs to Phase 3).

## Commits

- `b600539` — `feat(01-01): add AgentAPI and UISystem generic interfaces`
- `c7d9054` — `feat(01-01): add PiAdapter wrapping Pi ExtensionAPI`
- `e37c3f1` — `docs(01-01): add MAPPING.md for AgentAPI ↔ Pi surface`
- `0f69bfa` — `refactor(01-01): move Pi packages to optional peer/optional deps`
- `37de50e` — `feat(01-01): re-export PiAdapter, types, and piMcpAdapter alias`
- `c195f4f` — `test(01-01): add unit tests for PiAdapter and adaptPiContext`
- `bd45399` — `test(01-01): add integration tests for backward compatibility`

## Self-Check: PASSED

All 7 task files exist on disk, all 7 commit hashes resolve in `git log`, `npx tsc --noEmit` produces no diagnostics, and the 22 new tests pass.
