/**
 * Fixture for __tests__/mcp-server-stdin-eof.test.ts (issue #44).
 *
 * A minimal stdio MCP server standing in for a stateful child such as
 * codebase-memory-mcp: it records its PID so the test can verify reaping, and
 * — like a real stateful server — shuts down when its stdin pipe closes. This
 * makes the adapter→child teardown chain observable and deterministic.
 */
import { writeFileSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const pidFile = process.argv[2];
if (pidFile) writeFileSync(pidFile, String(process.pid));

let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  process.exit(0);
};
// Mirror a real stateful child: EOF on stdin or a signal ends the process.
process.stdin.on("end", shutdown);
process.stdin.on("close", shutdown);
process.stdin.resume();
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const server = new Server(
  { name: "eof-child-fixture", version: "1.0.0" },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
await server.connect(new StdioServerTransport());
