import readline from "node:readline";
const send = (message) =>
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  const result = (value) => send({ id: request.id, result: value });
  if (request.method === "server/discover")
    return result({
      supportedVersions: ["2026-07-28"],
      capabilities: { tools: {} },
    });
  if (request.method === "initialize")
    return result({
      protocolVersion: "2025-11-25",
      capabilities: { tools: {} },
      serverInfo: { name: "envelope-fixture", version: "1" },
    });
  if (request.method === "tools/list")
    return result({
      resultType: "complete",
      ttlMs: 0,
      cacheScope: "private",
      tools: [],
    });
  if (request.method === "demo/list")
    return result({
      resultType: "complete",
      meta: request.params?._meta ?? null,
    });
  if (request.method === "demo/stream")
    return send({
      method: "notifications/demo/event",
      params: {
        meta: request.params?._meta ?? null,
        _meta: { "io.modelcontextprotocol/subscriptionId": request.id },
      },
    });
});
