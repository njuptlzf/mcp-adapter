# Technology Stack

**Analysis Date:** 2026-06-26

## Languages

**Primary:**
- TypeScript 5.x - All source code (`*.ts` files throughout the project)
  - Target: ES2022 (per `tsconfig.json`)
  - Module system: NodeNext (ESM) with `"type": "module"` in `package.json`
  - Strict mode: disabled (`"strict": false`)

**No secondary languages detected.** The entire codebase is TypeScript/JavaScript.

## Runtime

**Environment:**
- Node.js (ESM modules; `"type": "module"` in `package.json`)
- Generated bundle: `app-bridge.bundle.js` (289KB, browser-side MCP SDK + Zod bundle for UI integration)

**Package Manager:**
- npm (no specific version pinned)
- Lockfile: `package-lock.json` present (194KB)

**Execution:**
- `tsx` (v4.21.0) used for direct TypeScript execution of bin scripts (`bin/kilo-mcp-server.ts`, `bin/qoder-mcp-bridge.ts`)
- CLI entry: `cli.js` (5.5KB) published as bin `pi-mcp-adapter`

## Frameworks

**Core:**
- No application framework. This is an adapter library/extension, not a standalone application.
- `@modelcontextprotocol/sdk` ^1.25.1 — MCP protocol client/server implementation (transport, auth, types)
- `@modelcontextprotocol/ext-apps` ^1.2.2 — MCP external applications extension (AppBridge bundling)

**Agent SDKs (adapter targets):**
- `@qoder-ai/qoder-agent-sdk` ^1.0.7 — Qoder coding agent SDK (used in `bin/qoder-mcp-bridge.ts`)
- `@earendil-works/pi-coding-agent` ^0.74.0 — Pi coding agent ExtensionAPI (peer + optional dependency)

**Schema / Validation:**
- `typebox` ^1.1.24 — Runtime type building (used for MCP proxy tool parameter schemas in `adapters/entry.ts`)
- `zod` ^3.25.0 || ^4.0.0 — Schema validation (peer + direct dependency)
- `recheck` ^4.5.0 — Regex safety analysis (ReDoS protection for user regex search queries in `proxy-modes.ts`)

**Utilities:**
- `open` ^10.2.0 — Cross-platform browser opener for OAuth flows (`mcp-auth-flow.ts`)

**Testing:**
- `vitest` ^3.0.0 — Test runner and assertion framework
- `@vitest/coverage-v8` ^3.2.6 — Code coverage (v8 provider)
- `tiktoken` ^1.0.22 — Token counting for test benchmarks

**Build/Dev:**
- `typescript` ^5.0.0 — TypeScript compiler
- `tsx` ^4.21.0 — TypeScript execution (used for scripts and bin entries)
- `@types/node` ^20.0.0 — Node.js type definitions
- `@types/bun` ^1.0.0 — Bun type definitions (for CI compatibility)

## Key Dependencies

**Critical (required for core function):**
| Package | Version | Why it matters |
|---------|---------|----------------|
| `@modelcontextprotocol/sdk` | ^1.25.1 | MCP protocol — Client, transports (stdio, SSE, StreamableHTTP), OAuth auth, tool/resource types |
| `typebox` | ^1.1.24 | Runtime-safe parameter schema construction for MCP proxy tool |
| `recheck` | ^4.5.0 | Prevents ReDoS attacks from user-supplied regex search queries |

**Agent Integration:**
| Package | Version | Why it matters |
|---------|---------|----------------|
| `@earendil-works/pi-coding-agent` | ^0.74.0 (peer, optional) | Pi agent ExtensionAPI — `PiAdapter` wraps this for tool/command/event registration |
| `@qoder-ai/qoder-agent-sdk` | ^1.0.7 | Qoder SDK — `createSdkMcpServer()` and `query()` used by `bin/qoder-mcp-bridge.ts` |

**Infrastructure:**
| Package | Version | Why it matters |
|---------|---------|----------------|
| `open` | ^10.2.0 | Opens OAuth authorization URLs in the user's browser |
| `zod` | ^3.25.0 | Schema validation (peer dependency, may be provided by host agent) |

**Self-referencing:**
- `pi-mcp-adapter` ^2.10.0 — The package references itself as a dependency (circular for extension discovery)

## Configuration

**TypeScript:**
- Config: `tsconfig.json`
- Target: ES2022, Module: NodeNext, ModuleResolution: NodeNext
- Key options: `allowImportingTsExtensions: true`, `esModuleInterop: true`, `strict: false`, `noEmit: true`
- Includes: `*.ts`, `interfaces/**/*.ts`, `adapters/**/*.ts`, `types/**/*.ts`

**Test:**
- Config: `vitest.config.ts`
- Environment: node, globals enabled
- Include patterns: `__tests__/**/*.test.ts`, `tests/**/*.test.ts`
- Coverage thresholds: 80% for key modules (`adapters/entry.ts`, `adapters/pi-adapter.ts`, `adapters/qoder-adapter.ts`, `interfaces/agent-paths.ts`, etc.)
- Custom reporter: `tests/reporters/matrix-reporter.ts` — generates per-adapter test matrix reports

**Package:**
- `package.json` — npm package with `"type": "module"`
- Published files: 39 files listed in `"files"` (source `.ts`, `cli.js`, `app-bridge.bundle.js`, `bin/`, `interfaces/`, `adapters/`)
- Bin entries: `pi-mcp-adapter` → `cli.js`, `kilo-mcp-server` → `bin/kilo-mcp-server.ts`, `qoder-mcp-bridge` → `bin/qoder-mcp-bridge.ts`

**Runtime Environment Variables:**
- `MCP_CONFIG_PATH` — Alternative config file path (used by `bin/kilo-mcp-server.ts`, `bin/qoder-mcp-bridge.ts`)
- `MCP_AGENT_DIR` — Override agent global config directory (Kilo, Qoder path resolvers)
- `MCP_DIRECT_TOOLS` — Comma-separated server:tool list or `__none__` to control direct tool registration
- `MCP_OAUTH_CALLBACK_PORT` — Override OAuth callback port (default: 19876)
- `MCP_UI_DEBUG` — Enable debug logging (`"1"` or `"true"`)
- `MCP_UI_VIEWER` — Force browser (`"browser"`) or Glimpse (`"glimpse"`) for MCP UI rendering
- `PI_CODING_AGENT_DIR` — Pi agent directory (Pi path resolver)
- `BROWSER` — Custom browser command for OAuth URL opening

## Platform Requirements

**Development:**
- Node.js (runtime)
- npm (package management)
- TypeScript 5.x compiler (or `tsx` for direct execution)
- Git (repository operations)

**Production / Deployment:**
- Target: npm package `pi-mcp-adapter` published to npm registry
- Deployment verification: `scripts/deploy-verify.ts` (exercises universal deployment flow)
- macOS-specific: Glimpse integration for native window MCP UI rendering (`glimpse-ui.ts`); browser fallback for all other platforms
- Token storage: `~/.pi/agent/mcp-oauth/` (or agent-specific OAuth directories) with `0o600`/`0o700` file permissions

---

*Stack analysis: 2026-06-26*
