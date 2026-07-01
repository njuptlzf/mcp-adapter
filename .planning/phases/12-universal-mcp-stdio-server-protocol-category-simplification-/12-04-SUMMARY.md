---
phase: 12-universal-mcp-stdio-server-protocol-category-simplification-
plan: 04
subsystem: e2e-tests
tags: [e2e, dual-layer-testing, d-08, d-13, parametric-tests, verify-deploy, subprocess]
requires:
  - "bin/mcp-server.ts (universal MCP stdio server from Plan 03)"
  - "@modelcontextprotocol/sdk (Client + StdioClientTransport for E2E)"
  - "__tests__/fixtures/mock-mcp-client.ts (unit layer fixture from Plan 01)"
  - "interfaces/agent-api.ts (AGENT_ADAPTERS registry from Plan 02)"
provides:
  - "__tests__/mcp-server-e2e.test.ts — E2E test: spawns bin/mcp-server.ts as subprocess, connects via StdioClientTransport, verifies tool listing, tool calling, and sampling capability acceptance (D-13)"
  - "Verification that adapter-contract.test.ts + capability-gate.test.ts auto-adapt to universal-mcp + pi with zero code changes (D-08)"
  - "Full verification suite results: tsc + vitest + verify:deploy + upstream:check"
affects:
  - "Plan 12-05: Must update special-cases.md to remove 5 stale entries + add new Phase 12 fork-only files"
tech-stack:
  added: []
  patterns:
    - "Dual-layer testing (D-13): unit tests (in-process MockMcpClient, Plan 01) + E2E tests (subprocess StdioClientTransport, this plan)"
    - "Parametric test auto-adaptation: AGENT_ADAPTERS-driven describe.each/for loops expand automatically when registry changes"
    - "Subprocess E2E: StdioClientTransport spawns npx tsx bin/mcp-server.ts, real MCP Client connects and verifies protocol-level behavior"
key-files:
  created:
    - path: "__tests__/mcp-server-e2e.test.ts"
      lines: 172
      purpose: "E2E test for universal MCP stdio server — 3 test cases: list tools, call tool, accept sampling capability"
    - path: ".planning/phases/12-universal-mcp-stdio-server-protocol-category-simplification-/deferred-items.md"
      lines: 33
      purpose: "Documents 5 stale upstream:check entries for Plan 05 to fix"
  modified: []
  verified:
    - path: "__tests__/adapter-contract.test.ts"
      result: "16/16 pass — auto-adapted to universal-mcp + pi with zero code changes"
    - path: "__tests__/capability-gate.test.ts"
      result: "4/4 pass — auto-adapted to universal-mcp + pi with zero code changes"
decisions:
  - "D-13: Dual-layer testing complete — unit tests (Plan 01, in-process MockMcpClient) + E2E tests (this plan, subprocess StdioClientTransport)"
  - "D-08: Parametric tests auto-adapted — adapter-contract.test.ts and capability-gate.test.ts needed zero code changes for the new AGENT_ADAPTERS registry (universal-mcp + pi)"
  - "upstream:check stale entries deferred to Plan 05 — 5 deleted-file entries in special-cases.md are stale due to Plan 03 deletions; acceptance criteria explicitly allows documentation"
metrics:
  duration: "~25min"
  completed: "2026-06-30"
  tasks: 2
  files_created: 2
  files_modified: 0
  tests: 528
  commits: 2
---

# Phase 12 Plan 04: E2E Tests + Verification Summary

Created the E2E test layer for the universal MCP stdio server (D-13), verified parametric tests auto-adapt to the new AGENT_ADAPTERS registry (D-08), and ran the full verification suite (tsc + vitest + verify:deploy + upstream:check).

## What Was Built

### __tests__/mcp-server-e2e.test.ts — E2E test (NEW, 172 lines)

**D-13: E2E layer of dual-layer testing.** The unit layer (in-process MockMcpClient) was created in Plan 01. This plan creates the E2E layer (subprocess + real MCP Client).

**Test structure:**
- `spawnServer(configPath?)` helper: spawns `npx tsx bin/mcp-server.ts` as a subprocess via `StdioClientTransport`, creates a real `Client` declaring `sampling: {}` + `elicitation: { form: {} }` capabilities, connects, returns `{ client, transport }`
- `afterEach`: closes transport (kills subprocess) with try/catch for safety (T-12-12)
- Per-test timeout: 15 seconds (E2E_TIMEOUT) — subprocess spawn + MCP handshake takes time

**3 test cases:**
1. **"lists tools including mcp proxy tool"** — spawns server, calls `client.listTools()`, verifies the "mcp" proxy tool is registered with description and inputSchema (D-08: Branch C has full tool functionality)
2. **"executes mcp proxy tool and returns content"** — calls `client.callTool({ name: "mcp", arguments: {} })`, verifies response.content is an array with at least one text content block (tool returns "MCP not initialized" or JSON status — both acceptable)
3. **"server accepts sampling capability declaration without crashing"** — client declares sampling + elicitation.form capabilities, verifies connection succeeds and server is responsive (D-06/D-07/D-11: pure forwarding, capability declaration is the only gate)

**Threat model mitigations:**
- T-12-12 (Denial of Service): 15s per-test timeout, subprocess killed in afterEach
- T-12-13 (Information Disclosure): stderr piped (not inherited), captured but not asserted on

### Parametric test verification (D-08)

**adapter-contract.test.ts** — 16/16 tests pass with ZERO code changes:
- Uses `describe.each(AGENT_ADAPTERS.map(...))` — parametrically iterates over all registered adapters
- Auto-expanded from 3 adapters (kilo + qoder + pi) to 2 adapters (universal-mcp + pi)
- Each adapter's factory is tested for all 8 AgentAPI methods + register/read-back round-trip

**capability-gate.test.ts** — 4/4 tests pass with ZERO code changes:
- Uses `for (const descriptor of AGENT_ADAPTERS)` — parametrically iterates
- Auto-expanded to test universal-mcp + pi gate verdicts (Path A: mcp proxy tool registered)

### deferred-items.md — Stale upstream:check documentation

Documents 5 stale entries in `special-cases.md` registry for Plan 05 to fix:
- `adapters/kilo-adapter.ts`, `adapters/qoder-adapter.ts`, `adapters/store-adapter.ts` — deleted in Plan 03 (D-04)
- `bin/kilo-mcp-server.ts` — renamed to bin/mcp-server.ts in Plan 03 (D-05)
- `bin/qoder-mcp-bridge.ts` — deleted in Plan 03 (D-04/D-10)

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `npx vitest run __tests__/mcp-server-e2e.test.ts` | 3/3 pass | 3/3 pass (3.72s) | PASS |
| `npx vitest run __tests__/adapter-contract.test.ts` | 16/16 pass | 16/16 pass (9ms) | PASS |
| `npx vitest run __tests__/capability-gate.test.ts` | 4/4 pass | 4/4 pass (6ms) | PASS |
| `npx tsc --noEmit` | exit 0 | exit 0 | PASS |
| `npx vitest run` (full suite) | all pass | 528/528 pass, 55 files (16.43s) | PASS |
| `npm run verify:deploy -- --agent universal-mcp` | succeed | ✅ Universal MCP passed | PASS |
| `npm run verify:deploy -- --agent pi` | skip gracefully | ⏭️ skipped (live native runtime required) | PASS |
| `npm run upstream:check` | exit 0 or documented | exit 1 (5 stale entries documented) | PASS (deferred) |
| No test references "kilo"/"qoder" as adapter IDs | true | only negative assertions in agent-adapters-registry.test.ts | PASS |

## Commits

| Hash | Type | Message |
|------|------|---------|
| f820daf | test | test(12-04): add E2E test for universal MCP stdio server |
| f347898 | docs | docs(12-04): verify parametric tests auto-adapt + document stale upstream:check entries |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. The E2E test passed on first run (implementation already exists from Plan 03). Parametric tests auto-adapted with zero code changes as expected.

### Deferred Items

**1. upstream:check stale entries (deferred to Plan 05)**
- **Found during:** Task 2 (full verification suite)
- **Issue:** `npm run upstream:check` exits 1 with 5 stale registry entries — files deleted in Plan 03 but still listed in `special-cases.md`
- **Action:** Documented in `deferred-items.md` — acceptance criteria explicitly allows this: "npm run upstream:check exits 0 (or documents stale entries for Plan 05 to fix)"
- **Files:** `deferred-items.md` (created)
- **Commit:** f347898

### GitNexus Impact Analysis Skip

Per AGENTS.md, GitNexus impact analysis (`gitnexus_impact`) should be run before editing symbols. GitNexus MCP tools were unavailable in this runtime. Per Phase 12 precedent (Plans 01-03 all skipped), this is documented as a skip. Risk: LOW — Task 1 creates a new test file only (no existing symbols modified). Task 2 makes zero code changes (verification only).

## Known Stubs

None. The E2E test is a complete test that verifies real protocol behavior:
- Tool listing: verifies the "mcp" proxy tool is registered with description + inputSchema
- Tool calling: verifies the tool executes and returns content (text block)
- Sampling capability: verifies the server accepts the capability declaration without crashing

## Threat Flags

None. No new security-relevant surface beyond the plan's `<threat_model>`:
- T-12-12 (Denial of Service): mitigated — 15s timeout, subprocess killed in afterEach
- T-12-13 (Information Disclosure): accepted — stderr captured for debugging only
- T-12-SC (Tampering): accepted — no new packages, all dependencies existing

## TDD Gate Compliance

Task 1 has `tdd="true"`. The implementation (`bin/mcp-server.ts`) already exists from Plan 03. The test was written and passed on first run — this is a verification test, not a traditional RED/GREEN cycle. The `test(...)` commit (f820daf) serves as the RED gate (test exists). No `feat(...)` commit is needed because the implementation was created in Plan 03 (d26c1ef).

- ✅ `test(12-04):` commit exists (f820daf) — test file created
- ✅ Implementation exists from Plan 03 (d26c1ef: `feat(12-03):` commit)
- ℹ️ No separate GREEN commit needed — implementation predates this plan

## Self-Check: PASSED

### Created files exist:
- ✅ FOUND: __tests__/mcp-server-e2e.test.ts
- ✅ FOUND: .planning/phases/12-universal-mcp-stdio-server-protocol-category-simplification-/deferred-items.md

### Commits exist:
- ✅ FOUND: f820daf (test(12-04): add E2E test for universal MCP stdio server)
- ✅ FOUND: f347898 (docs(12-04): verify parametric tests auto-adapt + document stale upstream:check entries)

### SUMMARY exists:
- ✅ FOUND: 12-04-SUMMARY.md
