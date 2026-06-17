# Qoder — Path A / B / C verification

Qoder-specific verification commands for the mcp-adapter-test skill. This file is consumed by Step 1 of Phase 4 in the main `SKILL.md`. Read it **after** the Capability Gate (Phase 4 Step 0) has classified the runtime into Path A / B / C.

## Path A: mcp proxy tool (Qoder)

The `mcp` proxy tool is registered by `createMcpAdapter` against `QoderAdapter`. Verify by:

1. Inspect `qoderAdapter.getAllTools()` — must include `mcp` (Path A signal)
2. `qoderAdapter.tools.get("mcp")?.execute(...)` → returns tool result for each registered server
3. Run smoke calls for all 10 servers through the proxy (see `../smoke-calls.md`)
4. For live-Qoder runtime: `qoderAdapter.attachQuery(query)` then `mcp({ tool: "...", args: ... })`

## Path B: directTools (Qoder, when `directTools: true`)

1. Confirm individual tools appear in `qoderAdapter.getAllTools()` with names matching `^<server>_`
2. Call individual tools via `qoderAdapter.tools.get("calculator_add")?.execute(...)`
3. Verify tool naming follows the prefix mode (default = server prefix)

## Path C: SDK_DIRECT fallback

See `tests/smoke/e2e-all-servers.test.ts` — covered by Phase 4 Step 4 of the main SKILL.md.
Qoder lacks `theme.fg`; renderer-based assertions are skipped.

## Qoder-specific notes

- Qoder lacks `UISystem.form` / `setStatus` / `theme`; only `notify` is exposed (per D-07)
- `QoderAdapter.attachQuery(q)` / `detachQuery()` are companion methods for live testing
- `MCP_AGENT_DIR` env var redirects the path resolver
- Default config path: `~/.qoder/agent/mcp.json`