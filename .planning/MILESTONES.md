# Milestones

## v3.1 upstream-merge 治理与架构优化 (Shipped: 2026-07-01)

**Phases completed:** 3 phases, 0 plans, 16 commits, 16 files, +2243/-36 lines

**Key accomplishments:**

- SKILL.md policy rewrite (4 sections): §3.5 (Conflict hunk independence check, 4-category decision matrix + awk function-extraction script), §4.2b (5-step → 2-step soft follow-up with `gh` CLI graceful degradation), §4.4 (Same-function 5-step protocol: extract ours/theirs → view function context → classify merge mode → document decision in commit body), §5(b) (Pi-coupling advisory log)
- 5 atomic commits (ebb7ed8..872e55a) implementing the policy changes
- 249 fork-only commits audited; 233 new files (already independent), 9 L1 REPLACEMENTS (Phase 3 抽象改造, accepted), 8 L2 ADDITIONS (Phase 12 optimized, no refactor needed), ~10 L3 TESTS (deferred)
- SKILL.md §6 "Fork architecture principles" with 5 future-proofing rules (new adapter → new file, etc.)
- 2 GitHub Actions workflows: `check-fork-only-ratio.yml` (modify-to-new ratio target ≤ 2.0) + `check-pi-coupling.yml` (advisory Pi-coupling re-introduction detection)
- `scripts/upstream-divergence.ts --json` mode emitting JSON Schema v1.0 (documented in retrospective §13)
- `docs/upstream-merge-retrospective.md` (938 lines) — multi-perspective reflection (架构师/开发者/QA/PM), 4-question Q&A, L1/L2/L3 decision matrix, L2 per-file analysis, CI-02 JSON schema
- All 12 requirements satisfied: MERGE-01..04 (Phase 13), ARCH-02..06 (Phase 14), CI-01..03 (Phase 15)
- ARCH-01 retired (Phase 5 already made `index.ts` a 27-line thin wrapper; real target was `adapters/entry.ts` `createMcpAdapter` 324 lines, now tracked as ARCH-06)
- ARCH-02..04 mechanical decomposition **deferred** — L2 per-file analysis showed 6/8 L2 files have negative fork delta (Phase 12 already optimized); remaining +4 lines in `agent-dir.ts` not worth extracting

**Archive:** `.planning/milestones/v3.1-ROADMAP.md` + `.planning/milestones/v3.1-REQUIREMENTS.md` + `.planning/milestones/v3.1-MILESTONE-AUDIT.md`

---

## v3.0 v3.0 (Shipped: 2026-07-01)

**Phases completed:** 3 phases, 9 plans, 16 tasks

**Key accomplishments:**

- Extracted shared StoreAgentAdapter base class from QoderAdapter (346→157 lines) and KiloAdapter (298→132 lines), eliminating ~350 lines of duplicated in-memory store logic via STORE-02 constructor injection.
- ✅ Complete
- Updated upstream-merge special-cases registry with 3 new Phase 10 entries (store-adapter.ts fork-only, qoder/kilo-adapter decoupled-wrapper), verified full 590-test suite + TypeScript compilation + parametric contract tests across all 3 agents.
- Unified mcp-adapter skill shipped with deploy-examples.md migration, broken-anchor fixes, complete fork-only registry (7 entries), and kilo resolver fix — all committed with upstream:check exit 0
- 1. [Rule 3 - Blocking] ElicitRequestFormParams type cast for elicitInput params
- Created `__tests__/agent-adapters-registry.test.ts` with 23 tests verifying the simplified registry structure — entry count, IDs, factory methods, resolver, capabilities, createVerificationContext, and fresh-object-per-call (T-12-05). 18 tests failed with the old 3-entry registry.
- InlineMcpAdapter class
- D-13: E2E layer of dual-layer testing.

---

## v2.0 Multi-Agent Adapter Completion (Shipped: 2026-06-23, released as git tag `v2.0.0-universal`)

**Release tag:** `v2.0.0-universal` (annotated, SHA `84bf7e5` → commit `1f493b1`). SemVer pre-release derivative of upstream `v2.0.0` (`5e1be49`). Naming rationale: see `.planning/STATE.md` → `## Naming Decisions` (collision with upstream `v2.0.0` namespace resolved by switching to `vX.Y.Z-{fork-identifier}` pattern).

**Phases completed:** 9 phases, 25 plans, 17 tasks

**Key accomplishments:**

- New module `interfaces/agent-paths.ts`
- 1. Rule 1 - Caller updates required for utils.ts migration
- 1. Rule 1 - Bug: UISystem.custom renderer type mismatch with tui type
- Created TypeScript declaration stubs for optional Pi peer packages and a Wave 0 entry-point test stub so downstream Phase 5 verify commands can run without missing files or unresolved types.
- Replaced remaining `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent` type imports in `types.ts`, `proxy-modes.ts`, and `direct-tools.ts` with local `McpToolResult<T>` and agent-agnostic abstractions from `interfaces/agent-api.ts`.
- `agent-dir.ts` now reads `MCP_AGENT_DIR` first, falls back to `PI_CODING_AGENT_DIR`, and keeps the default Pi directory path unchanged.
- Introduced a generic `SamplingProvider` interface and a Pi-specific `PiSamplingProvider` implementation, making `handleSamplingRequest` fully agent-agnostic while preserving Pi model selection and completion behavior.
- 1. [Rule 2 - Missing Critical Functionality] Preserved `reload` in `adaptPiContext`
- Qoder SDK installed after human verification, in-memory `QoderAdapter` implementing the full `AgentAPI` surface with minimal UISystem, MCP_AGENT_DIR-aware `createQoderResolver`, and a runtime smoke script proving the SDK's setModel / model-listing surface works on this machine.
- `QoderSamplingProvider` bridges the Qoder SDK's `query()` + `getAvailableModels()` to the agent-agnostic `SamplingProvider` contract with `queryFn` injection so unit tests never spawn `qodercli`, plus a 14-test vitest contract covering model discovery, completion, abort-signal bridging, and T-06-03 secret-leak mitigation.
- ✅ Complete
- ✅ Complete
- ✅ Complete (checkpoint:human-verify — agent-side execution done, awaits human approval)
- 1. [Rule 1 — Bug] Plan's MockAgentAPI JSDoc contained "Pi-specific" which conflicted with the no-Pi-pattern acceptance check (Task 2)
- 07-integration-test-rebuild / 07-02
- Main `skills/mcp-adapter-test/SKILL.md` rewritten from 228 to 148 lines (~35% reduction); agent-specific HOW extracted to three per-agent reference files under `references/agent-paths/` (pi.md, qoder.md, _template.md). Phase 4 renamed "Per-Path Verification" with a parametric table; Capability Gate extracted as Step 0. Adding a new adapter = copy `_template.md` → `<id>.md`; main SKILL.md is untouched (Phase 8 UPSTREAM-04 compatibility).
- Plan 07-04 ships the unified agent × section matrix report (auto-generated by every `npx vitest run`) and rewrites README.md to position Pi as a first-class supported adapter alongside every other agent. SKILL.md §5/5B gain the "baseline-bound" annotations that explain why the observed 94% / 56% are 1-9 pp short of the ≥ 95% / ≥ 65% targets — both numbers are fixture-determined and shared with Pi.
- None
- 1. [Plan command bug] `grep -c '\bExtensionAPI\b' SKILL.md` returns 0 (BRE word-boundary vs literal `\b` text)
- Phase 8's full-divergence `UPSTREAM-CHANGES.md` (51KB / 209 rows) retired and replaced with Architecture C: a 17-entry special-cases registry colocated with `skills/upstream-merge/` + a TypeScript divergence cross-check script + the 12-category matrix inlined into `SKILL.md` §3.2.

---
