---
phase: 05
slug: type-decoupling-entry-point-refactor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.6 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run __tests__/pi-adapter.test.ts __tests__/adapter-contract.test.ts __tests__/index-lifecycle.test.ts` |
| **Full suite command** | `npx vitest run --exclude='**/interactive-visualizer-server.test.ts'` |
| **Type-check command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` and targeted vitest tests for modified files
- **After every plan wave:** Run full vitest suite (excluding interactive-visualizer-server.test.ts)
- **Before `/gsd-verify-work`:** Full suite + type check must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | DECOUPLE-01 | — | `proxy-modes.ts` compiles without Pi `AgentToolResult` import | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | DECOUPLE-02 | — | `sampling-handler.ts` / `elicitation-handler.ts` compile without `ExtensionUIContext` import | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 05-01-03 | 01 | 1 | DECOUPLE-03 | — | `direct-tools.ts` executor signature uses `AgentContext` | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 05-01-04 | 01 | 1 | DECOUPLE-04 | — | `proxy-modes.ts` / `index.ts` use generic `ToolInfo` | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 1 | DECOUPLE-05 | — | `sampling-handler.ts` uses `SamplingProvider` abstraction | unit | `npx tsc --noEmit` + `npx vitest run __tests__/sampling-handler.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | DECOUPLE-06 | — | `tool-result-renderer.ts` returns generic `RenderOutput` | unit | `npx tsc --noEmit` + `npx vitest run __tests__/tool-result-renderer.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | DECOUPLE-07 | — | `agent-dir.ts` uses `AgentPathResolver` | unit | `npx vitest run __tests__/agent-paths-integration.test.ts` | ✅ | ⬜ pending |
| 05-03-01 | 03 | 2 | ENTRY-01 | — | `adapters/entry.ts` exports `createMcpAdapter` | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | ENTRY-02 | — | `index.ts` delegates to `createMcpAdapter` | integration | `npx vitest run __tests__/index-lifecycle.test.ts` | ✅ | ⬜ pending |
| 05-03-03 | 03 | 2 | ENTRY-03 | — | Pi default export behavior unchanged | integration | `npx vitest run __tests__/integration.test.ts __tests__/pi-adapter.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/sampling-handler.test.ts` — stubs for DECOUPLE-05
- [ ] `__tests__/tool-result-renderer.test.ts` — stubs for DECOUPLE-06
- [ ] `__tests__/entry.test.ts` — stubs for ENTRY-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pi extension loads in Pi agent without behavior change | ENTRY-03 | Requires Pi runtime environment | Smoke test with Pi agent; verify tools/commands register and session lifecycle works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
