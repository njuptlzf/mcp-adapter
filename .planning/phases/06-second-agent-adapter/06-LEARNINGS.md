---
phase: 06
phase_name: second-agent-adapter
project: "Universal MCP Adapter"
generated: 2026-06-16
counts:
  decisions: 13
  lessons: 8
  patterns: 7
  surprises: 5
  total: 33
missing_artifacts: []
artifacts_consumed:
  - "06-CONTEXT.md"
  - "06-01-SUMMARY.md"
  - "06-02-SUMMARY.md"
  - "06-03-SUMMARY.md"
  - "06-04-SUMMARY.md"
  - "06-05-SUMMARY.md"
  - "06-UAT.md"
  - "tests/reports/qoder-adapter-test-report.md"
---

# Phase 06 Learnings — Second Agent Adapter (Qoder)

> Five-plan execution (06-01..06-05) implementing Qoder as a second supported agent alongside Pi, with the mcp-adapter-test skill run end-to-end proving full parity. This document extracts the durable knowledge — decisions made, lessons learned, patterns established, and surprises encountered — for future phases and for the next agent adapter (Phase 7+).

---

## 1. Decisions

Eleven locked decisions from `06-CONTEXT.md` plus two architectural choices surfaced in `06-05-SUMMARY.md` §Architectural Decisions. Each row carries its source.

### 1.1 Architectural shape (D-01..D-04)

| ID | Decision | Source | Rationale |
|----|----------|--------|-----------|
| **D-01** | Qoder (`@qoder-ai/qoder-agent-sdk@1.0.3`) is the second supported agent — **not** a mock or stub. | `06-CONTEXT.md` D-01, `06-01-SUMMARY.md` line 109 (`grep -c @earendil-works adapters/qoder-adapter.ts` = 0) | Real adapter parity is the whole point of the phase; mock would defeat ADAPTER-01/02/03. |
| **D-02** | QoderAdapter implements the **full** `AgentAPI` surface (8 methods: `registerTool`/`registerCommand`/`registerFlag`/`on`/`getAllTools`/`getFlag`/`sendMessage`/`exec`) — not a Pi-shaped subset. | `06-CONTEXT.md` D-02, `06-01-SUMMARY.md` line 75 | `createMcpAdapter` calls all 8 from `entry.ts:130-380`; partial implementation would break wiring. |
| **D-03** | Default config path is `~/.qoder/agent/`, honored via `MCP_AGENT_DIR` env override (same precedence as `agent-dir.ts:7-18`). | `06-CONTEXT.md` D-03, `06-01-SUMMARY.md` lines 67-70 | Matches `interfaces/agent-paths.ts` convention; `MCP_AGENT_DIR` env escape hatch already established for Pi. |
| **D-04** | `createQoderResolver` lives in **`interfaces/agent-paths.ts`** (not a new file) and extends the `AgentId` union with `"qoder"`. | `06-CONTEXT.md` D-04, `06-01-SUMMARY.md` lines 67-72 | Centralizes resolver factories alongside `createPiResolver`; `AgentId` extension is the single point of truth for `config.ts`/`loadMcpConfig`. |

### 1.2 Sampling boundary (D-05..D-06)

| ID | Decision | Source | Rationale |
|----|----------|--------|-----------|
| **D-05** | `QoderSamplingProvider` implements the `SamplingProvider` contract (`resolveModel` + `complete` + `confirm`). | `06-CONTEXT.md` D-05, `06-02-SUMMARY.md` line 65 | Mirrors `adapters/pi-sampling-provider.ts` shape; `sampling-handler.ts:53,63` already consumes any `SamplingProvider`. |
| **D-06** | Sampling SDK isolation: `adapters/qoder-sampling-provider.ts` is the **only** file in the project that imports `@qoder-ai/qoder-agent-sdk` for sampling purposes (D-06 boundary). | `06-CONTEXT.md` D-06, `06-02-SUMMARY.md` line 124 (`grep -n "from \"@qoder-ai/qoder-agent-sdk\""` = 1 hit, in this file) | Threat-model T-06-SC: minimize blast radius of new SDK dependency. |

### 1.3 UISystem & events (D-07..D-09)

| ID | Decision | Source | Rationale |
|----|----------|--------|-----------|
| **D-07** | `UISystem` is **minimal** for Qoder: only `notify` is defined; `form`/`setStatus`/`custom`/`theme` are explicitly `undefined`. | `06-CONTEXT.md` D-07, `06-01-SUMMARY.md` line 44, 8-test describe block in `__tests__/qoder-adapter.test.ts` | Qoder's UX surface is CLI-only at Phase 6 scope; `setStatus: undefined` is required to satisfy `init.ts:48` `typeof === "function"` elicitation guard (deviation #2 in `06-04-SUMMARY.md`). |
| **D-08** | `registerCommand` routes through the universal `/` command system that `createMcpAdapter` wires in `entry.ts:130-380`. | `06-CONTEXT.md` D-08 | No Qoder-specific command subsystem; reuse the `/mcp`, `/mcp-auth` plumbing. |
| **D-09** | `on()` event-driven lifecycle is **simulated** by companion methods (`attachQuery`, `detachQuery`, `fireSessionStart`, `fireSessionShutdown`, `fireToolRegistered`). | `06-CONTEXT.md` D-09, `06-01-SUMMARY.md` lines 82-85 | Qoder SDK has no synchronous programmatic lifecycle API; `createMcpAdapter` needs explicit `session_start` firing to drive `initializeMcp` from `entry.ts:156`. |

### 1.4 Verification (D-10..D-11)

| ID | Decision | Source | Rationale |
|----|----------|--------|-----------|
| **D-10** | Full mcp-adapter-test skill run (Section 4 + 5 + 5B + 6) is the parity benchmark. | `06-CONTEXT.md` D-10, `06-05-SUMMARY.md` lines 197-214 | The skill is the project's existing parity oracle; Qoder passes 132/132 against it. |
| **D-11** | File layout: `adapters/qoder-*.ts`, `interfaces/agent-paths.ts` (resolver only), `__tests__/qoder-*.test.ts`, `scripts/qoder-smoke.ts`. | `06-CONTEXT.md` D-11, `06-03-SUMMARY.md` line 25 | Mirrors Pi layout; new agent is a peer, not a subdirectory. |

### 1.5 Surfaced in execution (not in CONTEXT.md but locked in plan files)

| ID | Decision | Source | Rationale |
|----|----------|--------|-----------|
| **D-12** | `tests/reports/qoder-adapter-test-report.md` is **gitignored** (per `.gitignore:24`); Plan 06-05's completion is registered via `git commit --allow-empty` with full run summary in the message body. | `06-05-SUMMARY.md` Architectural Decisions §1 | Respects the user's pre-existing `.gitignore`; force-staging with `git add -f` would override their stated preference. Plan threat-model T-06-VT-01 explicitly accepts gitignored-or-tracked. |
| **D-13** | Capability Gate verdict for Qoder comes from `__tests__/qoder-adapter-integration.test.ts` test 1 (`registers the mcp-config flag, mcp/mcp-auth commands, and proxy tool`), **not** from running SKILL.md's Pi-biased prose verbatim. | `06-05-SUMMARY.md` Architectural Decisions §2 | SKILL.md §122-138 introspects Pi's tool-list format; the integration test asserts the same property (`mcp` proxy tool in adapter's tool registry) through QoderAdapter's own contract. Recorded as Phase 7 TEST-01..05. |

---

## 2. Lessons

Eight concrete lessons learned during execution. Each one cost at least one failed `tsc` or test run; documenting them so the next adapter (Phase 7+) avoids the same trial.

### L-1 — SDK method names in research docs are not always the typed public API
**Source:** `06-01-SUMMARY.md` deviation #3, `06-02-SUMMARY.md` deviation #4
**Cost:** 2 plan delays (~5 min each) + 1 tsc error
**Lesson:** RESEARCH.md and PLAN.md called the SDK method `getModels()`. The typed public API in `node_modules/@qoder-ai/qoder-agent-sdk/dist/types/options.d.ts:282` is `getAvailableModels(): Promise<ModelInfo[]>`. Always verify the SDK's actual `.d.ts` against the doc's method names; the docs may be using an informal alias. **Mitigation:** smoke script (06-01) duck-types both names; production code (06-02) uses the typed name with JSDoc citing the `.d.ts:282` line.

### L-2 — SDK `Options` interface has no top-level `signal` or `maxTokens` field
**Source:** `06-02-SUMMARY.md` deviation #2
**Cost:** 1 tsc error pass
**Lesson:** PLAN.md action step said to pass `maxTokens` and `signal` directly into `options`. Neither field exists on the SDK `Options` interface. **Mitigation:** drop `maxTokens` (the SDK uses `maxTurns` for turn budgets, not token budgets); bridge `request.signal` through `Options.abortController` and listen via `request.signal.addEventListener("abort", () => abortController.abort(reason))`. Document both in JSDoc for future enhancement.

### L-3 — `vi.spyOn(console, "error")` leaks across test files unless `mockRestore()` is called
**Source:** `06-04-SUMMARY.md` deviation #1
**Cost:** 1 round of test contamination debugging
**Lesson:** The plan outlined a `vi.spyOn(console, "error").mockImplementation(() => {})` in `beforeEach` but omitted `mockRestore()`. Without it, the spy persists across the entire test file and leaks into adjacent test files in the same vitest worker (workers are reused across files in a shard). **Mitigation:** always pair spy + restore (`afterEach(() => spy.mockRestore())`). The T-06-IT-03 secret-leak test depends on this isolation.

### L-4 — `exec` test fakes need `setImmediate`, not `queueMicrotask`
**Source:** `06-01-SUMMARY.md` deviation #1
**Cost:** 5-second timeouts across the entire `exec` describe block
**Lesson:** Test fake-child's `queueMicrotask(() => child.emit("data", ...))` fires before the adapter's listener attachments are registered, because the adapter's `await import("node:child_process")` resolves between the `cp.spawn(...)` call and the listener `on("data")` attachments. **Mitigation:** use `setImmediate(fire)` so lifecycle events fire on the next event-loop iteration, after the synchronous listener attachment block has completed. This is a generalizable pattern for any async-imported module + listener-attachment race.

### L-5 — Adapter-context builders that fabricate a `UISystem` literal will fail the elicitation guard
**Source:** `06-04-SUMMARY.md` deviation #2
**Cost:** 1 test failing in confusing ways
**Lesson:** The plan's `buildQoderContext` outline constructed `{ notify: vi.fn(), setStatus: vi.fn() }` directly, bypassing `adaptQoderContext`. The fabricated `setStatus: vi.fn()` would *pass* the `typeof === "function"` check in `init.ts:48` and accidentally enable elicitation — but the adapter's real `setStatus` is `undefined` per D-07. **Mitigation:** always use `adaptQoderContext(input, adapter)` so the adapter's actual UISystem flows through, matching production behavior. Don't fabricate UISystem literals in tests.

### L-6 — `Query` handles must be closed AFTER consumption, not before
**Source:** `06-02-SUMMARY.md` deviation #1
**Cost:** caught in self-review, no production impact
**Lesson:** First draft had `await handle.close()` before `await handle.getAvailableModels()`. Closing the SDK control surface before querying it returns empty/undefined results. **Mitigation:** consume first (`await getAvailableModels()`), then close in `try/finally`. The "method missing" early-return path also closes the handle.

### L-7 — Plan's literal `grep -c` acceptance criteria can collide with prescribed file content
**Source:** `06-03-SUMMARY.md` deviation #2
**Cost:** verification step needed a "documented as note" disposition
**Lesson:** The plan's `grep -c "@qoder-ai" adapters/qoder-renderer.ts` should return 0, but the plan's prescribed file content included `@qoder-ai/qoder-agent-sdk` in a JSDoc comment. The grep returns 1. **Mitigation:** when a plan prescribes file content verbatim and a `grep` check contradicts it, follow the file content (the source of truth) and document the grep as "intention satisfied, not literal match" — for `import` checks use `grep -E "^import .* @qoder-ai"` instead.

### L-8 — `git stash` + re-run is the canonical way to confirm a failure is pre-existing
**Source:** `06-04-SUMMARY.md` line 22, `06-05-SUMMARY.md` Note #4
**Cost:** 1 verification round
**Lesson:** When 2 test failures appear in the full suite but the plan only created new test files, the failures are almost certainly pre-existing. **Mitigation:** `git stash` this plan's changes → re-run the failing suite at the prior commit → if the same 2 fail, they're pre-existing and out-of-scope per the executor SCOPE BOUNDARY rule. Document the pre-existing artifacts (e.g., missing `examples/interactive-visualizer/dist/`) in the plan's "Notes" section rather than fixing them.

---

## 3. Patterns

Seven patterns established in Phase 6 that should be reused for Phase 7+ adapters (Claude, Cursor, etc.). Each pattern has a source file and a rationale.

### P-1 — Storage-bridging adapter (Maps + companion methods)
**Source:** `06-01-SUMMARY.md` line 21, `adapters/qoder-adapter.ts` lines 64-180
**Shape:** When the target agent SDK has no synchronous programmatic registration API (Qoder's `createSdkMcpServer` only runs at session start), the adapter uses **in-memory Maps** (`tools: Map`, `commands: Map`, `flags: Map`) for storage. The host bridges these to the SDK's session-start construction.
**Why:** Decouples registration (sync, testable) from SDK wiring (async, runtime-only). Allows the adapter to be unit-tested without spawning the agent CLI.

### P-2 — Companion `attachQuery` / `detachQuery` + buffered `sendMessage`
**Source:** `06-01-SUMMARY.md` line 22, `adapters/qoder-adapter.ts` lines 165-172
**Shape:** `sendMessage(message, options?)` routes through `Query.streamInput` when a query is attached via `attachQuery(q)`; otherwise buffers up to 32 messages for test introspection. `detachQuery()` clears the buffer.
**Why:** Production code uses the live Query; tests inspect the buffer without needing to mock `streamInput` exhaustively. The Set-based handler registry (P-3) shares the same "state + introspection" design philosophy.

### P-3 — Set-based handler registry
**Source:** `06-01-SUMMARY.md` line 25, `06-04-SUMMARY.md` deviation #4, `adapters/qoder-adapter.ts` line 144
**Shape:** `on(event, handler)` uses `Set<Handler>` (not `Array`). Registering the same handler twice is a no-op. Handlers fire in registration order.
**Why:** Prevents double-registration bugs (e.g., the `createMcpAdapter`-registered `session_start` handler firing twice). Also enables the `06-04-SUMMARY.md` test 2 pattern: register an observer spy **first**, then `createMcpAdapter` — the spy proves the fire mechanism works without depending on `createMcpAdapter`'s handler order.

### P-4 — `queryFn` dependency injection (Pitfall 3 mitigation)
**Source:** `06-02-SUMMARY.md` lines 24, 66, `adapters/qoder-sampling-provider.ts` line 8
**Shape:** `constructor(queryFn: QoderQueryFn = query, defaultModel?: SamplingModel)`. The `queryFn` default parameter is the real SDK `query`; tests override with `vi.fn()`. The test file never imports `@qoder-ai/qoder-agent-sdk` and never spawns `qodercli`.
**Why:** Pitfall 3 (in RESEARCH.md): spawning a CLI subprocess in tests is slow, flaky, and CI-hostile. Constructor injection is the standard mitigation. Also generalizable: any adapter-side method that wraps an SDK function should accept that function as a default-parameterized constructor argument.

### P-5 — Agent-agnostic integration test wiring through universal `createMcpAdapter`
**Source:** `06-04-SUMMARY.md` line 26
**Shape:** Integration tests call `createMcpAdapter(qoderAdapter, ctx, testConfig, null)` (the *real* factory, not a mock of it), then drive `qoderAdapter.fireSessionStart(ctx)` to trigger `initializeMcp`. Only the SDK `Query` is faked (`{ streamInput: vi.fn() }`).
**Why:** This pattern is the empirical proof of ADAPTER-03 ("integration test proving the new adapter works with `initializeMcp()`"). The faked SDK Query is the smallest possible surface — it lets the test exercise the real `McpServerManager` + real calculator stdio process + real `entry.ts` wiring without the operational cost of a live CLI. **This pattern should be the template for Phase 7+ adapter integration tests.**

### P-6 — `QODER_INTEGRATION=1` env-gated full smoke (default CI fast)
**Source:** `06-04-SUMMARY.md` line 27, `__tests__/qoder-adapter-integration.test.ts` lines 110-130
**Shape:** The test file splits into two `describe` blocks: 8 always-active lightweight tests (wiring + single calculator eager-connect) + 10 gated by `describe.skipIf(!process.env.QODER_INTEGRATION)`. Default CI runs 8 tests in ~2s; opt-in full smoke connects to all 10 demo servers.
**Why:** T-06-IT-04 DoS mitigation: prevents CI from spawning 10 stdio subprocesses on every PR. Mirrors a well-established pattern from `tests/smoke/`. **Generalizable:** every adapter integration test should follow the same 8-light + 10-full split.

### P-7 — `waitForConnection` via externally-observable proxy-tool registration
**Source:** `06-04-SUMMARY.md` line 28
**Shape:** The `McpExtensionState` is closure-private inside `createMcpAdapter` (line 64). The helper polls `adapter.tools.has("mcp")` every 100ms then sleeps 500ms to let the async eager connect settle. No reflection or closure-poking required.
**Why:** The only signal accessible from outside the closure is the proxy tool registration on the adapter's `tools` Map. The poll + 500ms settle is sufficient because (a) proxy registration is synchronous in `createMcpAdapter`, (b) calculator eager connect resolves in ~300ms in practice, (c) the proxy registration order guarantees observability. **This is a generalizable pattern for any "wait for async setup to complete" check against a closure-private state.**

---

## 4. Surprises

Five unexpected findings that future adapter work should anticipate.

### S-1 — `@qoder-ai/qoder-agent-sdk@1.0.3` is 5 days old and SUS-flagged in the npm registry
**Source:** `06-01-SUMMARY.md` Plan context (SUS checkpoint), the user's `approved` response
**Surprise:** npm's security scanner flagged the package. Required an explicit `checkpoint:human-verify` pause to get user approval before `npm install`. **Implication for Phase 7+:** any new agent SDK is likely to be young, low-trust-score, or SUS-flagged. Plan templates should reserve a `checkpoint:human-verify` for the install step of any new SDK dependency.

### S-2 — Section 5 / 5B target shortfalls (94% vs ≥95%; 56% vs ≥65%) are baseline-bound, not Qoder regressions
**Source:** `06-05-SUMMARY.md` Architectural Decisions §1, `tests/reports/qoder-adapter-test-report.md` §Pi vs Qoder parity table
**Surprise:** The token-savings and conversation-savings targets are 1-9 percentage points below threshold. The numbers are **identical** between Pi and Qoder. The shortfall is determined by the agent-agnostic proxy serializer (`adapters/tool-registrar.ts`) and the demo-server fixture set, not by the adapter. **Implication:** a "miss" against the Section 5/5B targets does not indicate a new regression; it indicates a pre-existing baseline characteristic. Document as 🟡 baseline-bound, not 🟢. **Phase 7 follow-up:** tighten the targets or the baseline fixture set so the ≥95%/≥65% goals are actually achievable.

### S-3 — Two pre-existing test failures in `__tests__/interactive-visualizer-server.test.ts` (missing build artifacts)
**Source:** `06-04-SUMMARY.md` line 22, `06-05-SUMMARY.md` Note #4, `06-UAT.md` Known Issues section
**Surprise:** The test expects `examples/interactive-visualizer/dist/{app.html,server.js}` to exist, but those build artifacts are absent. Confirmed pre-existing via `git stash` + re-run at commit `9f5b743`. **Implication:** any "fix all test failures before declaring done" workflow would have failed on a Phase-6 boundary. Document pre-existing failures in the plan's "Notes" section (per L-8) and in the phase's `06-UAT.md` "Known Issues" section. **Phase 7 follow-up:** either (a) add a build step that produces `dist/`, (b) skip the assertions when `dist/` is absent, or (c) remove the obsolete test file.

### S-4 — The `mcp proxy tool registered` property is the *only* Capability Gate signal that matters
**Source:** `06-05-SUMMARY.md` Architectural Decisions §2
**Surprise:** SKILL.md §122-138 describes the Capability Gate in terms of "Pi's tool list format". Running it verbatim against Qoder would either give an ambiguous answer or require Pi-specific introspection that QoderAdapter doesn't expose. The agent-agnostic equivalent is the single assertion "`mcp` proxy tool is in the adapter's tool registry", which is satisfied by `__tests__/qoder-adapter-integration.test.ts` test 1. **Implication:** the project's Capability Gate is *one bit* of information, not a multi-checklist. **Phase 7 follow-up (TEST-01..05):** generalize SKILL.md's gate inspector to ask `AgentAPI.getRegisteredTools()` (or equivalent) for any adapter, not just Pi.

### S-5 — `scripts/qoder-smoke.ts` exits 1 outside a Qoder host runtime, but `setModel("default")` succeeds first
**Source:** `06-01-SUMMARY.md` line 64, `06-05-SUMMARY.md` Note #3
**Surprise:** Running the smoke script as a plain Node.js process throws `Cannot read properties of undefined (reading 'request')` from the SDK's control protocol. Inside a Qoder host process, the same script completes. The error is *post-setup* — the SDK's `setModel` call works fine. **Implication:** smoke scripts that depend on agent-side runtime context cannot be run in isolation; they need an opt-in harness (e.g., a CI job that runs inside the agent host, or a QODER_INTEGRATION=1-style env gate). Don't add the smoke script's exit-1 as a CI failure.

---

## 5. Cross-Phase Implications

### 5.1 Phase 7 follow-ups (recorded in `tests/reports/qoder-adapter-test-report.md` and `06-UAT.md`)

- **TEST-01..05** — Generalize `mcp-adapter-test` skill's Capability Gate to detect any `AgentAPI` registration, not just Pi's tool-list format. Add adapter-agnostic harness, parametric Section 4+6 runner, port Qoder-specific assertions into the matrix.
- **DOC-01..03** — Update `README.md` to list Qoder as a first-class supported agent, add a "Supported agents" parity matrix, link the new test report.
- **FIX-01** — Decide on a disposition for the 2 pre-existing `interactive-visualizer-server.test.ts` failures: add a build step, skip-when-absent, or remove.

### 5.2 Reusable assets for Phase 7+ (Claude, Cursor, etc.)

- `adapters/qoder-adapter.ts` (317 lines) — template for storage-bridging adapter (P-1)
- `adapters/qoder-sampling-provider.ts` (321 lines) — template for `queryFn`-injected sampling provider (P-4)
- `adapters/qoder-renderer.ts` (placeholder) — template for thin pass-through renderer (D-11)
- `__tests__/qoder-adapter.test.ts` (40 tests) — template for AgentAPI surface contract tests
- `__tests__/qoder-adapter-integration.test.ts` (313 lines, 18 tests) — template for `createMcpAdapter` integration test (P-5, P-6)
- `scripts/qoder-smoke.ts` (120 lines) — template for SDK runtime probe (with the "exit 1 outside host runtime" caveat from S-5)
- `vitest.config.ts` coverage thresholds — template for per-source-file 80/60 thresholds with inline justification

### 5.3 Threat model additions worth carrying forward

- **T-06-01** (`~/` path traversal) — generalizes to any `create<Agent>Resolver` factory. Always anchor `~` to `homedir()` and document the `path.resolve(homedir(), "../...")` semantics.
- **T-06-02** (handler-args leak via `console.error`) — generalizes to any adapter's `fire()` implementation. Always log only event name + handler count, never args.
- **T-06-03** (auth boundary) — generalizes to any sampling provider. The caller injects the sampling provider; the adapter never constructs one (keeps auth boundary decoupled).
- **T-06-04** (EoP via `exec`) — generalizes to any adapter's `exec`. Always use `spawn` (not `exec`/`eval`) and document the "trusted host code only" boundary in JSDoc.
- **T-06-SC** (Pi-isolation: zero `@earendil-works/*` imports) — generalizes to any new agent adapter. The new agent must not transitively import the existing agent's packages.

---

## 6. Verification commands

```bash
# All Phase 6 deliverables on disk
test -f adapters/qoder-adapter.ts && \
  test -f adapters/qoder-sampling-provider.ts && \
  test -f adapters/qoder-renderer.ts && \
  test -f scripts/qoder-smoke.ts && \
  test -f __tests__/qoder-adapter.test.ts && \
  test -f __tests__/qoder-sampling-provider.test.ts && \
  test -f __tests__/qoder-adapter-integration.test.ts && \
  test -f tests/reports/qoder-adapter-test-report.md && \
  echo "all deliverables present"

# Pi-isolation: zero @earendil-works imports in qoder-* source
grep -rE '@earendil-works' adapters/qoder-*.ts scripts/qoder-smoke.ts | wc -l  # → 0

# SDK-import boundary: only the sampling provider imports @qoder-ai/qoder-agent-sdk
grep -lE 'from "@qoder-ai/qoder-agent-sdk"' adapters/qoder-*.ts scripts/qoder-smoke.ts  # → adapters/qoder-sampling-provider.ts

# Decision-bearing strings (presence checks)
grep -n "createQoderResolver" interfaces/agent-paths.ts
grep -n '"qoder"' interfaces/agent-paths.ts
grep -n "@qoder-ai/qoder-agent-sdk" package.json

# Test runs
npx tsc --noEmit                                                                              # clean
npx vitest run __tests__/qoder-adapter.test.ts                                              # 40/40
npx vitest run __tests__/qoder-sampling-provider.test.ts                                    # 14/14
npx vitest run __tests__/qoder-adapter-integration.test.ts                                  # 8/8 + 10 skipped (QODER_INTEGRATION=1)
QODER_INTEGRATION=1 npx vitest run __tests__/qoder-adapter-integration.test.ts              # 18/18
```

---

## 7. Sign-off

- **Phase 06 goal:** "Qoder is a first-class supported agent alongside Pi" — **ACHIEVED** (D-10 parity, 132/132 tests, 11/11 decisions, 3/3 requirements).
- **LEARNINGS completeness:** 13 decisions + 8 lessons + 7 patterns + 5 surprises = 33 durable items extracted (D-01..D-11 from CONTEXT.md + D-12..D-13 surfaced in plan execution). All have source attribution. No missing artifacts (all 5 SUMMARY + CONTEXT + UAT + report consumed).
- **Next action:** Update `STATE.md` Last Activity, commit `06-LEARNINGS.md`, present summary to user.
