# Pi — Path A / B / C verification

Pi-specific verification commands for the mcp-adapter-test skill. This file is consumed by Step 1 of Phase 4 in the main `SKILL.md`. Read it **after** the Capability Gate (Phase 4 Step 0) has classified the runtime into Path A / B / C.

## Path A: mcp proxy tool (Pi)

The `mcp` proxy tool is registered by `createMcpAdapter`. Verify by:

1. `mcp({})` → status shows all 10 configured servers
2. `mcp({ search: "keyword" })` → returns matching tool descriptions
3. `mcp({ describe: "tool_name" })` → returns parameter schemas
4. `mcp({ tool: "tool_name", args: '{"key":"value"}' })` → returns correct result
5. Run smoke calls for all 10 servers through the proxy (see `../smoke-calls.md`)

## Path B: directTools (Pi, when `directTools: true`)

1. Confirm individual tools appear: `calculator_add`, `calculator_subtract`, …
2. Call `calculator_add({a: 10, b: 20})` directly
3. Verify tool naming follows the prefix mode (default = server prefix)

## Path C: SDK_DIRECT fallback

See `tests/smoke/e2e-all-servers.test.ts` — covered by Phase 4 Step 4 of the main SKILL.md.

## Pi-specific cleanup

- `~/.pi/agent/mcp.json` is Pi's per-host override file
- `MCP_AGENT_DIR` env var redirects the path resolver
- `PI_CODING_AGENT_DIR` is the legacy Pi-only env var (still honored as fallback)