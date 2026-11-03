import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// The `roots` tool returns the roots the client reports through roots/list.
const server = new Server({ name: "roots-server", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{ name: "roots", inputSchema: { type: "object", properties: {} } }],
}));

server.setRequestHandler(CallToolRequestSchema, async () => {
  const { roots } = await server.listRoots();
  return { content: [{ type: "text", text: JSON.stringify(roots) }] };
});

await server.connect(new StdioServerTransport());
