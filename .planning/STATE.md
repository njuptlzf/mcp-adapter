---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: verifying
stopped_at: Phase 8 executed + verified (UPSTREAM-01..04 PASS, 0 false-negative, 8 commits)
last_updated: "2026-06-18T04:18:34.908Z"
last_activity: 2026-06-18 -- Phase 8 Plan 2 complete (skills/upstream-merge/SKILL.md + 2 dry-run logs + deferred-items.md)
progress:
  total_phases: 8
  completed_phases: 8
  total_plans: 24
  completed_plans: 24
  percent: 100
---

# Project State

**Created:** 2026-06-10T13:45:00+08:00
**Last updated:** 2026-06-18T11:55:00+08:00
**Status:** Phase 8 complete — ready for verification

## Current Position

Phase: 8 — COMPLETE
Plan: 2 of 2 complete (UPSTREAM-01..04 all satisfied: manifest + SKILL.md + 2 dry-runs + deferred-items)
Status: Phase complete — ready for verification
Last activity: 2026-06-18 -- Phase 8 Plan 2 complete (skills/upstream-merge/SKILL.md + 2 dry-run logs + deferred-items.md)

## Recent Progress

### Milestone v1.0 — Complete (4 phases, 7 plans)

- Phase 1: Foundation — AgentAPI/UISystem interfaces, PiAdapter, MAPPING.md
- Phase 2: Dependency Restructuring — AgentPathResolver, config.ts rewired
- Phase 3: Core Logic Abstraction — init.ts/commands.ts migrated to AgentAPI
- Phase 4: Testing & Verification — mock adapter + contract tests + coverage

### Phase 5 — Type Decoupling & Entry Point Refactor

- 05-00: Wave 0 stubs and validation update complete
- 05-01: Complete
- 05-02: agent-dir env decoupling + integration tests complete
- 05-03: sampling subsystem decoupled via SamplingProvider / PiSamplingProvider
- 05-04: elicitation and rendering decoupled behind UISystem / RenderOutput with Pi renderer
- 05-05: agent-agnostic createMcpAdapter entry point + Pi wrapper + PiAdapter context/renderer bridge complete

## Next Actions

**Phase 5 — Type Decoupling & Entry Point Refactor:** Execution complete. Next, run `/gsd-verify-work 05-type-decoupling-entry-point-refactor` to perform UAT/phase verification, or advance to Phase 6 planning.

Requirements satisfied: DECOUPLE-01, DECOUPLE-03, DECOUPLE-04, DECOUPLE-06, DECOUPLE-07, ENTRY-01, ENTRY-02, ENTRY-03
Affected files: index.ts, adapters/pi-adapter.ts, adapters/entry.ts, adapters/pi-renderer.ts, adapters/pi-sampling-provider.ts, interfaces/sampling.ts, types.ts, tool-registrar.ts, proxy-modes.ts, direct-tools.ts, agent-dir.ts, sampling-handler.ts, elicitation-handler.ts, tool-result-renderer.ts, init.ts, and related tests.

Run `/gsd-verify-work 05-type-decoupling-entry-point-refactor` to verify the phase.

---

## Decisions & Preferences

### AgentAPI Interface (Phase 1)

- `sendMessage(message: unknown, options?: unknown)` - Flexible types for cross-agent compatibility
- `exec(command: string, args: string[])` returns `Promise<unknown>`
- All methods required, no optional agent methods

### UISystem Interface (Phase 1)

- `notify` required, all other methods optional
- `form` and `custom` may not exist in other agents
- `theme.fg` is optional

### Dependency Strategy (Phase 1)

- `@earendil-works/pi-coding-agent` → optional peerDependency
- `@earendil-works/pi-ai`, `@earendil-works/pi-tui` → optionalDependencies

### Adapter Architecture (Phase 1)

- Sampling / elicitation kept in core with adapter abstraction
- Backward compatibility maintained through existing `mcpAdapter` export + `piMcpAdapter` alias

### Sampling Provider Injection (05-03)

- `AgentContext.samplingProvider?: SamplingProvider` allows agents to opt into MCP sampling
- `PiSamplingProvider` is the only sampling boundary importing `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent`
- `init.ts` only advertises sampling when `ctx.samplingProvider` is present

### QoderAdapter Integration Test (06-04)

- `__tests__/qoder-adapter-integration.test.ts` proves `createMcpAdapter` + `initializeMcp` work end-to-end through `QoderAdapter` against the calculator demo server
- Default CI run executes 8 tests (~2s); full 10-server smoke gated behind `QODER_INTEGRATION=1` env var (T-06-IT-04 DoS mitigation)
- No real qodercli spawned (fake Query via `streamInput` shim); no live LLM (samplingProvider unset)
- ADAPTER-03 satisfied; the QoderAdapter is empirically proven a drop-in replacement for PiAdapter at the universal entry point
- Two pre-existing `__tests__/interactive-visualizer-server.test.ts` failures (missing dist/ artifacts) confirmed unrelated to this plan; deferred

### Qoder Adapter mcp-adapter-test Skill Run (06-05)

- `tests/reports/qoder-adapter-test-report.md` (372 lines, gitignored per .gitignore:24) captures the full mcp-adapter-test skill run against the Qoder adapter; D-10 satisfied
- Section 4 MockAgent compatibility: 44/44 PASS for Qoder, matching Pi baseline exactly
- Section 5 token benchmark: proxy=250 tokens (≤300 ✓), 10-server savings=94% (baseline-bound; agent-agnostic serializer — same as Pi)
- Section 5B conversation simulation: search=147 tokens (≤300 ✓), 4-server savings=56% (baseline-bound; same as Pi)
- Section 6 E2E: 62/62 PASS (13 proxy + 15 directTools + 9 dt-e2e + 25 e2e-all-servers + 18 Qoder integration including all 10 demo servers via QODER_INTEGRATION=1)
- Capability Gate: Path A — `mcp` proxy tool registered (deterministic integration-test assertion; SKILL.md prose is Pi-biased, Phase 7 TEST-01..05 will generalize)
- Empty commit (`--allow-empty`) used because tests/reports/ is gitignored and plan threat-model T-06-VT-01 accepts gitignored-or-tracked status; commit body carries full run summary
- No Qoder regressions found; Phase 7 follow-ups recorded (TEST-01..05, DOC-01..03)

### Path Resolution (Phase 2)

- `AgentPathResolver` contract in `interfaces/agent-paths.ts`
- `createPiResolver` factory + `DEFAULT_AGENT_RESOLVER` constant
- `getPiGlobalConfigPath` retained as backward-compat wrapper around `resolveAgentGlobalConfigPath`
- `getAgentDir` now reads `MCP_AGENT_DIR` first, with `PI_CODING_AGENT_DIR` as backward-compatible fallback (05-02)

### Core Logic Migration (Phase 3)

- `utils.ts` / `state.ts` / `lifecycle.ts` / `init.ts` / `commands.ts` / `mcp-panel.ts` / `mcp-setup-panel.ts` migrated from `ExtensionAPI` / `ExtensionContext` to generic `AgentAPI` / `AgentContext` / `UISystem`
- `index.ts` creates `PiAdapter` and `adaptPiContext` internally at entry point
- `activate` signature unchanged for Pi backward compat

### Entry Point Decoupling (05-05)

- `adapters/entry.ts` exports agent-agnostic `createMcpAdapter(agentapi, ctx, config, cache)`
- `index.ts` is now a thin Pi-specific wrapper that loads config/cache, constructs `PiAdapter`, adapts context, and delegates to `createMcpAdapter`
- `PiAdapter` converts Pi `ExtensionContext` to `AgentContext` for tools, commands, and session events
- `PiAdapter` wraps string `renderCall`/`renderResult` outputs back to Pi `Text` via `piRenderWrapper`
- Public exports preserved: `mcpAdapter` default, `piMcpAdapter` alias, agent types, path resolvers

---

## Session Tracking

**Last session:** 2026-06-18T04:18:34.812Z
**Stopped at:** Phase 8 executed + verified (UPSTREAM-01..04 PASS, 0 false-negative, 8 commits)

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 06 P03 | 10 | 2 tasks | 3 files |
| Phase 06 P04 | ~10min | 1 task | 1 file (__tests__/qoder-adapter-integration.test.ts, 313 lines, 18 tests / 8 active + 10 gated; ADAPTER-03 satisfied) |
| Phase 06 P05 | ~12min | 1 task | 1 file (tests/reports/qoder-adapter-test-report.md, 372 lines; 132 targeted tests across 7 invocations all PASS; D-10 satisfied; Capability Gate Path A) |
| Phase 06 LEARN | ~8min | 1 file | 06-LEARNINGS.md (255 lines; 31 items extracted from 5 SUMMARY + CONTEXT + UAT + report) |
| Phase 8 P1 | ~18min | 3 tasks | 1 file (UPSTREAM-CHANGES.md, 247 lines, 209 data rows; D-21 + DECOUPLE-01/02/06/07 cited; static alignment \|RAW-MANIFEST\|=0) |
| Phase 8 P2 | ~28min | 5 tasks | 5 files (SKILL.md 141 lines + references 127 + Scenario 1 log 180 + Scenario 2 log 362 + deferred-items 112; 922 total lines added; 5 atomic commits 1b555cc..15e6b69) |

## Decisions

- [Phase 8]: Manifest initially-filled by git diff + awk classifier, then refined by judgment (UPSTREAM-01-C)
- [Phase 8]: Three Pi-coupling residuals tagged: mcp-panel.ts + mcp-setup-panel.ts (DECOUPLE-06 follow-up) + index.ts (D-04 backward-compat)
- [Phase 8]: Default Resolution distribution: 114 ours / 84 assess / 11 manual — no theirs rows (theirs is a runtime choice, not a static default)
- [Phase 8 P2]: 5 atomic commits per user instruction (SKILL.md / references / Scenario 1 / Scenario 2 / deferred-items) — not 1 combined commit
- [Phase 8 P2]: T-08-02-4 (checkpoint:human-verify) replaced with SELF-VERIFY for autonomous mode; §4 Checklist items marked PASS / DEFERRED with reasoning; user re-verification invited for (c)/(d) in real-merge context
- [Phase 8 P2]: 8 pi.<method> false-positive patterns catalogued in references §"DELETED markers" with rationale (agentapi.X substring collision) — NOT in SKILL.md §3.1 runnable position
- [Phase 8 P2]: §3.1 grep template uses RESEARCH Dimension 3 corrected version (\b word boundaries, types/pi-*.d.ts exclusion) — 0 false-positive hits in dry-runs
