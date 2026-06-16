---
phase: 06-second-agent-adapter
plan: 02
subsystem: agent-adapters
tags: [qoder, sampling, mcp, sdk-integration, secret-leak-mitigation]
dependency_graph:
  requires:
    - phase: 06-second-agent-adapter
      plan: 01
      provides: "@qoder-ai/qoder-agent-sdk@^1.0.3 dependency, QoderAdapter.forwardSamplingProvider via input.samplingProvider"
  provides:
    - "QoderSamplingProvider implementing SamplingProvider (resolveModel + complete + confirm)"
    - "Sampling SDK isolation (D-06): adapters/qoder-sampling-provider.ts is the only sampling boundary importing @qoder-ai/qoder-agent-sdk"
    - "queryFn dependency injection (Pitfall 3): tests inject a vi.fn() mock without spawning qodercli"
    - "Contract test verifying resolveModel + complete + secret-leak mitigation (T-06-03)"
  affects:
    - "adapters/qoder-sampling-provider.ts (new boundary file)"
    - "__tests__/qoder-sampling-provider.test.ts (new test file)"
    - "interfaces/sampling.ts (consumed — unchanged)"
    - "sampling-handler.ts (consumed via SamplingProvider — unchanged)"
tech-stack:
  added: []
  patterns:
    - "Constructor-injected factory pattern (Pitfall 3 mitigation): queryFn: typeof query = query"
    - "Silent-fallback resolveModel (T-06-03b): catches SDK errors, returns undefined, never throws"
    - "AbortSignal bridge: request.signal -> Options.abortController (SDK has no top-level signal)"
    - "Test-internal mock factory: vi.fn() wrapped, no vi.mock() of @qoder-ai/qoder-agent-sdk"
    - "Spy-based secret-leak assertion: console.log/error/debug spy with /key|token|secret/ regex"
key-files:
  created:
    - adapters/qoder-sampling-provider.ts
    - __tests__/qoder-sampling-provider.test.ts
  modified: []
decisions:
  - "resolveModel uses Query.getAvailableModels() (the SDK's typed public method at dist/types/options.d.ts:282) instead of the informal 'getModels' alias from RESEARCH.md / PLAN.md; the smoke script at scripts/qoder-smoke.ts already documents this naming and duck-types both"
  - "complete drops Options.maxTokens (the SDK does not expose a top-level maxTokens field; turn budgets use maxTurns) and bridges request.signal through Options.abortController (the SDK has no top-level signal field). Documented in JSDoc for future enhancement"
  - "confirm returns true unconditionally (Qoder has no programmatic confirm UI at Phase 6 scope); documented as Phase-6-scope limitation"
  - "Discovery Query handle in resolveModel is closed after getAvailableModels() resolves (try/finally), not before — initial draft closed before reading models which would have made getAvailableModels() unusable; fixed via Rule 1 auto-correction"
  - "D-06 boundary preserved: only this file imports @qoder-ai/qoder-agent-sdk for sampling purposes; the test file uses dependency injection only and never imports the SDK"
  - "T-06-03 strictly enforced: no console.* call ever includes the system prompt, the messages, or the model API key. Error paths use console.debug with only the provider/id string or a stable event name"
metrics:
  duration_minutes: 12
  completed_date: 2026-06-16
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  commits: 2
---

# Phase 6 Plan 2: QoderSamplingProvider Summary

**One-liner:** `QoderSamplingProvider` bridges the Qoder SDK's `query()` + `getAvailableModels()` to the agent-agnostic `SamplingProvider` contract with `queryFn` injection so unit tests never spawn `qodercli`, plus a 14-test vitest contract covering model discovery, completion, abort-signal bridging, and T-06-03 secret-leak mitigation.

## What was built

### `adapters/qoder-sampling-provider.ts` (321 lines)
The sole sampling boundary that imports `@qoder-ai/qoder-agent-sdk` (D-06).

- **Imports (strict type-only where applicable):**
  - Type-only: `SamplingModel`, `SamplingProvider`, `SamplingRequest`, `SamplingResponse`, `SamplingMessage`, `SamplingTextContent` from `../interfaces/sampling.ts`.
  - Type-only: `ModelPreferences` from `@modelcontextprotocol/sdk/types.js`.
  - Runtime: `query` (default factory parameter) from `@qoder-ai/qoder-agent-sdk`.
  - Zero imports from `@earendil-works/pi-*` (T-06-SC isolation).

- **`QoderSamplingProvider` class** implementing `SamplingProvider`:
  - Constructor: `constructor(queryFn: QoderQueryFn = query, defaultModel?: SamplingModel)`. The `queryFn` default enables real SDK use in production; tests override with a `vi.fn()` mock (Pitfall 3 mitigation — no real `qodercli` subprocess).
  - `resolveModel(prefs?)`:
    - Calls `queryFn({ prompt: "", options: { model: "default" } })` to obtain a `Query` handle, then `handle.getAvailableModels()`.
    - Closes the handle in a `try/finally` after `getAvailableModels()` resolves.
    - Honors `ModelPreferences.hints[].name` via case-insensitive substring match against `value` / `displayName` / `modelId`. Falls back to the first available model when no hint matches.
    - **Never throws.** SDK errors, empty model lists, and missing `getAvailableModels` all return `this.defaultModel` (or `undefined`). Only `console.debug` with a stable event name is emitted (T-06-03b).
  - `complete(model, request)`:
    - Builds the composite model id `${provider}/${id}` and the prompt string from `request.messages` (handles both `string` content and `SamplingTextContent[]` blocks).
    - Constructs `Options` with `model` and bridges `request.signal` through `Options.abortController` (the SDK has no top-level `signal` field).
    - Iterates the async iterable until a `result` message arrives; maps `subtype === "success"` → `{ text, model, stopReason: "endTurn" }`; maps `subtype` starting with `error_` → `{ text: errors.join("\n"), stopReason: subtype }`; `subtype === "error"` throws (so `sampling-handler.ts` can produce a structured MCP error); otherwise throws `Error("Qoder sampling returned no result message")`.
    - Closes the handle in a `finally` block.
    - **T-06-03:** on any thrown error, logs `console.debug("[mcp-adapter/qoder] complete: Qoder sampling failed for ${modelId}")` — provider/id string only, never the prompt, messages, systemPrompt, or API key.
  - `confirm(title, message)` — returns `true` (auto-approve). JSDoc notes Qoder has no programmatic confirm UI at Phase 6 scope; future enhancement may add a caller-supplied dialog.

- **Type guard helpers (file-local, not exported):**
  - `pickModel(models, prefs)` — first-match by hint, fallback to first model.
  - `buildPrompt(messages)` — reduce `SamplingMessage[]` to a single string prompt.
  - `extractBlockText(block)` — narrow `SamplingTextContent` to a string.
  - `interpretResult(msg, modelId)` — map SDK `result` subtypes to `SamplingResponse`.
  - `asString` / `asStringArray` — runtime narrowing helpers for the duck-typed SDK message union.

### `__tests__/qoder-sampling-provider.test.ts` (14 tests, all green)
Five describe blocks via dependency injection (no `vi.mock` of `@qoder-ai/qoder-agent-sdk`):

- **`QoderSamplingProvider.resolveModel`** (6 tests):
  - `returns the first model from Query.getAvailableModels()` — fake returns `[{ value: "gpt-4", displayName: "GPT-4" }]` → asserts `{ provider: "qoder", id: "gpt-4", name: "GPT-4" }`.
  - `returns undefined when getAvailableModels returns an empty list` — `[]` → `undefined`.
  - `returns undefined (does not throw) when queryFn throws` — `qodercli unreachable` propagated as a thrown Error inside the factory → `undefined` (silent-fallback contract).
  - `returns the defaultModel when set and getAvailableModels fails` — fallback `{ provider: "qoder", id: "fallback", name: "Fallback" }` returned unchanged.
  - `honors ModelPreferences.hints via case-insensitive substring match` — hints `[{ name: "OpUs" }]` matched against `opus` model.
  - `returns undefined when getAvailableModels is missing on the Query handle` — fake Query without `getAvailableModels` → `undefined`.

- **`QoderSamplingProvider.complete`** (7 tests):
  - `returns SamplingResponse with text + model + stopReason on subtype 'success'` — `{ type: "result", subtype: "success", result: "Hello there" }` → `{ text: "Hello there", model: "qoder/gpt-4", stopReason: "endTurn" }`.
  - `returns stopReason=error_during_execution with joined errors on that subtype` — `{ errors: ["boom", "kapow"] }` → `stopReason: "error_during_execution"`, `text: "boom\nkapow"`.
  - `throws on subtype 'error' so MCP sampling-handler can surface it` — rejects with `/rate limited/`.
  - `throws when no result message is received before the iterator ends` — only `assistant` message yielded → rejects with `/no result message/`.
  - `concatenates message content (string and SamplingTextContent[]) into a single prompt` — three-message request → prompt equals `"First user line\n\nAssistant reply\n\nSecond user line"`.
  - `passes the composite model id (\`{provider}/{id}\`) into options.model` — `options.model === "qoder/gpt-4"`.
  - `never logs API keys, systemPrompt, or message content (T-06-03)` — error path triggered; regex `/key|token|secret|prompt content|Hello/` matched against `console.error` / `console.log` / `console.debug` spy calls; all zero.

- **`QoderSamplingProvider.confirm`** (1 test):
  - `returns true by default` — `provider.confirm("title", "message")` resolves to `true`.

- **`beforeEach`** in each block: `vi.spyOn(console, "error"/"log"/"debug")` to suppress noise and enable secret-leak assertions.

## Verification results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS (no errors) |
| `npx vitest run __tests__/qoder-sampling-provider.test.ts` | 14/14 PASS |
| `npx vitest run __tests__/qoder-adapter.test.ts __tests__/pi-sampling-provider.test.ts __tests__/sampling-handler.test.ts` | 57/57 PASS (no regressions) |
| `test -f adapters/qoder-sampling-provider.ts` | FOUND (321 lines, ≥120 min) |
| `grep -n "class QoderSamplingProvider" adapters/qoder-sampling-provider.ts` | line 72 |
| `grep -n "implements SamplingProvider" adapters/qoder-sampling-provider.ts` | line 72 |
| `grep -n "queryFn" adapters/qoder-sampling-provider.ts` | lines 8, 74, 93, 183 (constructor injection + JSDoc + 2 usages) |
| `grep -c '@earendil-works' adapters/qoder-sampling-provider.ts` | 0 (T-06-SC isolation) |
| `grep -n 'from "@qoder-ai/qoder-agent-sdk"' adapters/qoder-sampling-provider.ts` | line 33 (D-06 sampling boundary) |
| `grep -c 'console\.log' adapters/qoder-sampling-provider.ts` | 0 (T-06-03) |
| `grep -n 'console\.error\|console\.warn' adapters/qoder-sampling-provider.ts \| grep -i "key\|token\|secret\|api"` | 0 (T-06-03: no secrets in error logs) |
| `test -f __tests__/qoder-sampling-provider.test.ts` | FOUND (289 lines) |
| `grep -c 'QoderSamplingProvider' __tests__/qoder-sampling-provider.test.ts` | 20 (import + many usages) |
| `grep -c 'vi\.fn' __tests__/qoder-sampling-provider.test.ts` | 2 (Pitfall 3 mock factory) |
| `grep -cE 'key\|token\|secret' __tests__/qoder-sampling-provider.test.ts` | 1 (line 278, the secret-leak regex pattern) |
| `grep -c 'import.*@qoder-ai/qoder-agent-sdk' __tests__/qoder-sampling-provider.test.ts` | 0 (D-06 boundary preserved in tests) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] resolveModel closed the discovery Query handle BEFORE calling getAvailableModels()**
- **Found during:** Task 1 (initial review after tsc passed)
- **Issue:** First draft had `await handle.close()` before `await handle.getAvailableModels()`. In production this would always return an empty / undefined model list because the SDK control surface would be torn down before being queried. Caught during self-review of the file.
- **Fix:** Reordered so `getAvailableModels()` runs first, then `handle.close()` runs in a `finally` block. Both happy-path and the "method missing" early-return now correctly close the handle.
- **Files modified:** `adapters/qoder-sampling-provider.ts`
- **Commit:** 09afc04

**2. [Rule 1 - Bug] TypeScript errors in Options construction (Options.maxTokens and Options.signal don't exist on the SDK)**
- **Found during:** Task 1 (tsc --noEmit step)
- **Issue:** PLAN.md and the plan's <action> block say to pass `maxTokens` and `signal` directly into `options`. The SDK's `Options` interface (verified at `node_modules/@qoder-ai/qoder-agent-sdk/dist/types/options.d.ts`) does NOT declare either field. `tsc --noEmit` rejected both.
- **Fix:**
  - Dropped `maxTokens` (the SDK enforces turn budgets via `maxTurns`, not token budgets at the Options level; the request's `maxTokens` is informational only).
  - Bridged `request.signal` through `Options.abortController` (the SDK has no top-level `signal`). The bridge listens to `request.signal` and calls `abortController.abort(reason)` once.
  - Documented both choices in JSDoc for future enhancement.
- **Files modified:** `adapters/qoder-sampling-provider.ts`
- **Commit:** 09afc04

**3. [Rule 3 - Blocking] Strict-mode narrowing for `interpretResult` parameter**
- **Found during:** Task 1 (tsc --noEmit step)
- **Issue:** The narrowed message type `as { type?: string; subtype?: string; ... }` (with `subtype` optional) was passed to `interpretResult` whose parameter type required `subtype: string`. TS2339 error: "Property 'subtype' is optional ... but required".
- **Fix:** Re-narrowed inline inside the call site: `interpretResult({ subtype: msg.subtype, result: asString(msg.result), errors: asStringArray(msg.errors) }, modelId)`. Added `asString` / `asStringArray` helpers to keep the runtime narrowing explicit.
- **Files modified:** `adapters/qoder-sampling-provider.ts`
- **Commit:** 09afc04

**4. [Rule 2 - Critical] Plan-vs-SDK naming: getModels() vs getAvailableModels()**
- **Found during:** Task 1 (reading the SDK .d.ts)
- **Issue:** PLAN.md action step says "Call `handle.getModels()`" but the SDK's typed public API is `Query.getAvailableModels(): Promise<ModelInfo[]>`. RESEARCH.md and PLAN.md use the informal alias `getModels`. Using `getModels()` would fail at runtime against the real SDK (TypeScript would also reject it under strict mode).
- **Fix:** Implementation uses `getAvailableModels()`. JSDoc explicitly cites `dist/types/options.d.ts:282` and references the smoke script's duck-typed fallback (`scripts/qoder-smoke.ts:65-70`). Production code uses the typed name; smoke script remains backward-compatible.
- **Files modified:** `adapters/qoder-sampling-provider.ts`
- **Commit:** 09afc04

### No architectural changes required.
### No authentication gates hit.
### GitNexus impact analysis: `gitnexus_impact` MCP tool unavailable in this environment (CLI fallback limited to index/serve). Manual impact analysis performed: `SamplingProvider` is referenced by `sampling-handler.ts:53,63` and `qoder-adapter.ts:42,60` (type-only). The new file is additive — no callers need updating. **Risk: LOW.**

## Threat model compliance

| Threat | Disposition | Status |
|--------|-------------|--------|
| T-06-03 (secret leak in `complete`) | mitigate via console.debug only logging provider/id | DONE — verified by `never logs API keys, systemPrompt, or message content` test (regex `/key\|token\|secret/` against console.error/log/debug mock calls) |
| T-06-03b (SDK error leak in `resolveModel`) | mitigate via silent-fallback returning `undefined` | DONE — verified by `returns undefined (does not throw) when queryFn throws` and `returns undefined when getAvailableModels is missing` |
| T-06-03c (repudiation in mock factory) | accept — deterministic mock | DONE — `vi.fn()` records captured args; lastCall() introspection covers prompt + options |
| T-06-03d (EoP via signal passthrough) | mitigate via Options.abortController bridge | DONE — `request.signal` abort propagates to the SDK via controller.abort(reason) |
| T-06-SC (Pi isolation) | mitigate via zero `@earendil-works/*` imports | DONE — `grep -c @earendil-works` = 0 |
| D-05 (sampling contract) | provide QoderSamplingProvider implementing SamplingProvider | DONE — `implements SamplingProvider` confirmed; `resolveModel` + `complete` + `confirm` all present |
| D-06 (sampling isolation) | restrict SDK imports to `adapters/qoder-sampling-provider.ts` | DONE — `grep -n 'from "@qoder-ai/qoder-agent-sdk"'` shows only this file; test file has zero direct SDK imports |

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | `09afc04` | `feat(06-02): implement QoderSamplingProvider with queryFn injection` |
| 2 | `4a16217` | `feat(06-02): add QoderSamplingProvider contract tests with mock queryFn` |

## Self-Check: PASSED

- Both task commits exist in `git log --oneline`.
- `adapters/qoder-sampling-provider.ts` exists on disk (321 lines).
- `__tests__/qoder-sampling-provider.test.ts` exists on disk (289 lines).
- `npx tsc --noEmit` clean.
- `npx vitest run __tests__/qoder-sampling-provider.test.ts` — 14/14 green.
- Adjacent test suites (`qoder-adapter`, `pi-sampling-provider`, `sampling-handler`) — 57/57 green (no regressions).
- All D-06 / T-06-03 / T-06-SC grep checks pass.

## What this plan does NOT cover (forwarded to Plan 03+)

- `entry.ts` Qoder branch — Plan 03 wires `createMcpAdapter({ agent: "qoder", samplingProvider: new QoderSamplingProvider() })`.
- E2E integration test (`__tests__/qoder-sampling-integration.test.ts`) — Plan 03 owns the full MCP sampling flow.
- D-10 full-flow parity test — Plan 03.
- AbortSignal timeout tests against a real qodercli subprocess — explicitly out of scope (Pitfall 3: tests must not spawn qodercli).

## Requirements satisfied

- **SAMPLING-01** — `QoderSamplingProvider` (`adapters/qoder-sampling-provider.ts`) implements the generic `SamplingProvider` contract: `resolveModel`, `complete`, and `confirm`.
- **SAMPLING-02** — `resolveModel` returns `undefined` (never throws) on SDK failure so `sampling-handler.ts` can apply its fallback chain.
- **SAMPLING-03** — `complete` returns a `SamplingResponse` with `text` + `model` + `stopReason` on `subtype === "success"`.
- **SAMPLING-04** — Test file mocks the `queryFn` constructor parameter with `vi.fn()`; no `qodercli` subprocess is spawned (Pitfall 3 mitigation).
- **SAMPLING-05** — T-06-03 secret-leak mitigation enforced via `console.debug`-only logging and a regex spy test (`/key\|token\|secret/`).
- **SAMPLING-06** — D-06 isolation preserved: `@qoder-ai/qoder-agent-sdk` is imported only by `adapters/qoder-sampling-provider.ts`.
