import http from "node:http";
import net from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, expect } from "vitest";
import { McpServerManager } from "../server-manager.ts";
import { createProtocolSession } from "../runtime-protocol.ts";

const spec = {
  namespace: "demo",
  requests: ["demo/poll", "demo/subscribe", "demo/unsubscribe"],
  streams: ["demo/stream"],
  notifications: [
    "notifications/demo/active",
    "notifications/demo/event",
    "notifications/demo/list_changed",
  ],
};
type Mode = "http" | "sse" | "socket";

async function fixture(mode: Mode) {
  const directory = await mkdtemp(join(tmpdir(), "protocol-"));
  const streams = new Map<string, (frame: unknown) => void>();
  const responses = new Map<string, http.ServerResponse>();
  const closed = new Set<string>();
  const methods: string[] = [];
  const headers: http.IncomingHttpHeaders[] = [];
  const sockets = new Set<net.Socket>();
  let sharedSend: (frame: unknown) => void;
  const dispatch = (message: any, send: (frame: unknown) => void) => {
    methods.push(message.method);
    const result = (value: unknown) =>
      send({ jsonrpc: "2.0", id: message.id, result: value });
    switch (message.method) {
      case "server/discover":
        return result({
          supportedVersions: ["2026-07-28"],
          capabilities: { tools: {}, demo: { listChanged: true } },
        });
      case "initialize":
        return result({
          protocolVersion: "2025-11-25",
          capabilities: { tools: {}, demo: { listChanged: true } },
          serverInfo: { name: "protocol-fixture", version: "1" },
        });
      case "tools/list":
        return result({
          resultType: "complete",
          ttlMs: 0,
          cacheScope: "private",
          tools: [],
        });
      case "demo/poll":
      case "demo/subscribe":
      case "demo/unsubscribe":
        return result({ resultType: "complete", value: message.method });
      case "demo/stream":
        streams.set(message.id, send);
        return send({
          jsonrpc: "2.0",
          method: "notifications/demo/active",
          params: {
            _meta: { "io.modelcontextprotocol/subscriptionId": message.id },
          },
        });
      case "notifications/cancelled":
        closed.add(message.params.requestId);
        streams.delete(message.params.requestId);
        return;
      case "notifications/initialized":
        return;
      default:
        throw new Error(`Unexpected method: ${message.method}`);
    }
  };
  const server =
    mode === "socket"
      ? net.createServer((socket) => {
          const send = (frame: unknown) => {
            socket.write(JSON.stringify(frame) + "\n");
          };
          sharedSend = send;
          let buffer = "";
          socket.on("data", (chunk) => {
            buffer += chunk;
            let newline;
            while ((newline = buffer.indexOf("\n")) >= 0) {
              const line = buffer.slice(0, newline);
              buffer = buffer.slice(newline + 1);
              dispatch(JSON.parse(line), send);
            }
          });
        })
      : http.createServer(async (req, res) => {
          if (req.method === "GET" && mode === "sse") {
            res.writeHead(200, { "content-type": "text/event-stream" });
            sharedSend = (frame) => {
              res.write(`data: ${JSON.stringify(frame)}\n\n`);
            };
            res.write("event: endpoint\ndata: /messages\n\n");
            return;
          }
          if (req.method !== "POST") {
            res.writeHead(405).end();
            return;
          }
          if (mode === "sse" && req.url !== "/messages") {
            res.writeHead(404).end();
            return;
          }
          headers.push(req.headers);
          let body = "";
          for await (const chunk of req) body += chunk;
          const message = JSON.parse(body);
          if (mode === "sse") {
            res.writeHead(202).end();
            dispatch(message, sharedSend);
            return;
          }
          if (!("id" in message)) {
            res.writeHead(202).end();
            dispatch(message, () => {});
            return;
          }
          if (message.method === "demo/stream") {
            responses.set(message.id, res);
            res.on("close", () => closed.add(message.id));
            res.writeHead(200, { "content-type": "text/event-stream" });
            dispatch(message, (frame) => {
              res.write(`data: ${JSON.stringify(frame)}\n\n`);
            });
          } else
            dispatch(message, (frame) => {
              res
                .writeHead(200, { "content-type": "application/json" })
                .end(JSON.stringify(frame));
            });
        });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  const path = join(directory, "mcp.sock");
  await new Promise<void>((resolve) =>
    mode === "socket"
      ? server.listen(path, resolve)
      : server.listen(0, "127.0.0.1", resolve),
  );
  const definition =
    mode === "socket"
      ? { socket: path }
      : {
          url: `http://127.0.0.1:${(server.address() as net.AddressInfo).port}/mcp`,
          auth: false as const,
          headers: { "X-Protocol-Test": "configured" },
        };
  return {
    definition,
    streams,
    responses,
    closed,
    methods,
    headers,
    notify: () =>
      sharedSend({ jsonrpc: "2.0", method: "notifications/demo/list_changed" }),
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    },
  };
}

for (const [mode, protocolVersion] of [
  ["http", "legacy"],
  ["http", "2026-07-28"],
  ["sse", "legacy"],
  ["socket", "legacy"],
  ["socket", "2026-07-28"],
] as const) {
  it(`${mode}/${protocolVersion}: independent streams, ordinary requests, cancellation, and cleanup`, async () => {
    const f = await fixture(mode);
    const manager = new McpServerManager();
    const owner = new AbortController();
    try {
      const connection = await manager.connect("protocol-test", {
        ...f.definition,
        protocolVersion,
      });
      const session = createProtocolSession(connection, owner.signal, spec);
      const received: string[] = [];
      const a = session.openStream("demo/stream", {}, () => received.push("a"));
      const b = session.openStream("demo/stream", {}, () => received.push("b"));
      await Promise.all([a.sent, b.sent]);
      await expect.poll(() => received.length).toBe(2);
      connection.lastUsedAt = 0;
      expect(manager.isIdle("protocol-test", 1)).toBe(false);
      for (const method of spec.requests)
        expect(await session.request(method)).toMatchObject({ value: method });
      expect((await connection.client.listTools()).tools).toEqual([]);
      await a.cancel();
      await expect.poll(() => f.closed.has(a.id)).toBe(true);
      expect(f.closed.has(b.id)).toBe(false);
      f.streams.get(b.id)!({
        jsonrpc: "2.0",
        method: "notifications/demo/event",
        params: { _meta: { "io.modelcontextprotocol/subscriptionId": b.id } },
      });
      await expect.poll(() => received.length).toBe(3);
      expect(received[2]).toBe("b");
      expect(connection.activeProtocolOperations).toBe(1);
      expect((await connection.client.listTools()).tools).toEqual([]);
      if (mode === "http") {
        f.responses.get(b.id)!.end();
        expect((await b.closed).reason).toBe("disconnected");
        expect(f.methods).not.toContain("notifications/cancelled");
        expect(
          f.headers.every(
            (headers) => headers["x-protocol-test"] === "configured",
          ),
        ).toBe(true);
      } else {
        const changes: string[] = [];
        const watch = session.watchNotifications(
          ["notifications/demo/list_changed"],
          (method) => changes.push(method),
        );
        f.notify();
        await expect
          .poll(() => changes)
          .toEqual(["notifications/demo/list_changed"]);
        watch.close();
        f.streams.get(b.id)!({ jsonrpc: "2.0", id: b.id, result: {} });
        expect((await b.closed).reason).toBe("ended");
      }
      expect(connection.activeProtocolOperations).toBe(0);
      expect((await connection.client.listTools()).tools).toEqual([]);
      const c = session.openStream("demo/stream", {}, () => {});
      await c.sent;
      owner.abort();
      expect((await c.closed).reason).toBe("disconnected");
      await expect.poll(() => f.closed.has(c.id)).toBe(true);
      expect(connection.activeProtocolOperations).toBe(0);
    } finally {
      owner.abort();
      await manager.closeAll();
      await f.close();
    }
  });
}
