# <AGENT_ID> — Path A / B / C verification

Replace `<AGENT_ID>` with your adapter's `AgentId` from `interfaces/agent-paths.ts`
and `<DISPLAY_NAME>` with the adapter's `displayName` from `interfaces/agent-api.ts`.

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
- Env vars that activate this adapter: `process.env.<YOUR_AGENT_ENV_VAR>` (also list any `envHints` from `AGENT_ADAPTERS` descriptor)
- Companion methods (if any): `attachChannel` / `detachChannel` are preferred for bidirectional communication; legacy adapter-specific methods (`attachQuery`, `attachSendMessage`) remain for backward compatibility
- Active capabilities (from AGENT_ADAPTERS descriptor): `ui` / `sampling` / `renderer` — note which are true vs false

## Host environments for <AGENT_ID>

This section captures the **Host × Target** matrix (D-16). For each
known host agent, document whether the integration can run **in-process**,
needs to **spawn** a child process, or is **incompatible** with this target.

Fill in the rows that apply. Add new rows as new host agents are supported.

| Host agent | In-process | Spawn | Notes |
|------------|------------|-------|-------|
| Qoder      | ✅         | ✅    | host=Qoder + target=this-id → SDK bridge mode; `<host-specific notes>` |
| Pi         | ✅         | ✅    | host=Pi + target=this-id → native extension mode; `<host-specific notes>` |
| Kilo       | ✅         | ✅    | host=Kilo + target=this-id → MCP server mode; `<host-specific notes>` |
| Claude     | ✅         | ⚠️    | host=Claude has no MCP; in-process only; spawn not yet implemented |
| `<other>`  | ?          | ?     | (extend as new host agents are added) |

**Spawn command template** (per target, fill in):

```bash
# Spawn <AGENT_ID> as a subprocess for SDK_DIRECT validation
<command-to-spawn-target-binary> --mcp-adapter-test-mode
```

**Host-closure validation** (D-16 follow-up): when the user specifies
both a non-default host AND a non-default target, run the spawn variant
even if the in-process variant also passes — this confirms the host can
actually drive the target end-to-end. If the spawn variant fails, surface
the failure to the user before marking Step 5 green.
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