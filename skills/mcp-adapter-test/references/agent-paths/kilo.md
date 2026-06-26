# Kilo — Path A / B / C verification

> **Coverage disclaimer** (added after D-11 review):
> This file describes **two distinct verification levels** for Kilo.
>
> | Level | What it tests | How | Where |
> |-------|--------------|-----|-------|
> | **Adapter unit tests** | KiloAdapter class wiring: `createMcpAdapter` registration, `attachChannel`/`detachChannel` (legacy `attachSendMessage`/`detachSendMessage`), `fireSessionStart`, path resolver | `new KiloAdapter()` in-process, no Kilo binary required | `__tests__/adapter-contract.test.ts` (parametric) |
> | **Kilo runtime E2E** | Kilo process actually discovers + calls tools via mcp-adapter loaded as a Kilo extension | Requires running inside Kilo CLI / TUI; same env constraints as any Kilo session | Not automated in CI |
>
> Running `adapter-contract.test.ts` with factory `KiloAdapter` **does NOT prove "Kilo works end-to-end"** — it proves only that `KiloAdapter` is a structurally valid drop-in for `createMcpAdapter`. Real Kilo runtime validation requires the Kilo host to be running and is out of scope for this skill.

---

Kilo-specific verification commands for the mcp-adapter-test skill. This file is consumed by Step 1 of Phase 4 in the main `SKILL.md`. Read it **after** the Capability Gate (Phase 4 Step 0) has classified the runtime into Path A / B / C.

## Path A: mcp proxy tool (Kilo)

The `mcp` proxy tool is registered by `createMcpAdapter` against `KiloAdapter`. Verify by:

1. Inspect `kiloAdapter.getAllTools()` — must include `mcp` (Path A signal)
2. `kiloAdapter.tools.get("mcp")?.execute(...)` → returns tool result for each registered server
3. Run smoke calls for all 10 servers through the proxy (see `../smoke-calls.md`)
4. For live-Kilo runtime: `kiloAdapter.attachSendMessage(fn)` then `mcp({ tool: "...", args: ... })` — the proxy tool result flows back through the attached callback

## Path B: directTools (Kilo, when `directTools: true`)

1. Confirm individual tools appear in `kiloAdapter.getAllTools()` with names matching `^<server>_`
2. Call individual tools via `kiloAdapter.tools.get("calculator_add")?.execute(...)`
3. Verify tool naming follows the prefix mode (default = server prefix)

## Path C: SDK_DIRECT fallback

See `tests/smoke/e2e-all-servers.test.ts` — covered by Phase 4 Step 4 of the main SKILL.md.

## Kilo-specific notes

- Default config path: `~/.kilo/`
- Project config file: `.mcp.json`
- Env vars that activate this adapter: `MCP_AGENT_DIR` (overrides the default `~/.kilo/` global config path; supports `~`, `~/<rest>`, or absolute path — see `createKiloResolver()`)
- UISystem surface: `notify` is implemented (writes `[mcp-adapter/kilo] ...` to console); `setStatus` is a no-op; `theme.fg` returns the original text unchanged; `form` and `custom` are `undefined`
- Companion methods: `attachChannel(c)` / `detachChannel()` are preferred; legacy `attachSendMessage(fn)` / `detachSendMessage()` remain — distinct from Qoder's `attachQuery`/`detachQuery`; buffers messages when no channel is attached (max 32)
- Resolver factory: `createKiloResolver()` from `interfaces/agent-paths.ts`
