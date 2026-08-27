# Universal Host Shim — ExtensionAPI Mapping

This file documents how the fork-owned universal MCP-stdio host
(`adapters/universal-host.ts`) satisfies the upstream Pi `ExtensionAPI`
surface, so the upstream engine (`index.ts` `installMcpAdapter`) runs
unchanged against a non-Pi host.

> Direction (Phase 1): **fork the host, not the engine.** The retired
> `AgentAPI` abstraction (`interfaces/agent-api.ts` / `adapters/pi-adapter.ts`)
> is gone. The sole adapter surface is now `UniversalMcpHost`, which
> impersonates `ExtensionAPI` directly; `bin/mcp-server.ts` casts to
> `ExtensionAPI` at the boundary. The shared fork-owned types live in
> `interfaces/host-types.ts`.

This is the source of truth for verifying the host surface. When the
upstream Pi ecosystem changes its public surface, update both the host
and the corresponding row below.

---

## UniversalHostSurface → ExtensionAPI

| Host member (host-types.ts / universal-host.ts) | Satisfies | Upstream call sites (evidence) | Notes |
| --- | --- | --- | --- |
| `registerTool` | `pi.registerTool` | `index.ts` registerDirectTool / registerMcpScript / registerProxyTool | Renderer boundary keeps 3 `as (tool: unknown)` casts — fork `RenderTheme` ≠ pi-* `Theme`. |
| `registerCommand` | `pi.registerCommand` | `index.ts` `mcp` / `mcp-auth` / `pi-mcp` | Direct pass-through; no-op surface on MCP stdio. |
| `registerFlag` | `pi.registerFlag` | `index.ts` / `init.ts` | Direct pass-through. |
| `on` | `pi.on` | `index.ts` `session_start` / `tool_result` / `input` | Event-name generics erased. |
| `events` | `pi.events` (`McpStatusEventBus`) | `index.ts` `publishMcpStatusShutdown` | `UniversalStatusEventBus` = `EventEmitter` subset (`emit` / `on` / `removeAllListeners`). |
| `getAllTools` | `pi.getAllTools` | `index.ts` | `ToolInfo[]`. |
| `setActiveTools` | `pi.setActiveTools` | `index.ts` `syncProxyTool` / `syncNamespaceTools` | Drives MCP `ListTools` filtering. |
| `getActiveTools` | `pi.getActiveTools` | `index.ts` | — |
| `unregisterTool` | `pi.unregisterTool` | `index.ts` dynamic proxy/direct removal | Returns `boolean`. |
| `getFlag` | `pi.getFlag` | `init.ts` | `string \| undefined`. |
| `sendMessage` | `pi.sendMessage` | `init.ts` | Both `message` / `options` are `unknown`. |
| `exec` | `pi.exec` | `utils.ts` | `Promise<unknown>`. |

## UISystem / Form → ExtensionUIContext

| Host member (host-types.ts) | Pi member | Call site | Optional? |
| --- | --- | --- | --- |
| `UISystem.notify` | `ctx.ui.notify` | `commands.ts`, `init.ts` | Required. |
| `UISystem.setStatus` | `ctx.ui.setStatus` | `init.ts` | Optional. |
| `UISystem.form` | `ctx.ui.form` → `elicitation-handler.ts` | `bin/mcp-server.ts` → `protocol-elicitation-forwarder.ts` | Optional. |
| `UISystem.custom` | `ctx.ui.custom` | (reserved, no current use) | Optional. |
| `UISystem.theme.fg` | `ctx.ui.theme.fg` | `init.ts` | Optional. |
| `FormConfig` / `FormResult` | `ExtensionUIFormRequest` / `ExtensionUIFormResult` | `elicitation-handler.ts` | — |

## Type Mappings

| Fork-owned type (`interfaces/host-types.ts`) | Pi type | Source |
| --- | --- | --- |
| `UniversalHostSurface` | `ExtensionAPI` | boundary cast in `bin/mcp-server.ts` |
| `ToolInfo` | `getAllTools` element | `index.ts` |
| `ToolRegistration` | `ToolDefinition` | `index.ts` registerTool |
| `CommandConfig` | `RegisteredCommand` | `index.ts` registerCommand |
| `FlagConfig` | `ExtensionFlag` | `index.ts` registerFlag |
| `AgentChannel` | (host → owning stdio process) | `bin/mcp-server.ts` (host `sendMessage` → stderr) |
| `FormConfig` / `FormResult` | `ExtensionUIFormRequest` / `ExtensionUIFormResult` | `elicitation-handler.ts` |

---

## Upstream Update Checklist

When upstream Pi changes land, walk this list:

- [ ] `UniversalHostSurface` members vs `index.ts` / `init.ts` / `utils.ts` `pi.*` call sites
- [ ] the 3 `as (tool: unknown)` renderer-boundary casts in `index.ts`
- [ ] `events` bus shape (`McpStatusEventBus`)
- [ ] upstream v2.28.0 `MCP_RUNTIME_REGISTER_EVENT` runtime registration (deferred merge)

For any new `pi.*` / `ctx.ui.*` call site, add a row to the tables above and a
corresponding member on `UniversalMcpHost` (or in `host-types.ts`).