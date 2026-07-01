# Phase 12 Plan Verification

**Phase:** 12 — Universal MCP Stdio Server — Protocol-Category Simplification
**Plans checked:** 5 (12-01 through 12-05)
**Verification date:** 2026-06-30
**Verifier:** gsd-plan-checker (goal-backward analysis)
**Result:** ISSUES FOUND — 2 blocker(s), 3 warning(s), 2 info

---

## Executive Summary

The five plans for Phase 12 are **well-constructed and substantively sound**. All 13 decisions (D-01 through D-13) are covered with specific implementing tasks. The four critical research findings — `getClientCapabilities()` vs `getCapabilities()` (Pitfall 5), flow reordering (Pitfall 1), StoreAgentAdapter deletion with inline AgentAPI (D-04), and MCP SDK v1.29.0 API surface — are all explicitly addressed in the plan actions, acceptance criteria, and verification steps. Task quality is high: every task has `read_first`, `acceptance_criteria`, concrete `action`, and automated `<verify>` commands. Dependencies form a clean 3-wave DAG with no cycles.

**The two blockers are process/documentation gates, not substance gates:**
1. VALIDATION.md is missing (Dimension 8, Check 8e) — but all 11 tasks have automated verification.
2. RESEARCH.md `## Open Questions` lacks `(RESOLVED)` markers (Dimension 11) — but the plans functionally resolve all three questions.

Both can be fixed without revising the plan files themselves.

---

## VERIFICATION RESULT: ISSUES FOUND

**Phase:** 12 — Universal MCP Stdio Server — Protocol-Category Simplification
**Plans checked:** 5
**Issues:** 2 blocker(s), 3 warning(s), 2 info

---

### Blockers (must fix)

**1. [nyquist_compliance / Dimension 8 — Check 8e] VALIDATION.md not found**

- **Dimension:** Dimension 8 (Nyquist Compliance, Check 8e — VALIDATION.md Existence Gate)
- **Severity:** BLOCKER
- **Description:** The phase directory has no `12-VALIDATION.md` file. `workflow.nyquist_validation` is absent in `.planning/config.json` (absent key = enabled). RESEARCH.md contains a `## Validation Architecture` section (lines 789-853) with a full test map, sampling rate, Wave 0 gaps, and test-file-to-delete inventory. Per Check 8e: "If missing: BLOCKING FAIL."
- **Mitigating context:** All 11 tasks across the 5 plans have `<automated>` verification commands (`npx tsc --noEmit`, `npx vitest run ...`, `grep -c ... | xargs test`, `npm run verify:deploy`, `npm run upstream:check`). The substance of Nyquist — fast automated feedback per task — IS satisfied. Furthermore, the three most recent phases (09, 10, 11) also lacked VALIDATION.md, suggesting the project norm has shifted away from this artifact.
- **Fix options (pick one):**
  1. Create `12-VALIDATION.md` from RESEARCH.md §Validation Architecture (quick — the content already exists in RESEARCH).
  2. Set `"nyquist_validation": false` in `.planning/config.json` `workflow` section if the project has formally retired this artifact.

```yaml
issue:
  plan: null
  dimension: nyquist_compliance
  severity: blocker
  description: "VALIDATION.md not found for phase 12. Per Check 8e gate, this is a blocking fail."
  fix_hint: "Create 12-VALIDATION.md from RESEARCH.md §Validation Architecture, OR set workflow.nyquist_validation: false in config.json"
```

**2. [research_resolution / Dimension 11] Open Questions not marked as resolved**

- **Dimension:** Dimension 11 (Research Resolution #1602)
- **Severity:** BLOCKER
- **Description:** RESEARCH.md has a `## Open Questions` section (lines 760-775) without the `(RESOLVED)` suffix. Three questions are listed without inline `RESOLVED` markers:
  1. **StoreAgentAdapter retention** — Does D-04 include deleting the generic base class, or only per-agent subclasses?
  2. **URL elicitation forwarding** — How to forward URL elicitation through `uisystem.form()`?
  3. **init.ts modification depth** — Does "no config check" (D-11) require modifying init.ts, or is the default-check-pass approach sufficient?
- **Mitigating context:** The plans functionally resolve ALL three questions:
  - Q1: Plans 02 and 03 follow D-04 literally — delete StoreAgentAdapter, use inline AgentAPI (no shared base class). D-04 is unambiguous: "Delete ALL per-agent adapter code including the base class... No shared adapter base class — each entry point has its own inline implementation."
  - Q2: Plan 01 implements form elicitation forwarding only. RESEARCH.md recommendation ("URL elicitation can use the existing handleUrlElicitation code path") is followed implicitly. The "if supported" qualifier in D-07 allows this.
  - Q3: Plan 03 uses the "Preferred" approach from RESEARCH Pitfall 4 — set `ctx.hasUI = true` and provide forwarders on ctx BEFORE `fireSessionStart()`. This satisfies init.ts conditions without modifying init.ts.
  - The issue is purely that RESEARCH.md was not updated to reflect these resolutions.
- **Fix:** Update RESEARCH.md heading to `## Open Questions (RESOLVED)` and add inline resolution markers:
  - Q1: "RESOLVED: D-04 interpreted literally — StoreAgentAdapter deleted; inline AgentAPI used per D-04"
  - Q2: "RESOLVED: Form forwarding only in Phase 12; URL elicitation uses existing handleUrlElicitation path per 'if supported' qualifier"
  - Q3: "RESOLVED: ctx.hasUI=true + forwarder injection approach; no init.ts modification needed"

```yaml
issue:
  plan: null
  dimension: research_resolution
  severity: blocker
  description: "RESEARCH.md ## Open Questions section lacks (RESOLVED) suffix; 3 questions lack inline resolution markers"
  fix_hint: "Update heading to '## Open Questions (RESOLVED)' and add RESOLVED markers to each question"
```

---

### Warnings (should fix)

**1. [scope_sanity / Dimension 5] Plan 03 total files = 18 (5 modified + 13 deleted)**

- **Dimension:** Dimension 5 (Scope Sanity)
- **Severity:** WARNING
- **Description:** Plan 03 touches 18 files — 5 modified (bin/mcp-server.ts, package.json, vitest.config.ts, interfaces/agent-paths.ts, __tests__/package-manifest.test.ts) + 13 deleted. The 15+ files threshold normally triggers a blocker, but 13 of these are simple file deletions (low complexity, no code authoring). The substantive work is in Task 1 (creating bin/mcp-server.ts with ~120+ line inline AgentAPI + reordered flow) and Task 2 (config updates). Task 3 (13 deletions) is mechanical.
- **Risk:** The complex Task 1 (inline AgentAPI class, reordered flow, capability discovery, forwarder injection) combined with 13 file deletions in the same plan may strain the context budget if issues arise during execution.
- **Fix:** Monitor execution closely. If context degrades, the executor can split Task 3 (deletions) into a separate follow-up plan. No plan revision needed now.

```yaml
issue:
  plan: "12-03"
  dimension: scope_sanity
  severity: warning
  description: "Plan 03 touches 18 files (5 modified + 13 deleted). Above 15+ threshold but 13 are low-complexity deletions."
  fix_hint: "Monitor execution; split deletions into separate plan if context budget degrades"
```

**2. [key_links_planned / Dimension 4 + verification_derivation / Dimension 6] Two divergent inline AgentAPI implementations**

- **Dimension:** Dimension 4 (Key Links Planned) + Dimension 6 (Verification Derivation)
- **Severity:** WARNING
- **Description:** D-04 mandates "No shared adapter base class — each entry point has its own inline implementation." The plans correctly comply, but this creates TWO separate inline AgentAPI implementations with behavioral differences:
  - **Plan 02 factory** (used by adapter-contract.test.ts, capability-gate.test.ts): `sendMessage` = no-op, `exec` = mock returning `{code:0, stdout:"", stderr:""}`, `attachChannel`/`fireSessionStart`/`fireSessionShutdown` = no-op stubs.
  - **Plan 03 InlineMcpAdapter** (used by the real server): `sendMessage` = routes to channel (stderr), `exec` = real `node:child_process.spawn`, `attachChannel`/`fireSessionStart` = real implementations.
  - The parametric contract tests (Plan 04) test the factory's stubs, NOT the real InlineMcpAdapter. The real `attachChannel`, `fireSessionStart`, and `exec` in InlineMcpAdapter are only indirectly tested by the E2E test (which calls `listTools` and `callTool` but doesn't directly exercise exec or lifecycle methods).
- **Risk:** A bug in InlineMcpAdapter's real `attachChannel`, `fireSessionStart`, or `exec` would not be caught by the contract tests. The E2E test provides some coverage but doesn't directly test these methods.
- **Fix:** Consider adding a focused unit test for InlineMcpAdapter's real methods (attachChannel routing, fireSessionStart handler invocation, exec result mapping) in Plan 04. Alternatively, accept E2E coverage as sufficient for Phase 12 and document the gap.

```yaml
issue:
  plan: "12-02, 12-03"
  dimension: key_links_planned
  severity: warning
  description: "Two divergent inline AgentAPI implementations (factory stubs vs real InlineMcpAdapter). Contract tests test stubs; real lifecycle/exec methods only covered by E2E."
  fix_hint: "Add unit tests for InlineMcpAdapter real methods in Plan 04, or accept E2E coverage and document gap"
```

**3. [agents_md_compliance / Dimension 10] gitnexus_impact not mentioned in plan actions**

- **Dimension:** Dimension 10 (AGENTS.md Compliance)
- **Severity:** WARNING
- **Description:** AGENTS.md requires: "MUST run `gitnexus_impact` before editing any symbol" and "NEVER edit a function, class, or method without first running `gitnexus_impact` on it." The plans modify several symbols (AGENT_ADAPTERS array, createUniversalResolver addition, AGENT_ADAPTERS import changes, bin/mcp-server.ts creation that replaces bin/kilo-mcp-server.ts). None of the plan `<action>` or `<read_first>` sections mention running `gitnexus_impact` on the symbols being modified.
- **Mitigating context:** RESEARCH.md (line 89) notes: "GitNexus MCP tools may be unavailable in the current runtime. If so, the planner should note this and proceed with manual impact analysis (grep-based caller search) as a fallback." The plans include thorough `read_first` sections that serve as manual impact analysis. The `execute-plan` workflow may also handle this at execution time.
- **Fix:** The executor should run `gitnexus_impact` on modified symbols (AGENT_ADAPTERS, createUniversalResolver, etc.) during execution, or note the fallback per RESEARCH.md. No plan revision needed — this is an execution-time concern.

```yaml
issue:
  plan: null
  dimension: claude_md_compliance
  severity: warning
  description: "Plans modify symbols (AGENT_ADAPTERS, agent-paths.ts exports) without mentioning gitnexus_impact per AGENTS.md requirement"
  fix_hint: "Executor runs gitnexus_impact during execution; RESEARCH.md fallback (grep-based analysis) already documented"
```

---

### Info (suggestions)

**1. [task_completeness] Plan 04 Task 2 speculative about verify:deploy --agent pi behavior**

- **Plan:** 12-04, Task 2
- **Severity:** INFO
- **Description:** The action says: "Run `npm run verify:deploy -- --agent pi` — should skip (Pi has no createVerificationContext... wait, actually Pi entry in AGENT_ADAPTERS doesn't have createVerificationContext. Check if verify:deploy skips gracefully.)" The plan is uncertain about Pi's behavior with verify:deploy. The executor will need to verify during execution.
- **Fix:** No plan revision needed — the executor will discover the behavior during execution and handle accordingly.

**2. [context_compliance] Plan 03 deletes files beyond D-04's explicit list**

- **Plan:** 12-03, Task 3
- **Severity:** INFO
- **Description:** D-04 explicitly lists 5 files for deletion. Plan 03 deletes 13 files. The additional 8 are: bin/kilo-mcp-server.ts (renamed per D-05), adapters/qoder-renderer.ts (per-agent renderer), scripts/kilo-mcp-entry.ts (legacy), scripts/qoder-smoke.ts (smoke test for deleted adapter), and 4 test files (per D-09). These are all logical consequences of "delete ALL per-agent adapter code" — not scope creep. The additional files would become orphaned without imports after the adapter deletions.
- **Fix:** No action needed — the extended deletion is thorough cleanup, not scope creep.

---

## Dimension-by-Dimension Summary

| Dimension | Status | Notes |
|-----------|--------|-------|
| 1. Requirement Coverage | ✅ PASS | All 13 decisions (D-01 through D-13) mapped to specific tasks |
| 2. Task Completeness | ✅ PASS | All 11 tasks have files + action + verify (automated) + acceptance_criteria + done |
| 3. Dependency Correctness | ✅ PASS | Clean 3-wave DAG: Wave 1 (01+02 parallel), Wave 2 (03), Wave 3 (04+05 parallel). No cycles. |
| 4. Key Links Planned | ⚠️ WARNING | All wiring planned, but two divergent inline AgentAPI implementations create test coverage gap |
| 5. Scope Sanity | ⚠️ WARNING | Plan 03 = 18 files (5 modified + 13 deleted); deletions are low-complexity |
| 6. Verification Derivation | ✅ PASS | Truths are user-observable; artifacts map to truths; key_links specified |
| 7. Context Compliance | ✅ PASS | All locked decisions honored; no deferred ideas included; no contradictions |
| 7b. Scope Reduction Detection | ✅ PASS | No scope reduction language reducing decisions; "placeholder" model is correct per D-11 |
| 7c. Architectural Tier Compliance | ✅ PASS | All capabilities in correct tiers per RESEARCH responsibility map |
| 8. Nyquist Compliance | ❌ FAIL | VALIDATION.md missing (Check 8e gate); all tasks have automated verification otherwise |
| 9. Cross-Plan Data Contracts | ✅ PASS | No conflicting transforms on shared data entities |
| 10. AGENTS.md Compliance | ⚠️ WARNING | gitnexus_impact not mentioned; RESEARCH fallback documented |
| 11. Research Resolution | ❌ FAIL | Open Questions section lacks (RESOLVED) markers; questions functionally resolved by plans |
| 12. Pattern Compliance | SKIPPED | No PATTERNS.md found in phase directory |

---

## Coverage Summary

### Decision Coverage (D-01 through D-13)

| Decision | Plans | Tasks | Status |
|----------|-------|-------|--------|
| D-01 (AGENT_ADAPTERS: Pi + universal-mcp) | 12-02 | Task 2 | ✅ Covered |
| D-02 (Universal config path discovery) | 12-02, 12-03 | 02-T1 (createUniversalResolver), 03-T2 (remove old resolvers) | ✅ Covered |
| D-03 (Pi Branch A only) | 12-05 | Task 1 (SKILL.md) | ✅ Covered |
| D-04 (Delete per-agent adapters + inline AgentAPI) | 12-02, 12-03 | 02-T2 (inline factory), 03-T1 (InlineMcpAdapter), 03-T3 (delete files) | ✅ Covered |
| D-05 (Rename kilo-mcp-server → mcp-server) | 12-03 | Task 1 (create bin/mcp-server.ts), Task 3 (delete kilo-mcp-server.ts) | ✅ Covered |
| D-06 (ProtocolSamplingForwarder) | 12-01, 12-03 | 01-T1 (create), 03-T1 (inject) | ✅ Covered |
| D-07 (ProtocolElicitationForwarder) | 12-01, 12-03 | 01-T1 (create), 03-T1 (inject) | ✅ Covered |
| D-08 (Branch C is complete, not "best-effort") | 12-04, 12-05 | 04-T2 (parametric tests), 05-T1 (SKILL.md states complete) | ✅ Covered |
| D-09 (Delete per-adapter tests) | 12-03 | Task 3 (delete 4 test files) | ✅ Covered |
| D-10 (Single bin entry, no aliases) | 12-03, 12-05 | 03-T2 (package.json), 05-T2 (CHANGELOG) | ✅ Covered |
| D-11 (Pure forwarding, no config check) | 12-01, 12-03 | 01-T1 (no config.settings), 03-T1 (no config check) | ✅ Covered |
| D-12 (SKILL.md Phase 0 simplification) | 12-05 | Task 1 (single question, Branch B removed) | ✅ Covered |
| D-13 (Dual-layer testing) | 12-01, 12-04 | 01-T2 (unit tests), 04-T1 (E2E tests) | ✅ Covered |

### Critical Research Findings Incorporated

| Finding | Where Addressed | Status |
|---------|-----------------|--------|
| `getClientCapabilities()` vs `getCapabilities()` (Pitfall 5) | Plan 03 Task 1 action Step 11; acceptance_criteria; verify grep | ✅ Explicitly addressed |
| Flow reordering — connect Server before fireSessionStart (Pitfall 1) | Plan 03 Task 1 action Steps 10→14; acceptance_criteria | ✅ Explicitly addressed |
| StoreAgentAdapter deletion with inline AgentAPI (D-04) | Plan 02 Task 2 (factory inline); Plan 03 Task 1 (InlineMcpAdapter); Plan 03 Task 3 (delete store-adapter.ts) | ✅ Explicitly addressed |
| MCP SDK v1.29.0 API surface | Plan 01 read_first (SDK source lines); Plan 03 read_first (SDK source lines) | ✅ Referenced in read_first |
| init.ts condition workaround (Pitfall 4) | Plan 03 Task 1 action Step 12-13 (ctx.hasUI = true) | ✅ Explicitly addressed |
| Double conversion for elicitation (Pitfall 3) | Plan 01 Task 1 action (JSDoc note about accepted trade-off) | ✅ Documented |
| Coverage thresholds for deleted files (Pitfall 6) | Plan 03 Task 2 action (remove vitest.config.ts entries) | ✅ Explicitly addressed |

---

## Plan Summary

| Plan | Tasks | Files (modified+deleted) | Wave | Depends On | Status |
|------|-------|--------------------------|------|------------|--------|
| 12-01 | 2 | 5 (5 new) | 1 | [] | Valid |
| 12-02 | 2 | 2 (2 modified) | 1 | [] | Valid |
| 12-03 | 3 | 18 (5 modified + 13 deleted) | 2 | [12-01, 12-02] | Valid (scope warning) |
| 12-04 | 2 | 3 (1 new + 2 verified) | 3 | [12-03] | Valid |
| 12-05 | 2 | 7 (7 modified) | 3 | [12-03] | Valid |

### Wave Structure

```
Wave 1 (parallel):  12-01 (forwarders + mock client + unit tests)
                    12-02 (registry simplification + universal resolver)
                              ↓
Wave 2 (sequential): 12-03 (bin/mcp-server.ts + deletions + config updates)
                              ↓
Wave 3 (parallel):  12-04 (E2E tests + full verification)
                    12-05 (SKILL.md + README + CHANGELOG + special-cases.md)
```

Wave 1 plans (12-01, 12-02) can run in parallel — they have no shared file dependencies:
- 12-01 creates new files (forwarders, mock client, tests)
- 12-02 modifies interface files (agent-api.ts, agent-paths.ts)
No file overlap. ✅

Wave 3 plans (12-04, 12-05) can run in parallel — they have no shared file dependencies:
- 12-04 creates/modifies test files
- 12-05 modifies documentation files
No file overlap. ✅

---

## Test Strategy Assessment (D-13)

| Layer | Plan | File | What it tests |
|-------|------|------|---------------|
| Unit (in-process) | 12-01 | protocol-sampling-forwarder.test.ts | ProtocolSamplingForwarder with MockMcpClient — resolveModel, complete, confirm, message conversion |
| Unit (in-process) | 12-01 | protocol-elicitation-forwarder.test.ts | ProtocolElicitationForwarder with MockMcpClient — form, action mapping, convertFieldToSchema |
| E2E (subprocess) | 12-04 | mcp-server-e2e.test.ts | bin/mcp-server.ts as subprocess via StdioClientTransport — listTools, callTool, sampling capability acceptance |
| Parametric | 12-04 | adapter-contract.test.ts | AGENT_ADAPTERS entries (universal-mcp + pi) — AgentAPI contract (8 methods) |
| Parametric | 12-04 | capability-gate.test.ts | AGENT_ADAPTERS entries — capability gate behavior |

**Gap noted (Warning #2):** The InlineMcpAdapter's real `attachChannel`, `fireSessionStart`, and `exec` methods are only covered by the E2E test (indirectly). The contract tests test the Plan 02 factory's stubs, not the real implementation.

---

## Scope Creep Check

| Deferred Idea | Present in plans? | Status |
|---------------|-------------------|--------|
| Roots forwarding (`server.listRoots()`) | No | ✅ Excluded |
| Logging forwarding (`server.sendLoggingMessage()`) | No | ✅ Excluded |
| MCP Prompts exposure (`/mcp setup` as MCP Prompt) | No | ✅ Excluded |
| OAuth management via tools (`/mcp-auth` as MCP tools) | No | ✅ Excluded |
| Dynamic capability declaration in AGENT_ADAPTERS | No (static entry with comment) | ✅ Excluded |

No scope creep detected. ✅

---

## Structured Issues

```yaml
issues:
  - id: 1
    plan: null
    dimension: nyquist_compliance
    severity: blocker
    description: "VALIDATION.md not found for phase 12. Check 8e gate requires it when nyquist_validation is enabled (absent key = enabled) and RESEARCH.md has Validation Architecture section."
    fix_hint: "Create 12-VALIDATION.md from RESEARCH.md §Validation Architecture, OR set workflow.nyquist_validation: false in config.json"

  - id: 2
    plan: null
    dimension: research_resolution
    severity: blocker
    description: "RESEARCH.md ## Open Questions section (lines 760-775) lacks (RESOLVED) suffix. 3 questions lack inline RESOLVED markers: StoreAgentAdapter retention, URL elicitation forwarding, init.ts modification depth."
    fix_hint: "Update heading to '## Open Questions (RESOLVED)' and add RESOLVED markers with resolution summary to each question"

  - id: 3
    plan: "12-03"
    dimension: scope_sanity
    severity: warning
    description: "Plan 03 touches 18 files (5 modified + 13 deleted). Above 15+ blocker threshold but 13 are low-complexity deletions. Task 1 (inline AgentAPI + reordered flow) is complex."
    fix_hint: "Monitor execution; split Task 3 (deletions) into separate plan if context budget degrades"

  - id: 4
    plan: "12-02, 12-03"
    dimension: key_links_planned
    severity: warning
    description: "Two divergent inline AgentAPI implementations: Plan 02 factory (stubs: no-op sendMessage/exec/attachChannel/fireSessionStart) vs Plan 03 InlineMcpAdapter (real implementations). Contract tests test stubs; real lifecycle/exec methods only covered by E2E indirectly."
    fix_hint: "Add unit tests for InlineMcpAdapter real methods in Plan 04, or accept E2E coverage and document the gap"

  - id: 5
    plan: null
    dimension: claude_md_compliance
    severity: warning
    description: "AGENTS.md requires gitnexus_impact before editing symbols. Plans modify AGENT_ADAPTERS, agent-paths.ts exports without mentioning this step."
    fix_hint: "Executor runs gitnexus_impact during execution; RESEARCH.md fallback (grep-based analysis) already documented"

  - id: 6
    plan: "12-04"
    dimension: task_completeness
    severity: info
    description: "Plan 04 Task 2 is speculative about verify:deploy --agent pi behavior ('wait, actually Pi entry... Check if verify:deploy skips gracefully')."
    fix_hint: "Executor verifies during execution; no plan revision needed"

  - id: 7
    plan: "12-03"
    dimension: context_compliance
    severity: info
    description: "Plan 03 deletes 8 files beyond D-04's explicit list (qoder-renderer.ts, kilo-mcp-entry.ts, qoder-smoke.ts, 4 test files, kilo-mcp-server.ts). These are logical consequences of per-agent adapter elimination, not scope creep."
    fix_hint: "No action needed — thorough cleanup, not scope creep"
```

---

## Recommendation

**2 blocker(s) require resolution before execution.** Both are process/documentation gates that can be fixed quickly without revising the plan files:

1. **VALIDATION.md** — Either create the file (content exists in RESEARCH.md §Validation Architecture) or disable nyquist_validation in config.json. Estimated fix: 5 minutes.
2. **Open Questions resolution markers** — Update RESEARCH.md heading and add 3 inline RESOLVED markers. The resolutions are already determined by the plans — this is a documentation update. Estimated fix: 5 minutes.

**3 warning(s) are recommended but not blocking.** The most significant is Warning #2 (divergent inline AgentAPI implementations creating a test coverage gap). The executor should consider adding focused unit tests for InlineMcpAdapter's real methods during Plan 04 execution.

**The plans are substantively ready for execution.** The 5 plans collectively achieve the phase goal: a universal MCP stdio server with runtime capability discovery and protocol forwarding, eliminating all per-agent adapters. All 13 decisions are covered, all critical research findings are incorporated, task quality is high, dependencies are correct, and no scope creep exists.

---

*Verification performed by gsd-plan-checker on 2026-06-30*
*Methodology: Goal-backward analysis — start from phase goal, verify each plan task traces back to a decision/requirement, verify artifacts are wired, verify scope is within budget.*
