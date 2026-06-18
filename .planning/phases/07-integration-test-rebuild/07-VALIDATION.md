---
phase: 7
slug: integration-test-rebuild
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 7: Integration Test Rebuild — no production runtime code; all deliverables are tests, fixtures, reporters, SKILL.md parametric structure, and README.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.6 (verified via `node_modules/vitest/package.json`) |
| **Config file** | `vitest.config.ts` (existing, 91 lines) — to be amended with `globalSetup` (D-14) and new reporter (D-17) |
| **Quick run command (parametric)** | `npx vitest run __tests__/adapter-contract.test.ts` (8 cases × N adapters = 16 by default) |
| **Quick run command (gate)** | `npx vitest run __tests__/capability-gate.test.ts` |
| **Quick run command (FIX-01)** | `npm run test:prebuild && npx vitest run __tests__/interactive-visualizer-server.test.ts` |
| **Full suite command** | `npx vitest run` (entire suite, ~30s) |
| **Full matrix opt-in** | `AGENT_API_FULL_MATRIX=1 npx vitest run` (N × 44 heavy) |
| **Estimated runtime** | ~30 seconds (quick) / ~3 minutes (full) |

---

## Sampling Rate

- **After every task commit:** `npx vitest run __tests__/adapter-contract.test.ts` (~2s, parametric 8×N = 16 cases)
- **After every plan wave:** `npx vitest run` (full suite, ~30s)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | TEST-01 | — | N/A | unit | `npx vitest run __tests__/capability-gate.test.ts` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 1 | TEST-02 | — | N/A | unit | (same as 7-01-01) | ❌ W0 | ⬜ pending |
| 7-01-03 | 01 | 1 | TEST-03 | — | N/A | unit | `npx vitest run __tests__/adapter-contract.test.ts` | ❌ W0 | ⬜ pending |
| 7-01-04 | 01 | 1 | TEST-04 | — | N/A | unit | (same as 7-01-03) | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 1 | FIX-01 (D-14) | — | N/A | integration | `npm run test:prebuild && npx vitest run __tests__/interactive-visualizer-server.test.ts` | ✅ existing | ⬜ pending |
| 7-02-02 | 02 | 1 | D-15 | — | N/A | integration | (same as 7-02-01) | ❌ W0 | ⬜ pending |
| 7-03-01 | 03 | 1 | TEST-05 (D-10) | — | N/A | manual review | `wc -l skills/mcp-adapter-test/SKILL.md` (≤160 lines target) | ❌ W0 | ⬜ pending |
| 7-03-02 | 03 | 1 | TEST-05 (D-11) | — | N/A | manual review | (same as 7-03-01) | ❌ W0 | ⬜ pending |
| 7-04-01 | 04 | 1 | DOC-01 (D-18) | — | N/A | manual review | `grep -c "Universal\|agent-agnostic\|matrix" README.md` (≥3 matches) | ❌ W0 | ⬜ pending |
| 7-04-02 | 04 | 1 | DOC-02 (D-19) | — | N/A | manual review | `grep -c "## Verification\|## Test" README.md` (≥1) | ❌ W0 | ⬜ pending |
| 7-04-03 | 04 | 1 | DOC-03 (D-20) | — | N/A | manual review | `grep -c "createMcpAdapter" README.md` (≥2 entry points) | ❌ W0 | ⬜ pending |
| 7-04-04 | 04 | 1 | D-16 | — | N/A | unit | `npx vitest run` (reporter writes `mcp-adapter-test-report.md`) | ❌ W0 | ⬜ pending |
| 7-04-05 | 04 | 1 | D-17 | — | N/A | unit | (same as 7-04-04, JSON sidecar) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/fixtures/mock-agent-api.ts` — NEW generic mock (D-08)
- [ ] `__tests__/adapter-contract.test.ts` — REWRITE with `describe.each` (D-04/D-09)
- [ ] `__tests__/capability-gate.test.ts` — NEW gate unit test (D-01..D-03)
- [ ] `tests/global-setup.ts` — NEW prebuild safety net (D-14)
- [ ] `tests/reporters/matrix-reporter.ts` — NEW custom JSON reporter (D-17)
- [ ] `interfaces/agent-api.ts` amendment — `AGENT_ADAPTERS` + `AgentAdapterDescriptor` (D-07)
- [ ] `tests/reports/mcp-adapter-test-report.md` — NEW unified matrix (D-16)
- [ ] `tests/reports/mcp-adapter-test-report.json` — NEW JSON sidecar (D-17)
- [ ] `__tests__/compatibility/legacy-pi-mock.test.ts` — NEW deprecated mock (D-08)
- [ ] `tests/reports/qoder-adapter-test-report.md` — DEPRECATE (D-16)
- [ ] `package.json` `test:prebuild` script + `test` script amendment (D-14)
- [ ] `vitest.config.ts` `globalSetup` field + reporter registration (D-14/D-17)
- [ ] `skills/mcp-adapter-test/SKILL.md` — REWRITE short parametric (D-10/D-11)
- [ ] `skills/mcp-adapter-test/references/agent-paths/pi.md` — NEW (D-10/D-11)
- [ ] `skills/mcp-adapter-test/references/agent-paths/qoder.md` — NEW (D-10/D-11)
- [ ] `skills/mcp-adapter-test/references/agent-paths/_template.md` — NEW (D-10/D-11)
- [ ] `README.md` — REWRITE Pi-first-class + matrix (D-18..D-20)

*Framework install: No framework install — vitest 3.2.6 + esbuild 0.25.12 already installed.*

---

## Test Isolation Strategy (per RESEARCH.md §Validation Architecture)

**Critical concern:** `describe.each` factory pattern must guarantee state isolation between adapter instances.

**Mitigations (priority order):**
1. **`beforeEach` creates fresh adapter via `factory()`** — primary defense. QoderAdapter constructor initializes empty Maps; no cross-test state survives.
2. **`afterEach` releases per-test resources** — generic 8-method contract tests allocate no resources; `node:child_process` mock in `qoder-adapter.test.ts:20-26` prevents real subprocess leaks.
3. **Worker isolation** — vitest 3 spawns separate worker processes per test file by default (`test.isolate` defaults to `true`).
4. **Mocks scoped to test file** — `vi.mock("node:child_process", ...)` is automatically reset at file end (vitest `vi.restoreAllMocks()` on worker teardown).

**40 server-compatibility cases** use `MockAgentAPI` (Pattern 4) — no subprocesses, no network. Isolation automatic.

**Mock state reset:**
- `MockAgentAPI`: `new MockAgentAPI()` in `beforeEach` produces fresh empty Maps.
- `PiAdapter` (parametric): `new PiAdapter(pi)` with fresh `vi.fn()`-based `ExtensionAPI` mock.
- `QoderAdapter` (parametric, 7+): `new QoderAdapter()` resets all Maps + `queryRef` + `bufferedMessages`.

**Async setup awaiting:**
- `createMcpAdapter(adapter, ctx, config, null)` is **synchronous** (`adapters/entry.ts:58-63`) — registration completes before return.
- `adapter.on("session_start", handler)` is registration; drive via `adapter.fireSessionStart(ctx)` and `await`.
- `globalSetup` prebuild is synchronous (`spawnSync`) — vitest blocks on `globalSetup` return before spawning workers.

---

## Security Threat Model Gate (§5.55)

**No new threat surface introduced by Phase 7.** All deliverables are test fixtures, vitest reporters, and prose documentation. No production code paths are modified — only test infrastructure and documentation.

- **Capability Gate (TEST-01..02):** The Gate *reads* the adapter's tool list and reports the environment. It performs no privileged operation. Threat model: N/A.
- **Mock replacement (TEST-03):** `MockAgentAPI` is a test-only construct; never imported by production code paths. Threat model: N/A.
- **Parametric tests (TEST-04):** Test isolation is enforced by `beforeEach` factory pattern. No shared mutable state across adapters. Threat model: N/A.
- **SKILL.md split (TEST-05):** Documentation only. Threat model: N/A.
- **FIX-01 prebuild:** Adds a `prebuild` script that runs `tsc -p . --noEmit && node build.mjs`. This is invoked by developer or vitest `globalSetup`. It is **not** invoked by the published package's consumers. Threat model: N/A.
- **Matrix reporter (D-16/D-17):** Writes to `tests/reports/`. No path traversal — output path is hardcoded. Threat model: N/A.

**Conclusion:** §5.55 gate returns N/A. No SECURITY.md artifact required for Phase 7.

---

## UI Design Contract Gate (§5.6)

**Phase 7 has no UI component deliverables.** All output is text (README, SKILL.md, Markdown report) and JSON sidecar.

**§5.6 gate returns N/A.** No UI-SPEC.md artifact required for Phase 7.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SKILL.md "supports any agent" language | TEST-05 | SKILL.md is prose, not code | `cat skills/mcp-adapter-test/SKILL.md \| head -100` — verify parametric language, no Pi-specific commands in main |
| README "Pi-first-class + matrix" | DOC-01 | README is prose, not code | `cat README.md` — verify Pi gets full attention, all other adapters get matrix row |
| README Verification section | DOC-02 | Prose section | `grep -A 20 "## Verification" README.md` — verify run commands, expected output, troubleshooting |
| README dual entry points | DOC-03 | Prose section | `grep -B 2 -A 10 "createMcpAdapter" README.md` — verify ≥2 distinct entry-point examples (Pi + generic) |
| Per-agent references extracted | D-11 | File structure, not code | `ls skills/mcp-adapter-test/references/agent-paths/` — verify `pi.md`, `qoder.md`, `_template.md` exist |
| Main SKILL.md shrunk | D-10 | Line count target | `wc -l skills/mcp-adapter-test/SKILL.md` — verify ≤160 lines (down from 228) |

*All other phase behaviors have automated verification (vitest unit tests).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
