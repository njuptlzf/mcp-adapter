# Phase 1: Universal Interfaces - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Define generic AgentAPI and UISystem interfaces with PiAdapter implementation. This phase establishes the abstraction layer without modifying core MCP logic.
</domain>

<decisions>
## Implementation Decisions

### AgentAPI Interface Design
- **D-01:** `sendMessage` uses `unknown` parameter type for maximum flexibility across agents
- **D-02:** `exec` returns `Promise<unknown>` - simple type union causes type assertion issues across agents
- **D-03:** All core methods required (no optional agent methods) - enforce minimum API contract

### UISystem Interface Design
- **D-04:** `notify` method required - all agents should support notification
- **D-05:** `setStatus`, `form`, `custom` optional - not all agents have full UI capabilities
- **D-06:** `theme.fg` optional method - may not exist in other agents

### Pi Adapter Strategy
- **D-07:** PiAdapter implements AgentAPI with direct pass-through to ExtensionAPI
- **D-08:** `adaptPiContext` function converts ExtensionContext to AgentContext

### Dependency Management
- **D-09:** `@earendil-works/pi-coding-agent` → optional peerDependency (user installs if needed)
- **D-10:** `@earendil-works/pi-ai`, `@earendil-works/pi-tui` → optionalDependencies
- **D-11:** Core MCP SDK and utilities remain as regular dependencies

### Sampling/Elicitation Handling
- **D-12:** Keep in core layer via `server-manager.ts` - these are MCP protocol extensions
- **D-13:** Abstract through interfaces - SamplingConfig/ElicitationConfig use generic types
- **D-14:** Pi provides concrete implementation via adapter functions

### Backward Compatibility
- **D-15:** Export existing `mcpAdapter` unchanged - zero code change for existing Pi users
- **D-16:** `createMcpAdapter` not exported yet - avoid incomplete implementation confusion
- **D-17:** All existing imports and types preserved in core files
</decisions>

<canonical_refs>
## Canonical References

### Interface Design
- `docs/refactor.md` — Complete refactoring plan with code examples
- `index.ts` — Current ExtensionAPI usage patterns
- `init.ts` — ExtensionContext and UI configuration patterns
- `elicitation-handler.ts` — Form handling requirements

### Pi-Specific APIs
- `init.ts:72` — `pi.sendMessage` usage
- `init.ts:284-288` — `ui.theme.fg` usage for status bar
- `elicitation-handler.ts:112-125` — `ui.form` for elicitation
- `sampling-handler.ts:1-8` — AI API integration patterns
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None - this is greenfield interface design

### Established Patterns
- Pi agent uses async/await heavily for all operations
- Configuration loaded from homedir `.pi/agent/mcp.json` or cwd `.mcp.json`
- UI methods always guarded by `ctx.hasUI` check

### Integration Points
- `index.ts` - Main entry point, uses all 8 Pi APIs
- `init.ts` - Initialization, uses ExtensionAPI and ExtensionContext
- `commands.ts` - Command handlers, uses ctx.ui.notify/setStatus
- `utils.ts` - Tool execution wrapper
- `sampling-handler.ts` - AI integration
- `elicitation-handler.ts` - Form handling
</code_context>

<specifics>
## Specific Ideas

- Adapter pattern keeps core logic unchanged, minimizes risk
- MAPPING.md serves as living documentation for future adapter implementations
- Type assertions in adapter (`as unknown as never`) handle Pi API quirks
</specifics>

<deferred>
## Deferred Ideas

- Claude/Cursor adapter implementations - Phase 2+
- Full generic mcpAdapter implementation - pending interface validation
- CLI mode handling - separate concern from agent integration
</deferred>

---

*Phase: 01-universal-adapter*
*Context gathered: 2026-06-10*