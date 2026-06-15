---
name: mcp-adapter-test
description: >
  Full mcp-adapter integration test. Runs MockAgent compatibility (Section 4),
  token benchmark (Section 5/5B), proxy mode unit tests, directTools unit +
  integration tests, and E2E validation (Section 6) against all 10 demo MCP
  servers. Supports three E2E paths: mcp proxy, directTools, or SDK fallback.
  Generates reports under tests/reports/.
  Use when user says "run mcp-adapter tests", "test mcp-adapter",
  "验证 mcp-adapter", "测试 mcp-adapter", or "/mcp-adapter-test".
---

# mcp-adapter Integration Test

Executes the test plan (`docs/mcp-adapter-test-plan.md`) end-to-end.

## Quick Start

Say `/mcp-adapter-test` and the agent will:
1. Run 44 MockAgent compatibility tests
2. Measure token savings (tiktoken benchmark + conversation simulation)
3. Run proxy mode unit tests (search/describe/call logic)
4. Run directTools unit + integration tests (resolveDirectTools + real MCP SDK calls)
5. Detect environment (Capability Gate) and run E2E tests via the best available path:
   - **Path A**: mcp proxy tool → verify search→describe→call through the adapter
   - **Path B**: directTools → verify individual tool registration + calls
   - **Path C**: SDK_DIRECT fallback → MCP SDK stdio connection (always works)
6. Generate all reports under `tests/reports/`

## Pre-flight

```bash
# Run from project root
mkdir -p tests/reports
```

---

## Phase 1: MockAgent Compatibility (Section 4)

```bash
npx vitest run tests/compatibility/ --reporter=verbose
```

**Pass criteria**: 44/44
- 40 cases: 10 servers × 4 generic tests (TC-A1 register, TC-A2 search, TC-A3 describe, TC-A4 call)
- 4 cases: AgentAPI contract (TC-A5 single proxy, TC-A6 resolver, TC-A7 no-UI, TC-A8 directTools)

**If any fail**: stop and report. Do NOT continue to Phase 2.

Record per-server results for the master report (Phase 5).

---

## Phase 2: Token Benchmark (Section 5)

Run sequentially:

```bash
npx tsx tests/token-benchmark/run-baseline.ts
npx tsx tests/token-benchmark/run-adapter.ts
npx tsx tests/token-benchmark/report.ts
```

Verify `tests/token-benchmark/benchmark-report.md` is generated.

**Pass criteria**:
| Metric | Target |
|--------|--------|
| Proxy tool definition tokens | ≤ 300 |
| 10-server combined savings | ≥ 95% |

---

## Phase 3: Conversation Cost Simulation (Section 5B)

```bash
npx tsx tests/token-benchmark/run-conversation-sim.ts
```

If `run-conversation-sim.ts` does not exist, skip and note `⚠️ SKIP (script not yet implemented)`.

**Pass criteria**:
| Metric | Target |
|--------|--------|
| 4-server conversation total savings | ≥ 65% |
| Search overhead (4 discoveries) | ≤ 300 tokens |

---

## Phase 4: E2E Validation (Section 6)

### Step 0 — Create `.mcp.json`

Check if `.mcp.json` exists at project root. If NOT, create it using the config in [references/mcp-config.md](references/mcp-config.md).

> This file IS in `.gitignore` (agent-generated, not project source).

---

### Step 1 — Proxy Mode Unit Tests (always runs)

```bash
npx vitest run __tests__/proxy-modes-discovery.test.ts __tests__/proxy-modes-auto-auth.test.ts __tests__/proxy-modes-ui-messages.test.ts --reporter=verbose
```

**Pass criteria**: All proxy unit tests pass.

---

### Step 2 — directTools Unit + Integration Tests (always runs)

```bash
npx vitest run __tests__/direct-tools.test.ts __tests__/direct-tools-auto-auth.test.ts --reporter=verbose
npx vitest run tests/smoke/e2e-direct-tools.test.ts --reporter=verbose
```

**Pass criteria**: 14 cases (unit 5 + integration 9) all pass.

---

### Step 3 — Capability Gate (environment detection)

Check the agent's tool list to determine which E2E path to take:

- **Path A — mcp proxy**: `mcp` tool IS in the agent's tool list
  → mcp-adapter is loaded and tools are routed through the single `mcp` proxy tool.
  Verify the complete search→describe→call flow through the proxy for all 10 servers.

- **Path B — directTools**: Individual prefixed tools ARE in the agent's tool list
  (e.g. `calculator_add`, `calculator_subtract`, `string-utils_upper`)
  → mcp-adapter is loaded with `directTools: true` and tools are registered individually.
  Verify individual tool existence and functionality.

- **Path C — SDK_DIRECT fallback**: NEITHER Path A nor Path B
  → mcp-adapter is NOT loaded as an extension in this environment.
  Run all E2E tests via MCP SDK direct stdio connection.

> **CRITICAL — No Auto-Skip**: If a path requires prerequisites the environment
> doesn't have, do NOT silently skip. Consult the user: "Path [X] requires
> [prerequisite]. Should I construct the prerequisites and run it, or is the
> existing contract-level coverage sufficient?" Then proceed per user decision.

---

### Step 4 — Run E2E tests (all paths)

```bash
npx vitest run tests/smoke/e2e-all-servers.test.ts --reporter=verbose
```

**Pass criteria**: 25/25
- E2E-03: calculator search→describe→call (3 tests)
- E2E-04: all 10 servers discover + smoke call (20 tests)
- E2E-06: multi-turn calculator→unit-converter (2 tests)

---

### Step 5 — Path-specific verification

**If Path A (mcp proxy available):**
1. `mcp({})` → status shows all 10 configured servers
2. Per server: `mcp({ search: "keyword" })` → returns matching tool descriptions
3. `mcp({ describe: "tool_name" })` → returns parameter schemas
4. `mcp({ tool: "tool_name", args: '{"key":"value"}' })` → returns correct result
5. Run smoke calls for all 10 servers through the proxy (see Smoke Calls Reference below)

Record path-specific results for the master report (Phase 5).

**If Path B (directTools available):**
1. Confirm individual tools appear: `calculator_add`, `calculator_subtract`, etc.
2. Call `calculator_add({a: 10, b: 20})` directly (not via mcp proxy) → "30"
3. Verify tool naming follows the prefix mode (server prefix is default)
4. Confirm no `mcp` proxy tool exists (individual tools replace it)
5. Run at least 1 smoke call per server via its individual tools

**If Path C (SDK_DIRECT fallback):**
Step 4 already covers this. Record "Path C — SDK_DIRECT fallback" for master report.

---

## Phase 5: Master Report

Write a single `tests/reports/mcp-adapter-test-report.md` containing ALL results:

1. Overall pass/fail summary (all phases)
2. Per-phase detail (counts, duration, failures):
   - Phase 1: MockAgent compatibility + per-server results table
   - Phase 2: Token benchmark summary + per-server savings
   - Phase 3: Conversation simulation results
   - Phase 4: Proxy unit tests + directTools unit/integration + E2E per-server pass/fail
   - Capability Gate result (Path A/B/C)
3. Pass criteria checklist (target vs actual)
4. Bugs found / notes

> Do NOT generate separate per-phase reports. Everything goes into this single file.

---

## One-Screen Summary

At the end, output:

```
=== mcp-adapter Test Results ===
Section 4 (MockAgent):        ✅ 44/44
Section 5 (Token Bench):      ✅ 94% savings
Section 5B (Conversation):    ✅/⚠️/SKIP
Proxy Unit Tests:             ✅ N/N
DirectTools Unit+Integration: ✅ 14/14
Section 6 (E2E):              ✅ 25/25 (PATH_A / PATH_B / SDK_DIRECT)

Capability Gate:              Path A (mcp proxy) / Path B (directTools) / Path C (SDK_DIRECT)

Verdict: 🟢 ALL PASS
```

## Smoke Calls Reference

See [references/smoke-calls.md](references/smoke-calls.md) for the expected results per demo server.

## Reference Files

| File | Content |
|------|---------|
| [references/mcp-config.md](references/mcp-config.md) | `.mcp.json` config for all 10 demo servers |
| [references/smoke-calls.md](references/smoke-calls.md) | Expected smoke call inputs/outputs per server |
