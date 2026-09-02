# @njuptlzf/mcp-adapter

**Universal MCP (Model Context Protocol) adapter** — Pi as a first-class host (native extension), plus any MCP-compatible coding agent via the universal `mcp-server` stdio entry point.

> Fork of [`nicobailon/pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter). The full upstream documentation is preserved in [README-src.md](README-src.md).

Use MCP servers without burning your context window: one ~200-token proxy tool instead of hundreds of tool definitions. Servers start lazily on first use, and tool metadata is cached so search/describe work with no live connection.

## What this fork changes

- **Repackaged as `@njuptlzf/mcp-adapter`** — org-scoped npm package, currently `2.29.0-0.0.3` (tracks upstream `v2.29.0`).
- **Pure upstream core** — `index.ts`, `config.ts`, `agent-dir.ts`, etc. run as upstream code; the fork's MCP SDK v1 → v2 migration is isolated in the `adapters/` host layer so upstream merges stay conflict-free.
- **Universal host** — `adapters/universal-host.ts` impersonates Pi's `ExtensionAPI`, so the same engine runs unchanged behind the `mcp-server` stdio layer for any MCP-compatible agent.
- **Prebuilt subpath exports** — `@njuptlzf/mcp-adapter/types`, `/config`, and `/metadata-cache` ship compiled `.js` + `.d.ts` from `dist/`.

## Install

### Pi (recommended)

```bash
pi install npm:@njuptlzf/mcp-adapter
```

Restart Pi. Standard MCP files (`.mcp.json`, `~/.config/mcp/mcp.json`) are discovered automatically.

### Any other MCP-compatible agent

```json
{
  "mcpServers": {
    "mcp-adapter": { "command": "mcp-server" }
  }
}
```

## Entry points

| Bin | File | Purpose |
|-----|------|---------|
| `pi-mcp-adapter` | `cli.js` | CLI — `init` (detect host configs → Pi imports), `token` (bearer auth) |
| `mcp-adapter` / `mcp-server` | `mcp-server.mjs` | Universal stdio MCP server (self-contained esbuild bundle) |

Programmatic Pi entry point (backward-compatible):

```typescript
import { mcpAdapter } from "@njuptlzf/mcp-adapter";
export default mcpAdapter(pi);
```

## Development

```bash
npm install
npm test                    # prebuild visualizer + full vitest suite
npm run typecheck           # tsc --noEmit
npm run build:public        # tsc -> dist/ (subpath exports)
npm run build:mcp-server    # esbuild -> self-contained mcp-server.mjs
```

## Docs

- [README-src.md](README-src.md) — full upstream documentation (config options, agent skills, OAuth, MCP UI, direct tools, verification).
- [MAPPING.md](MAPPING.md) — host-surface contract for the universal host.
- [CHANGELOG.md](CHANGELOG.md) — release history.

## License

MIT