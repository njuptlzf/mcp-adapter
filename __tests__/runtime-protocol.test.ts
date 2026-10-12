import { describe, it, expect, vi } from "vitest";
import {
  createProtocolSession,
  registerProtocolBridge,
  registerMcpProtocol,
} from "../runtime-protocol.ts";
import { wrapTransportWithMcpTrace } from "../mcp-trace.ts";
const spec = {
  namespace: "demo",
  requests: ["demo/list"],
  streams: ["demo/stream"],
  notifications: ["notifications/demo/event"],
};
function fixture() {
  const transport = {
    onclose: vi.fn(),
    onmessage: vi.fn(),
    send: vi.fn(async () => {}),
  };
  const client = {
    request: vi.fn(async () => ({ entries: [] })),
    notification: vi.fn(async () => {}),
    getProtocolEra: () => "legacy",
  };
  const connection = {
    status: "connected",
    definition: { command: "node" },
    inFlight: 2,
    lastUsedAt: 0,
    client,
    transport,
  } as any;
  const owner = new AbortController();
  return {
    connection,
    owner,
    session: () => createProtocolSession(connection, owner.signal, spec),
    transport,
    client,
  };
}
function bus() {
  const listeners = new Map();
  return {
    events: {
      on: (n: string, f: any) => listeners.set(n, f),
      emit: (n: string, r: any) => listeners.get(n)?.(r),
    },
  } as any;
}
describe("mediated protocol extensions", () => {
  it("registers lazily, isolates namespaces, and removes disposed registrations", async () => {
    const pi = bus(),
      f = fixture();
    expect(() => registerMcpProtocol(pi, spec)).toThrow("protocol extensions");
    const resolve = vi.fn(async () => ({
      connection: f.connection,
      signal: f.owner.signal,
    }));
    registerProtocolBridge(pi, resolve);
    const protocol = registerMcpProtocol(pi, spec);
    expect(resolve).not.toHaveBeenCalled();
    expect(() => registerMcpProtocol(pi, spec)).toThrow("already registered");
    const session = await protocol.connect("test");
    expect(session).not.toHaveProperty("client");
    expect(session).not.toHaveProperty("transport");
    expect(session).not.toHaveProperty("send");
    protocol.dispose();
    expect(session.signal.aborted).toBe(true);
    await expect(protocol.connect("test")).rejects.toThrow("disposed");
    expect(() => registerMcpProtocol(pi, spec)).not.toThrow();
  });
  it.each([
    "tools",
    "resources",
    "prompts",
    "sampling",
    "tasks",
    "subscriptions",
    "server",
    "notifications",
    "rpc",
  ])("rejects reserved namespace %s", (namespace) => {
    const pi = bus();
    registerProtocolBridge(pi, vi.fn());
    expect(() => registerMcpProtocol(pi, { ...spec, namespace })).toThrow(
      "reserved",
    );
  });
  it("rejects cross-namespace declarations and undeclared methods before touching the server", async () => {
    const f = fixture(),
      pi = bus();
    registerProtocolBridge(pi, vi.fn());
    for (const definition of [
      { ...spec, requests: ["tools/call"] },
      { ...spec, notifications: ["notifications/resources/updated"] },
      { ...spec, streams: ["demo/list"] },
    ])
      expect(() => registerMcpProtocol(pi, definition)).toThrow();
    const session = f.session();
    await expect(session.request("tools/call", {})).rejects.toThrow(
      "Undeclared",
    );
    expect(() => session.openStream("tools/call", {}, () => {})).toThrow(
      "Undeclared",
    );
    await expect(session.request("demo/list", { _meta: {} })).rejects.toThrow(
      "reserved _meta",
    );
    expect(f.client.request).not.toHaveBeenCalled();
    expect(f.transport.send).not.toHaveBeenCalled();
    session.close();
  });
  it("pins only active operations and preserves ordinary tool accounting", async () => {
    const f = fixture(),
      session = f.session();
    expect(f.connection.activeProtocolOperations ?? 0).toBe(0);
    await session.request("demo/list");
    expect(f.client.request).toHaveBeenCalledOnce();
    expect(f.connection.activeProtocolOperations).toBe(0);
    const a = session.openStream("demo/stream", {}, () => {}),
      b = session.openStream("demo/stream", {}, () => {});
    await Promise.all([a.sent, b.sent]);
    expect(f.connection.activeProtocolOperations).toBe(2);
    await a.cancel();
    await a.cancel();
    expect(await a.closed).toEqual({ reason: "cancelled" });
    expect(f.client.notification).toHaveBeenCalledTimes(1);
    expect(f.connection.activeProtocolOperations).toBe(1);
    expect(f.connection.inFlight).toBe(2);
    session.close();
    expect(await b.closed).toEqual({ reason: "cancelled" });
    expect(f.connection.activeProtocolOperations).toBe(0);
  });
  it("routes by declared method and stream ID, preserves unrelated traffic and discards late frames", async () => {
    const f = fixture(),
      original = f.transport.onmessage,
      first = f.session(),
      second = f.session();
    const a = vi.fn(),
      b = vi.fn();
    const x = first.openStream("demo/stream", {}, a),
      y = second.openStream("demo/stream", {}, b);
    await Promise.all([x.sent, y.sent]);
    const notify = (id: string, method = "notifications/demo/event") =>
      f.connection.transport.onmessage({
        jsonrpc: "2.0",
        method,
        params: {
          value: 1,
          _meta: { "io.modelcontextprotocol/subscriptionId": id },
        },
      });
    notify(x.id);
    notify(y.id);
    notify(x.id, "notifications/resources/updated");
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    expect(original).toHaveBeenCalledOnce();
    first.close();
    notify(x.id);
    expect(a).toHaveBeenCalledOnce();
    expect(second.signal.aborted).toBe(false);
    f.connection.transport.onmessage({ jsonrpc: "2.0", id: y.id, result: {} });
    expect(await y.closed).toEqual({ reason: "ended" });
    expect(f.connection.activeProtocolOperations).toBe(0);
    second.close();
  });
  it.each(["disconnect", "owner"])(
    "invalidates consumers on %s",
    async (reason) => {
      const f = fixture(),
        original = f.transport.onclose,
        a = f.session(),
        b = f.session();
      const stream = a.openStream("demo/stream", {}, () => {});
      await stream.sent;
      if (reason === "owner") f.owner.abort();
      else f.connection.transport.onclose();
      expect(a.signal.aborted).toBe(true);
      expect(b.signal.aborted).toBe(true);
      expect((await stream.closed).reason).toBe("disconnected");
      expect(f.connection.activeProtocolOperations).toBe(0);
      if (reason === "disconnect") expect(original).toHaveBeenCalledOnce();
      await expect(a.request("demo/list")).rejects.toThrow("ended");
    },
  );
  it("reports handler and send errors without disrupting other streams", async () => {
    const f = fixture(),
      session = f.session();
    const broken = session.openStream("demo/stream", {}, () => {
      throw new Error("bad handler");
    });
    await broken.sent;
    f.connection.transport.onmessage({
      jsonrpc: "2.0",
      method: "notifications/demo/event",
      params: {
        _meta: { "io.modelcontextprotocol/subscriptionId": broken.id },
      },
    });
    expect((await broken.closed).error).toContain("bad handler");
    f.transport.send.mockRejectedValueOnce(new Error("write failed"));
    const failed = session.openStream("demo/stream", {}, () => {});
    await expect(failed.sent).rejects.toThrow("write failed");
    expect(await failed.closed).toEqual({
      reason: "error",
      error: "write failed",
    });
    expect(f.connection.activeProtocolOperations).toBe(0);
    session.close();
  });
  it("rejects dead owners and stale registration connects", async () => {
    const f = fixture();
    f.owner.abort();
    expect(f.session).toThrow("unavailable");
    const pi = bus();
    let resolve!: (value: any) => void;
    registerProtocolBridge(
      pi,
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const protocol = registerMcpProtocol(pi, spec);
    const pending = protocol.connect("test");
    protocol.dispose();
    resolve({ connection: f.connection, signal: f.owner.signal });
    await expect(pending).rejects.toThrow("disposed");
  });
});

it("copies declarations, routes server cancellation, and releases failed request pins", async () => {
  const f = fixture(),
    pi = bus();
  registerProtocolBridge(pi, async () => ({
    connection: f.connection,
    signal: f.owner.signal,
  }));
  const declaration = structuredClone(spec);
  const protocol = registerMcpProtocol(pi, declaration);
  declaration.requests.push("tools/call");
  const session = await protocol.connect("test");
  await expect(session.request("tools/call")).rejects.toThrow("Undeclared");
  f.client.request.mockRejectedValueOnce(new Error("request failed"));
  await expect(session.request("demo/list")).rejects.toThrow("request failed");
  expect(f.connection.activeProtocolOperations).toBe(0);
  const stream = session.openStream("demo/stream", {}, () => {});
  await stream.sent;
  f.connection.transport.onmessage({
    jsonrpc: "2.0",
    method: "notifications/cancelled",
    params: { requestId: stream.id },
  });
  expect((await stream.closed).reason).toBe("ended");
  expect(f.connection.activeProtocolOperations).toBe(0);
  protocol.dispose();
});

it("does not send a stream cancelled before dispatch and never exposes uncorrelated notifications", async () => {
  const f = fixture(),
    previous = f.transport.onmessage,
    session = f.session(),
    received = vi.fn();
  const stream = session.openStream("demo/stream", {}, received);
  await stream.cancel();
  await stream.sent;
  expect(f.transport.send).not.toHaveBeenCalled();
  f.connection.transport.onmessage({
    jsonrpc: "2.0",
    method: "notifications/demo/event",
    params: { data: "unowned" },
  });
  expect(received).not.toHaveBeenCalled();
  expect(previous).toHaveBeenCalledOnce();
  session.close();
});

it("fails closed if a modern connection cannot supply its SDK metadata", async () => {
  const f = fixture();
  f.client.getProtocolEra = () => "modern";
  const session = f.session();
  const stream = session.openStream("demo/stream", {}, () => {});
  await expect(stream.sent).rejects.toThrow("metadata is unavailable");
  expect(f.transport.send).not.toHaveBeenCalled();
  expect((await stream.closed).reason).toBe("error");
  expect(f.connection.activeProtocolOperations).toBe(0);
  session.close();
});

it("isolates declared notification observers and preserves SDK delivery", async () => {
  const f = fixture(),
    previous = f.transport.onmessage,
    session = f.session();
  const received = vi.fn(),
    broken = vi.fn(() => {
      throw new Error("consumer failed");
    });
  const a = session.watchNotifications(["notifications/demo/event"], received);
  const b = session.watchNotifications(["notifications/demo/event"], broken);
  expect(f.connection.activeProtocolOperations).toBe(2);
  expect(() =>
    session.watchNotifications(["notifications/tools/list_changed"], received),
  ).toThrow("Undeclared");
  f.transport.onmessage({
    jsonrpc: "2.0",
    method: "notifications/demo/event",
    params: { value: 1 },
  });
  expect(received).toHaveBeenCalledOnce();
  expect(previous).toHaveBeenCalledOnce();
  expect((await b.closed).reason).toBe("error");
  expect(f.connection.activeProtocolOperations).toBe(1);
  f.transport.onmessage({
    jsonrpc: "2.0",
    method: "notifications/tools/list_changed",
  });
  expect(received).toHaveBeenCalledOnce();
  a.close();
  a.close();
  expect(await a.closed).toEqual({ reason: "cancelled" });
  expect(f.connection.activeProtocolOperations).toBe(0);
  const c = session.watchNotifications(["notifications/demo/event"], received);
  f.owner.abort();
  expect((await c.closed).reason).toBe("disconnected");
  expect(f.connection.activeProtocolOperations).toBe(0);
});

it("preserves structured stream errors", async () => {
  const f = fixture(),
    session = f.session();
  const stream = session.openStream("demo/stream", {}, () => {});
  await stream.sent;
  const error = {
    code: -32012,
    message: "Forbidden",
    data: { reason: "revoked" },
  };
  f.transport.onmessage({ jsonrpc: "2.0", id: stream.id, error });
  const end = await stream.closed;
  expect(end).toEqual({
    reason: "error",
    error: "Forbidden",
    protocolError: error,
  });
  error.data.reason = "changed";
  expect(end.protocolError?.data).toEqual({ reason: "revoked" });
  session.close();
});

it("copies observer declarations and payloads and does not broadcast stream traffic", async () => {
  const f = fixture(),
    session = f.session();
  const methods = ["notifications/demo/event"];
  const received = vi.fn();
  const watch = session.watchNotifications(methods, (_method, params) => {
    params.value = 2;
    received();
  });
  methods[0] = "notifications/tools/list_changed";
  const notification = {
    jsonrpc: "2.0",
    method: "notifications/demo/event",
    params: { value: 1 },
  };
  f.transport.onmessage(notification);
  expect(notification.params.value).toBe(1);
  const stream = session.openStream("demo/stream", {}, () => {});
  await stream.sent;
  f.transport.onmessage({
    ...notification,
    params: { _meta: { "io.modelcontextprotocol/subscriptionId": stream.id } },
  });
  expect(received).toHaveBeenCalledOnce();
  watch.close();
  session.close();
});

it.each(["observer", "session", "owner"])(
  "does not deliver to observers closed during dispatch by %s cleanup",
  async (cleanup) => {
    const f = fixture(),
      previous = f.transport.onmessage,
      session = f.session(),
      received = vi.fn();
    let closeLater!: () => void;
    const first = session.watchNotifications(
      ["notifications/demo/event"],
      () => {
        if (cleanup === "observer") closeLater();
        else if (cleanup === "session") session.close();
        else f.owner.abort();
      },
    );
    const later = session.watchNotifications(
      ["notifications/demo/event"],
      received,
    );
    closeLater = () => later.close();
    const frame = {
      jsonrpc: "2.0",
      method: "notifications/demo/event",
      params: {},
    };
    f.transport.onmessage(frame);
    expect(received).not.toHaveBeenCalled();
    expect(previous).toHaveBeenCalledWith(frame, undefined);
    expect((await later.closed).reason).toBe(
      cleanup === "owner" ? "disconnected" : "cancelled",
    );
    expect(f.connection.activeProtocolOperations).toBe(
      cleanup === "observer" ? 1 : 0,
    );
    first.close();
    session.close();
    expect(f.connection.activeProtocolOperations).toBe(0);
  },
);
it("records each inbound frame once on a traced transport", async () => {
  const f = fixture(),
    sdk = f.transport.onmessage,
    traced: string[] = [];
  wrapTransportWithMcpTrace(f.transport as any, "demo", "stdio", {
    record: (event) => traced.push(event.direction),
  });
  const session = f.session();
  const received = vi.fn();
  const stream = session.openStream("demo/stream", {}, received);
  await stream.sent;
  traced.length = 0;
  f.transport.onmessage({ jsonrpc: "2.0", id: 1, result: {} });
  expect(traced).toEqual(["inbound"]);
  expect(sdk).toHaveBeenCalledOnce();
  f.transport.onmessage({
    jsonrpc: "2.0",
    method: "notifications/demo/event",
    params: { _meta: { "io.modelcontextprotocol/subscriptionId": stream.id } },
  });
  expect(traced).toEqual(["inbound", "inbound"]);
  expect(received).toHaveBeenCalledOnce();
  expect(sdk).toHaveBeenCalledOnce();
  session.close();
  f.transport.onmessage({ jsonrpc: "2.0", id: 2, result: {} });
  expect(traced).toEqual(["inbound", "inbound", "inbound"]);
  expect(sdk).toHaveBeenCalledTimes(2);
});
