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