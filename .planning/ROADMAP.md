# Roadmap

## Phases

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

**Requirements:** TEST-01 through TEST-05, DOC-01 through DOC-03

**Deliverables:**

- Updated `skills/mcp-adapter-test/SKILL.md`
- New/updated test infrastructure for generic AgentAPI mocking
- Per-adapter contract test framework
- Revised `README.md` with compatibility/verification section

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

**Plans:** — (to be planned with `/gsd-plan-phase 8`)
