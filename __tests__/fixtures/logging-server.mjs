import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// The `log` tool sends one notifications/message before it returns.
const server = new Server({ name: "logging-server", version: "1.0.0" }, { capabilities: { tools: {}, logging: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{ name: "log", inputSchema: { type: "object", properties: {} } }],
}));

server.setRequestHandler(CallToolRequestSchema, async () => {
  await server.sendLoggingMessage({ level: "warning", logger: "db", data: "pool exhausted\nretrying" });
  return { content: [{ type: "text", text: "ok" }] };
});

await server.connect(new StdioServerTransport());
