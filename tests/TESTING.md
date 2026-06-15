# mcp-adapter Test Infrastructure

## Philosophy
"100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower."

## Test Framework
- **Primary**: Vitest v3.2.6
- **TypeScript**: tsx for ES module support
- **Token Benchmark**: Tiktoken for static token counting

## How to Run Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm test -- tests/compatibility/          # Adaptability tests
npm test -- tests/token-benchmark/        # Token benchmarks
npm test -- __tests__/                    # Original unit tests

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Test Layers

### Unit Tests
- **Location**: `__tests__/` directory
- **Purpose**: Test individual functions and classes in isolation
- **Examples**: MockAgentAPI tests, utility functions, type definitions
- **Conventions**: 
  - File named `[feature].test.ts`
  - Uses `describe`/`it` blocks from Vitest
  - Mocks external dependencies

### Integration Tests
- **Location**: `tests/compatibility/` directory
- **Purpose**: Test interactions between components (mcp-adapter + demo servers)
- **Examples**: Adaptability test suite verifying all 10 demo servers work with mcp-adapter
- **Conventions**:
  - Tests real-like interactions (though servers are mocked in unit tests)
  - Focuses on contracts and interfaces

### Smoke Tests (E2E-inspired)
- **Location**: `tests/agent-scenarios/AGENTS.md`
- **Purpose**: Validate core functionality works end-to-end
- **Examples**: 
  - `mcp-compat-tester`: Runs all adaptability tests
  - `token-benchmark-runner`: Executes token efficiency benchmark
  - `e2e-smoke-tester`: Conceptual end-to-end validation

### Token Benchmark Tests
- **Location**: `tests/token-benchmark/` directory
- **Purpose**: Measure token efficiency of mcp-adapter proxy tool
- **Examples**:
  - Baseline: Direct exposure of all MCP tools
  - Adapter: Single mcp proxy tool replacing all tools
  - Report: Shows token savings percentage
- **Conventions**:
  - Static analysis (no runtime execution)
  - Uses tiktoken for consistent measurement
  - Reports both token counts and byte sizes

## Test Conventions

### File Naming
- Test files: `[feature].test.ts`
- Test utilities: `[utility].ts` (no test suffix)
- Snapshot tests: `[feature].snapshot.test.ts`

### Assertion Style
- Use Vitest's `expect` API
- Prefer specific matchers: `.toBe()`, `.toEqual()`, `.toMatch()`
- Avoid overly broad assertions like `.toBeDefined()` when more specific checks possible
- For error conditions: `.toThrow()` or `.toThrowError()`

### Setup/Teardown Patterns
- Use `beforeEach`/`afterEach` for per-test isolation
- Use `beforeAll`/`afterAll` for expensive shared setup
- Mock external services and dependencies
- Clean up mocks and spies after each test

### Mocking Guidelines
- Mock all external dependencies (network, filesystem, etc.)
- Use Vitest's `vi.fn()` for spy/mock functions
- Keep mocks simple and focused on the behavior being tested
- Prefer implementation mocks over behavioral mocks when possible

## Test Infrastructure Components

### 1. MockAgent (`tests/fixtures/mock-agent.ts`)
- Full implementation of AgentAPI interface for testing
- Simulates tool registration, command handling, event system
- Used in adaptability tests to verify mcp-adapter compatibility

### 2. Demo MCP Servers (`tests/demo-servers/*/`)
- 10 fully functional MCP servers implementing 5-8 tools each
- Each includes:
  - `server.ts`: Working MCP server implementation
  - `server-spec.json`: Static tool schema for token benchmarking
- Tools cover: calculations, string manipulation, datetime, unit conversion, JSON ops, markdown, file stats, HTTP mocking, KV storage, text analysis

### 3. Adaptability Test Suite (`tests/compatibility/non-pi-agent.test.ts`)
- 40 test cases (10 servers × 4 core tests)
- Tests mcp proxy tool registration, search, describe, and call execution
- Includes 8 additional AgentAPI contract tests
- All tests pass, verifying compatibility with various tool sets

### 4. Token Benchmark Infrastructure (`tests/token-benchmark/`)
- `token-counter.ts`: Tiktoken wrapper for consistent counting
- `run-baseline.ts`: Measures direct tool exposure (3,963 tokens total)
- `run-adapter.ts`: Measures mcp proxy tool efficiency (250 tokens)
- `report.ts`: Generates formatted benchmark report showing 94% savings

## Running Token Benchmarks
```bash
# Generate baseline (direct tool exposure)
npx ts-node tests/token-benchmark/run-baseline.ts

# Measure adapter efficiency  
npx ts-node tests/token-benchmark/run-adapter.ts

# Generate formatted report
npx ts-node tests/token-benchmark/report.ts
```

## Adding New Tests
1. Create test file in appropriate directory following naming conventions
2. For unit tests: Add to `__tests__/` 
3. For compatibility tests: Add to `tests/compatibility/`
4. For token benchmarks: Add to `tests/token-benchmark/`
5. Follow existing patterns for setup, assertions, and mocking
6. Ensure tests are deterministic and don't rely on external state

## CI Integration
The test infrastructure is designed to work with GitHub Actions:
- Compatibility tests run on Ubuntu latest with Node.js 20
- Token benchmarks run in the same environment
- Artifacts are uploaded for PR review
- See `.github/workflows/test.yml` for configuration

---

*This TESTING.md file documents the test infrastructure implemented to validate the mcp-adapter's core functionality and token efficiency claims.*