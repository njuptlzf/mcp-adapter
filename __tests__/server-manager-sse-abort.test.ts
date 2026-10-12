import http from "node:http";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { afterEach, expect, it } from "vitest";
import { McpServerManager } from "../server-manager.ts";

setFlagsFromString("--expose-gc");
const gc = runInNewContext("gc") as () => void;

const servers: http.Server[] = [];
afterEach(async () => {
  for (const server of servers) server.closeAllConnections();
  await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  servers.length = 0;
});

async function waitFor(check: () => boolean, ms: number): Promise<boolean> {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise(resolve => setTimeout(resolve, 10))) {
    if (check()) return true;
  }
  return check();
}

it("close() aborts the open SSE GET through the bearerTokenCommand fetch wrapper after GC", async () => {
  let sseOpen = false;
  let sseClosed = false;
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET") {
      sseOpen = true;
      res.on("close", () => { sseClosed = true; });
      res.writeHead(200, { "content-type": "text/event-stream" }).flushHeaders();
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const message = JSON.parse(body) as { id?: number; method?: string };
    if (message.id === undefined) {
      res.writeHead(202).end();
      return;
    }
    const result = message.method === "initialize"
      ? { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "sse", version: "1.0.0" } }
      : message.method === "tools/list" ? { tools: [] } : {};
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind to a TCP port");

  const manager = new McpServerManager();
  try {
    await manager.connect("sse", { url: `http://127.0.0.1:${address.port}/mcp`,
      auth: "bearer",
      bearerToken: `!node -e "process.stdout.write('t')"`,
    });
    expect(await waitFor(() => sseOpen, 2000)).toBe(true);

    // Wrapper Request objects are only weakly linked to the caller's signal.
    gc();
    await new Promise(resolve => setTimeout(resolve, 50));
    gc();

    await manager.close("sse");
    expect(await waitFor(() => sseClosed, 2000)).toBe(true);
  } finally {
    await manager.close("sse").catch(() => {});
  }
});
