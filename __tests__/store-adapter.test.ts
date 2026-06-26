/**
 * Unit tests for StoreAgentAdapter base class.
 *
 * Covers all 8 AgentAPI methods, event simulators, exec, bufferedMessages,
 * attachChannel/detachChannel, and the STORE-02 sendMessage injection pattern.
 */

import { beforeEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import type {
	AgentContext,
	ToolRegistration,
	UISystem,
} from "../interfaces/agent-api.ts";
import type { AgentChannel } from "../interfaces/agent-channel.ts";

// Dynamic import so the test file can exist before the source file is written.
// Once store-adapter.ts is created, this import will resolve.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let StoreAgentAdapter: any;

beforeAll(async () => {
	const mod = await import("../adapters/store-adapter.ts");
	StoreAgentAdapter = mod.StoreAgentAdapter;
});

// --- node:child_process mock for exec() ---
vi.mock("node:child_process", async (importOriginal) => {
	const actual = (await importOriginal()) as typeof import("node:child_process");
	return { ...actual, spawn: vi.fn() };
});

function buildFakeChild(opts: {
	stdout?: string;
	stderr?: string;
	code?: number | null;
	error?: Error;
}): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter } {
	const child = new EventEmitter() as EventEmitter & {
		stdout: EventEmitter;
		stderr: EventEmitter;
	};
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	const fire = (): void => {
		if (opts.error) {
			child.emit("error", opts.error);
			return;
		}
		if (opts.stdout) child.stdout.emit("data", Buffer.from(opts.stdout));
		if (opts.stderr) child.stderr.emit("data", Buffer.from(opts.stderr));
		child.emit("close", opts.code ?? 0);
	};
	setImmediate(fire);
	return child;
}

// ---- Minimal profile for constructing StoreAgentAdapter ----
function makeProfile(overrides?: Record<string, unknown>) {
	return {
		id: "test-agent",
		displayName: "Test Agent",
		prefix: "[mcp-adapter/test]",
		...overrides,
	};
}

describe("StoreAgentAdapter - construction", () => {
	it("constructs with a minimal profile", () => {
		const adapter = new StoreAgentAdapter(makeProfile());
		expect(adapter).toBeDefined();
	});

	it("exposes 4 public readonly Maps", () => {
		const adapter = new StoreAgentAdapter(makeProfile());
		expect(adapter.tools).toBeInstanceOf(Map);
		expect(adapter.commands).toBeInstanceOf(Map);
		expect(adapter.flags).toBeInstanceOf(Map);
		expect(adapter.handlers).toBeInstanceOf(Map);
	});

	it("has a readonly ui property", () => {
		const adapter = new StoreAgentAdapter(makeProfile());
		expect(adapter.ui).toBeDefined();
		expect(typeof adapter.ui.notify).toBe("function");
	});
});

describe("StoreAgentAdapter - AgentAPI surface", () => {
	let adapter: InstanceType<typeof StoreAgentAdapter>;

	beforeEach(() => {
		adapter = new StoreAgentAdapter(makeProfile());
	});

	// Test 1: registerTool
	it("registerTool stores tool by name", () => {
		const tool: ToolRegistration = { name: "x", execute: vi.fn() };
		adapter.registerTool(tool);
		expect(adapter.tools.get("x")).toBeDefined();
		expect(adapter.tools.get("x")?.name).toBe("x");
	});

	it("registerTool → getAllTools includes the tool", () => {
		adapter.registerTool({ name: "x", execute: vi.fn() });
		const tools = adapter.getAllTools();
		expect(tools.some((t: { name: string }) => t.name === "x")).toBe(true);
	});

	// Test 2: registerCommand
	it("registerCommand stores config by name", () => {
		const cfg = { handler: vi.fn() };
		adapter.registerCommand("c", cfg);
		expect(adapter.commands.get("c")).toBeDefined();
		expect(adapter.commands.get("c")?.handler).toBe(cfg.handler);
	});

	// Test 3: registerFlag
	it("registerFlag stores config with mutable value", () => {
		adapter.registerFlag("f", { description: "d" });
		const entry = adapter.flags.get("f");
		expect(entry).toBeDefined();
		expect(entry?.description).toBe("d");
		// getFlag returns undefined initially (no value set)
		expect(adapter.getFlag("f")).toBeUndefined();
		// After setting value via internal mutation
		entry!.value = "set-value";
		expect(adapter.getFlag("f")).toBe("set-value");
	});

	it("registerFlag does not mutate caller's object", () => {
		const original = { description: "path" } as const;
		adapter.registerFlag("x", original);
		const entry = adapter.flags.get("x");
		expect(entry).not.toBe(original as unknown as object);
	});

	// Test 4: on() + fireSessionStart
	it("on() stores handlers and fires on fireSessionStart", async () => {
		const handler = vi.fn();
		adapter.on("session_start", handler);
		const ctx: AgentContext = { cwd: "/work", hasUI: false };
		await adapter.fireSessionStart(ctx);
		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith("session_start", ctx);
	});

	it("on() does not double-register the same handler", async () => {
		const handler = vi.fn();
		adapter.on("session_start", handler);
		adapter.on("session_start", handler);
		adapter.on("session_start", handler);
		await adapter.fireSessionStart({ cwd: "/", hasUI: false });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	// Test 5: sendMessage with no channel → buffer
	it("sendMessage with no channel buffers messages", () => {
		adapter.sendMessage({ role: "user", content: "hello" });
		adapter.sendMessage({ role: "user", content: "world" });
		const buffered = adapter.getBufferedMessages();
		expect(buffered).toHaveLength(2);
		expect(buffered[0]).toEqual({ role: "user", content: "hello" });
		expect(buffered[1]).toEqual({ role: "user", content: "world" });
	});

	// Test 6: sendMessage with attached channel → channel.send
	it("sendMessage with attached channel delegates to channel.send", async () => {
		const sendSpy = vi.fn();
		const channel: AgentChannel = { send: sendSpy };
		adapter.attachChannel(channel);
		adapter.sendMessage("hi");
		await new Promise((r) => setImmediate(r));
		expect(sendSpy).toHaveBeenCalledWith("hi", undefined);
	});

	// Test 7: exec
	it("exec uses child_process.spawn", async () => {
		const cp = await import("node:child_process");
		const spawnMock = cp.spawn as unknown as ReturnType<typeof vi.fn>;
		const fakeChild = buildFakeChild({ stdout: "ok", stderr: "", code: 0 });
		spawnMock.mockReturnValue(fakeChild as unknown as ReturnType<typeof cp.spawn>);
		const result = (await adapter.exec("echo", ["hi"])) as {
			code: number | null;
			stdout: string;
			stderr: string;
		};
		expect(spawnMock).toHaveBeenCalledWith(
			"echo",
			["hi"],
			expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] }),
		);
		expect(result.code).toBe(0);
		expect(result.stdout).toBe("ok");
	});

	// Test 8: profile.sendMessage returns false → message is buffered
	it("profile.sendMessage returning false → message is buffered", () => {
		const adapter2 = new StoreAgentAdapter(makeProfile({
			sendMessage: () => false,
		}));
		adapter2.sendMessage("test-msg");
		expect(adapter2.getBufferedMessages()).toEqual(["test-msg"]);
	});

	// Test 9: profile.sendMessage returns true → message NOT buffered
	it("profile.sendMessage returning true → message is NOT buffered", () => {
		const handled: unknown[] = [];
		const adapter2 = new StoreAgentAdapter(makeProfile({
			sendMessage: (msg: unknown) => { handled.push(msg); return true; },
		}));
		adapter2.sendMessage("test-msg");
		expect(adapter2.getBufferedMessages()).toHaveLength(0);
		expect(handled).toEqual(["test-msg"]);
	});

	// Additional coverage
	it("getAllTools returns registered names only", () => {
		adapter.registerTool({ name: "alpha", execute: vi.fn() });
		adapter.registerTool({ name: "beta", execute: vi.fn() });
		const tools = adapter.getAllTools();
		expect(tools).toHaveLength(2);
		expect(tools.map((t: { name: string }) => t.name).sort()).toEqual(["alpha", "beta"]);
	});

	it("getFlag returns undefined for unknown flag", () => {
		expect(adapter.getFlag("missing")).toBeUndefined();
	});

	it("fireSessionShutdown fires handlers", async () => {
		const handler = vi.fn();
		adapter.on("session_shutdown", handler);
		await adapter.fireSessionShutdown();
		expect(handler).toHaveBeenCalledWith("session_shutdown");
	});

	it("fireToolRegistered fires handlers", async () => {
		const handler = vi.fn();
		adapter.on("tool_registered", handler);
		await adapter.fireToolRegistered("alpha");
		expect(handler).toHaveBeenCalledWith("tool_registered", "alpha");
	});

	it("fire() catches handler errors and logs with prefix + event name (T-10-01)", async () => {
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const handler = vi.fn(() => { throw new Error("boom"); });
		adapter.on("session_start", handler);
		await expect(
			adapter.fireSessionStart({ cwd: "/secret-dir", hasUI: false }),
		).resolves.toBeUndefined();
		expect(errSpy).toHaveBeenCalled();
		const msg = String(errSpy.mock.calls[0]?.[0] ?? "");
		expect(msg).toMatch(/session_start/);
		// T-10-01: must NOT include args (cwd path)
		expect(msg).not.toMatch(/\/secret-dir/);
		errSpy.mockRestore();
	});

	it("fire() is no-op when no handlers registered", async () => {
		await expect(
			adapter.fireSessionStart({ cwd: "/", hasUI: false }),
		).resolves.toBeUndefined();
	});
});

describe("StoreAgentAdapter - channel lifecycle", () => {
	let adapter: InstanceType<typeof StoreAgentAdapter>;

	beforeEach(() => {
		adapter = new StoreAgentAdapter(makeProfile());
	});

	it("attachChannel sets channel so sendMessage routes through it", async () => {
		const sendSpy = vi.fn();
		adapter.attachChannel({ send: sendSpy });
		adapter.sendMessage("msg");
		await new Promise((r) => setImmediate(r));
		expect(sendSpy).toHaveBeenCalledWith("msg", undefined);
	});

	it("detachChannel closes channel and clears buffer", () => {
		const closeSpy = vi.fn();
		adapter.attachChannel({ send: vi.fn(), close: closeSpy });
		adapter.sendMessage("before-detach");
		adapter.detachChannel();
		expect(closeSpy).toHaveBeenCalled();
	});

	it("getBufferedMessages returns readonly view", () => {
		adapter.sendMessage("a");
		adapter.sendMessage("b");
		const msgs = adapter.getBufferedMessages();
		expect(msgs).toHaveLength(2);
		expect(msgs[0]).toBe("a");
	});
});

describe("StoreAgentAdapter - default UISystem", () => {
	it("default ui.notify logs to console with profile prefix", () => {
		const adapter = new StoreAgentAdapter(makeProfile({ prefix: "[test-prefix]" }));
		const spy = vi.spyOn(console, "info").mockImplementation(() => {});
		adapter.ui.notify("hello", "info");
		expect(spy).toHaveBeenCalledWith("[test-prefix] hello");
		spy.mockRestore();
	});

	it("uses profile.ui when provided", () => {
		const customUi: UISystem = {
			notify: vi.fn(),
		};
		const adapter = new StoreAgentAdapter(makeProfile({ ui: customUi }));
		expect(adapter.ui).toBe(customUi);
	});

	it("ui.notify with error level calls console.error", () => {
		const adapter = new StoreAgentAdapter(makeProfile({ prefix: "[p]" }));
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		adapter.ui.notify("fail", "error");
		expect(spy).toHaveBeenCalledWith("[p] fail");
		spy.mockRestore();
	});

	it("ui.notify with warning level calls console.warn", () => {
		const adapter = new StoreAgentAdapter(makeProfile({ prefix: "[p]" }));
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
		adapter.ui.notify("careful", "warning");
		expect(spy).toHaveBeenCalledWith("[p] careful");
		spy.mockRestore();
	});
});

describe("StoreAgentAdapter - buffer FIFO limit", () => {
	it("keeps at most 32 messages (SEND_BUFFER_LIMIT)", () => {
		const adapter = new StoreAgentAdapter(makeProfile());
		for (let i = 0; i < 40; i++) {
			adapter.sendMessage(`msg-${i}`);
		}
		const buffered = adapter.getBufferedMessages();
		expect(buffered).toHaveLength(32);
		expect(buffered[0]).toBe("msg-8");
		expect(buffered[31]).toBe("msg-39");
	});
});

describe("StoreAgentAdapter - clearBuffer (protected)", () => {
	it("clearBuffer is accessible for subclasses via type assertion in tests", () => {
		const adapter = new StoreAgentAdapter(makeProfile());
		adapter.sendMessage("a");
		adapter.sendMessage("b");
		(adapter as unknown as { clearBuffer(): void }).clearBuffer();
		expect(adapter.getBufferedMessages()).toHaveLength(0);
	});
});
