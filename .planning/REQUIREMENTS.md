# Requirements

## Requirement Definitions

### REQ-01: Generic Agent API Interface

- Define `AgentAPI` interface abstracting agent tool/flag/command registration
- Include methods: `registerTool`, `registerCommand`, `registerFlag`, `on`, `getAllTools`, `getFlag`, `sendMessage`, `exec`
- Priority: Must

### REQ-02: UI System Interface  

- Define `UISystem` interface for notification, status bar, form, and theming
- Support optional methods for agents without full UI capabilities
- Priority: Must

### REQ-03: Pi Adapter Implementation

- Implement `PiAdapter` class wrapping Pi's `ExtensionAPI`
- Provide `adaptPiContext` function for context conversion
- Priority: Must

### REQ-04: Backward Compatibility

- Existing Pi users can upgrade without code changes
- Export existing `mcpAdapter` function unchanged
- Priority: Must

### REQ-05: Dependency Restructuring

- Move Pi-specific packages to `peerDependencies` (optional)
- Core packages remain as regular dependencies
- Priority: Must

### REQ-06: Documentation

- Create `MAPPING.md` documenting all interface mappings
- Update README with universal adapter usage examples
- Priority: Should

### REQ-07: Testing

- Add unit tests for PiAdapter
- Add integration tests for backward compatibility
- Priority: Should

---

## Milestone v2.0 — Active Requirements

### DECOUPLE: Type Decoupling

- [x] **DECOUPLE-01**: Replace `AgentToolResult` imports in proxy-modes.ts, direct-tools.ts, tool-result-renderer.ts with generic types from interfaces/agent-api.ts
- [x] **DECOUPLE-02**: Replace `ExtensionUIContext` imports in sampling-handler.ts, elicitation-handler.ts with generic `UISystem` from interfaces/agent-api.ts
- [x] **DECOUPLE-03**: Replace `ExtensionContext` import in direct-tools.ts with generic `AgentContext`
- [x] **DECOUPLE-04**: Replace `ToolInfo` import in proxy-modes.ts and index.ts with generic `ToolInfo` from interfaces/agent-api.ts
- [x] **DECOUPLE-05**: Replace `Model`, `complete`, `AssistantMessage` etc. in sampling-handler.ts with agent-agnostic abstractions (or extract to Pi-specific sampling wrapper)
- [x] **DECOUPLE-06**: Replace `@earendil-works/pi-tui` Text import in tool-result-renderer.ts with generic rendering interface
- [x] **DECOUPLE-07**: Replace `PI_CODING_AGENT_DIR` in agent-dir.ts with `AgentPathResolver` usage
- Priority: Must

### ENTRY: Entry Point Refactor

- [x] **ENTRY-01**: Create agent-agnostic entry point accepting `AgentAPI` instead of `ExtensionAPI`
- [x] **ENTRY-02**: Refactor existing `mcpAdapter(pi: ExtensionAPI)` in index.ts as Pi-specific wrapper around new entry point
- [x] **ENTRY-03**: Maintain 100% backward compatibility — Pi users see zero behavior change
- Priority: Must

### ADAPTER: Second Agent Adapter

- [ ] **ADAPTER-01**: Implement at least one non-Pi `AgentAPI` adapter (e.g., QoderAdapter) in adapters/
- [ ] **ADAPTER-02**: Implement corresponding `AgentPathResolver` for the new agent
- [x] **ADAPTER-03**: Integration test proving the new adapter works with initializeMcp()
- Priority: Must

### TEST: Agent-Agnostic Test Skill

- [ ] **TEST-01**: Move Capability Gate to run FIRST before any test, not embedded in Phase 4
- [ ] **TEST-02**: Clearly report: which agent is running, which paths are available, which adapters are supported
- [ ] **TEST-03**: Replace Pi-specific MockAgent in adapter-contract.test.ts with generic AgentAPI mock
- [ ] **TEST-04**: Add per-adapter verification layer: for each registered adapter, verify AgentAPI contract compliance
- [ ] **TEST-05**: Rebuild SKILL.md Phase 4 to support Path A/B verification for ANY supported agent (not just Pi)
- Priority: Should

### DOC: Documentation & Project Value Communication

- [ ] **DOC-01**: Revise `README.md` to lead with "fully Pi-compatible + supports every agent" positioning, emphasizing that Pi adapter is a first-class implementation, not a legacy mode
- [ ] **DOC-02**: Add a "Verification" or "Compatibility" section to `README.md` summarizing integration test results across agents, including proxy path, directTools path, and SDK fallback coverage
- [ ] **DOC-03**: Update `README.md` usage examples to show both Pi (`mcpAdapter`) and universal (`createMcpAdapter`) entry points once Phase 5 entry point refactor is complete
- Priority: Should

### UPSTREAM: Upstream Merge Conflict Resolution

- [x] **UPSTREAM-01** *(revised by Phase 9)*: Maintain a hand-curated special-cases registry documenting files diverged from upstream (https://github.com/nicobailon/pi-mcp-adapter) that need explicit per-file rationale. Living at `skills/upstream-merge/references/special-cases.md` (skill-local, sub-option C2). Schema `| Path | Status | Why special | Decision |`; ~15-20 anchored entries; the diverged-but-not-registered set is surfaced live by `scripts/upstream-divergence.ts` (no longer statically enumerated).
- [x] **UPSTREAM-02** *(revised by Phase 9)*: `skills/upstream-merge/SKILL.md` — an agent skill that (a) reads `references/special-cases.md` and (b) runs `npm run upstream:check` (which executes `tsx scripts/upstream-divergence.ts`) when upstream merge conflicts occur; provides conflict resolution guidance (keep adapter change vs accept upstream vs manual merge).
- [x] **UPSTREAM-03**: In the skill, define conflict resolution rules: (a) new files under adapters/, interfaces/, skills/ → always keep ours, (b) type-replacement changes in source files → prefer adapter pattern over Pi-specific imports, (c) upstream bugfixes to core MCP logic → accept if they don't re-introduce Pi coupling, (d) upstream features → assess per-case. **(Phase 9 enhancement: inlined 12-category per-file default-resolution matrix into SKILL.md §3.2a per D-35.)**
- [x] **UPSTREAM-04**: Minimize source file modifications during Phase 5-6 by preferring adapter/wrapper patterns over direct edits where possible
- [x] **UPSTREAM-05** *(NEW Phase 9)*: Provide `scripts/upstream-divergence.ts` invoked via `npm run upstream:check` that runs `git diff upstream/main --name-status`, cross-checks against `references/special-cases.md`, and emits: (a) registered entries (GREEN), (b) diverged-but-not-registered (YELLOW, exit 2), (c) stale entries (RED, exit 1). GnuTLS workaround verbatim from 08-LEARNINGS.md L-4. Manual trigger only (no pre-commit / pre-merge / CI hook, per UPSTREAM-01-D "no CI hook" principle — D-33).
- Priority: Must

## Traceability

Canonical mapping from every REQ-ID in this document to the phase that delivered it. The v2.0 milestone closed on 2026-06-22 (9/9 phases, 25/25 plans per STATE.md); all entries show Status=Complete. The Date column uses the phase-level completion date where verifiable, otherwise the milestone close date. A few ADAPTER/TEST/DOC checkboxes above remain `[ ]` historically — the canonical state below is taken from STATE.md, not from the body checkboxes (the latter will be flipped by `/gsd-complete-milestone` in the next step).

| REQ-ID | Phase | Status | Date |
| --- | --- | --- | --- |
| REQ-01 | Phase 1 | Complete | 2026-06-10 |
| REQ-02 | Phase 1 | Complete | 2026-06-10 |
| REQ-03 | Phase 1 | Complete | 2026-06-10 |
| REQ-04 | Phase 1 | Complete | 2026-06-10 |
| REQ-05 | Phase 2 | Complete | 2026-06-11 |
| REQ-06 | Phase 1 | Complete | 2026-06-10 |
| REQ-07 | Phase 4 | Complete | 2026-06-13 |
| DECOUPLE-01 | Phase 5 | Complete | 2026-06-15 |
| DECOUPLE-02 | Phase 5 | Complete | 2026-06-15 |
| DECOUPLE-03 | Phase 5 | Complete | 2026-06-15 |
| DECOUPLE-04 | Phase 5 | Complete | 2026-06-15 |
| DECOUPLE-05 | Phase 5 | Complete | 2026-06-15 |
| DECOUPLE-06 | Phase 5 | Complete | 2026-06-15 |
| DECOUPLE-07 | Phase 5 | Complete | 2026-06-15 |
| ENTRY-01 | Phase 5 | Complete | 2026-06-15 |
| ENTRY-02 | Phase 5 | Complete | 2026-06-15 |
| ENTRY-03 | Phase 5 | Complete | 2026-06-15 |
| ADAPTER-01 | Phase 6 | Complete | 2026-06-16 |
| ADAPTER-02 | Phase 6 | Complete | 2026-06-16 |
| ADAPTER-03 | Phase 6 | Complete | 2026-06-16 |
| TEST-01 | Phase 7 | Complete | 2026-06-17 |
| TEST-02 | Phase 7 | Complete | 2026-06-17 |
| TEST-03 | Phase 7 | Complete | 2026-06-17 |
| TEST-04 | Phase 7 | Complete | 2026-06-17 |
| TEST-05 | Phase 7 | Complete | 2026-06-17 |
| DOC-01 | Phase 7 | Complete | 2026-06-17 |
| DOC-02 | Phase 7 | Complete | 2026-06-17 |
| DOC-03 | Phase 7 | Complete | 2026-06-17 |
| UPSTREAM-01 | Phase 9 | Complete | 2026-06-22 |
| UPSTREAM-02 | Phase 9 | Complete | 2026-06-22 |
| UPSTREAM-03 | Phase 8 | Complete | 2026-06-18 |
| UPSTREAM-04 | Phase 8 | Complete | 2026-06-18 |
| UPSTREAM-05 | Phase 9 | Complete | 2026-06-22 |
