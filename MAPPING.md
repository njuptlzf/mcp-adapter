# Agent API Mapping

This file documents the mapping between the universal `AgentAPI` /
`AgentContext` / `UISystem` interfaces in `interfaces/agent-api.ts` and
the concrete Pi implementation in `adapters/pi-adapter.ts`.

It is the source of truth for verifying the adapter layer. When the
upstream Pi ecosystem changes its public surface, update both the
adapter and the corresponding row in this table.

---

## AgentAPI → ExtensionAPI

| AgentAPI method | Pi method | File / line (Pi code) | Notes |
| --- | --- | --- | --- |
| `registerTool` | `pi.registerTool` | `index.ts:70-80`, `index.ts:251-335` | Cast to permissive `ToolRegistration` at the boundary. |
| `registerCommand` | `pi.registerCommand` | `index.ts:156-217`, `index.ts:219-248` | Direct pass-through. |
| `registerFlag` | `pi.registerFlag` | `index.ts:84-87` | Direct pass-through. |
| `on` | `pi.on` | `index.ts:89-138`, `index.ts:140-154` | Event-name generics are erased. |
| `getAllTools` | `pi.getAllTools` | `index.ts:82` | Returned array is normalized to `ToolInfo[]`. |
| `getFlag` | `pi.getFlag` | `init.ts:32` | Returned as `string \| undefined`. |
| `sendMessage` | `pi.sendMessage` | `init.ts:72` | Both `message` and `options` are `unknown` (D-01). |
| `exec` | `pi.exec` | `utils.ts:10-17` | Returns `Promise<unknown>` (D-02). |

## UISystem → ExtensionUIContext

| UISystem member | Pi member | File / line | Optional? |
| --- | --- | --- | --- |
| `notify` | `ctx.ui.notify` | `commands.ts`, `init.ts:145, 156, 170, 202, 232, 237` | Required (D-04). |
| `setStatus` | `ctx.ui.setStatus` | `init.ts:126, 284, 288, 317` | Optional (D-05). |
| `form` | `ctx.ui.form` | `elicitation-handler.ts:117, 133` | Optional (D-05). |
| `custom` | `ctx.ui.custom` | (reserved, no current use) | Optional (D-05). |
| `theme.fg` | `ctx.ui.theme.fg` | `init.ts:288` | Optional (D-06). |

## Type Mappings

| Universal type | Pi type | Source |
| --- | --- | --- |
| `AgentAPI` | `ExtensionAPI` | `@earendil-works/pi-coding-agent` |
| `AgentContext` | `ExtensionContext` | `@earendil-works/pi-coding-agent` |
| `UISystem` | `ExtensionUIContext` | `@earendil-works/pi-coding-agent` |
| `ToolInfo` | Pi's tool-info object (array element from `getAllTools`) | `index.ts:82` |
| `ToolRegistration` | Pi's `ToolDefinition` shape | `index.ts:251-335` |
| `CommandConfig` | Pi's `RegisteredCommand` shape | `index.ts:156-217` |
| `FlagConfig` | Pi's `ExtensionFlag` shape | `index.ts:84-87` |
| `FormConfig` | Pi's `ExtensionUIFormRequest` | `elicitation-handler.ts:69-76` |
| `FormResult` | Pi's `ExtensionUIFormResult` | `elicitation-handler.ts:78-81` |

## AgentContext field mapping

| AgentContext field | Pi source | Notes |
| --- | --- | --- |
| `cwd` | `ctx.cwd` | Always present. |
| `hasUI` | `ctx.hasUI` | Drives whether `ui` is populated. |
| `ui` | `ctx.ui` (only when `hasUI`) | Wrapped via `adaptPiUI`. |
| `model` | `ctx.model` | Generic `unknown` on the interface. |
| `modelRegistry` | `ctx.modelRegistry` | Generic `unknown` on the interface. |
| `signal` | `ctx.signal` | May be undefined. |
| `reload` | not on `ExtensionContext` | Optional, omitted in `adaptPiContext`. Available on `ExtensionCommandContext` but not the base context. |

---

## Upstream Update Checklist

When upstream Pi changes land, walk this list:

- [ ] `index.ts` — `registerTool` / `registerCommand` / `registerFlag` / `on` usage
- [ ] `index.ts` — `getAllTools` / `getFlag`
- [ ] `init.ts` — `getFlag`, `sendMessage`, `ui.notify`, `ui.setStatus`, `ui.theme.fg`
- [ ] `commands.ts` — `ui.notify`
- [ ] `utils.ts` — `pi.exec`
- [ ] `elicitation-handler.ts` — `ui.form`
- [ ] `sampling-handler.ts` — `pi-ai` types and `ui.confirm` (out of scope for Phase 1; revisit Phase 3)

For any new `pi.*` or `ctx.ui.*` call sites, add a row to the tables above
and a corresponding method on `PiAdapter` or in `adaptPiUI`.
