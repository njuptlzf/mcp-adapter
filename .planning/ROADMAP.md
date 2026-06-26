# Roadmap

## Milestones

- 🔄 **v3.0 Protocol-Category Simplification** — Phase 10+ (active 2026-06-26) — Simplify "for every MCP-compatible agent" by merging per-agent adapters into protocol-category shared adapters, with agent self-reporting config paths.
- ✅ **v2.0 Multi-Agent Adapter Completion** — Phases 1-9 (shipped 2026-06-23) — 9 phases / 25 plans / 17 tasks. Archive: `.planning/milestones/v2.0-ROADMAP.md` and `.planning/milestones/v2.0-REQUIREMENTS.md`. Summary: `.planning/MILESTONES.md`.

## Phases

<details>
<summary>✅ v2.0 Multi-Agent Adapter Completion (Phases 1-9) — SHIPPED 2026-06-23</summary>

### Phase 1: Foundation - Universal Interfaces

Establish the core interface abstractions and Pi adapter implementation.

**Goals:**

- AgentAPI interface with all required methods
- UISystem interface with optional UI capabilities  
- PiAdapter implementation wrapping ExtensionAPI
- MAPPING.md documentation

**Deliverables:**

- `interfaces/agent-api.ts` - Generic interfaces
- `adapters/pi-adapter.ts` - Pi implementation
- `MAPPING.md` - Interface mapping documentation

---

### Phase 2: Dependency Restructuring

Restructure package.json to support universal architecture.

**Goals:**

- Move Pi packages to optional peer dependencies
- Add config path abstraction
- Verify backward compatibility

**Deliverables:**

- Updated package.json (done in Phase 1)
- `interfaces/agent-paths.ts` — AgentPathResolver contract + Pi default
- Rewired `config.ts` using resolver while preserving Pi behavior

**Plans:** 1 plan

Plans:

- [x] 02-01-PLAN.md — introduce AgentPathResolver, rewire config.ts, add non-Pi integration test

---

### Phase 3: Core Logic Abstraction

Gradually migrate core logic to use generic interfaces.

**Goals:**

- Migrate init.ts, utils.ts, commands.ts from ExtensionAPI/ExtensionContext to AgentAPI/AgentContext/UISystem
- Wire index.ts entry point to use PiAdapter internally
- Maintain backward compatibility — activate signature unchanged

**Deliverables:**

- `init.ts` — generic AgentAPI + AgentContext based initialization
- `utils.ts` — AgentAPI-compatible openUrl/openPath
- `commands.ts` — AgentContext-based command handlers
- `state.ts` — UISystem-typed ui field

**Plans:** 3 plans

Plans:

- [x] 03-01-PLAN.md — migrate utils.ts, state.ts, lifecycle.ts to AgentAPI/UISystem
- [x] 03-02-PLAN.md — wire init.ts + index.ts entry point through PiAdapter
- [x] 03-03-PLAN.md — migrate commands.ts + panel entry points to AgentContext

---

### Phase 4: Testing & Verification

Comprehensive testing of the universal adapter.

**Goals:**

- Unit tests for all adapter functions
- Integration tests for backward compatibility
- Test against multiple agent scenarios

**Deliverables:**

- `__tests__/pi-adapter.test.ts`
- `__tests__/integration.test.ts`
- Test coverage reports

**Plans:** 2 plans

Plans:

- [x] 04-01-PLAN.md — mock adapter + contract tests for universal adapter pattern
- [x] 04-02-PLAN.md — configure coverage reporting, generate coverage report

---

### Phase 5: Type Decoupling & Entry Point Refactor

Decouple all remaining Pi type imports across 6 source files, create agent-agnostic entry point.

**Goals:**

- Replace `AgentToolResult`, `ExtensionUIContext`, `ExtensionContext`, `ToolInfo` imports with generic equivalents from interfaces/agent-api.ts
- Extract Pi-specific sampling handler logic (Model, complete, AssistantMessage) into optional wrapper
- Replace `@earendil-works/pi-tui` Text dependency with generic rendering interface
- Replace `PI_CODING_AGENT_DIR` with `AgentPathResolver` in agent-dir.ts
- Create new agent-agnostic entry point accepting `AgentAPI`
- Refactor existing `mcpAdapter(pi: ExtensionAPI)` as Pi-specific wrapper

**Requirements:** DECOUPLE-01 through DECOUPLE-07, ENTRY-01 through ENTRY-03

**Affected files:**

- `proxy-modes.ts` — AgentToolResult, ToolInfo
- `direct-tools.ts` — AgentToolResult, AgentToolUpdateCallback, ExtensionContext
- `tool-result-renderer.ts` — AgentToolResult, Text (pi-tui)
- `sampling-handler.ts` — ExtensionUIContext, Model, complete (pi-ai)
- `elicitation-handler.ts` — ExtensionUIContext
- `index.ts` — ExtensionAPI, ToolInfo
- `agent-dir.ts` — PI_CODING_AGENT_DIR

**Plans:** 6/6 plans complete

Plans:

- [x] 05-00-PLAN.md — Wave 0 stubs: Pi peer type declarations + missing test file + validation update
- [x] 05-01-PLAN.md — localize McpToolResult and decouple proxy-modes.ts / direct-tools.ts
- [x] 05-02-PLAN.md — add MCP_AGENT_DIR fallback in agent-dir.ts and verify integration tests
- [x] 05-03-PLAN.md — abstract sampling behind SamplingProvider with PiSamplingProvider adapter
- [x] 05-04-PLAN.md — abstract elicitation and rendering behind UISystem / RenderOutput with Pi renderer
- [x] 05-05-PLAN.md — create createMcpAdapter entry point, refactor index.ts as Pi wrapper

---

### Phase 6: Second Agent Adapter

Implement a non-Pi AgentAPI adapter to prove interface portability.

**Goals:**

- Implement QoderAdapter (or equivalent) in adapters/ implementing AgentAPI
- Implement corresponding AgentPathResolver
- Integration test proving initializeMcp() works with the new adapter
- Verify 10 demo MCP servers function through the new adapter

**Requirements:** ADAPTER-01 through ADAPTER-03

**Deliverables:**

- `adapters/qoder-adapter.ts` (or equivalent)
- Corresponding AgentPathResolver
- New integration test

---

### Phase 7: Integration Test Rebuild

Rebuild skills/mcp-adapter-test as "for every agent" with per-adapter verification.

**Goals:**

- Capability Gate runs FIRST, clearly reports agent environment and available paths
- Replace Pi-specific MockAgent with generic AgentAPI mock
- Add per-adapter contract verification layer
- Test skill clearly states "Agent X supports Path Y. Agent Z not yet supported"
- Rebuild SKILL.md Phase 4 for any supported agent
- Update `README.md` to communicate Pi compatibility + universal agent support and highlight integration test verification results

**Requirements:** TEST-01 through TEST-05, DOC-01 through DOC-03, FIX-01

**Status:** ✅ COMPLETE (4/4 plans, 1 deviation, 21/21 decisions, 9/9 requirements)

**Plans:** 4 plans, 1 wave (Wave 1, autonomous) — ALL COMPLETE

- ✅ `07-01` Adapter Registry + Parametric Test Framework (D-04, D-07, D-08, D-09) — 4 commits
- ✅ `07-02` Capability Gate + FIX-01 Prebuild (D-01..D-03, D-14, D-15) — 4 commits, 1 deviation
- ✅ `07-03` SKILL.md Parametric + Per-Agent References (D-10, D-11) — 3 commits
- ✅ `07-04` Matrix Reporter + README Rewrite (D-12, D-13, D-16, D-17, D-18..D-20) — 4 commits

**Deviations:** 1 (Rule 1) — vitest 3.2.6 SSR race caused removal of `globalSetup` field; `test:prebuild` npm script is the primary build mechanism instead. `tests/global-setup.ts` file retained as safety net.

**Deliverables:**

- Updated `skills/mcp-adapter-test/SKILL.md`
- New/updated test infrastructure for generic AgentAPI mocking
- Per-adapter contract test framework
- Revised `README.md` with compatibility/verification section

**Plans:** 4 plans, 1 wave (Wave 1, autonomous)

- `07-01` Adapter Registry + Parametric Test Framework (D-04, D-07, D-08, D-09)
- `07-02` Capability Gate + FIX-01 Prebuild (D-01..D-03, D-14, D-15)
- `07-03` SKILL.md Parametric + Per-Agent References (D-10, D-11)
- `07-04` Matrix Reporter + README Rewrite (D-12, D-13, D-16, D-17, D-18..D-20)

**Cross-cutting constraints:**

- All 4 plans share `vitest.config.ts` (07-02 adds `globalSetup`, 07-04 adds `reporters`); executors MUST re-read the file before editing.
- `interfaces/agent-api.ts` is a production interface file modified by 07-01 (per D-07 user-locked decision); layer-violation mitigation recorded in VALIDATION.md §5.55.
- 07-02 and 07-04 share `vitest.config.ts`; recommended execution order: 07-01 → 07-03 → 07-02 → 07-04 (or full sequential).

---

### Phase 8: Upstream Merge Conflict Resolution

Establish fork-maintainer workflow for merging upstream features and bugfixes from https://github.com/nicobailon/pi-mcp-adapter.

**Goals:**

- Create `UPSTREAM-CHANGES.md` manifest tracking every file diverged from upstream with rationale
- Create `skills/upstream-merge/SKILL.md` — agent skill for automated conflict resolution
- Define conflict resolution rules: adapter files always kept, type-replacement changes preferred, upstream bugfixes accepted if Pi-coupling-free
- Guide Phase 5-6 implementation to minimize source edits via adapter/wrapper patterns

**Requirements:** UPSTREAM-01 through UPSTREAM-04

**Deliverables:**

- `UPSTREAM-CHANGES.md` — change manifest for all diverged files
- `skills/upstream-merge/SKILL.md` — merge conflict resolution skill
- Updated Phase 5-6 implementation patterns to prefer wrappers over direct edits

**Plans:** 2/2 plans complete

Plans:

- [x] 08-01-PLAN.md — `UPSTREAM-CHANGES.md` initial-fill (5-column manifest + Decision Anchors + static alignment check)
- [x] 08-02-PLAN.md — `skills/upstream-merge/SKILL.md` 4-section skill + 2 dry-run scenarios (worktree-isolated) + follow-up issue template

---

### Phase 9: Upstream Manifest Architecture C Refactor

Refactor Phase 8's full-divergence manifest into a leaner Architecture C: a special-cases registry that lives inside `skills/upstream-merge/` instead of the repo root, with a divergence-check script that replaces manual manifest regeneration.

**Goals:**

- Retire the repo-root `UPSTREAM-CHANGES.md` (51KB / 209 rows / 8 implicit categories) and replace it with a hand-curated special-cases registry (~15-20 entries) co-located with `skills/upstream-merge/SKILL.md`
- Encode the Phase 8 fast-path rules (D-23: 12-category per-file default-resolution matrix) into `SKILL.md` itself, so any non-special-case file is resolved by category rules without needing to look up the registry
- Add `scripts/upstream-divergence.ts` that runs `git diff upstream/main --name-status` and cross-checks against the registry, surfacing (a) diverged files not in the registry → treat as `assess`, (b) registry entries no longer diverged → suggest removal
- Trigger the divergence check **manually only** (per Phase 8 UPSTREAM-01-D "no CI hook" principle), surfaced as an `npm run upstream:check` script and as step 1 of `SKILL.md` §2
- Preserve every Phase 8 invariant: 4-section skill structure, Pi-coupling marker grep (§3.1 corrected with `\b` + `types/pi-*.d.ts` exclusion), 5-step follow-up flow (§3.2), 6-item merge checklist (§4), `upstream-merge:` commit prefix

**Requirements:** UPSTREAM-01 (revised: special-cases-only scope), UPSTREAM-02 (skill §2 reference updated), UPSTREAM-03 (unchanged — rules stay the same), UPSTREAM-04 (unchanged — adapter pattern preservation), UPSTREAM-05 (NEW: divergence check script with manual-only trigger)

**Deliverables:**

- **Retired:** `UPSTREAM-CHANGES.md` (removed from repo root)
- **New:** `skills/upstream-merge/references/special-cases.md` — special-cases registry, schema `| Path | Status | Why special | Decision |`, 15-20 hand-curated entries (covers: `index.ts` D-04 backward-compat, `mcp-panel.ts` + `mcp-setup-panel.ts` DECOUPLE-06 follow-up, `panel-keys.ts` deleted-in-fork, `interfaces/agent-api.ts` legal JSDoc, `interfaces/agent-paths.ts` + `interfaces/sampling.ts`, `package.json` + `vitest.config.ts` + `tsconfig.json`, `README.md` + `MAPPING.md` + `CHANGELOG.md` + `OAUTH.md`, `types/pi-*.d.ts` × 3, any new special cases surfaced during Phase 9 execution)
- **New:** `scripts/upstream-divergence.ts` — TypeScript script; outputs (1) diverged-not-registered list, (2) stale-entries list, (3) summary stats; exits non-zero on stale entries, zero on diverged-not-registered (warning only)
- **Modified:** `skills/upstream-merge/SKILL.md` §2 — replace "Read `UPSTREAM-CHANGES.md` at the repo root" with "Read `references/special-cases.md` AND run `npm run upstream:check`"; rewire §4(e) to invoke the script instead of comparing manifest rows
- **New:** `package.json` scripts entry `"upstream:check": "tsx scripts/upstream-divergence.ts"` (manual invocation only; no pre-commit / pre-merge wiring)
- **Documentation:** update `skills/upstream-merge/SKILL.md` §2 freshness-check snippet to call the script

**Plans:**
1/1 plans complete

**Cross-cutting constraints:**

- Phase 8 verifier passed all 4 must-haves on 2026-06-18; Phase 9 does **not** retro-edit any Phase 8 deliverable, only supersedes `UPSTREAM-CHANGES.md`
- The 12-category matrix in D-23 must be inlined into `SKILL.md` (not duplicated in `special-cases.md`) — single source of truth for the fast-path
- `scripts/upstream-divergence.ts` must handle the GnuTLS workaround documented in Phase 8 (`GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream`) — copy the snippet, don't re-derive
- Phase 9 accepts a small gap between the new registry and upstream: the 15-20 hand-curated entries are a snapshot, and the script's job is to surface drift, not eliminate it

</details>

### Phase 10: StoreAdapter Base Class & Agent Self-Reporting Paths

Extract shared StoreAgentAdapter base class from QoderAdapter + KiloAdapter (90% code overlap), add agent self-reporting config path to AgentContext, and update upstream-merge skill for the new file layout.

**Goals:**

- Merge QoderAdapter(346行) + KiloAdapter(298行) into shared StoreAgentAdapter(~100行) + thin agent wrappers(~50行 each)
- Add `mcpConfigPath?: string` to AgentContext for agent self-reporting config paths
- Eliminate hardcoded default paths per agent; agents self-report `.mcp.json` location
- Update `skills/upstream-merge/references/special-cases.md` with new fork-only files
- Verify parametric adapter contract tests pass for all 3 agents

**Requirements:** STORE-01 through STORE-05, PATH-01 through PATH-03

**Deliverables:**

- `adapters/store-adapter.ts` — Shared StoreAgentAdapter base class
- Refactored `adapters/qoder-adapter.ts` → thin wrapper delegating to StoreAgentAdapter
- Refactored `adapters/kilo-adapter.ts` → thin wrapper delegating to StoreAgentAdapter
- Updated `interfaces/agent-api.ts` — AGENT_ADAPTERS registry + AgentContext.mcpConfigPath
- Updated `skills/upstream-merge/references/special-cases.md` — +3 entries for new files
- Updated `__tests__/adapter-contract.test.ts` — parametric test for StoreAdapter

**Plans:** 3 plans, 2 waves (Wave 1: StoreAdapter + Paths, Wave 2: Tests + Upstream Registry)

Plans:
- [x] 10-01-PLAN.md — StoreAgentAdapter base class extraction + QoderAdapter/KiloAdapter thin-wrapper refactor (STORE-01 through STORE-03, STORE-05)
- [x] 10-02-PLAN.md — Agent self-reporting paths: mcpConfigPath on AgentContext + config.ts wiring + optional agent-paths dedup (PATH-01 through PATH-03)
- [x] 10-03-PLAN.md — Tests + upstream-merge registry update + full verification suite (STORE-04, UP-01, UP-02)

**Status:** ✅ Complete (3 plans, 9 commits, 590/600 tests pass)

---

_For milestone history, see `.planning/MILESTONES.md`. For archived roadmap + requirements, see `.planning/milestones/v2.0-*.md`._
