#!/usr/bin/env npx tsx
import { KiloAdapter, adaptKiloContext } from "../adapters/kilo-adapter.ts";
import { createMcpAdapter } from "../adapters/entry.ts";
import { loadMcpConfig } from "../config.ts";
import { loadMetadataCache } from "../metadata-cache.ts";
import type { AgentContext } from "../interfaces/agent-api.ts";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const adapter = new KiloAdapter();
const ctx: AgentContext = adaptKiloContext({ cwd: process.cwd(), hasUI: false });

const config = loadMcpConfig();
const cache = loadMetadataCache();

createMcpAdapter(adapter, ctx, config, cache);

adapter.fireSessionStart(ctx).then(() => {
  console.error("[kilo-mcp-entry] session started, servers:", Object.keys(config.mcpServers || {}).length);
}).catch((err: Error) => {
  console.error("[kilo-mcp-entry] session start error:", err.message);
});

const mcpTools = [...adapter.tools.entries()].map(([name, tool]) => ({
  name,
  description: tool.description || `MCP proxy tool: ${name}`,
  inputSchema: tool.parameters || { type: "object", properties: {} },
}));

const server = new Server(
  { name: "mcp-adapter-kilo", version: "2.9.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error(`[kilo-mcp-entry] list-tools: ${mcpTools.length} tools`);
  return { tools: mcpTools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = adapter.tools.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  try {
    const result = await tool.execute(`call-${Date.now()}`, args || {}, undefined, undefined, ctx);
    const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return { content: [{ type: "text" as const, text }] };
  } catch (err) {
    return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error("[kilo-mcp-entry] MCP server ready via stdio");
}).catch((err: Error) => {
  console.error("[kilo-mcp-entry] server connect error:", err.message);
  process.exit(1);
});