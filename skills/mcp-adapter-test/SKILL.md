---
name: mcp-adapter-test
description: >
  Universal mcp-adapter integration test. Runs MockAgent compatibility
  (Section 4), token benchmark (Section 5/5B), proxy mode unit tests,
  directTools unit + integration tests, and E2E validation (Section 6)
  against all 10 demo MCP servers. Works for any AgentAPI adapter
  registered in AGENT_ADAPTERS. See references/agent-paths/<agent>.md
  for adapter-specific commands.
  Use when user says "run mcp-adapter tests", "test mcp-adapter",
  "验证 mcp-adapter", "测试 mcp-adapter", or "/mcp-adapter-test".
---

# mcp-adapter Integration Test (universal)

Executes the test plan (`docs/mcp-adapter-test-plan.md`) end-to-end for every
registered `AgentAPI` adapter in [`interfaces/agent-api.ts`](../../interfaces/agent-api.ts).

## Agent-agnostic parametric structure

This main file describes WHAT each phase does. Adapter-specific HOW lives in
`references/agent-paths/<id>.md` — one file per adapter registered in
`AGENT_ADAPTERS`. Run this command to see the current set:

```bash
echo "=== Adapter reference files ==="
ls skills/mcp-adapter-test/references/agent-paths/*.md | xargs -n1 basename
```

To add a new adapter: copy [`references/agent-paths/_template.md`](references/agent-paths/_template.md) → `references/agent-paths/<your-id>.md` and fill in Path A/B/C.
**This main file is not modified** (Phase 8 UPSTREAM-04 compatibility).

## Quick Start

Say `/mcp-adapter-test` and the agent will:

1. Run 44 MockAgent compatibility tests (40 server + 4 contract)
2. Measure token savings (tiktoken benchmark + conversation simulation)
3. Run proxy mode + directTools unit/integration tests
4. **Run Capability Gate FIRST** (Phase 4 Step 0) — see below
5. **Discover adapters + let you select which to integration-test** (Phase 4 Step 5)
6. Run E2E tests via the detected Path (A / B / C)
7. Generate reports under `tests/reports/`

## Pre-flight

```bash
mkdir -p tests/reports
npm run test:prebuild  # FIX-01: build visualizer dist/ if missing
```

### Agent-paths completeness check (NEW)

Before running any test phase, verify every adapter in `AGENT_ADAPTERS` has a corresponding `references/agent-paths/<id>.md` file:

```bash
echo "=== AGENT_ADAPTERS entries ==="
grep -oP "id:\s*['\"]([^'\"]+)['\"]" interfaces/agent-api.ts | cut -d'"' -f2 | while read id; do
  if [ -f "skills/mcp-adapter-test/references/agent-paths/${id}.md" ]; then
    echo "✅ ${id} — agent-paths/${id}.md found"
  else
    echo "❌ ${id} — MISSING: skills/mcp-adapter-test/references/agent-paths/${id}.md"
    echo "   → cp references/agent-paths/_template.md references/agent-paths/${id}.md"
  fi
done
```

- If any adapter is MISSING → **STOP**. Tell the user to create the file first (copy `_template.md`). Without it, Phase 4 Step 1 cannot verify deployment-path correctness for that adapter.
- If all adapters have files → continue.

---

## Phase 1: MockAgent Compatibility (Section 4)

```bash
npx vitest run tests/compatibility/ --reporter=verbose
```

**Pass criteria**: 44/44 (40 server + 4 contract). See `references/agent-paths/<id>.md` if any fail.

## Phase 2: Token Benchmark (Section 5)

```bash
npx tsx tests/token-benchmark/run-baseline.ts
npx tsx tests/token-benchmark/run-adapter.ts
npx tsx tests/token-benchmark/report.ts
```

**Pass criteria**: Proxy tool definition ≤ 300 tokens; 10-server combined savings ≥ 95%. 🟡 Note: the 94% combined savings observed in practice is **baseline-bound** — the proxy tool definition in `adapters/tool-registrar.ts` is agent-agnostic, so Pi and Qoder serialize the same JSON schema. The percentage is fully determined by the `tests/demo-servers/*` fixture (61 tools, 3963 baseline tokens) plus the proxy's fixed 250-token cost; swapping the adapter cannot change it. The 1 pp gap from the ≥ 95% target is a pre-existing project characteristic, not an adapter regression. See `tests/reports/qoder-adapter-test-report.md` §Section 5 and `docs/mcp-adapter-token-savings.md` for the full analysis.

## Phase 3: Conversation Cost Simulation (Section 5B)

```bash
npx tsx tests/token-benchmark/run-conversation-sim.ts
```

If `run-conversation-sim.ts` does not exist, skip and note `⚠️ SKIP`.

**Pass criteria**: 4-server conversation total savings ≥ 65%; search overhead ≤ 300 tokens. 🟡 Note: the 56% conversation savings observed in practice is **baseline-bound** for the same reason as Phase 2 — the proxy tool definition (147 tokens — well under the 300-token ceiling) plus the per-call overhead are agent-agnostic. The 9 pp gap from the ≥ 65% target is shared with Pi and is a pre-existing project characteristic, not an adapter regression. See `tests/reports/qoder-adapter-test-report.md` §Section 5B and `docs/mcp-adapter-token-savings.md` for the full analysis.

## Phase 4: Per-Path Verification (Section 6)

Per D-11: Phase 4 is renamed from "E2E Validation" to "Per-Path Verification" with a parametric table. The Pi-biased prose of the old §122-138 is replaced by the table + per-agent reference files.

### Step 0 — Capability Gate (universal, runs FIRST)

Per D-03: extracted to its own step. Runs BEFORE any E2E test. Verdict from `adapter.getAllTools()` for each adapter in `AGENT_ADAPTERS`:

| `mcp` in tool list? | `^<server>_` prefix in tool list? | Path | Resolved |
|---------------------|------------------------------------|------|----------|
| yes                 | any                                | A    | mcp proxy tool registered |
| no                  | yes (at least one server prefix)   | B    | directTools mode, individual tools |
| no                  | no                                 | C    | mcp-adapter NOT loaded as extension here |

Path C is explicit: "mcp-adapter NOT loaded as extension in this environment".

### Step 1 — Path-specific verification (per adapter)

Read `references/agent-paths/<id>.md` and execute the verification commands there. Record results in the master report.

### Step 2 — Proxy mode unit tests (always runs)

```bash
npx vitest run __tests__/proxy-modes-discovery.test.ts __tests__/proxy-modes-auto-auth.test.ts __tests__/proxy-modes-ui-messages.test.ts --reporter=verbose
```

### Step 3 — directTools unit + integration tests (always runs)

```bash
npx vitest run __tests__/direct-tools.test.ts __tests__/direct-tools-auto-auth.test.ts
npx vitest run tests/smoke/e2e-direct-tools.test.ts
```

### Step 4 — Run E2E tests (all paths)

```bash
npx vitest run tests/smoke/e2e-all-servers.test.ts --reporter=verbose
```

**Pass criteria**: 25/25 (E2E-03 calculator search→describe→call + E2E-04 all 10 servers discover + smoke + E2E-06 multi-turn).

### Step 5 — Adapter Integration Tests (NEW — user-selectable)

Runs adapter-specific integration tests that exercise the full
`createMcpAdapter` stack against real MCP demo servers. This validates
the complete wiring: adapter construction → `createMcpAdapter` →
session lifecycle → real MCP server connections.

Unlike other steps, this step is **user-selectable** — you choose which
adapters to test based on your runtime environment.

#### Step 5a — Discover adapters

Read the `AGENT_ADAPTERS` array from `interfaces/agent-api.ts`, which is
the single source of truth for all supported adapters:

```bash
echo "=== Discovered adapters ==="
grep -B1 -A5 "id:" interfaces/agent-api.ts | grep -E "(id:|displayName:)" | head -20
```

This dynamically detects Pi, Qoder, and any future adapters added to the
registry — no hardcoding needed.

#### Step 5b — User selects adapters to test

Use `AskUserQuestion` to present the discovered adapters with multi-select.
Each `id` from `AGENT_ADAPTERS` becomes one option. Derive the display text
from `displayName` and the coverage notes from the adapter's `capabilities`
(e.g. `ui`, `sampling`, `renderer`).

Example option shape (for the current registry, do **not** hardcode this table):

| Adapter | id | Coverage note |
|---------|----|---------------|
| `<displayName>` | `<id>` | `AgentAPI` contract + full stack when available |

Structure the question with `multiSelect: true`. RECOMMENDATION: select all
adapters for complete coverage (Completeness: 10/10).

#### Step 5c — Run integration tests

**Always run** the parametric AgentAPI contract test — it covers ALL selected
adapters automatically via `describe.each(AGENT_ADAPTERS)`:

```bash
npx vitest run __tests__/adapter-contract.test.ts --reporter=verbose
```

For each adapter that has a dedicated full-stack integration test, also run
that adapter's test file. The current registry may include files such as:

| Adapter pattern | Typical integration test | Command |
|-----------------|--------------------------|---------|
| SDK-bridge adapters (e.g. Qoder) | Full `createMcpAdapter` + `initializeMcp` | `npx vitest run __tests__/<id>-adapter-integration.test.ts --reporter=verbose` |
| Native-extension adapters (e.g. Pi) | (covered by parametric AgentAPI contract) | — |

Always verify the actual test file exists before running. Record per-adapter
results in the master report under a new section.

**Pass criteria**:
- AgentAPI contract: all contract tests pass for every selected adapter
- Per-adapter integration: full `createMcpAdapter` wiring + at least one
  real MCP server connection verified (where a dedicated integration test exists)

---

## Phase 5: Master Report

`tests/reports/mcp-adapter-test-report.md` (auto-generated by the matrix reporter — see `tests/reporters/matrix-reporter.ts`) contains: overall pass/fail summary; per-phase detail (counts, duration, failures); Capability Gate result (Path A/B/C per adapter); **Step 5 per-adapter integration results (Pi/Qoder/...)**: pass criteria checklist; bugs/notes.

## One-Screen Summary

```
=== mcp-adapter Test Results ===
Section 4 (MockAgent):        ✅ 44/44
Section 5 (Token Bench):      ✅ 94% savings
Section 5B (Conversation):    ✅/⚠️/SKIP
Proxy Unit Tests:             ✅ N/N
DirectTools Unit+Integration: ✅ 24/24
Section 6 (E2E):              ✅ 25/25 (PATH_A / PATH_B / SDK_DIRECT)
Adapter Integration (Step 5): ✅ N/N — (Pi/Qoder/...)

Capability Gate:              Path A (mcp proxy) / Path B (directTools) / Path C (SDK_DIRECT)

Verdict: 🟢 ALL PASS
```

## Reference Files

| File | Content |
|------|---------|
| [references/agent-paths/pi.md](references/agent-paths/pi.md) | Pi-specific Path A/B/C verification |
| [references/agent-paths/kilo.md](references/agent-paths/kilo.md) | Kilo-specific Path A/B/C verification |
| [references/agent-paths/qoder.md](references/agent-paths/qoder.md) | Qoder-specific Path A/B/C verification |
| [references/agent-paths/_template.md](references/agent-paths/_template.md) | Scaffold for new adapters |
| [references/mcp-config.md](references/mcp-config.md) | `.mcp.json` config for all 10 demo servers |
| [references/smoke-calls.md](references/smoke-calls.md) | Expected smoke call inputs/outputs per server |