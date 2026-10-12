import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { McpServerManager } from "../server-manager.ts";
import { createProtocolSession } from "../runtime-protocol.ts";
const protocolSession = (connection: any, signal: AbortSignal) =>
  createProtocolSession(connection, signal, {
    namespace: "demo",
    requests: ["demo/list"],
    streams: ["demo/stream"],
    notifications: [],
  });

const fixture = fileURLToPath(
  new URL("./fixtures/delayed-mcp-server.mjs", import.meta.url),
);
const definition = { command: process.execPath, args: [fixture] };

describe("protocol operations on real stdio transports", () => {
  it("shares tools, prevents idle cleanup, and invalidates on reconnect without pinning the replacement", async () => {
    const manager = new McpServerManager(process.cwd());
    const owner = new AbortController();
    try {
      const connection = await manager.connect("demo", definition);
      const session = protocolSession(connection, owner.signal);
      const stream = session.openStream("demo/stream", {}, () => {});
      await stream.sent;
      connection.lastUsedAt = 0;
      expect(manager.isIdle("demo", 100)).toBe(false);
      const result = await connection.client.callTool({
        name: "reload_identity",
        arguments: {},
      });
      expect(result.content).toEqual([
        { type: "text", text: "fixture evidence visible to the model" },
      ]);
      const replacement = await manager.reconnect(
        "demo",
        definition,
        connection,
      );
      expect(replacement).not.toBe(connection);
      expect(session.signal.aborted).toBe(true);
      replacement.lastUsedAt = 0;
      expect(manager.isIdle("demo", 100)).toBe(true);
      expect(replacement.inFlight).toBe(0);
      const currentSession = protocolSession(replacement, owner.signal);
      const currentStream = currentSession.openStream(
        "demo/stream",
        {},
        () => {},
      );
      await currentStream.sent;
      session.close(); // An old consumer must not release the new transport's operation.
      expect(manager.isIdle("demo", 100)).toBe(false);
      currentSession.close();
      replacement.lastUsedAt = 0;
      expect(manager.isIdle("demo", 100)).toBe(true);
      expect((await replacement.client.listTools()).tools).toHaveLength(1);
      const closingSession = protocolSession(replacement, owner.signal);
      await manager.close("demo");
      expect(closingSession.signal.aborted).toBe(true);
    } finally {
      owner.abort();
      await manager.closeAll();
    }
  });
});

for (const protocolVersion of ["legacy", "2026-07-28"] as const) {
  it(`uses the SDK request envelope on real ${protocolVersion} streams`, async () => {
    const manager = new McpServerManager(process.cwd());
    const owner = new AbortController();
    manager.setSamplingConfig({
      autoApprove: true,
      modelRegistry: {} as any,
      getCurrentModel: () => undefined,
      getSignal: () => undefined,
    });
    manager.setElicitationConfig({ allowUrl: true, ui: {} as any });
    try {
      const connection = await manager.connect("envelope-test", {
        command: process.execPath,
        args: [
          fileURLToPath(
            new URL("./fixtures/protocol-envelope-server.mjs", import.meta.url),
          ),
        ],
        protocolVersion,
      });
      const session = createProtocolSession(connection, owner.signal, {
        namespace: "demo",
        requests: ["demo/list"],
        streams: ["demo/stream"],
        notifications: ["notifications/demo/event"],
      });
      const ordinary = (await session.request("demo/list")) as { meta: any };
      let received!: (value: unknown) => void;
      const notification = new Promise((resolve) => {
        received = resolve;
      });
      const stream = session.openStream("demo/stream", {}, (_method, params) =>
        received(params.meta),
      );
      await stream.sent;
      const streamMeta = await notification;
      expect(streamMeta).toEqual(ordinary.meta);
      if (protocolVersion === "2026-07-28") {
        expect(streamMeta).toMatchObject({
          "io.modelcontextprotocol/protocolVersion": protocolVersion,
          "io.modelcontextprotocol/clientInfo": {
            name: "pi-mcp-envelope-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {
            sampling: {},
            elicitation: { form: {}, url: {} },
          },
        });
        expect(
          ordinary.meta["io.modelcontextprotocol/clientCapabilities"]
            .extensions,
        ).toBeDefined();
      } else expect(streamMeta).toBeNull();
      await stream.cancel();
      session.close();
    } finally {
      owner.abort();
      await manager.closeAll();
    }
  });
}
