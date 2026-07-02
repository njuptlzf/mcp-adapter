# Universal MCP Adapter

## Current State (v2.0 — released as git tag v2.0.0-universal on 2026-06-23)

**Milestone:** v2.0 Multi-Agent Adapter Completion — SHIPPED 2026-06-23 (9 phases, 25 plans, 17 tasks).

**Release tag:** `v2.0.0-universal` (annotated, SHA `84bf7e5` → commit `1f493b1`). SemVer pre-release derivative of upstream `v2.0.0` (`5e1be49`). Tag name uses SemVer pre-release identifier `-universal` to mark the fork derivative; see `.planning/STATE.md` → `## Naming Decisions` for the full rationale (collision with upstream `v2.0.0` namespace, migration to `vX.Y.Z-{fork-identifier}` pattern).

**Shipped capabilities:**
- Universal `AgentAPI` / `UISystem` interfaces in `interfaces/agent-api.ts` (REQ-01, REQ-02)
- Pi adapter (`adapters/pi-adapter.ts`) as a first-class `AgentAPI` implementation, not a legacy mode (REQ-03, REQ-04)
- Qoder adapter (`adapters/qoder-adapter.ts`) + Qoder sampling provider + QoderAgentPathResolver (ADAPTER-01, ADAPTER-02, ADAPTER-03)
- Agent-agnostic entry point `createMcpAdapter(agentapi, ctx, config, cache)` in `adapters/entry.ts`; `index.ts` is a thin Pi wrapper (ENTRY-01, ENTRY-02, ENTRY-03)
- Decoupled all 6 source files from Pi type imports (DECOUPLE-01..07)
- Agent-agnostic `skills/mcp-adapter-test/` skill with per-agent reference files and Capability Gate (TEST-01..05)
- README rewrites leading with "Pi-compatible + every MCP-compatible agent" + Verification/Compatibility section (DOC-01..03)
- `scripts/upstream-divergence.ts` + `skills/upstream-merge/references/special-cases.md` (Architecture C) + `npm run upstream:check` (UPSTREAM-01..05)
- Test suite 350/352 passing at v2.0 close; 2 pre-existing `__tests__/interactive-visualizer-server.test.ts` failures (missing dist/ artifacts) confirmed unrelated and deferred

**Public surface preserved:** `mcpAdapter` (Pi), `piMcpAdapter` alias, `createMcpAdapter` (universal), `createPiAdapter` / `createQoderAdapter` factories, `resolveAgentGlobalConfigPath` / `getAgentDir`, all agent types.

**Archive:** `.planning/milestones/v2.0-ROADMAP.md` and `.planning/milestones/v2.0-REQUIREMENTS.md`.

**Next milestone:** Awaiting kickoff (see `.planning/STATE.md` Operator Next Steps).

---

## Vision

Refactor the Pi-specific MCP adapter into a universal, agent-agnostic adapter that can work with multiple coding agents while maintaining backward compatibility with Pi.

## Background

The current `pi-mcp-adapter` is tightly coupled to Pi coding agent's ecosystem:
- Imports types from `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`
- Uses Pi-specific APIs: `pi.registerTool`, `pi.on`, `pi.exec`, `ctx.ui.notify`, etc.
- Has Pi-specific configuration paths and UI integration patterns

## Goal

Create a universal adapter architecture:
1. Define generic `AgentAPI` and `UISystem` interfaces
2. Implement Pi adapter as one implementation among many
3. Enable future adapters for Claude, Cursor, and other agents
4. Maintain full backward compatibility for existing Pi users

## Core Principles

- **Zero-risk refactoring**: Core MCP logic remains unchanged, only adapter layer added
- **Easy upstream updates**: Clean separation allows merging upstream changes without conflicts
- **Gradual migration**: Existing code works as-is, new features use generic interfaces

## Current Milestone: v3.2 — upstream-merge 实战 (重试第一次 merge with v3.1 protocols)

> **Status (2026-07-01):** PLANNING. Initialized from v3.1 milestone completion. v3.1 (upstream-merge 治理与架构优化) is archived; this milestone targets the **first real upstream-merge attempt** using the v3.1 SKILL.md §3.5 + §4.2b + §4.4 protocols shipped in v3.1.

**Goal:** Validate the v3.1 governance improvements by executing the first real `git merge upstream/main` using the new protocols. The 11 conflicts that aborted the 2026-07-01 first attempt should resolve at the policy/protocol level, not case-by-case. Expected outcome: conflict granularity moves from "line-level" / "function-level" to "file-level" / "section-level" per the L1/L2/L3 classification in retrospective §3.2.1.

**Target phases:**
- Phase 16 — Upstream-merge 实战 (v3.1 protocols applied): re-run `git merge upstream/main`, classify conflicts via §3.5 awk script, resolve same-function conflicts via §4.4 5-step protocol, accept upstream Pi-coupling per §4.1 default `--theirs`, propagate to v1.0 working branch per §1 two-step flow, push to origin, tag new release.

**Source artifacts:**
- `skills/upstream-merge/SKILL.md` (363 lines) — §3.5 + §4.2b + §4.4 + §6 protocols
- `docs/upstream-merge-retrospective.md` (938 lines) — first attempt analysis
- `scripts/upstream-divergence.ts --json` — pre-merge divergence check
- `.github/workflows/check-fork-only-ratio.yml` + `check-pi-coupling.yml` — post-merge CI guardrails

> **Status (2026-07-01):** PLANNING. Initialized from `docs/upstream-merge-retrospective.md` (the 772-line retrospective written after the first upstream-merge attempt produced 11 conflicts). v3.0 (Universal MCP Stdio Server — Protocol-Category Simplification) is archived; this milestone targets the SKILL.md + architecture debt surfaced by that first merge attempt.

**Goal:** Convert the retrospective's P0/P1/P2 improvement roadmap into shipped code. The first real upstream-merge exposed three categories of debt — outdated SKILL.md policy (Pi-coupling-first vs upstream-first), file-level architecture that aggregates too many responsibilities in single files (index.ts 343 lines, elicitation-handler.ts 565 lines, proxy-modes.ts 958 lines), and absence of defensive CI for Pi-coupling re-introduction. v3.1 ships the three-layer response: policy change → file decomposition → guardrails.

**Target phases:**
- Phase 13 — SKILL.md 改写 (P0 from retrospective): Default `--theirs`, soften §4.2b from 5-step to 2-step soft follow-up, add §3.5 conflict independence check + §4.4 same-function 5-step analysis protocol
- Phase 14 — 大文件拆分 (P1 from retrospective): Decompose `index.ts` mcpAdapter (343 lines) into 4 small functions, split `elicitation-handler.ts` (565 lines) into 3 files, split `proxy-modes.ts` (958 lines) into 4 files, split `__tests__/init-elicitation.test.ts` (3 hunks) into 3 files
- Phase 15 — 防御性 CI (P2 from retrospective): CI type-boundary guard for Pi-coupling re-introduction, conflict-statistics dashboard, same-file-conflict predictor

**Source artifact:** `docs/upstream-merge-retrospective.md` (772 lines, written 2026-07-01)

## Current State

**Milestone v1.0 complete (4 phases, 7 plans)** — Internal interfaces abstracted (AgentAPI/UISystem/PiAdapter), init.ts/core logic migrated to AgentAPI. However:
- `index.ts` still accepts `ExtensionAPI` (blocks non-Pi agents)
- 6 source files still import Pi types (`AgentToolResult`, `ExtensionUIContext`, etc.)
- Only one adapter implementation (`PiAdapter`) in `adapters/`
- `agent-dir.ts` hardcodes `PI_CODING_AGENT_DIR`
- Integration test skill only validates against Pi mock

Test suite: 350/352 pass.

## Validated Requirements

- REQ-01 (Generic AgentAPI Interface) — Validated in Phase 01: `interfaces/agent-api.ts`; Phase 03: `utils.ts`/`init.ts`/`commands.ts` accept AgentAPI
- REQ-02 (UI System Interface) — Validated in Phase 01: `interfaces/agent-api.ts`; Phase 03: `state.ts`/`commands.ts` use UISystem
- REQ-03 (Pi Adapter Implementation) — Validated in Phase 01: `adapters/pi-adapter.ts`; Phase 03: `index.ts` wires PiAdapter + adaptPiContext internally
- REQ-04 (Backward Compatibility) — Validated in Phase 01: `index.ts` default `mcpAdapter` unchanged, `piMcpAdapter` alias added; Phase 03: activate signature preserved
- REQ-05 (Dependency Restructuring) — Validated in Phase 01: `package.json` peer/optional deps; Phase 02: `AgentPathResolver` abstraction lets non-Pi agents supply their own global config path
- REQ-06 (Documentation) — Validated in Phase 01: `MAPPING.md`
- REQ-07 (Testing) — Validated in Phase 01: `__tests__/pi-adapter.test.ts` + `__tests__/integration.test.ts`; Phase 02: `__tests__/agent-paths.test.ts` + `__tests__/agent-paths-integration.test.ts`; Phase 03: regression test for McpLifecycleManager Pi-coupling check

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

**After each milestone:**
1. Full review of all sections
2. Core Value check
3. Audit Out of Scope
4. Update Context with current state
---

*Last updated: 2026-07-01 — Milestone v3.1 (upstream-merge 治理与架构优化) initialized from `docs/upstream-merge-retrospective.md`. v3.0 (Universal MCP Stdio Server) archived.*