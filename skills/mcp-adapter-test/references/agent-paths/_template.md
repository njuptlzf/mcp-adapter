# <AGENT_ID> — Path A / B / C verification

Replace `<AGENT_ID>` with your adapter's `AgentId` from `interfaces/agent-paths.ts`.

Scaffold template — copy this file to `<your-id>.md`, fill in each section, and add it to the main `SKILL.md` parametric table.

## Path A: mcp proxy tool (<AGENT_ID>)

The `mcp` proxy tool is registered by `createMcpAdapter` against `<AGENT_ID>Adapter`. Verify by:

1. Inspect `<agent>Adapter.getAllTools()` — must include `mcp` (Path A signal)
2. `<agent>Adapter.tools.get("mcp")?.execute(...)` → returns tool result for each registered server
3. Run smoke calls for all 10 servers through the proxy (see `../smoke-calls.md`)

## Path B: directTools (<AGENT_ID>, when `directTools: true`)

1. Confirm individual tools appear in `<agent>Adapter.getAllTools()` with names matching `^<server>_`
2. Call individual tools via `<agent>Adapter.tools.get("<server>_<tool>")?.execute(...)`

## Path C: SDK_DIRECT fallback

See `tests/smoke/e2e-all-servers.test.ts` — covered by Phase 4 Step 4 of the main SKILL.md.

## <AGENT_ID>-specific notes

- Default config path: `<describe your adapter's default config path>`
- Optional UISystem surface: `notify` is required; `form`/`setStatus`/`theme` are optional
- Env vars that activate this adapter: `process.env.<YOUR_AGENT_ENV_VAR>`
- Companion methods (if any): `attachChannel` / `detachChannel` are preferred for bidirectional communication; legacy adapter-specific methods (`attachQuery`, `attachSendMessage`) remain for backward compatibility