---
phase: 6
slug: second-agent-adapter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-16
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.0.0 |
| **Config file** | `vitest.config.ts` (existing — covers `__tests__/**/*.test.ts`) |
| **Quick run command** | `npx vitest run __tests__/qoder-adapter.test.ts __tests__/qoder-sampling-provider.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60s (quick) / ~120s (full suite) |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command (match Phase 5 baseline of 475 passing tests)
- **Before `/gsd-verify-work`:** Full suite must be green + `mcp-adapter-test` Section 4 (44/44) + Section 6 (25/25)
- **Max feedback latency:** 60s for quick, 120s for full

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | ADAPTER-02 | T-06-01 | `createQoderResolver` reads `MCP_AGENT_DIR` first, no path traversal | unit | `npx vitest run __tests__/qoder-adapter.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | ADAPTER-01 | T-06-02 | `QoderAdapter` implements all 8 AgentAPI methods without leaking tokens | unit | `npx vitest run __tests__/qoder-adapter.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | D-07 | — | UI exposes only `notify`; other methods undefined | unit | inline assertion in qoder-adapter.test.ts | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | D-05/D-06 | T-06-03 | `QoderSamplingProvider.complete` uses SDK query() without leaking API keys | unit | `npx vitest run __tests__/qoder-sampling-provider.test.ts` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 3 | ADAPTER-03 | T-06-04 | `initializeMcp(qoderAdapter, ctx)` connects all 10 demo MCP servers safely | integration | `npx vitest run __tests__/qoder-adapter-integration.test.ts` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 4 | D-10 | — | `mcp-adapter-test` plan Section 4 + 5 + 6 pass against Qoder | integration | `npx tsx skills/mcp-adapter-test` | exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/qoder-adapter.test.ts` — contract test for the 8 AgentAPI methods + createQoderResolver
- [ ] `__tests__/qoder-adapter-integration.test.ts` — runs initializeMcp against the 10 demo servers with a mock Query
- [ ] `__tests__/qoder-sampling-provider.test.ts` — resolveModel + complete with a mock query() factory
- [ ] `adapters/qoder-adapter.ts` — AgentAPI impl
- [ ] `adapters/qoder-sampling-provider.ts` — SamplingProvider impl
- [ ] `adapters/qoder-renderer.ts` — placeholder pass-through (D-11)
- [ ] `interfaces/agent-paths.ts` — add createQoderResolver + extend AgentId union
- [ ] `scripts/qoder-smoke.ts` — setModel/getModels smoke check (resolves Open Question #1)
- [ ] `package.json` — add @qoder-ai/qoder-agent-sdk to dependencies (gated by `checkpoint:human-verify`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live qodercli integration with real LLM | D-10 | Requires Qoder subscription / live API key | Set `QODER_INTEGRATION=1` and run `npx tsx skills/mcp-adapter-test` against a real Qoder session |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
