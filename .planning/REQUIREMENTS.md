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