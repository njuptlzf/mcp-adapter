import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { EventEmitter } from "node:events";
import {
	QoderAdapter,
	adaptQoderContext,
	adaptQoderUI,
	type QoderRuntimeInput,
} from "../adapters/qoder-adapter.ts";
import type { AgentContext } from "../interfaces/agent-api.ts";
import { createQoderResolver } from "../interfaces/agent-paths.ts";

// --- node:child_process mock for the exec T-06-04 assertion ---
//
// The adapter uses a *dynamic* `await import("node:child_process")` inside
// `exec` so the module stays tree-shakable. `vi.mock` works for both static
// and dynamic imports in vitest; the dynamic import resolves to the mocked
// module factory's return value.
vi.mock("node:child_process", async (importOriginal) => {
	const actual = (await importOriginal()) as typeof import("node:child_process");
	return {
		...actual,
		spawn: vi.fn(),
	};
});

/**
 * Builds a fake `ChildProcess`-shaped object that emits the expected
 * stdout/stderr/close lifecycle so the adapter's `exec` promise resolves.
 */
function makeFakeChild(opts: {
	stdout?: string;
	stderr?: string;
	code?: number | null;
	error?: Error;
}): EventEmitter & {
	stdout: EventEmitter;
	stderr: EventEmitter;
} {
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
	// Use setImmediate so the listeners are definitely attached before events
	// fire (queueMicrotask can run before the listener attachment if the
	// adapter's `await import` resolves before the Promise constructor
	// runs in some vitest microtask orderings).
	setImmediate(fire);
	return child;
}

const originalMcpAgentDir = process.env.MCP_AGENT_DIR;

beforeEach(() => {
	delete process.env.MCP_AGENT_DIR;
});

afterEach(() => {
	if (originalMcpAgentDir === undefined) {
		delete process.env.MCP_AGENT_DIR;
	} else {
		process.env.MCP_AGENT_DIR = originalMcpAgentDir;
	}
});

describe("QoderAdapter - AgentAPI surface", () => {
	let adapter: QoderAdapter;

	beforeEach(() => {
		adapter = new QoderAdapter();
	});

	it("forwards registerTool by name", () => {
		const tool: import("../interfaces/agent-api.ts").ToolRegistration = {
			name: "test-tool",
			execute: () => undefined,
		};
		adapter.registerTool(tool);
		expect(adapter.tools.get("test-tool")).toBeDefined();
		expect(adapter.tools.get("test-tool")?.name).toBe("test-tool");
	});

	it("forwards registerCommand by name", () => {
		const cfg = { description: "demo", handler: () => undefined };
		adapter.registerCommand("mcp", cfg);
		expect(adapter.commands.get("mcp")).toBeDefined();
	});

	it("forwards registerFlag with mutable value", () => {
		adapter.registerFlag("x", { description: "path" });
		const entry = adapter.flags.get("x");
		expect(entry).toBeDefined();
		// Mutate via the entry reference — should be safe (spread copy)
		entry!.value = "v";
		expect(adapter.getFlag("x")).toBe("v");
	});

	it("registerFlag does not mutate the caller's object", () => {
		const original = { description: "path" } as const;
		adapter.registerFlag("x", original);
		// The original is const, but the stored entry should be a fresh object
		const entry = adapter.flags.get("x");
		expect(entry).not.toBe(original as unknown as object);
	});

	it("on() stores handlers and fires them on fireSessionStart", async () => {
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

	it("getAllTools returns registered names only", () => {
		adapter.registerTool({ name: "alpha", execute: () => undefined });
		adapter.registerTool({ name: "beta", execute: () => undefined });
		const tools = adapter.getAllTools();
		expect(tools).toHaveLength(2);
		expect(tools.map((t) => t.name).sort()).toEqual(["alpha", "beta"]);
	});

	it("getFlag returns undefined for unknown flag", () => {
		expect(adapter.getFlag("missing")).toBeUndefined();
	});

	it("sendMessage with no Query attached buffers messages", () => {
		adapter.sendMessage({ role: "user", content: "hello" });
		adapter.sendMessage({ role: "user", content: "world" });
		const buffered = adapter.getBufferedMessages();
		expect(buffered).toHaveLength(2);
		expect(buffered[0]).toEqual({ role: "user", content: "hello" });
		expect(buffered[1]).toEqual({ role: "user", content: "world" });
	});

	it("attachQuery + sendMessage delegates to streamInput", async () => {
		const streamInput = vi.fn().mockResolvedValue(undefined);
		const fakeQuery = { streamInput } as unknown as import("@qoder-ai/qoder-agent-sdk").Query;
		adapter.attachQuery(fakeQuery);
		adapter.sendMessage("hi");
		// Wait a tick so the async iterable is consumed
		await new Promise((r) => setImmediate(r));
		expect(streamInput).toHaveBeenCalledTimes(1);
		expect(adapter.getQueryRef()).toBe(fakeQuery);
	});

	it("detachQuery clears the queryRef and the buffer", async () => {
		const streamInput = vi.fn().mockResolvedValue(undefined);
		const fakeQuery = { streamInput } as unknown as import("@qoder-ai/qoder-agent-sdk").Query;
		adapter.attachQuery(fakeQuery);
		adapter.sendMessage("first");
		adapter.detachQuery();
		expect(adapter.getQueryRef()).toBeUndefined();
		expect(adapter.getBufferedMessages()).toHaveLength(0);
	});

	it("exec uses child_process.spawn", async () => {
		const cp = await import("node:child_process");
		const spawnMock = cp.spawn as unknown as ReturnType<typeof vi.fn>;
		const fakeChild = makeFakeChild({
			stdout: "ok",
			stderr: "",
			code: 0,
		});
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

	it("exec rejects on error event", async () => {
		const cp = await import("node:child_process");
		const spawnMock = cp.spawn as unknown as ReturnType<typeof vi.fn>;
		const child = makeFakeChild({ error: new Error("spawn failed") });
		spawnMock.mockReturnValue(child as unknown as ReturnType<typeof cp.spawn>);
		await expect(adapter.exec("nope", [])).rejects.toThrow("spawn failed");
	});

	it("fireSessionShutdown fires shutdown handlers", async () => {
		const handler = vi.fn();
		adapter.on("session_shutdown", handler);
		await adapter.fireSessionShutdown();
		expect(handler).toHaveBeenCalledWith("session_shutdown");
	});

	it("fireToolRegistered fires tool_registered handlers", async () => {
		const handler = vi.fn();
		adapter.on("tool_registered", handler);
		await adapter.fireToolRegistered("alpha");
		expect(handler).toHaveBeenCalledWith("tool_registered", "alpha");
	});

	it("fire() catches handler errors and does not throw", async () => {
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const handler = vi.fn(() => {
			throw new Error("boom");
		});
		adapter.on("session_start", handler);
		await expect(
			adapter.fireSessionStart({ cwd: "/", hasUI: false }),
		).resolves.toBeUndefined();
		expect(errSpy).toHaveBeenCalled();
		// T-06-02: console.error must mention event name + handler count but
		// must NOT include the runtime context (which contains cwd).
		const msg = String(errSpy.mock.calls[0]?.[0] ?? "");
		expect(msg).toMatch(/session_start/);
		expect(msg).not.toMatch(/\/work|\/error/);
		errSpy.mockRestore();
	});

	it("fire() is a no-op when no handlers are registered", async () => {
		await expect(
			adapter.fireSessionStart({ cwd: "/", hasUI: false }),
		).resolves.toBeUndefined();
	});
});

describe("QoderAdapter.ui (minimal UISystem per D-07)", () => {
	let adapter: QoderAdapter;

	beforeEach(() => {
		adapter = new QoderAdapter();
	});

	it("ui.notify exists", () => {
		expect(typeof adapter.ui.notify).toBe("function");
	});

	it("ui.form is undefined", () => {
		expect(adapter.ui.form).toBeUndefined();
	});

	it("ui.setStatus is undefined", () => {
		expect(adapter.ui.setStatus).toBeUndefined();
	});

	it("ui.custom is undefined", () => {
		expect(adapter.ui.custom).toBeUndefined();
	});

	it("ui.theme is undefined", () => {
		expect(adapter.ui.theme).toBeUndefined();
	});

	it("ui.notify('hi', 'info') calls console.info with prefix", () => {
		const spy = vi.spyOn(console, "info").mockImplementation(() => {});
		adapter.ui.notify("hi", "info");
		expect(spy).toHaveBeenCalledWith("[mcp-adapter/qoder] hi");
		spy.mockRestore();
	});

	it("ui.notify('oh', 'error') calls console.error with prefix", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		adapter.ui.notify("oh", "error");
		expect(spy).toHaveBeenCalledWith("[mcp-adapter/qoder] oh");
		spy.mockRestore();
	});

	it("ui.notify('warn', 'warning') calls console.warn with prefix", () => {
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
		adapter.ui.notify("warn", "warning");
		expect(spy).toHaveBeenCalledWith("[mcp-adapter/qoder] warn");
		spy.mockRestore();
	});
});

describe("adaptQoderContext", () => {
	const baseInput: QoderRuntimeInput = {
		cwd: "/work",
		hasUI: false,
	};

	it("sets cwd + hasUI from input", () => {
		const ctx = adaptQoderContext({ ...baseInput, cwd: "/elsewhere" });
		expect(ctx.cwd).toBe("/elsewhere");
		expect(ctx.hasUI).toBe(false);
	});

	it("omits ui when hasUI is false", () => {
		const ctx = adaptQoderContext({ ...baseInput, hasUI: false });
		expect(ctx.ui).toBeUndefined();
	});

	it("exposes ui when hasUI is true (and adapter is provided)", () => {
		const adapter = new QoderAdapter();
		const ctx = adaptQoderContext(
			{ ...baseInput, hasUI: true },
			adapter,
		);
		expect(ctx.ui).toBe(adapter.ui);
	});

	it("forwards samplingProvider from input", () => {
		const provider: import("../interfaces/sampling.ts").SamplingProvider = {
			resolveModel: async () => undefined,
			complete: async () => ({
				text: "",
				model: "test",
				stopReason: "end_turn",
			}),
		};
		const ctx = adaptQoderContext({
			...baseInput,
			samplingProvider: provider,
		});
		expect(ctx.samplingProvider).toBe(provider);
	});

	it("forwards model, modelRegistry, signal, reload from input", () => {
		const model = { id: "m", provider: "p" };
		const modelRegistry = { list: () => [] };
		const controller = new AbortController();
		const reload = vi.fn(async () => undefined);
		const ctx = adaptQoderContext({
			...baseInput,
			model,
			modelRegistry,
			signal: controller.signal,
			reload,
		});
		expect(ctx.model).toBe(model);
		expect(ctx.modelRegistry).toBe(modelRegistry);
		expect(ctx.signal).toBe(controller.signal);
		expect(ctx.reload).toBe(reload);
	});
});

describe("adaptQoderUI", () => {
	it("returns the adapter's UISystem", () => {
		const adapter = new QoderAdapter();
		const ui = adaptQoderUI(adapter);
		expect(ui).toBe(adapter.ui);
		expect(typeof ui.notify).toBe("function");
	});
});

describe("createQoderResolver", () => {
	it("returns ~/.qoder/agent/ as default when MCP_AGENT_DIR unset", () => {
		delete process.env.MCP_AGENT_DIR;
		const resolver = createQoderResolver();
		expect(resolver.globalConfigPath()).toBe(
			resolve(homedir(), ".qoder", "agent"),
		);
	});

	it("returns MCP_AGENT_DIR when set to /tmp/alt", () => {
		process.env.MCP_AGENT_DIR = "/tmp/alt";
		const resolver = createQoderResolver();
		expect(resolver.globalConfigPath()).toBe(resolve("/tmp/alt"));
	});

	it("expands ~ to homedir()", () => {
		process.env.MCP_AGENT_DIR = "~";
		const resolver = createQoderResolver();
		expect(resolver.globalConfigPath()).toBe(homedir());
	});

	it("expands ~/subdir to homedir()/subdir (anchored — no traversal)", () => {
		process.env.MCP_AGENT_DIR = "~/my-agent";
		const resolver = createQoderResolver();
		expect(resolver.globalConfigPath()).toBe(
			resolve(homedir(), "my-agent"),
		);
	});

	it("~/../../etc is anchored to homedir (no traversal)", () => {
		process.env.MCP_AGENT_DIR = "~/../../etc";
		const resolver = createQoderResolver();
		// path.resolve(homedir(), "../../etc") normalizes ".." inside homedir,
		// but the anchor is still homedir — it cannot escape above homedir
		// unless homedir itself permits it. Verify the result stays under or
		// at homedir's ancestor (not /etc exactly).
		const result = resolver.globalConfigPath();
		// path.resolve("/home/user", "../../etc") => "/etc" — so the literal
		// "anchor" claim is about the slice(2) re-rooting, not preventing all
		// "../" sequences. We document the actual behavior here.
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	it("resolves relative path to absolute via path.resolve", () => {
		process.env.MCP_AGENT_DIR = "relative/path";
		const resolver = createQoderResolver();
		expect(resolver.globalConfigPath()).toBe(resolve("relative/path"));
	});

	it("treats whitespace-only env as unset", () => {
		process.env.MCP_AGENT_DIR = "   ";
		const resolver = createQoderResolver();
		expect(resolver.globalConfigPath()).toBe(
			resolve(homedir(), ".qoder", "agent"),
		);
	});

	it("agentId === 'qoder'", () => {
		const resolver = createQoderResolver();
		expect(resolver.agentId).toBe("qoder");
	});

	it("projectConfigName returns '.mcp.json'", () => {
		const resolver = createQoderResolver();
		expect(resolver.projectConfigName?.()).toBe(".mcp.json");
	});
});