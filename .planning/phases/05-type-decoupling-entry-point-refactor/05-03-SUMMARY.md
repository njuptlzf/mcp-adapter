---
phase: 05-type-decoupling-entry-point-refactor
plan: 03
subsystem: sampling
tags: [decoupling, sampling, provider, pi-ai, agent-agnostic]
dependencies:
  requires: []
  provides: [DECOUPLE-02, DECOUPLE-05]
  affects: [sampling-handler.ts, adapters/pi-adapter.ts, init.ts, interfaces/agent-api.ts]
tech-stack:
  added: []
  patterns: [SamplingProvider injection chain, adapter boundary]
key-files:
  created:
    - interfaces/sampling.ts
    - adapters/pi-sampling-provider.ts
    - __tests__/pi-sampling-provider.test.ts
  modified:
    - sampling-handler.ts
    - __tests__/sampling-handler.test.ts
    - interfaces/agent-api.ts
    - adapters/pi-adapter.ts
    - init.ts
    - __tests__/server-manager-sampling.test.ts
decisions:
  - Kept Pi model resolution logic identical by moving it verbatim into PiSamplingProvider.resolveModel
  - Stored resolved Pi Model<Api> in a WeakMap keyed by the returned SamplingModel so complete() can rehydrate it without leaking Pi types into the generic interface
  - Confirmation falls back from provider.confirm to ui.form (empty fields) to preserve non-Pi agent support per DECOUPLE-02
  - Added pi-sampling-provider.test.ts to preserve model-selection coverage that sampling-handler.test.ts can no longer exercise through a mocked provider
  - init.ts only enables sampling when ctx.samplingProvider is present, preventing runtime failures for agents without a sampling implementation
metrics:
  duration: 3542
  completed_date: "2026-06-16"
---

# Phase 05 Plan 03: Sampling Type Decoupling Summary

**One-liner:** Introduced a generic `SamplingProvider` interface and a Pi-specific `PiSamplingProvider` implementation, making `handleSamplingRequest` fully agent-agnostic while preserving Pi model selection and completion behavior.

## What Changed

- **`interfaces/sampling.ts`** (new): Agent-agnostic abstractions — `SamplingProvider`, `SamplingModel`, `SamplingRequest`, `SamplingResponse`, `SamplingMessage`, `SamplingTextContent`. No Pi imports.
- **`adapters/pi-sampling-provider.ts`** (new): The sole sampling-specific boundary that imports `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent`. Reproduces the original model-resolution order (hints → current → available), converts generic messages to Pi `Message[]`, calls `pi-ai.complete`, and returns a generic `SamplingResponse`.
- **`sampling-handler.ts`**: Removed all `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent` imports. Now depends only on `SamplingProvider`, `UISystem`, and MCP SDK types. Handles protocol validation, confirmation orchestration, and MCP result formatting.
- **`interfaces/agent-api.ts`**: Added optional `samplingProvider?: SamplingProvider` to `AgentContext`.
- **`adapters/pi-adapter.ts`**: `adaptPiContext` now constructs a `PiSamplingProvider` from Pi's `modelRegistry`, current `model`, and native `confirm` dialog, injecting it into `AgentContext`.
- **`init.ts`**: Passes `ctx.samplingProvider` to `manager.setSamplingConfig` instead of spreading Pi-specific model fields.
- **Tests**: Rewrote `__tests__/sampling-handler.test.ts` around a mocked `SamplingProvider`; updated `__tests__/server-manager-sampling.test.ts` for the new `ServerSamplingConfig` shape; added `__tests__/pi-sampling-provider.test.ts` to keep model-selection behavior verified.

## Verification

- `npx tsc --noEmit` passes.
- `npx vitest run __tests__/sampling-handler.test.ts __tests__/pi-sampling-provider.test.ts __tests__/server-manager-sampling.test.ts` passes (22/22 tests).
- `grep -v '^#' sampling-handler.ts | grep -c "@earendil-works" == 0`.
- `interfaces/sampling.ts` contains zero `@earendil-works` imports.
- `adapters/pi-adapter.ts` constructs `PiSamplingProvider` in `adaptPiContext`.
- `init.ts` references `ctx.samplingProvider` in `setSamplingConfig`.

## Deviations from Plan

### 1. Added `__tests__/pi-sampling-provider.test.ts`

- **Found during:** Task 3 test rewrite
- **Issue:** Once `sampling-handler.test.ts` mocks `SamplingProvider`, it can no longer verify Pi-specific model selection behavior (hints → current → available ordering, case-insensitive matching, auth fallback).
- **Fix:** Added a dedicated provider test file that clones the original model-selection test cases.
- **Files created:** `__tests__/pi-sampling-provider.test.ts`
- **Commit:** `e868345`

### 2. Write/SearchReplace tool silently failed for `adapters/pi-sampling-provider.ts`

- **Found during:** Task 2
- **Issue:** The `Write` tool reported "create file success" and printed a diff, but the file did not exist on disk. Subsequent `SearchReplace` edits on the file also reported success without persisting changes.
- **Fix:** Created a stub with `cat` via `Bash`, then used `Bash` heredoc to write the full file content. Verified with `wc -l` and `npx tsc --noEmit`.
- **Files affected:** `adapters/pi-sampling-provider.ts`
- **Commit:** `781df02`

### 3. `init.ts` sampling guard strengthened

- **Found during:** Task 4 wiring
- **Issue:** The plan instructs passing `ctx.samplingProvider` to `setSamplingConfig`, but agents without a sampling implementation would pass `undefined` and fail at runtime.
- **Fix:** Added `ctx.samplingProvider &&` to the sampling-enablement condition so sampling is only advertised when a provider exists.
- **Files modified:** `init.ts`
- **Commit:** `2f2f782`

## Threat Flags

No new threat surface introduced beyond what was captured in the plan's `<threat_model>`. The mitigation for T-05-03-01 is preserved: `autoApprove === false` requires either `provider.confirm` or `ui.form`; if neither is available, the request is rejected.

## Known Stubs

None. All sampling abstractions are wired to real implementations.

## Out-of-Scope Discoveries

- `__tests__/interactive-visualizer-server.test.ts` fails because `examples/interactive-visualizer/dist/app.html` and `dist/server.js` are missing. This is unrelated to the 05-03 changes and was not fixed. See `deferred-items.md` in this phase directory.

## Self-Check: PASSED

- [x] `interfaces/sampling.ts` exists
- [x] `adapters/pi-sampling-provider.ts` exists
- [x] `__tests__/pi-sampling-provider.test.ts` exists
- [x] All commits exist in `git log`
- [x] `npx tsc --noEmit` passes
- [x] Targeted vitest suite passes
