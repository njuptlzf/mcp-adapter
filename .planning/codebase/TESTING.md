# Testing Patterns

**Analysis Date:** 2026-06-26

## Test Framework

**Runner:**
- Vitest v3.0+ (locked to `^3.0.0`)
- Config: `vitest.config.ts`
- Coverage provider: `@vitest/coverage-v8` v3.2.6
- TypeScript support: via `tsx` (dev dependency, used for `test:oauth-provider`)

**Configuration Highlights (`vitest.config.ts`):**
```typescript
export default defineConfig({
  test: {
    globals: true,          // vi, describe, it, expect available globally
    environment: "node",
    include: ["__tests__/**/*.test.ts", "tests/**/*.test.ts"],
    reporters: ["default", "./tests/reporters/matrix-reporter.ts"],
    coverage: {
      provider: "v8",
      include: ["*.ts", "interfaces/**/*.ts", "adapters/**/*.ts"],
      reporter: ["text", "html", "json"],
      // Per-file thresholds for critical modules (see §Coverage below)
    },
  },
});
```

**Assertion Library:**
- Vitest's built-in `expect` API (Jest-compatible)

**Run Commands:**
```bash
npm test                     # Run all tests (includes prebuild step)
npm run test:watch           # Watch mode
npm run test:coverage        # Run with coverage
npm run test:prebuild        # Build interactive-visualizer before tests
npm run test:oauth-provider  # OAuth provider test (separate runner via tsx)
```

## Test File Organization

**Location:**
- `__tests__/` — Unit tests and integration tests (~51 test files)
- `tests/` — E2E smoke tests, compatibility tests, token benchmarks, test infrastructure
  - `tests/smoke/` — Smoke/E2E tests (3 files: `calculator-smoke.test.ts`, `e2e-all-servers.test.ts`, `e2e-direct-tools.test.ts`)
  - `tests/compatibility/` — Interop compatibility tests (`non-pi-agent.test.ts`)
  - `tests/token-benchmark/` — Static token efficiency benchmarks (10 files including runners and reporters)
  - `tests/reporters/` — Custom vitest reporter (`matrix-reporter.ts`)
  - `tests/fixtures/` — Shared fixtures (`mock-agent.ts`)
  - `tests/demo-servers/` — 10 demo MCP servers for E2E testing
  - `tests/agent-scenarios/` — Agent scenario definitions

**Naming:**
- Test files: `[feature].test.ts` (e.g., `config.test.ts`, `ui-server.test.ts`, `qoder-adapter.test.ts`)
- Smoke tests: `[scope]-smoke.test.ts` or `e2e-[scope].test.ts`
- Integration tests: `[feature]-integration.test.ts` (e.g., `qoder-adapter-integration.test.ts`)
- Fixtures: `mock-[thing].ts` (e.g., `mock-agent-api.ts`, `mock-agent.ts`)
- A few test files at root level: `mcp-auth-flow.test.ts`, `mcp-auth.test.ts`, `mcp-callback-server.test.ts`, `mcp-oauth-provider.test.ts`

**Root-level test files** (outside `__tests__/`):
- `mcp-auth-flow.test.ts` — Auth flow tests
- `mcp-auth.test.ts` — Auth tests
- `mcp-callback-server.test.ts` — Callback server tests
- `mcp-oauth-provider.test.ts` — OAuth provider tests (has separate npm script)

## Test Structure

**Standard Suite Organization:**
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("FeatureName", () => {
  beforeEach(() => {
    // Reset state per test
  });

  afterEach(() => {
    // Cleanup
  });

  it("describes the expected behavior", () => {
    // Arrange
    const mock = makeMock();

    // Act
    const result = functionUnderTest(mock);

    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

**Setup/Teardown Patterns:**
- `beforeEach`/`afterEach` for per-test isolation (most common)
- `beforeAll`/`afterAll` for expensive shared setup (e.g., loading config once in `qoder-adapter-integration.test.ts`)
- Environment variable preservation pattern:
  ```typescript
  const originalDirectTools = process.env.MCP_DIRECT_TOOLS;
  beforeEach(() => { delete process.env.MCP_DIRECT_TOOLS; });
  afterEach(() => {
    if (originalDirectTools === undefined) delete process.env.MCP_DIRECT_TOOLS;
    else process.env.MCP_DIRECT_TOOLS = originalDirectTools;
  });
  ```

**Factory Functions for Test Data:**
- `createState()` — constructs mock `McpExtensionState` objects
- `createPi()` — constructs mock Pi API handlers
- `createAgentApi()` — constructs mock `AgentAPI` with `_handlers` map for introspection
- `createMockManager()` — mock `McpServerManager`
- `createMockConsentManager()` — mock `ConsentManager`
- `createMockResource()` — mock `UiResourceContent`
- `createServerOptions()` — composite for UI server tests
- `createDeferred<T>()` — deferred promise for testing async race conditions
- `makePiMock()` — mock `ExtensionAPI` with `vi.fn()` methods
- `makeFakeChild()` — mock `ChildProcess` with EventEmitter

## Mocking

**Framework:**
- Vitest's built-in mocking: `vi.fn()`, `vi.mock()`, `vi.spyOn()`, `vi.hoisted()`

**Module-level mocking pattern (`vi.mock` + `vi.hoisted`):**
```typescript
// Define mocks at module scope via vi.hoisted() so they can be referenced
// inside vi.mock() factory functions (which are hoisted by vitest).
const mocks = vi.hoisted(() => ({
  initializeMcp: vi.fn(),
  updateStatusBar: vi.fn(),
  flushMetadataCache: vi.fn(),
  initializeOAuth: vi.fn().mockResolvedValue(undefined),
  shutdownOAuth: vi.fn().mockResolvedValue(undefined),
  loadMcpConfig: vi.fn(() => ({ mcpServers: {} })),
  loadMetadataCache: vi.fn(() => null),
  // ... more mocked functions
}));

vi.mock("../init.ts", () => ({
  initializeMcp: mocks.initializeMcp,
  updateStatusBar: mocks.updateStatusBar,
  flushMetadataCache: mocks.flushMetadataCache,
}));

vi.mock("../mcp-auth-flow.ts", () => ({
  initializeOAuth: mocks.initializeOAuth,
  shutdownOAuth: mocks.shutdownOAuth,
}));
```

**Reset pattern in beforeEach:**
```typescript
beforeEach(() => {
  vi.resetModules();
  for (const value of Object.values(mocks)) {
    if (typeof value === "function" && "mockReset" in value) {
      value.mockReset();
    }
  }
  // Re-apply default mock implementations
  mocks.initializeOAuth.mockResolvedValue(undefined);
  mocks.shutdownOAuth.mockResolvedValue(undefined);
  mocks.loadMcpConfig.mockReturnValue({ mcpServers: {} });
  // ...
});
```

**Console spy pattern:**
```typescript
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy.mockRestore();
});
// Assertion:
expect(consoleErrorSpy).not.toHaveBeenCalled();
```

**In-Memory Mock Implementations:**
- `MockAgentAPI` in `__tests__/fixtures/mock-agent-api.ts` — full `AgentAPI` implementation with Map-based storage
- `MockAgentAPI` / `MockAgentContext` / `MockUISystem` in `__tests__/mock-adapter.test.ts` — contract verification mocks
- Both implementations follow the same storage pattern as `QoderAdapter` (Map-based tools, commands, flags, handlers)

**What to Mock:**
- All external dependencies (filesystem via `node:fs`, child processes via `node:child_process`, network via `http`)
- Agent runtime APIs (`ExtensionAPI`, `@qoder-ai/qoder-agent-sdk`)
- Internal dependencies when testing a module in isolation (e.g., `init.ts`, `commands.ts`, `proxy-modes.ts` are all mocked in `entry.test.ts`)

**What NOT to Mock:**
- The module under test itself
- The `AgentAPI` contract interfaces (tested against real adapter instances or `MockAgentAPI`)
- Config loading when testing config behavior (uses real `loadMcpConfig` with temp directories)

**Special Mock Patterns:**
- Dynamic import mocking for `node:child_process`:
  ```typescript
  vi.mock("node:child_process", async (importOriginal) => {
    const actual = (await importOriginal()) as typeof import("node:child_process");
    return { ...actual, spawn: vi.fn() };
  });
  ```
- Path override mocking:
  ```typescript
  vi.mock("../adapters/pi-renderer.ts", () => ({
    piRenderWrapper: vi.fn((fn) => (...args: unknown[]) => `Text(${fn(...args)})`),
  }));
  ```

## Fixtures and Factories

**Shared Fixtures (`__tests__/fixtures/`):**
- `mock-agent-api.ts` — `MockAgentAPI` class implementing `AgentAPI` with full 8-method surface
  - Used by `adapter-contract.test.ts` (server-compat cases) and `capability-gate.test.ts`

**E2E Demo Servers (`tests/demo-servers/`):**
- 10 standalone MCP servers each with 5-8 tools:
  - `calculator` — arithmetic operations
  - `string-utils` — string manipulation
  - `datetime` — date/time calculations
  - `unit-converter` — unit conversions
  - `json-tools` — JSON processing
  - `markdown` — markdown rendering
  - `file-stats` — file statistics
  - `http-mock` — HTTP mocking
  - `kv-store` — key-value storage
  - `text-analyzer` — text analysis
- Each includes `server.ts` + `server-spec.json`

**Test Configuration:**
- `.mcp.json` at project root defines all 10 demo servers for E2E tests
- Generated by tests, gitignore'd (only root-level)

**Helper for HTTP testing (`ui-server.test.ts`):**
```typescript
async function request(url: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<{ status: number; body: unknown; headers: http.IncomingHttpHeaders }>
function connectSSE(url: string, onEvent: (name: string, data: unknown, eventId?: string) => void, headers?: Record<string, string>): Promise<{ close: () => void }>
```

## Coverage

**Provider:** v8 (via `@vitest/coverage-v8`)

**Included paths:** `*.ts`, `interfaces/**/*.ts`, `adapters/**/*.ts`

**Excluded files:** `__tests__/**`, `vitest.config.ts`, `cli.js`, `app-bridge.bundle.js`, `host-html-template.ts`, `glimpse-ui.ts`, `interfaces/agent-api.ts`

**Per-file thresholds (all set to 80% lines/functions/branches/statements):**
| File | Threshold |
|------|-----------|
| `interfaces/agent-paths.ts` | 80% |
| `adapters/pi-adapter.ts` | 80% |
| `interfaces/sampling.ts` | 80% |
| `adapters/pi-sampling-provider.ts` | 80% |
| `adapters/pi-renderer.ts` | 80% |
| `adapters/entry.ts` | 80% |
| `adapters/qoder-adapter.ts` | 80% |
| `adapters/qoder-sampling-provider.ts` | 80% |
| `adapters/qoder-renderer.ts` | 60% (thin pass-through placeholder) |
| `scripts/qoder-smoke.ts` | 60% (manual CLI, not exercised by vitest) |

**Report formats:** text (terminal), html (`coverage/`), json (`coverage/coverage-final.json`)

**View Coverage:**
```bash
npm run test:coverage
# Output in coverage/index.html and coverage/coverage-final.json
```

## Test Types

**Unit Tests (`__tests__/`):**
- Test individual modules in isolation with heavy mocking
- Examples: `pi-adapter.test.ts`, `config.test.ts`, `sampling-handler.test.ts`, `logger.test.ts`, `errors.test.ts`
- Pattern: mock all dependencies, test one module
- Key scope areas: adapter contract, auth flows, proxy modes, direct tools, OAuth, UI, CLI, config, sampling, Qoder integration

**Adapter Contract Tests (`__tests__/adapter-contract.test.ts`):**
- Parametric: `describe.each(AGENT_ADAPTERS.map(...))` runs same 6 tests against all registered adapters
- Verifies all 8 `AgentAPI` methods exist and work across all adapters
- Server-compatibility tests use `MockAgentAPI` (agent-agnostic)
- Adding a new adapter to `AGENT_ADAPTERS` = zero test edits needed

**Capability Gate Test (`__tests__/capability-gate.test.ts`):**
- Runs FIRST — detects which adapter path is active (A/B/C)
- Path A: `"mcp"` in tool list → proxy tool registered
- Path B: any `^server_` prefix → directTools mode
- Path C: neither → mcp-adapter not loaded as extension
- Iterates over `AGENT_ADAPTERS` parametric framework

**Integration Tests:**
- `__tests__/qoder-adapter-integration.test.ts` — End-to-end through `createMcpAdapter` with `QoderAdapter`
  - Connects to real demo MCP servers (calculator)
  - Full 10-server smoke gated behind `QODER_INTEGRATION=1`
- `__tests__/agent-paths-integration.test.ts` — Path resolver integration
- `__tests__/integration.test.ts` — General integration
- `tests/compatibility/non-pi-agent.test.ts` — 40 test cases across 10 demo servers

**Smoke / E2E Tests (`tests/smoke/`):**
- `calculator-smoke.test.ts` — Lightweight calculator server smoke
- `e2e-all-servers.test.ts` — All 10 demo servers
- `e2e-direct-tools.test.ts` — Direct tools mode validation

**Token Benchmark Tests (`tests/token-benchmark/`):**
- Static analysis using `tiktoken` — no runtime execution
- `run-baseline.ts` — Measures direct tool exposure token count
- `run-adapter.ts` — Measures MCP proxy tool efficiency
- `report.ts` — Generates formatted benchmark report
- Reports show ~94% token savings

**Prebuild Test (`__tests__/interactive-visualizer-server.test.ts`):**
- Requires prebuilt assets from `examples/interactive-visualizer/`
- Auto-built via `npm run test:prebuild` (chained in `npm test`)

## Common Patterns

**Async Testing:**
```typescript
// Awaiting async operations
await adapter.fireSessionStart(ctx);
await Promise.resolve();  // Let microtasks flush
await Promise.resolve();

// Deferred pattern for testing race conditions
const first = createDeferred<any>();
const second = createDeferred<any>();
mocks.initializeMcp.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
// Trigger two rapid session starts...
second.resolve(activeState);  // Resolve latest first
await Promise.resolve(); await Promise.resolve();
expect(mocks.updateStatusBar).toHaveBeenCalledWith(activeState);
first.resolve(staleState);  // Stale init resolves later
await Promise.resolve(); await Promise.resolve();
expect(mocks.updateStatusBar).not.toHaveBeenCalledWith(staleState);
expect(staleState.lifecycle.gracefulShutdown).toHaveBeenCalledTimes(1);
```

**Error Testing:**
```typescript
// Expect rejection with specific message
await expect(adapter.exec("nope", [])).rejects.toThrow("spawn failed");

// Expect rejection with error code check
await expect(handleSamplingRequest(opts, req)).rejects.toThrow("MCP sampling requires interactive approval");

// Verify nothing else was called after error
expect(mockProvider.complete).not.toHaveBeenCalled();
```

**Poll-Based Verification (for async lifecycle tests):**
```typescript
async function waitForConnection(adapter: QoderAdapter, serverName: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (adapter.tools.has("mcp")) {
      await new Promise((r) => setTimeout(r, 500));  // Let init settle
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for ${serverName} connection`);
}
```

**Test Isolation:**
- `vi.resetModules()` in `beforeEach` to clear module cache (used in tests that dynamically import the module under test)
- Fresh adapter instance per test: `adapter = new QoderAdapter()` or `adapter = factory()`
- Environment variable save/restore in `beforeEach`/`afterEach`

**Opt-in Heavy Tests:**
```typescript
const describeFull = process.env.QODER_INTEGRATION === "1" ? describe : describe.skip;
describeFull("Full 10-server smoke (QODER_INTEGRATION=1 only)", () => { ... });
```

**Test Introspection Helpers:**
- Adapters expose test-only getters: `getBufferedMessages()`, `getQueryRef()`
- Mock adapters expose `_handlers` map for accessing registered event handlers
- `mock.calls[0][0]` for inspecting first call's first argument

## Custom Reporter

**Matrix Reporter (`tests/reporters/matrix-reporter.ts`):**
- Custom vitest reporter that writes agent × section matrix reports
- Outputs:
  - `tests/reports/mcp-adapter-test-report.md` (human-readable Markdown)
  - `tests/reports/mcp-adapter-test-report.json` (CI/dashboard sidecar)
- Classifies tests by agent (from `fullName` pattern `"adapter: <id>"`) and section (from file path patterns)
- Section classification hierarchy: Gate → Section4-contract → Section4 → Prebuild → Section6-proxy → Section6-directTools → Section6-E2E → Section6-QoderIntegration → Section5 (token-benchmark) → Section6-auth → Section6-ui → Section6-sampling → Section6-adapter → Section6-mock → Section6-host → Other
- B1 unclassified drift visibility: lists unmatched files in report footer

## Prebuild Mechanism

**Global Setup (`tests/global-setup.ts`):**
- Runs ONCE before test workers start
- Checks if `examples/interactive-visualizer/dist/` exists
- If missing, runs `npm run build` in that subdir
- **Known vitest 3.2.6 SSR race condition**: `globalSetup` was REMOVED from vitest.config.ts — workaround is `test:prebuild` npm script chained into `npm test`

**Test Runner Note:**
- `npm test` always works (prebuild chained)
- `npx vitest run` directly may fail for visualizer test without manual prebuild

## Adding New Tests

1. **Unit tests:** Create `__tests__/[feature].test.ts` following existing mock patterns
2. **Adapter tests:** Add to `AGENT_ADAPTERS` in `interfaces/agent-api.ts` — parametric contract tests auto-expand
3. **Integration tests:** Add to `__tests__/` with `-integration` suffix
4. **E2E/smoke tests:** Add to `tests/smoke/`
5. **Compatibility tests:** Add to `tests/compatibility/`
6. **Follow mock patterns:** Use `vi.hoisted()` for module mocks, `createDeferred()` for async races
7. **Ensure determinism:** No reliance on external state, save/restore env vars

---

*Testing analysis: 2026-06-26*
