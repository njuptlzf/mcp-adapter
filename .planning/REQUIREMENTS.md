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

- [ ] **DECOUPLE-01**: Replace `AgentToolResult` imports in proxy-modes.ts, direct-tools.ts, tool-result-renderer.ts with generic types from interfaces/agent-api.ts
- [ ] **DECOUPLE-02**: Replace `ExtensionUIContext` imports in sampling-handler.ts, elicitation-handler.ts with generic `UISystem` from interfaces/agent-api.ts
- [ ] **DECOUPLE-03**: Replace `ExtensionContext` import in direct-tools.ts with generic `AgentContext`
- [ ] **DECOUPLE-04**: Replace `ToolInfo` import in proxy-modes.ts and index.ts with generic `ToolInfo` from interfaces/agent-api.ts
- [ ] **DECOUPLE-05**: Replace `Model`, `complete`, `AssistantMessage` etc. in sampling-handler.ts with agent-agnostic abstractions (or extract to Pi-specific sampling wrapper)
- [ ] **DECOUPLE-06**: Replace `@earendil-works/pi-tui` Text import in tool-result-renderer.ts with generic rendering interface
- [x] **DECOUPLE-07**: Replace `PI_CODING_AGENT_DIR` in agent-dir.ts with `AgentPathResolver` usage
- Priority: Must

### ENTRY: Entry Point Refactor

- [ ] **ENTRY-01**: Create agent-agnostic entry point accepting `AgentAPI` instead of `ExtensionAPI`
- [ ] **ENTRY-02**: Refactor existing `mcpAdapter(pi: ExtensionAPI)` in index.ts as Pi-specific wrapper around new entry point
- [ ] **ENTRY-03**: Maintain 100% backward compatibility — Pi users see zero behavior change
- Priority: Must

### ADAPTER: Second Agent Adapter

- [ ] **ADAPTER-01**: Implement at least one non-Pi `AgentAPI` adapter (e.g., QoderAdapter) in adapters/
- [ ] **ADAPTER-02**: Implement corresponding `AgentPathResolver` for the new agent
- [ ] **ADAPTER-03**: Integration test proving the new adapter works with initializeMcp()
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

- [ ] **UPSTREAM-01**: Create `UPSTREAM-CHANGES.md` manifest documenting all files diverged from upstream (https://github.com/nicobailon/pi-mcp-adapter), with per-file rationale (why changed, how to resolve conflicts)
- [ ] **UPSTREAM-02**: Create `skills/upstream-merge/SKILL.md` — an agent skill that reads UPSTREAM-CHANGES.md when upstream merge conflicts occur, and provides conflict resolution guidance (keep adapter change vs accept upstream vs manual merge)
- [ ] **UPSTREAM-03**: In the skill, define conflict resolution rules: (a) new files under adapters/, interfaces/, skills/ → always keep ours, (b) type-replacement changes in source files → prefer adapter pattern over Pi-specific imports, (c) upstream bugfixes to core MCP logic → accept if they don't re-introduce Pi coupling, (d) upstream features → assess per-case
- [ ] **UPSTREAM-04**: Minimize source file modifications during Phase 5-6 by preferring adapter/wrapper patterns over direct edits where possible
- Priority: Must